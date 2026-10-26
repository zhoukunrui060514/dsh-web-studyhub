import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { buildPreview } from '../scripts/build.mjs';
import { createPreviewServer, previewCall } from '../scripts/preview-server.mjs';
import { launchChromium } from '../scripts/qa/browser.mjs';
import { openPage } from '../scripts/qa/open-page.mjs';

test('sidebar inbox reads a complete explanation without practice; material topup is one click in the current course', { timeout: 60000 }, async t => {
  const out = await mkdtemp(join(tmpdir(), 'material-inbox-')), root = join(out, 'library'); let browser, server;
  t.after(async () => { await browser?.close(); await server?.close(); await rm(out, { recursive: true, force: true }); });
  const seed = new StudyService(root);
  await seed.store.update(s => {
    s.sources.push({ id: 'a', title: '生理讲义', text: '# 稳态\n\n负反馈通过反向调节纠正生理变量的偏差，维持内环境稳定。'.repeat(8), format: 'md', courses: ['生理'] },
      { id: 'b', title: '药理讲义', text: '药物通过与靶点相互作用改变机体功能。'.repeat(12), format: 'md', courses: ['药理'] });
    s.decks.push({ id: 'd', title: '生理题组', course: '生理', cards: [{ id: 'c', kind: 'flashcard', topic: '负反馈', prompt: '什么是负反馈？', answer: '反向调节', explanation: '维持稳态。', citations: [] }] });
  });
  await seed.call('focus.set', { course: '生理' });
  await seed.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '讲清楚调节过程', answer: '# 调节机制\n\n' + '完整讲解。'.repeat(250) + '\n\n讲解结束标记', source: 'assistant' }); await seed.dispose();
  await buildPreview({ outdir: join(out, 'dist') }); server = await createPreviewServer({ libraryRoot: root, home: join(out, 'home'), port: 0, model: 'fake', distDir: join(out, 'dist') });
  const api = (action, args = {}) => previewCall(server, action, args), before = await api('export');
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(12000);
  const errors = [], batches = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', req => { try { const data = req.postDataJSON(); if (data?.action === 'generate.uncovered') batches.push(data.args); } catch { /* static requests */ } });
  await page.goto(server.url); await page.locator('.sidebar').waitFor(); const later = page.getByRole('button', { name: '以后再说' }); if (await later.count()) await later.click();
  await page.locator('.sidebar [data-tour="nav-inbox"]').click(); await page.locator('.mailbox__item').first().click();
  await page.locator('.inbox-reading').waitFor(); await page.getByText('讲解结束标记', { exact: true }).waitFor();
  assert.equal(await page.getByText('讲清楚调节过程', { exact: true }).isVisible(), false, 'raw request context is folded while the explanation leads');
  await page.waitForTimeout(350); await page.screenshot({ path: 'output/qa/material-inbox-reader.png' });
  assert.equal(await page.locator('.topbar .mailbox__toggle').count(), 0); assert.equal(await page.locator('.study-app').getAttribute('data-usage-area'), 'inbox');
  const after = await api('export'); assert.deepEqual(after.runs, before.runs); assert.deepEqual(after.attempts, before.attempts);
  await page.getByRole('button', { name: '返回信箱', exact: true }).click(); await page.locator('.mailbox__item').first().waitFor();
  await openPage(page, 'sources'); const start = page.getByRole('button', { name: '一键补齐未覆盖', exact: true });
  await start.evaluate(el => { el.click(); el.click(); }); await page.getByText(/已启动.*份资料/).first().waitFor();
  assert.equal(batches.length, 1); const groups = await api('coverage.get', { sourceId: 'a' }); assert.deepEqual(batches[0].documentIds, [groups.key]);
  await page.screenshot({ path: 'output/qa/material-topup-page.png' });
  assert.deepEqual(errors, []);
});
