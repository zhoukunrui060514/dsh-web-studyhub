/* global document, window -- evaluate callbacks execute in the browser */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { StudyService } from '../../lib/service.js';
import { courseOutlineMaterial } from '../../lib/course-outline-book.js';
import { createPreviewServer } from '../preview-server.mjs';
import { launchChromium } from './browser.mjs';
import { openPage } from './open-page.mjs';

const out = resolve('output/qa/frontend-loop', `run-${Date.now()}`);
await mkdir(out, { recursive: true });
const root = join(out, 'library'), home = join(out, 'home');
const seed = new StudyService(root);
await seed.call('source.add', { id: 'source', title: '循环原文', text: '心输出量等于每搏输出量乘以心率。', courses: ['生理'] });
await seed.call('source.add', { title: '病理资料', text: '炎症反应。', courses: ['病理'] });
await seed.store.update(s => {
  s.inbox.push({ id: 'notice', kind: 'generate-complete', at: new Date().toISOString(), detail: '验收资料已准备好', read: false });
  s.sources.push(courseOutlineMaterial({ title: '生理大纲', course: '生理', fingerprint: '12345678', orderBasis: { codes: ['numbering'] },
    nodes: [{ id: 'circulation', title: '循环', anchors: ['source:source'] }], other: { anchors: [] }, counts: { units: 1, leftover: 0, invalid: 0, repeated: 0 } }));
  s.decks.push({ id: 'deck', title: '循环题组', course: '生理', sourceIds: ['source'], cards: [{ id: 'q', kind: 'quiz', topic: '循环', prompt: '心输出量等于？', citations: [{ sourceId: 'source', quote: '心输出量等于每搏输出量乘以心率。' }], options: [{ id: 'A', text: '每搏量乘心率', correct: true }, { id: 'B', text: '每搏量除心率', correct: false }] }] });
});
await seed.call('focus.set', { course: '生理' });
await seed.dispose();
const server = await createPreviewServer({ libraryRoot: root, home, port: 0 });
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const top = () => page.locator('.study-app').first().evaluate(el => el.scrollTo({ top: 0 }));
const shot = async name => {
  await page.locator('main').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: join(out, name) });
};
const errors = []; page.on('pageerror', error => errors.push(error.message));
const call = async (action, args = {}) => {
  const response = await fetch(`${server.url}/api/call`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Study-Token': server.token }, body: JSON.stringify({ action, args }) });
  const value = await response.json(); assert.equal(value.ok, true, JSON.stringify(value)); return value.value;
};
const report = { steps: [], out };
const step = async (name, fn) => { await fn(); report.steps.push(name); console.log(`ok ${name}`); };
try {
  await page.goto(server.url);
  await step('today uses backend decision', async () => { await page.getByTestId('loop-today').waitFor(); await page.getByRole('heading', { name: '学习下一批知识' }).waitFor(); await page.getByRole('progressbar', { name: '今日学习进度' }).waitFor(); await shot('today.png'); });
  await step('curriculum and explicit session start', async () => {
    await openPage(page, 'book'); await page.getByRole('heading', { name: '循环', exact: true }).waitFor();
    await top(); await shot('curriculum.png');
    await page.getByRole('button', { name: '学这个知识点' }).click(); await page.getByRole('dialog').waitFor();
    await page.getByRole('textbox', { name: '讲解笔记' }).fill('心输出量是每搏量乘心率');
    await page.getByRole('button', { name: '保存并继续' }).click(); await page.getByRole('textbox', { name: '用自己的话复述' }).waitFor();
  });
  await step('failed save preserves input, retry succeeds', async () => {
    const field = page.getByRole('textbox', { name: '用自己的话复述' }); await field.fill('我可以用乘法解释循环');
    let rejected = false;
    await page.route('**/api/call', async route => {
      const body = route.request().postDataJSON();
      if (!rejected && body.action === 'learning.session.record') { rejected = true; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '保存暂时失败', code: 'TEST_SAVE' }) }); }
      else await route.continue();
    });
    await page.getByRole('button', { name: '保存笔记', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '保存暂时失败' }).waitFor();
    assert.equal(await field.inputValue(), '我可以用乘法解释循环');
    await page.getByRole('button', { name: '重新读取进度' }).click();
    await page.waitForResponse(response => response.url().endsWith('/api/call') && response.request().postDataJSON()?.action === 'learning.session.get');
    assert.equal(await field.inputValue(), '我可以用乘法解释循环');
    await page.unroute('**/api/call');
    let advanceLost = false;
    await page.route('**/api/call', async route => {
      if (!advanceLost && route.request().postDataJSON()?.action === 'learning.session.advance') {
        advanceLost = true; await route.fetch();
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '推进响应丢失', code: 'TEST_RESPONSE_LOST' }) });
      } else await route.continue();
    });
    await page.getByRole('button', { name: '保存并继续' }).click(); await page.getByRole('alert').filter({ hasText: '推进响应丢失' }).waitFor();
    assert.equal(await field.inputValue(), '我可以用乘法解释循环');
    await page.getByRole('button', { name: '保存并继续' }).click(); await page.getByRole('button', { name: '开始练习', exact: true }).waitFor();
    await page.unroute('**/api/call');
  });
  await step('real question answer, resume, summary', async () => {
    await page.getByRole('button', { name: '开始练习', exact: true }).click(); await page.locator('.options .option').first().waitFor();
    await page.locator('.options .option', { hasText: '每搏量乘心率' }).click();
    const submit = page.getByRole('button', { name: '提交答案', exact: true }); if (await submit.count()) await submit.click();
    await page.locator('.options .option.correct').first().waitFor();
    await openPage(page, 'library'); await page.getByRole('heading', { name: '继续上次的学习' }).waitFor();
    await page.getByTestId('loop-today').getByRole('button', { name: '开始', exact: true }).click();
    await page.getByRole('button', { name: '作答完成，进入总结' }).click();
    await page.getByRole('textbox', { name: '这次学到了什么' }).fill('我能用每搏量和心率解释心输出量');
    await page.getByRole('button', { name: '保存并结束' }).click();
    await page.getByRole('dialog').getByText('生理 · 已完成').waitFor();
    await shot('session.png');
    await page.keyboard.press('Escape');
  });
  await step('records refresh reads persisted facts', async () => {
    await openPage(page, 'records'); await page.getByRole('heading', { name: '学习记录', exact: true }).last().waitFor();
    await page.getByRole('button', { name: '打开学习会话' }).first().waitFor();
    await page.reload(); await openPage(page, 'records');
    await page.getByRole('button', { name: '打开学习会话' }).first().click();
    await page.getByRole('dialog').getByText('生理 · 已完成').waitFor(); await page.keyboard.press('Escape');
    await top(); await shot('records.png');
    await page.getByRole('button', { name: '查看记录详情' }).first().click();
    await page.locator('.loop-detail').getByText('我能用每搏量和心率解释心输出量', { exact: true }).waitFor();
    const state = await call('learning.records.query', { scope: { kind: 'all' } });
    assert.ok(state.items.some(item => item.type === 'session' && item.status === 'completed'));
    assert.ok(state.items.some(item => item.type === 'attempt'));
  });
  await step('late curriculum response cannot overwrite another course', async () => {
    let release, entered, finished, intercepted = false;
    const held = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const handled = new Promise(resolve => { finished = resolve; });
    await page.route('**/api/call', async route => {
      if (!intercepted && route.request().postDataJSON()?.action === 'curriculum.get') { intercepted = true; const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); finished(); }
      else await route.continue();
    });
    await openPage(page, 'book'); await held;
    await page.locator('.top-course').getByRole('combobox').click(); await page.getByRole('option', { name: '病理', exact: true }).click();
    await page.locator('.top-course').getByText('病理', { exact: true }).waitFor();
    release(); await handled; await page.unroute('**/api/call');
    await page.getByRole('heading', { name: '这门课还没有大纲' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: '循环', exact: true }).count(), 0);
  });
  await step('scope changes and activity', async () => {
    await call('focus.set', { course: '*' }); await page.reload(); await openPage(page, 'book');
    await page.getByText('请在顶栏选择一门课程，查看它的大纲。').waitFor();
    await openPage(page, 'tasks'); await page.getByRole('heading', { name: '活动中心', exact: true }).waitFor();
    await page.getByRole('heading', { name: '验收资料已准备好' }).waitFor();
    await page.getByRole('button', { name: '标为已读', exact: true }).click();
    await page.getByText('通知已读', { exact: true }).waitFor();
    assert.equal((await call('activity.query')).items[0].notifications[0].read, true);
    await shot('activity.png');
    await page.setViewportSize({ width: 390, height: 844 }); await openPage(page, 'records'); await top();
    await shot('narrow.png');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.body.style.zoom = '2'; }); await top();
    await shot('zoom-200.png');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  });
  assert.deepEqual(errors, []); report.ok = true;
} catch (error) { report.ok = false; report.error = error.stack; await page.screenshot({ path: join(out, 'failure.png') }); }
finally { await browser.close(); await server.close(); await writeFile(join(out, 'summary.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report)); if (!report.ok) process.exitCode = 1;
