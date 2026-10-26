import test from 'node:test';
import assert from 'node:assert/strict';
import { StudyService } from '../lib/service.js';
import { privateRoot } from './helpers/model-family-baseline.mjs';
import { mergedTranscript } from './helpers/merged-transcript.mjs';
import { clusteringModel } from './helpers/clustering-model.mjs';
import { settleJob } from './helpers/wait.mjs';

async function world(t) {
  const service = new StudyService(await privateRoot(t, 'material-topup-'), { coverage: { roundLimit: 2 } });
  t.after(() => service.dispose()); service.complete = clusteringModel().complete;
  for (const source of mergedTranscript({ recordings: 1, parts: 5, paragraphs: 2 }).sources) await service.call('source.add', source);
  const view = await service.call('coverage.get', { sourceId: 'audio-batch-vol1' });
  return { service, key: view.key };
}

test('one click covers a zero-deck document in rounds and concurrent clicks start it once', async t => {
  const { service, key } = await world(t);
  const results = await Promise.all([service.call('generate.uncovered', { documentIds: [key] }), service.call('generate.uncovered', { documentIds: [key] })]);
  const started = results.flatMap(r => r.started); assert.equal(started.length, 1);
  assert.equal((await settleJob(service, started[0].jobId)).status, 'complete');
  const state = await service.call('export'), coverage = await service.call('coverage.get', { documentId: key });
  assert.equal(state.decks.length, 0); assert.equal(state.drafts.length, 1);
  assert.equal(coverage.coverage.covered, coverage.coverage.leaves);
  const again = await service.call('generate.uncovered', { documentIds: [key] }); assert.equal(again.started.length, 0); assert.equal(again.skipped.length, 1);
});

test('global document coverage counts unpublished draft questions and leaves them intact', async t => {
  const { service, key } = await world(t);
  const first = await service.call('generate', { sourceIds: ['audio-batch-vol1'], kind: 'quiz', count: 1 });
  assert.equal((await settleJob(service, first.jobId)).status, 'complete');
  const original = (await service.call('export')).drafts[0], before = await service.call('coverage.get', { documentId: key });
  assert.ok(before.coverage.covered > 0 && before.coverage.covered < before.coverage.leaves);
  const started = await service.call('generate.uncovered', { documentIds: [key] }); assert.equal(started.started.length, 1);
  assert.equal((await settleJob(service, started.started[0].jobId)).status, 'complete');
  const state = await service.call('export'), after = await service.call('coverage.get', { documentId: key });
  assert.deepEqual(state.drafts.find(d => d.id === original.id), original);
  assert.equal(after.coverage.covered, after.coverage.leaves);
  assert.equal(state.drafts.reduce((n, d) => n + d.cards.length, 0), after.coverage.leaves, 'no new question for a previously covered section');
});

test('missing and archived documents are reported without starting a job', async t => {
  const { service, key } = await world(t);
  await service.store.update(s => { for (const source of s.sources) source.archived = true; });
  const result = await service.call('generate.uncovered', { documentIds: ['missing', key] });
  assert.equal(result.started.length, 0); assert.equal(result.skipped.length, 2);
});

test('batch topup of a published material keeps the existing deck unchanged', async t => {
  const { service, key } = await world(t);
  const first = await service.call('generate', { sourceIds: ['audio-batch-vol1'], kind: 'quiz', count: 1 }); await settleJob(service, first.jobId);
  const draft = (await service.call('export')).drafts[0];
  const receipt = await service.call('draft.publish.quick', { id: draft.id, draftVersion: draft.draftVersion });
  const before = await service.call('deck.get', { id: receipt.deckId });
  const result = await service.call('generate.uncovered', { documentIds: [key, 'missing'] }); assert.equal(result.started.length, 1); assert.equal(result.skipped.length, 1);
  assert.equal((await settleJob(service, result.started[0].jobId)).status, 'complete');
  assert.deepEqual(await service.call('deck.get', { id: receipt.deckId }), before);
  const added = (await service.call('export')).drafts[0]; assert.equal(added.editorial.part.deckId, before.id);
});

test('a normal generation before its first save reserves the material against bulk topup', async t => {
  const { service, key } = await world(t), complete = service.complete;
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  service.complete = async (...args) => { entered(); await gate; return complete(...args); };
  const first = await service.call('generate', { sourceIds: ['audio-batch-vol1'], kind: 'quiz', count: 1 }); await started;
  let result; try { result = await service.call('generate.uncovered', { documentIds: [key] }); } finally { release(); }
  await settleJob(service, first.jobId); for (const job of result.started) await settleJob(service, job.jobId);
  assert.equal(result.started.length, 0); assert.equal(result.skipped[0].reason, 'in-flight');
});
