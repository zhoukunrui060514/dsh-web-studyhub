import test from 'node:test';
import assert from 'node:assert/strict';
import { StudyService } from '../lib/service.js';
import { privateRoot } from './helpers/model-family-baseline.mjs';
import { settleJob } from './helpers/wait.mjs';
import { imageLibrary } from './helpers/image-library.mjs';
import { aiBlocks } from '../lib/course-book-ai-text.js';
import { PNG } from './helpers/book-image.mjs';
import { switchOptions } from './helpers/runtime-switch.mjs';
import { writeAiBlock } from '../lib/course-book-ai.js';
import { planAi } from '../lib/contexts/generation/book-ai/plan.js';
async function world(t, generate) {
  const root = await privateRoot(t, 'book-image-'), complete = async () => JSON.stringify({ text: 'Mechanism explanation', quotes: [], extra: [], figurePlan: { prompt: 'A causal mechanism', caption: 'Causal chain', alt: 'Causal chain diagram' } });
  const service = new StudyService(root, { complete, ...switchOptions('runtime', { complete, paths: [] }), imageModel: { route: { provider: 'test', model: 'gpt-image-2' }, generate } }); t.after(() => service.dispose());
  const { state } = imageLibrary(); await service.store.update(s => { s.sources = state.sources; s.decks = state.decks; s.focus = state.focus; });
  const book = await service.call('course.book.open'); const point = book.nodes[0].children[0];
  return { root, service, point, args: { course: book.course, heading: point.hid, words: 'writes each decision down', requestId: 'image-one' }, open: () => service.call('course.book.open') };
}
test('manual figure has a unified job, immutable asset and durable replay without another request', async t => {
  let calls = 0; const w = await world(t, async () => { calls++; return { bytes: PNG, mime: 'image/png', usage: null }; });
  const first = await w.service.call('generation.courseBook.illustrate', w.args);
  const job = await settleJob(w.service, first.jobId); assert.equal(job.status, 'complete', JSON.stringify(job));
  const [block] = aiBlocks((await w.open()).nodes[0].children[0].mine);
  assert.match(block.body, /studyhub:\/\/asset\/[a-f0-9]{64}/); assert.equal(block.metadata.route.model, 'gpt-image-2'); assert.equal(calls, 1);
  const again = await w.service.call('generation.courseBook.illustrate', w.args); assert.equal(again.blockId, first.blockId); assert.equal(calls, 1);
  await assert.rejects(w.service.call('generation.courseBook.illustrate', { ...w.args, instruction: 'another' }), { code: 'image-request-conflict' });
  const fresh = await w.service.call('generation.courseBook.illustrate', { ...w.args, requestId: 'new-generation' }); await settleJob(w.service, fresh.jobId); assert.equal(calls, 2);
});
test('a changed source rejects publication; an unrelated own-file edit does not', async t => {
  let release; const held = new Promise(r => { release = r; }); let arrived; const entered = new Promise(r => { arrived = r; });
  const w = await world(t, async () => { arrived(); await held; return { bytes: PNG }; });
  const first = await w.service.call('generation.courseBook.illustrate', w.args); await entered;
  await w.service.store.update(s => { s.sources.find(x => x.id === 'document-l1-p1').text += '\nActual source changed'; }); release();
  assert.equal((await settleJob(w.service, first.jobId)).status, 'failed'); assert.equal(aiBlocks((await w.open()).nodes[0].children[0].mine).length, 0);
});
test('text commits before its automatic child; failed image preserves text and handoff', async t => {
  const w = await world(t, async () => { throw new Error('offline'); });
  const first = await w.service.call('generation.courseBook.explain', { ...w.args, requestId: 'text', allowFigure: true });
  assert.equal((await settleJob(w.service, first.jobId)).status, 'complete');
  const [block] = aiBlocks((await w.open()).nodes[0].children[0].mine); assert.match(block.body, /Mechanism explanation/); assert.ok(block.metadata.handoff.requestId); assert.match(block.metadata.handoff.expectedBlockRevision, /^[a-f0-9]{64}$/);
});

