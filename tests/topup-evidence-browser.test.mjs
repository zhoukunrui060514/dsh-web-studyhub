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

test('material top-up names held PDF pages and leaves them uncovered without starting a job', { timeout: 60000 }, async t => {
  const out = await mkdtemp(join(tmpdir(), 'topup-evidence-ui-')), root = join(out, 'library'); let browser, server;
  t.after(async () => { await browser?.close(); await server?.close(); await rm(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  const seed = new StudyService(root);
  await seed.store.update(s => { s.sources.push(...['第二章 麻醉与神经系统', '脑电图常见的基本波形'].map((text, i) => ({
    id: `p${i + 1}`, title: `生理.pdf · p.${i + 1}`, format: 'pdf', text, courses: ['生理'],
    document: { id: 'physiology', filename: '生理.pdf', page: i + 1, totalPages: 2, sparseText: true },
  }))); });
  await seed.call('focus.set', { course: '生理' }); await seed.dispose();
  await buildPreview({ outdir: join(out, 'dist') });
  server = await createPreviewServer({ libraryRoot: root, home: join(out, 'home'), port: 0, model: 'fake', distDir: join(out, 'dist') });
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url); await page.locator('.sidebar').waitFor();
  const later = page.getByRole('button', { name: '以后再说' }); if (await later.count()) await later.click();
  await openPage(page, 'sources'); await page.getByRole('button', { name: '一键补齐未覆盖', exact: true }).click();
  await page.getByText('已启动 0 份资料，跳过 1 份，失败 0 份。', { exact: true }).waitFor();
  await page.getByText('「生理.pdf」有 2 个页面暂不补题', { exact: true }).click();
  await page.getByText('第 1 页：非考核页面，不强制出题', { exact: true }).waitFor();
  await page.getByText('第 2 页：文字证据不足，请查看原文并补充图表说明', { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator('.material-topup__result').innerText(), /都有题/);
  await page.screenshot({ path: 'output/qa/topup-evidence-pages.png' });
  const state = await previewCall(server, 'export', {}), view = await previewCall(server, 'coverage.get', { sourceId: 'p1' });
  assert.equal(state.drafts.length, 0); assert.equal(view.coverage.covered, 0); assert.equal(view.coverage.percentLeaves, 0);
  assert.deepEqual(errors, []);
});
