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
import { imageLibrary } from './helpers/image-library.mjs';
import { PNG } from './helpers/book-image.mjs';

test('reading image controls are explicit, single-flight and survive refresh', { timeout: 60000 }, async t => {
  const base = await mkdtemp(join(tmpdir(), 'figure-browser-')), root = join(base, 'library'), dist = join(base, 'dist'); let server, browser;
  t.after(async () => { await browser?.close(); await server?.close(); await rm(base, { recursive: true, force: true }); });
  await buildPreview({ outdir: dist }); const seed = new StudyService(root); const { state } = imageLibrary();
  await seed.store.update(s => { s.sources = state.sources; s.decks = state.decks; s.focus = state.focus; }); await seed.call('course.book.open'); await seed.dispose();
  let calls = 0;
  server = await createPreviewServer({ libraryRoot: root, home: join(base, 'home'), port: 0, model: 'fake', distDir: dist,
    imageModel: { route: { provider: 'test', model: 'gpt-image-2' }, generate: async () => { calls++; await new Promise(r => setTimeout(r, 500)); return { bytes: PNG }; } } });
  const api = (op, args) => previewCall(server, op, args), courseId = (await api('course.list')).courses.find(c => c.name === state.focus.course).id;
  const outline = await api('curriculum.get', { scope: { kind: 'course', courseId }, view: 'structure' });
  await api('learning.session.start', { scope: { kind: 'course', courseId }, target: { kind: 'outline', nodeId: 'what', outlineRevision: outline.outlineRevision }, origin: 'knowledge', requestId: 'browser' });
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(10000);
  const errors = [], traffic = []; page.on('pageerror', e => errors.push(e.message));
  page.on('response', async response => { try { const input = response.request().postDataJSON(); if (input?.action === 'generation.courseBook.imageStatus') traffic.push({ args: input.args, result: await response.json() }); } catch { /* non-RPC response */ } });
  await page.goto(server.url); await page.locator('.sidebar').first().waitFor(); const later = page.getByRole('button', { name: '以后再说' }); if (await later.count()) await later.click();
  await openPage(page, 'records'); await page.getByRole('button', { name: '打开学习会话', exact: true }).first().click();
  const panel = page.locator('.loop-session'), draw = panel.getByRole('button', { name: '画图解释', exact: true }).first(); await draw.waitFor(); assert.equal(calls, 0);
  await draw.evaluate(el => { el.click(); el.click(); });
  await panel.locator('.md-image img').first().waitFor(); assert.equal(calls, 1);
  const scroll = await panel.locator('.loop-reader').evaluate(el => el.scrollTop); await page.waitForTimeout(500); assert.equal(await panel.locator('.loop-reader').evaluate(el => el.scrollTop), scroll);
  await page.reload(); await page.locator('.sidebar').first().waitFor(); await openPage(page, 'records'); await page.getByRole('button', { name: '打开学习会话', exact: true }).first().click();
  await panel.locator('.md-image img').first().waitFor(); assert.equal(calls, 1);
  await page.keyboard.press('Escape'); await openPage(page, 'book');
  await page.getByText('编辑与生成', { exact: true }).click(); await page.getByRole('button', { name: '打开完整阅读编辑器', exact: true }).click();
  await page.locator('[data-book-ask-open]').first().click();
  const ask = page.locator('.book-ask'); await ask.getByText('本次允许配图', { exact: true }).waitFor();
  await ask.getByRole('button', { name: /画图解释|重新画图/ }).click();
  try { await ask.getByRole('button', { name: '重新画图', exact: true }).waitFor(); }
  catch (error) {
    const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('studyhub.figure:')));
    console.log(JSON.stringify({ calls, stored, traffic: traffic.slice(-12), attrs: await ask.locator('[data-figure-controls]').evaluate(el => ({...el.dataset})), statuses: await Promise.all(stored.map(async ([k, v]) => [k, await api('generation.courseBook.imageStatus', { requestId: JSON.parse(v).requestId })])), ask: await ask.count() ? await ask.innerText() : 'closed' })); throw error;
  }
  assert.equal(calls, 2); assert.deepEqual(errors, []);
});