test('automatic figure hashes the saved text block after instruction clipping', async t => {
  let calls = 0;
  const w = await world(t, async () => { calls++; return { bytes: PNG }; });
  const text = await w.service.call('generation.courseBook.explain', { ...w.args, mode: 'here', instruction: '说明机制'.repeat(100), allowFigure: true });
  assert.equal((await settleJob(w.service, text.jobId)).status, 'complete');
  const [block] = aiBlocks((await w.open()).nodes[0].children[0].mine);
  assert.equal(block.ask.length, 300);
  const child = await w.service.call('generation.courseBook.imageStatus', { requestId: block.metadata.handoff.requestId });
  assert.ok(child.jobId, 'a valid saved explanation must submit its child');
  assert.equal((await settleJob(w.service, child.jobId)).status, 'complete');
  assert.equal(calls, 1);
});

test('persisted handoff carries the exact child request for save-only retry', async t => {
  let calls = 0;
  const w = await world(t, async () => { calls++; return { bytes: PNG }; });
  const update = w.service.store.update.bind(w.service.store);
  let failed = false;
  w.service.store.update = (fn, ...rest) => update(async state => {
    const result = await fn(state);
    if (!failed && state.sources.some(s => Object.values(s.bookDoc?.files || {}).some(f => aiBlocks(f.text).some(b => b.metadata?.kind === 'figure')))) {
      failed = true; throw new Error('injected one-time publication failure');
    }
    return result;
  }, ...rest);
  const text = await w.service.call('generation.courseBook.explain', { ...w.args, instruction: 'Explain the mechanism', language: 'en', allowFigure: true });
  assert.equal((await settleJob(w.service, text.jobId)).status, 'complete');
  const [block] = aiBlocks((await w.open()).nodes[0].children[0].mine), handoff = block.metadata.handoff;
  const child = await w.service.call('generation.courseBook.imageStatus', { requestId: handoff.requestId });
  assert.equal((await settleJob(w.service, child.jobId)).status, 'failed');
  assert.equal((await w.service.call('generation.courseBook.imageStatus', { requestId: handoff.requestId })).status, 'result');
  // Same shape as FigureControls, including the saved canonical fields overriding display text.
  const retry = await w.service.call('generation.courseBook.illustrate', { course: w.args.course, heading: w.args.heading, words: block.about, after: block.id, instruction: handoff.figurePlan.prompt, ...handoff });
  assert.equal((await settleJob(w.service, retry.jobId)).status, 'complete');
  assert.equal(calls, 1);
});
test('target guards allow unrelated edits, reject missing replacements and reconcile a lost publication response', async t => {
  const w = await world(t, async () => ({ bytes: PNG })), state = structuredClone(await w.service.store.read()), plan = planAi(state, w.args);
  const args = { course: plan.course, leafId: plan.leaf.id, id: 'one', at: plan.at, about: plan.about, body: 'body', mode: 'explain', guard: plan.guard, receiptId: 'receipt', metadata: { receiptId: 'receipt' } };
  const doc = state.sources.find(s => s.bookDoc).bookDoc;
  doc.files[w.point.files.mine].text += '\nAn unrelated own note.';
  assert.equal(writeAiBlock(state, args).status, 'written');
  const version = doc.files[w.point.files.mine].version;
  assert.equal(writeAiBlock(state, args).before, null); assert.equal(doc.files[w.point.files.mine].version, version);
  assert.throws(() => writeAiBlock(state, { ...args, id: 'two', receiptId: 'new', replace: 'gone' }), { code: 'course-book-target-stale' });
  const parentPlan = planAi(state, { ...w.args, after: 'one' });
  doc.files[w.point.files.mine].text = '';
  assert.throws(() => writeAiBlock(state, { ...args, id: 'child', receiptId: 'child', after: 'one', guard: parentPlan.guard }), { code: 'course-book-target-stale' });
});
test('an unknown paid result is not resent; a new explicit generation can run', async t => {
  let calls = 0; const w = await world(t, async () => { calls++; throw new Error('connection lost'); });
  const first = await w.service.call('generation.courseBook.illustrate', w.args); await settleJob(w.service, first.jobId);
  await assert.rejects(w.service.call('generation.courseBook.illustrate', w.args), { code: 'image-result-unknown' }); assert.equal(calls, 1);
  const fresh = await w.service.call('generation.courseBook.illustrate', { ...w.args, requestId: 'explicit-new' }); await settleJob(w.service, fresh.jobId); assert.equal(calls, 2);
});
