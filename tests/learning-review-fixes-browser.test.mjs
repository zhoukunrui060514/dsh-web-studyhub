/* global document, window -- Playwright evaluation callbacks run in the browser. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { activityQuery } from '../lib/activity.js';
import { buildPreview } from '../scripts/build.mjs';
import { createPreviewServer, previewCall } from '../scripts/preview-server.mjs';
import { launchChromium } from '../scripts/qa/browser.mjs';
import { openPage } from '../scripts/qa/open-page.mjs';

let dist;
before(async () => { dist = await mkdtemp(join(tmpdir(), 'review-fixes-dist-')); await buildPreview({ outdir: dist }); });
after(async () => { if (dist) await rm(dist, { recursive: true, force: true }); });

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'review-fixes-')), root = join(base, 'library');
  let server, browser;
  t.after(async () => { await browser?.close(); await server?.close(); await rm(base, { recursive: true, force: true }); });
  const seed = new StudyService(root);
  try {
    await seed.store.update(state => {
      state.sources.push({ id: 's', title: '审查资料', text: '有效原文', courses: ['审查课程'], format: 'md' });
      state.decks.push({ id: 'd', title: '审查题组', course: '审查课程', sourceIds: ['s'], cards: [
        { id: 'q', kind: 'quiz', topic: '审查主题', prompt: '请选择甲', options: [{ id: 'A', text: '甲', correct: true }, { id: 'B', text: '乙' }], citations: [{ sourceId: 's', quote: '有效原文' }] },
      ] });
    });
  } finally { await seed.dispose(); }
  server = await createPreviewServer({ libraryRoot: root, home: join(base, 'home'), port: 0, model: 'fake', distDir: dist });
  browser = await launchChromium();
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const api = (op, args) => previewCall(server, op, args);
  await api('focus.set', { course: '审查课程' });
  const courseId = (await api('course.list')).courses.find(course => course.name === '审查课程').id;
  const open = async () => {
    await page.goto(server.url);
    await page.locator('.sidebar').first().waitFor();
    const later = page.getByRole('button', { name: '以后再说' });
    if (await later.count()) await later.click();
  };
  return { root, page, api, open, courseId, errors };
}

test('records update in place after a session advances without leaving the page', { timeout: 45000 }, async t => {
  const { page, api, open, courseId, errors } = await fixture(t);
  const session = await api('learning.session.start', { scope: { kind: 'course', courseId }, target: { kind: 'topic', deckId: 'd', topic: '审查主题' }, origin: 'knowledge', requestId: 'record-refresh' });
  await open();
  await openPage(page, 'records');
  const row = page.locator('.loop-row').filter({ has: page.getByRole('heading', { name: '审查主题', exact: true }) }).first();
  await row.waitFor();
  await row.getByRole('button', { name: '查看记录详情', exact: true }).click();
  await row.locator('.loop-detail').waitFor();
  await row.getByRole('button', { name: '打开学习会话' }).click();
  await page.locator('.loop-session textarea').fill('已保存的讲解');
  await page.locator('.loop-session').getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.locator('.loop-session label').filter({ hasText: '用自己的话复述' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal((await api('learning.session.get', { id: session.id })).step, 'retell');
  await page.waitForFunction(() => [...document.querySelectorAll('.loop-row')].some(row => row.textContent.includes('审查主题') && row.textContent.includes('复述 ·')));
  assert.match(await row.innerText(), /复述 · 进行中/);
  await row.locator('.loop-detail').getByText('已保存的讲解', { exact: true }).waitFor();
  await row.getByRole('button', { name: '打开学习会话' }).click();
  await page.locator('.loop-session').getByRole('button', { name: '暂停学习', exact: true }).click();
  await page.locator('.loop-session').getByRole('button', { name: '恢复学习', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => [...document.querySelectorAll('.loop-row')].some(row => row.textContent.includes('审查主题') && row.textContent.includes('已暂停')));
  assert.deepEqual(errors, []);
});

test('reinforcement refreshes when new answers change the library while its page stays open', { timeout: 45000 }, async t => {
  const { page, api, open, errors } = await fixture(t);
  await open();
  await openPage(page, 'wrongbook');
  await page.getByText('当前范围没有待巩固题目。', { exact: true }).waitFor();
  const answer = async selected => {
    const run = await api('review.start', { mode: 'quiz', deckId: 'd', fresh: true });
    await api('review.answer', { runId: run.id, cardId: 'q', selected: [selected] });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  };
  await answer('B');
  await page.locator('.loop-row h2', { hasText: '审查主题' }).waitFor();
  await answer('A');
  await page.getByText('当前范围没有待巩固题目。', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

test('activity keeps historical audio visible but exposes only stopping, while other jobs can retry', { timeout: 45000 }, async t => {
  const { root, page, open, errors } = await fixture(t);
  const activity = activityQuery({ inbox: [], drafts: [] }, [
    { id: 'audio-failed', root, type: 'audio-import', status: 'failed', retryable: true, filename: '失败录音.wav' },
    { id: 'audio-running', root, type: 'audio-import', status: 'running', filename: '进行中录音.wav', control: { values: { paused: true }, limits: {} }, paused: true },
    { id: 'pdf-failed', root, type: 'pdf-convert', status: 'failed', retryable: true, filename: '失败资料.pdf' },
  ], {}, { root });
  await page.route('**/api/call', async route => {
    if (route.request().postDataJSON().action === 'activity.query') await route.fulfill({ json: { ok: true, value: activity } });
    else await route.continue();
  });
  await open();
  await openPage(page, 'tasks');
  const failedAudio = page.locator('.loop-row').filter({ hasText: '失败录音.wav' });
  await failedAudio.waitFor();
  assert.equal(await failedAudio.getByRole('button', { name: '重试', exact: true }).count(), 0);
  const runningAudio = page.locator('.loop-row').filter({ hasText: '进行中录音.wav' });
  assert.equal(await runningAudio.getByRole('button', { name: '继续', exact: true }).count(), 0);
  assert.equal(await runningAudio.getByRole('button', { name: '取消', exact: true }).count(), 1);
  assert.equal(await page.locator('.loop-row').filter({ hasText: '失败资料.pdf' }).getByRole('button', { name: '重试', exact: true }).count(), 1);
  assert.deepEqual(errors, []);
});
