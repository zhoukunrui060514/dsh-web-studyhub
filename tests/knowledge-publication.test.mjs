import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../lib/store.js';
import { KNOWLEDGE_COLLECTIONS, knowledgeDefaults } from '../lib/contexts/knowledge/model.js';
import { inputsFromState } from '../lib/contexts/knowledge/materials.js';
import { publishMaterial } from '../lib/contexts/knowledge/publication.js';
import { acceptMerge, rejectMerge } from '../lib/contexts/knowledge/merge.js';
import { mergeCandidates } from '../lib/contexts/knowledge/merge.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-publish-')), store = new Store(root);
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const { name, ...d } of KNOWLEDGE_COLLECTIONS) store.registerCollection(name, d);
  await store.update(s => Object.assign(s, knowledgeDefaults(), { sources: [{ id: 'a', text: '甲', title: 'A' }, { id: 'b', text: '甲', title: 'B' }] }));
  return { store, context: { state: { update: f => store.update(f) } }, refs: inputsFromState(await store.read()) };
}
const batch = ref => ({ nodes: [{ id: 'local', label: '甲', definition: '定义', aliases: [], manualOverrides: {} }], edges: [],
  evidence: [{ targetKind: 'node', targetId: 'local', materialIdentity: ref.identity, revision: ref.revision, sourceId: ref.sourceIds[0], quote: '甲', start: 0, end: 1, assertion: 'asserted', contribution: { label: '甲', definition: '定义', aliases: [] } }], mergeProposals: [] });

test('publication rechecks current revision under Store lock; never commits results after update, deletion or cancellation', async t => {
  const { store, context, refs } = await fixture(t), ref = refs[0];
  let locked, release;
  const gate = new Promise(r => { release = r; }), entered = new Promise(r => { locked = r; });
  const writer = store.update(async s => { locked(); await gate; s.sources[0].text = '新文本'; });
  await entered;
  const publishing = publishMaterial(context, { ref, batch: batch(ref), extractorVersion: '1' });
  release(); await writer;
  assert.deepEqual(await publishing, { published: false, reason: 'stale-material' });
  assert.equal((await store.read()).knowledgeEvidence.length, 0);
  assert.equal((await store.read()).knowledgeMaterials[0].status, 'pending');
  await store.update(s => { s.sources = []; });
  assert.equal((await publishMaterial(context, { ref, batch: batch(ref), extractorVersion: '1' })).published, false);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(publishMaterial(context, { ref, batch: batch(ref), signal: controller.signal }));
});

test('publication rejects extraction started before same-version page expansion', async t => {
  const { store, context } = await fixture(t);
  await store.update(s => { s.documents = [{ id: 'doc', currentRevision: 'bytes', versions: [{ revision: 'bytes', sourceIds: ['a'] }] }]; });
  const ref = inputsFromState(await store.read()).find(m => m.documentId === 'doc');
  await store.update(s => { s.documents[0].versions[0].sourceIds.push('b'); });
  assert.deepEqual(await publishMaterial(context, { ref, batch: batch(ref) }), { published: false, reason: 'stale-material' });
  assert.equal((await store.read()).knowledgeEvidence.length, 0);
});

test('accepted semantic signatures reuse the canonical concept on later extraction', () => {
  const s = knowledgeDefaults();
  s.knowledgeNodes = [{ id: 'one', label: 'X', definition: 'one' }, { id: 'two', label: 'X', definition: 'two' }];
  s.knowledgeMerges = [{ id: 'merge', nodeId: 'two', candidateId: 'one', status: 'pending' }];
  acceptMerge(s, 'merge');
  const candidate = { nodes: [{ id: 'local', label: 'X', definition: 'two' }], edges: [], evidence: [] };
  const result = mergeCandidates(s, candidate, { createId: () => 'unexpected-new' });
  assert.equal(result.nodes[0].id, 'one');
  assert.equal(result.mergeProposals.length, 0);
});

test('replacing one contribution retains other sources and manual overrides, and merge redirects are idempotent', async t => {
  const { store, context, refs } = await fixture(t);
  for (const ref of refs) assert.equal((await publishMaterial(context, { ref, batch: batch(ref), extractorVersion: '1' })).published, true);
  let before = await store.read(); assert.equal(before.knowledgeNodes.length, 1);
  await store.update(s => { s.knowledgeNodes[0].manualOverrides.label = '人工名称'; });
  const other = before.knowledgeEvidence.filter(e => e.materialIdentity === refs[1].identity);
  await publishMaterial(context, { ref: refs[0], batch: batch(refs[0]), extractorVersion: '1' });
  const after = await store.read();
  assert.equal(after.knowledgeNodes[0].manualOverrides.label, '人工名称');
  assert.deepEqual(after.knowledgeEvidence.filter(e => e.materialIdentity === refs[1].identity), other);
  before = structuredClone(after); const canonicalId = before.knowledgeNodes[0].id;
  before.knowledgeNodes.push({ id: 'duplicate', label: '甲' });
  before.knowledgeMerges.push({ id: 'proposal', nodeId: 'duplicate', candidateId: canonicalId, status: 'pending' });
  assert.deepEqual(acceptMerge(before, 'proposal'), { canonicalId });
  assert.deepEqual(acceptMerge(before, 'proposal'), { canonicalId });
  assert.equal(before.knowledgeMerges.find(m => m.oldId === 'duplicate').canonicalId, canonicalId);
  before.knowledgeMerges.push({ id: 'reject', nodeId: 'another', candidateId: canonicalId, status: 'pending' });
  rejectMerge(before, 'reject'); assert.equal(before.knowledgeMerges.find(m => m.id === 'reject').status, 'rejected');
});
