import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudyRuntime } from '../lib/runtime/builtins.js';
import { managedRuntimeOptions } from './helpers/runtime-switch.mjs';
import { until } from './helpers/wait.mjs';
import { reconcileKnowledge } from '../lib/contexts/knowledge/scheduler.js';
import { triggerKnowledgeReconcile, afterKnowledgeMaterialCommit } from '../lib/runtime/knowledge-composition.js';

const response = (_s, p) => { const seg = JSON.parse(p).segments[0]; return JSON.stringify({ nodes: [{ id: 'n', label: seg.text, definition: seg.text, evidence: [{ sourceId: seg.sourceId, quote: seg.text, start: seg.start, end: seg.end, assertion: 'asserted' }] }], edges: [] }); };
async function harness(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-auto-'));
  const runtime = createStudyRuntime(root, { contexts: ['system', 'materials', 'courses', 'knowledge'], ...options });
  t.after(async () => { await runtime.dispose(); await rm(root, { recursive: true, force: true }); });
  return { runtime, root };
}
test('automatic boundary excludes old unchanged inputs; waits durably for executor and submits once when it appears', async t => {
  const { runtime } = await harness(t, { complete: response });
  await runtime.call('source.add', { id: 'old', title: '旧资料', text: '旧' });
  await runtime.storage.update(s => { s.sources[0].createdAt = '2020-01-01T00:00:00Z'; });
  await runtime.call('knowledge.settings.set', { autoBuild: true });
  assert.equal((await runtime.storage.read()).knowledgeMaterials.some(m => m.identity === 'source:old'), false);
  await runtime.call('source.add', { id: 'new', title: '新资料', text: '新' });
  let s = await runtime.storage.read(), waiting = s.knowledgeMaterials.find(m => m.identity === 'source:new');
  assert.equal(waiting.status, 'waiting-executor'); assert.ok(!waiting.jobId);
  const managed = managedRuntimeOptions({ complete: response });
  await triggerKnowledgeReconcile(runtime, 'executor-available', { complete: response, ...managed });
  await until(async () => (await runtime.storage.read()).knowledgeMaterials.find(m => m.identity === 'source:new')?.status === 'complete', 'automatic publish');
  await triggerKnowledgeReconcile(runtime, 'executor-available', { complete: response, ...managed });
  assert.equal(managed.starts(), 1);
  s = await runtime.storage.read(); assert.equal(s.knowledgeMaterials.find(m => m.identity === 'source:new').followAuto, true);
  await runtime.call('knowledge.settings.set', { autoBuild: false });
  await runtime.call('source.add', { id: 'off', title: '关闭后', text: '停' });
  assert.equal((await runtime.storage.read()).knowledgeMaterials.some(m => m.identity === 'source:off'), false);
});

test('restart recovers unaccepted intent, marks orphaned accepted work interrupted, and never schedules from snapshots', async t => {
  const { runtime } = await harness(t);
  await runtime.call('knowledge.settings.set', { autoBuild: true });
  await runtime.call('source.add', { id: 'a', title: 'A', text: '内容' });
  await runtime.storage.update(s => { Object.assign(s.knowledgeMaterials[0], { status: 'queued', claimId: 'old', claimEpoch: 'previous-process', jobId: null }); });
  await triggerKnowledgeReconcile(runtime, 'acquire');
  assert.equal((await runtime.storage.read()).knowledgeMaterials[0].status, 'waiting-model');
  await runtime.storage.update(s => { Object.assign(s.knowledgeMaterials[0], { status: 'extracting', claimId: 'old', claimEpoch: 'previous-process', jobId: 'lost-native-job' }); });
  await triggerKnowledgeReconcile(runtime, 'acquire');
  assert.equal((await runtime.storage.read()).knowledgeMaterials[0].status, 'interrupted');
  const before = (await runtime.storage.read()).knowledgeMaterials;
  await runtime.call('knowledge.query', {}); await runtime.call('knowledge.settings.get', {});
  assert.deepEqual((await runtime.storage.read()).knowledgeMaterials, before);
  assert.equal(typeof reconcileKnowledge, 'function');
});

test('postcommit fault is contained and generated sources cannot self-declare automatic provenance', async t => {
  await assert.doesNotReject(afterKnowledgeMaterialCommit({ runtime: { invoke: async () => { throw new Error('postcommit fault'); } }, installed: true }, { action: 'source.add', result: { sourceIds: ['saved'] } }));
  const { runtime } = await harness(t);
  await runtime.call('knowledge.settings.set', { autoBuild: true });
  const result = await runtime.invoke('materials.v1', 'sources.ingest', { sources: [{ id: 'untrusted', title: 'generated', text: '模型输出', knowledgeOrigin: 'user-text' }] });
  assert.deepEqual(result.sourceIds, ['untrusted']);
  assert.equal((await runtime.storage.read()).knowledgeMaterials.length, 0);
});

test('explicit backfill with auto disabled builds existing manual material without enabling automatic follow-up', async t => {
  const managed = managedRuntimeOptions({ complete: response });
  const { runtime } = await harness(t, { complete: response, ...managed });
  await runtime.call('source.add', { id: 'old', title: '已有文本', text: '旧资料' });
  const receipt = await runtime.call('knowledge.build', { origin: 'backfill', materials: [] });
  assert.equal(receipt.accepted, true);
  await until(async () => (await runtime.storage.read()).knowledgeMaterials[0]?.status === 'complete', 'backfill completes');
  assert.equal((await runtime.call('knowledge.settings.get')).autoBuild, false);
  assert.equal((await runtime.storage.read()).knowledgeMaterials[0].followAuto, false);
});
