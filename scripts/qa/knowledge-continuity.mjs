/* global document, window, requestAnimationFrame */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPreviewServer } from '../preview-server.mjs';
import { launchChromium } from './browser.mjs';
const out = resolve('output/qa/knowledge-continuity');
await mkdir(out, { recursive: true });
const server = await createPreviewServer({ port: 0, libraryRoot: resolve(out, 'library'), home: resolve(out, 'home') });
let browser;
const sleep = ms => new Promise(done => setTimeout(done, ms));
try {
  browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, label: `概念${i}`, definition: `可阅读的定义${i}` }));
  const edges = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, from: 'n0', to: `n${i + 1}`, direction: 'directed', predicate: 'related' }));
  await page.route('**/api/call', async route => {
    const { action, args } = route.request().postDataJSON(); let value;
    if (action === 'knowledge.query') { await sleep(120); const subset = args.focusId ? nodes.slice(0, 6) : nodes; value = { graphRevision: 'fixture', nodes: subset, edges, displayed: { nodes: subset.length, edges: 5 }, totals: { nodes: subset.length, edges: 5 } }; }
    else if (action === 'knowledge.node.get') { await sleep(args.id === 'n1' ? 450 : 160); value = { item: nodes.find(n => n.id === args.id), evidence: [] }; }
    else if (action === 'knowledge.materials') value = { materials: [], courses: [] };
    else if (action === 'knowledge.settings.get') value = { autoBuild: false };
    else return route.continue();
    await route.fulfill({ json: { ok: true, value } });
  });
  await page.goto(server.url);
  await page.getByRole('button', { name: '知识图谱', exact: true }).click();
  await page.getByText('当前显示 30 / 总计 30', { exact: false }).waitFor();
  await page.locator('.knowledge-canvas[data-settled="true"]').waitFor();
  const overviewZoom = await page.locator('.knowledge-zoom').innerText();
  const hitBefore = await page.locator('[data-node-id="n0"] .knowledge-node-hitbox').boundingBox();
  await page.mouse.move(hitBefore.x + hitBefore.width / 2, hitBefore.y + hitBefore.height / 2);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.knowledge-node[data-faded]').count(), 0, 'hover does not dim and relight the entire network');
  const hitAfter = await page.locator('[data-node-id="n0"] .knowledge-node-hitbox').boundingBox();
  assert.ok(Math.abs(hitBefore.width - hitAfter.width) < 1 && Math.abs(hitBefore.height - hitAfter.height) < 1, 'hover labels cannot move their pointer hit area');
  await page.locator('[data-node-id="n0"] .knowledge-node-dot').click();
  await page.locator('.knowledge-detail-content h3').filter({ hasText: '概念0' }).waitFor();
  await page.waitForTimeout(400);
  const inspectZoom = await page.locator('.knowledge-zoom').innerText();
  // A normal concept click must not unexpectedly magnify the entire network.
  assert.equal(inspectZoom, overviewZoom, 'inspection preserves the user zoom');
  await page.evaluate(() => {
    window.knowledgeFrames = []; const until = performance.now() + 1400;
    const sample = () => {
      const canvas = document.querySelector('.knowledge-viewport svg'), panel = document.querySelector('.knowledge-details');
      window.knowledgeFrames.push({ t: performance.now(), transform: canvas.querySelector(':scope > g').getAttribute('transform'), content: !!panel.querySelector('.knowledge-detail-content h3'), busy: panel.getAttribute('aria-busy'), height: panel.getBoundingClientRect().height });
      if (performance.now() < until) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await page.locator('[data-node-id="n1"] .knowledge-node-dot').click();
  await page.locator('.knowledge-details[aria-busy="true"]').waitFor();
  assert.equal(await page.locator('.knowledge-details [inert]').count(), 1, 'previous evidence cannot act on the new selection while pending');
  await page.locator('.knowledge-detail-content h3').filter({ hasText: '概念1' }).waitFor();
  await page.waitForTimeout(1000);
  const frames = await page.evaluate(() => window.knowledgeFrames);
  await writeFile(resolve(out, 'frames.json'), JSON.stringify(frames));
  assert.ok(frames.length > 10);
  assert.ok(frames.every(f => f.content), 'the evidence panel never clears between loaded concepts');
  assert.ok(Math.max(...frames.map(f => f.height)) - Math.min(...frames.map(f => f.height)) < 40, 'evidence panel keeps its reading surface');
  // Fast switching must discard the slower, superseded response.
  await page.locator('[data-node-id="n0"]').press('Enter');
  await page.locator('[data-node-id="n1"]').press('Enter');
  await page.locator('[data-node-id="n2"]').press('Enter');
  await page.locator('.knowledge-detail-content h3').filter({ hasText: '概念2' }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.knowledge-detail-content h3').innerText(), '概念2');
  await page.evaluate(() => {
    window.knowledgeTopologyFrames = []; const until = performance.now() + 900;
    const sample = () => { const node = document.querySelector('[data-node-id="n0"]'), xy = node?.transform.baseVal.consolidate()?.matrix;
      window.knowledgeTopologyFrames.push({ t: performance.now(), x: xy?.e, y: xy?.f });
      if (performance.now() < until) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await page.getByRole('button', { name: '聚焦概念', exact: true }).click();
  const canvasTop = await page.locator('.knowledge-canvas').evaluate(e => e.getBoundingClientRect().top);
  await page.waitForTimeout(30);
  assert.ok(Math.abs(await page.locator('.knowledge-canvas').evaluate(e => e.getBoundingClientRect().top) - canvasTop) < 2, 'query status does not push the canvas down');
  await page.getByText('当前显示 6 / 总计 6', { exact: false }).waitFor();
  await page.locator('.knowledge-canvas[data-settled="true"]').waitFor();
  await page.waitForTimeout(950);
  const topologyFrames = await page.evaluate(() => window.knowledgeTopologyFrames);
  assert.ok(topologyFrames.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)), 'shared concepts never disappear during local focus');
  for (let i = 1; i < topologyFrames.length; i++) {
    const a = topologyFrames[i - 1], b = topologyFrames[i];
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 20 + (b.t - a.t) * 4, 'shared concepts move continuously rather than jumping to a new layout');
  }
  await writeFile(resolve(out, 'topology-frames.json'), JSON.stringify(topologyFrames));
  await page.screenshot({ path: resolve(out, 'desktop.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-node-id="n0"]').press('Enter');
  await page.locator('.knowledge-detail-content h3').filter({ hasText: '概念0' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  console.log('Knowledge continuity passed: preserved zoom, continuous evidence, safe pending controls, rapid switches, local focus and reduced motion.');
} finally { await browser?.close(); await server.close(); }
