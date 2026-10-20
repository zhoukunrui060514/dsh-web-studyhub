/* global document, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPreviewServer, previewCall } from '../preview-server.mjs';
import { launchChromium } from './browser.mjs';
const out = resolve('output/qa/knowledge-preview');
await mkdir(out, { recursive: true });
const server = await createPreviewServer({ port: 0, libraryRoot: resolve(out, 'library'), home: resolve(out, 'home') });
let browser;
try {
  const repeatedText = '第一处前文：相同引文。第一处后文。\n\n第二处前文：相同引文。第二处后文。';
  await previewCall(server, 'source.get', { id: 'kg-repeated' }).catch(() => previewCall(server, 'source.add', { id: 'kg-repeated', title: '重复引文定位验收', text: repeatedText }));
  const actualMaterials = await previewCall(server, 'knowledge.materials');
  const repeatedMaterial = actualMaterials.materials.find(m => m.identity === 'source:kg-repeated');
  let actualEvidence = false;
  const exactCitation = { id: 'exact', materialIdentity: repeatedMaterial.identity, revision: repeatedMaterial.revision, sourceId: 'kg-repeated', quote: '相同引文', start: repeatedText.lastIndexOf('相同引文'), end: repeatedText.lastIndexOf('相同引文') + 4, assertion: 'asserted' };
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, label: `概念${i}`, definition: `定义${i}` }));
  const edges = [{ id: 'e', from: 'n0', to: 'n1', direction: 'directed', predicate: 'promotes', conditions: '正常条件下' }];
  const citation = { id: 'ev', materialIdentity: 'source:x', sourceId: 'x', revision: 'old', quote: '资料原文', assertion: 'inferred', start: 0, end: 4, status: 'stale' };
  const messages = [], sleep = ms => new Promise(done => setTimeout(done, ms));
  await page.route('**/api/call', async route => {
    const { action } = route.request().postDataJSON(); let value;
    if (action === 'knowledge.query') value = { graphRevision: 'fixture', nodes, edges, displayed: { nodes: 300, edges: 1 }, totals: { nodes: 301, edges: 1 } };
    else if (action === 'knowledge.materials') value = actualEvidence ? actualMaterials : { materials: [], courses: [] };
    else if (action === 'knowledge.settings.get') value = { autoBuild: false };
    else if (action === 'knowledge.node.get') value = { item: nodes[0], evidence: [actualEvidence ? exactCitation : citation], versionStatus: actualEvidence ? 'current' : 'stale' };
    else if (action === 'knowledge.edge.get') value = { item: edges[0], evidence: [citation], versionStatus: 'stale' };
    else if (action === 'knowledge.thread.get') value = { threadId: 'fixture-thread', messages };
    else if (action === 'knowledge.ask') { await sleep(600); messages.push({ id: 'a', role: 'assistant', text: '反向查看不改变关系方向。', supplemental: true, citations: [citation] }); value = { threadId: 'fixture-thread', messages, status: 'complete' }; }
    else return route.continue();
    await route.fulfill({ json: { ok: true, value } });
  });
  await page.goto(server.url);
  await page.getByRole('button', { name: '知识图谱', exact: true }).click();
  await page.getByRole('button', { name: '构建／更新', exact: true }).waitFor();
  await page.getByText('当前显示 300 / 总计 301', { exact: false }).waitFor();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.getByRole('button', { name: '概念0', exact: true }).first().click();
  await page.getByText('依据旧版本', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: '针对当前内容提问' }).click();
  await page.getByRole('textbox', { name: '问题', exact: true }).fill('为何不能将反向查看当成因果方向？');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '发送问题', exact: true }).isDisabled(), true);
  await page.getByText('补充解释／资料未直接说明', { exact: true }).waitFor();
  await page.getByRole('button', { name: /查看引用/ }).click();
  await page.getByRole('alert').filter({ hasText: '引用资料已不可用' }).waitFor();
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByRole('button', { name: '概念0', exact: true }).first().click();
  await page.getByRole('button', { name: '针对当前内容提问' }).click();
  await page.getByText('反向查看不改变关系方向。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '从这里选择链路' }).click();
  await page.locator('svg g[role="button"]').filter({ has: page.locator('line') }).first().dispatchEvent('click');
  await page.getByText('按顺序选择链路 (1/12)', { exact: true }).waitFor();
  await page.getByRole('button', { name: '继续展开', exact: true }).click();
  await page.getByText('按顺序选择链路 (1/12)', { exact: true }).waitFor();
  actualEvidence = true;
  await page.getByRole('button', { name: '关闭详情' }).click();
  await page.getByRole('button', { name: '概念0', exact: true }).first().click();
  await page.getByRole('button', { name: '在原文中查看', exact: true }).click();
  await page.locator('.study-document-body').waitFor();
  await page.waitForTimeout(600);
  assert.equal(await page.getByText('引用在资料中出现多次，请结合上下文核对位置。', { exact: true }).count(), 0);
  const highlighted = await page.evaluate(() => {
    const range = [...(window.CSS?.highlights?.get('study-source-quote') || [])][0];
    if (!range) return null;
    const before = document.createRange(); before.selectNodeContents(document.querySelector('.study-document-body')); before.setEnd(range.startContainer, range.startOffset);
    return { quote: range.toString(), before: before.toString() };
  });
  assert.equal(highlighted?.quote, '相同引文'); assert.ok(highlighted.before.includes('第二处前文'), 'second occurrence is highlighted');
  await page.screenshot({ path: resolve(out, 'desktop.png'), fullPage: true });
  for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow ${width}`); }
  await page.screenshot({ path: resolve(out, 'mobile.png'), fullPage: true });
  await writeFile(resolve(out, 'summary.json'), JSON.stringify({ ok: true, displayed: 300, total: 301, widths: [1440, 390] }, null, 2));
  console.log('Knowledge preview passed: bounded graph, controls, desktop/mobile overflow.');
} finally { await browser?.close(); await server.close(); }
