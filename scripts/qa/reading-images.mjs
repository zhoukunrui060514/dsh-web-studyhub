// Real-model acceptance. Originals are read-only; all copies, state and evidence stay in a new output/qa folder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { StudyService } from '../../lib/service.js';
import { courseOutlineMaterial, materialsFingerprint } from '../../lib/course-outline-book.js';
import { buildOutlineIndex } from '../../lib/course-outline-index.js';
import { groupSourcesByDocument } from '../../lib/source-groups.js';
import { courseNotesMaterial } from '../../lib/course-book.js';
import { aiBlocks } from '../../lib/course-book-ai-text.js';
import { createPreviewServer, previewCall } from '../preview-server.mjs';
import { imageModelFromEnv } from '../../lib/image-model.js';
import { launchChromium } from './browser.mjs';
import { openPage } from './open-page.mjs';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = resolve(arg('materials') || 'C:/Users/ZKR/Downloads/全套精炼版本');
const out = resolve(arg('out') || `output/qa/reading-images-${Date.now()}`), root = join(out, 'library');
if (!out.startsWith(resolve('output/qa') + '\\') && !out.startsWith(resolve('output/qa') + '/')) throw new Error('QA output must be inside this checkout output/qa');
const resume = arg('resume') === '1';
const summary = resume ? JSON.parse(await readFile(join(out, 'summary.json'), 'utf8')) : { startedAt: new Date().toISOString(), materials: [], steps: [], setup: 'All PDF originals copied and imported; one source-backed reading scaffold seeded for a focused mechanism test. Explanation and illustration use real configured models.' };
if (resume) { assert.ok(summary.image?.assetId, 'resume requires an already saved real image'); delete summary.error; summary.resumedAt = new Date().toISOString(); }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let server, browser;
await mkdir(join(out, 'inputs'), { recursive: true });
const save = () => writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
try {
  assert.ok(process.env.STUDY_API_KEY, 'STUDY_API_KEY required'); assert.ok(imageModelFromEnv(), 'image capability required');
  const seed = new StudyService(root), course = '隔离验收·麻醉生理学';
  try { if (!resume) {
    for (const name of (await readdir(source)).filter(n => n.toLowerCase().endsWith('.pdf')).sort()) {
      const original = join(source, name), copy = join(out, 'inputs', name), before = hash(await readFile(original));
      await copyFile(original, copy); const doc = await seed.call('materials.document.import', { path: copy, course });
      summary.materials.push({ name, sha256: before, documentId: doc.documentId, projections: doc.sourceIds.length }); console.log(`Imported ${summary.materials.length}: ${name}`);
    }
    assert.equal(summary.materials.length, 14);
    const state = await seed.store.read(), selected = summary.materials.find(m => m.name.includes('血压')) || summary.materials[0];
    const material = state.sources.find(s => s.document?.materialId === selected.documentId && s.text?.length > 300), group = groupSourcesByDocument(state.sources).find(g => g.sourceIds.includes(material.id));
    assert.ok(group); const anchors = [group.key], title = '血压调节机制';
    const outline = courseOutlineMaterial({ title: '隔离验收大纲', course, orderBasis: { codes: ['numbering'] }, fingerprint: materialsFingerprint(buildOutlineIndex(state, { course }).allDocuments),
      nodes: [{ id: 'qa-mechanism', title, anchors }], other: { anchors: [] }, counts: { units: 1, leftover: 0, invalid: 0, repeated: 0 } });
    const notes = courseNotesMaterial({ title: '隔离验收阅读', course, outlineId: outline.id, language: 'zh', papers: [], counts: {}, leaves: [{ id: 'qa-mechanism', title, anchors,
      body: { fingerprint: hash(material.text).slice(0, 16), points: [], explain: material.text.slice(0, 1800), cites: [{ n: 1, sourceId: material.id, quote: material.text.slice(0, 40), start: 0, end: 40 }] } }] });
    await seed.store.update(s => { s.sources.push(outline, notes); }); await seed.call('focus.set', { course }); await seed.call('course.book.open', { course });
    summary.steps.push('14 original PDFs copied/imported'); await save();
  } } finally { await seed.dispose(); }
  server = await createPreviewServer({ libraryRoot: root, home: join(out, 'home'), port: 0,
    model: { apiKey: process.env.STUDY_API_KEY, baseUrl: process.env.STUDY_BASE_URL, model: process.env.STUDY_MODEL }, imageModel: imageModelFromEnv() });
  const api = (action, args = {}) => previewCall(server, action, args);
  async function settled(jobId) {
    for (let i = 0; i < 360; i++) { const job = await api('job.status', { jobId }); if (!['running', 'queued', 'cancelling'].includes(job.status)) { assert.equal(job.status, 'complete', JSON.stringify(job.error)); return job; } await new Promise(r => setTimeout(r, 1000)); }
    throw new Error('QA job timed out');
  }
  const book = await api('course.book.open', { course }), point = book.nodes.find(n => n.leaf), heading = point.hid;
  if (!resume) {
  const text = await api('generation.courseBook.explain', { course, heading, mode: 'here', instruction: '请按照资料讲解血压调节的因果机制，定义关键概念，逐步说明调节过程并指出容易混淆的地方。', allowFigure: true });
  await settled(text.jobId); summary.steps.push('real text explanation saved');
  let current = await api('course.book.open', { course }), explanation = aiBlocks(current.nodes.find(n => n.hid === heading).mine).find(b => b.id === text.blockId);
  assert.ok(explanation?.body.length > 30);
  const handoff = explanation.metadata?.handoff;
  let image;
  if (handoff) { image = await api('generation.courseBook.imageStatus', { requestId: handoff.requestId }); assert.ok(image.jobId, 'automatic handoff did not submit'); }
  else image = await api('generation.courseBook.illustrate', { course, heading, after: text.blockId, requestId: 'qa-manual-figure', instruction: '依据本节资料绘制血压调节的因果箭头示意图，中文标注清楚，强调调节方向。' });
  await settled(image.jobId); current = await api('course.book.open', { course });
  const figure = aiBlocks(current.nodes.find(n => n.hid === heading).mine).find(b => b.metadata?.kind === 'figure'); assert.ok(figure);
  const assetId = /studyhub:\/\/asset\/([a-f0-9]{64})/.exec(figure.body)[1], resource = await api('materials.book.asset.get', { assetId });
  await writeFile(join(out, `mechanism.${resource.mime === 'image/png' ? 'png' : 'webp'}`), Buffer.from(resource.dataBase64, 'base64'));
  summary.image = { assetId, mime: resource.mime, bytes: resource.bytes, route: figure.metadata.route }; summary.steps.push('real figure persisted and read through controlled asset API');
  const exported = await api('export'); assert.ok(exported.portableBookAssets.files.length);
  await api('restore', { state: exported }); assert.equal((await api('materials.book.asset.get', { assetId })).dataBase64, resource.dataBase64);
  summary.steps.push('portable full backup and restore preserved image');
  }
  const markdown = await api('course.book.export', { course, form: 'folder' }); assert.ok(markdown.images?.length); summary.steps.push('Markdown folder includes image reference');
  const courseId = (await api('course.list')).courses.find(c => c.name === course).id, scope = { kind: 'course', courseId };
  const curriculum = await api('curriculum.get', { scope, view: 'structure' });
  const session = await api('learning.session.start', { scope, target: { kind: 'outline', nodeId: 'qa-mechanism', outlineRevision: curriculum.outlineRevision }, origin: 'knowledge', requestId: 'qa-learning' });
  await api('learning.session.finish', { id: session.id, version: session.version, requestId: 'qa-finish' }); summary.steps.push('read-only study can finish without retelling or mastery');
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url); await page.locator('.sidebar').first().waitFor(); const later = page.getByRole('button', { name: '以后再说' }); if (await later.count()) await later.click();
  await openPage(page, 'book'); await page.getByRole('button', { name: '阅读', exact: true }).click();
  try { await page.locator('.loop-reading .md-image-open').first().scrollIntoViewIfNeeded(); await page.locator('.loop-reading .md-image img').first().waitFor(); }
  catch (error) { await page.screenshot({ path: join(out, 'reading-failure.png'), fullPage: true }); await writeFile(join(out, 'reading-failure.txt'), await page.locator('body').innerText()); throw error; }
  await page.screenshot({ path: join(out, 'real-reading.png'), fullPage: true }); assert.deepEqual(errors, []); summary.steps.push('Edge displayed generated illustration without page errors');
  for (const entry of summary.materials) assert.equal(hash(await readFile(join(source, entry.name))), entry.sha256);
  summary.steps.push('all original PDF hashes unchanged'); summary.ok = true;
} catch (error) { summary.ok = false; summary.error = error.message; process.exitCode = 1; }
finally { await browser?.close(); await server?.close(); summary.endedAt = new Date().toISOString(); await save(); console.log(JSON.stringify({ ok: summary.ok, steps: summary.steps, out, error: summary.error })); }
