import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
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

test('learning reads, practices and finishes without mandatory writing', { timeout: 45000 }, async t => {
  const { page, api, open, courseId, errors } = await fixture(t);
  const initial = await api('learning.session.start', { scope: { kind: 'course', courseId }, target: { kind: 'topic', deckId: 'd', topic: '审查主题' }, origin: 'knowledge', requestId: 'reader' });
  await open(); await openPage(page, 'records');
  await page.getByRole('button', { name: '打开学习会话', exact: true }).first().click();
  const panel = page.locator('.loop-session');
  await panel.getByRole('button', { name: '做题检验', exact: true }).waitFor();
  assert.equal(await panel.locator('textarea').count(), 0);
  assert.ok(!/跳过原因|学习依据|用自己的话复述/.test(await panel.innerText()));
  await panel.getByRole('button', { name: '做题检验', exact: true }).click();
  await page.getByRole('button', { name: '返回本次学习', exact: true }).click();
  await panel.getByRole('button', { name: '结束本批', exact: true }).click();
  await panel.getByText('本批结果', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '结束本次学习', exact: true }).click();
  await panel.getByText('已结束', { exact: false }).waitFor();
  assert.equal((await api('learning.session.get', { id: initial.id })).status, 'completed');
  assert.deepEqual(errors, []);
});
