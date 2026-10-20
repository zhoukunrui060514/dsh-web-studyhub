import test from 'node:test';
import assert from 'node:assert/strict';
import { inputsFromState, materialKey, readKnowledgeMaterials, resolveKnowledgeMaterial } from '../lib/contexts/knowledge/materials.js';

const fixture = () => ({ courses: [{ id: 'A', name: '生理', aliases: [] }], documents: [{ id: 'doc', currentRevision: 'v2', versions: [
  { revision: 'v1', sourceIds: ['old'] }, { revision: 'v2', sourceIds: ['p1', 'p2'], importedAt: '2026-10-19T10:00:00Z' },
] }], sources: [
  { id: 'old', text: '过期' },
  ...['p1', 'p2'].map((id, i) => ({ id, title: '讲义', text: '重复段落', courses: ['生理'], document: { page: i + 1 } })),
  { id: 'legacy', text: '旧文本', courses: [] },
  { id: 'transcript', text: '转写', knowledgeOrigin: 'user-transcript', createdAt: '2026-10-19T10:00:00Z' },
  { id: 'generated', text: '清单', provenance: 'course-outline-inventory', courseInventory: {} },
] });

test('current document pages share one identity; evidence offsets remain source-local; generated input excluded', () => {
  const all = inputsFromState(fixture()), doc = all.find(m => m.identity === 'document:doc');
  assert.deepEqual(doc.sourceIds, ['p1', 'p2']);
  assert.deepEqual(doc.courses, ['A']);
  assert.equal(doc.segments[1].start, 0);
  assert.equal(doc.segments[1].page, 2);
  assert.equal(all.some(m => m.identity === 'source:old'), false);
  assert.equal(all.some(m => m.identity === 'source:generated'), false);
  assert.equal(all.find(m => m.identity === 'source:legacy').eligibleAuto, false);
  assert.equal(all.find(m => m.identity === 'source:transcript').eligibleAuto, true);
});

test('course rename changes projection, never identity/revision or library-bound idempotency key', async () => {
  const s = fixture(), before = inputsFromState(s)[0];
  s.courses[0].aliases = ['生理']; s.courses[0].name = '生理学';
  const after = inputsFromState(s)[0];
  assert.equal(after.revision, before.revision); assert.deepEqual(after.courses, ['A']);
  const ports = { materials: { list: async () => ({ documents: [{ ...s.documents[0], legacy: false }], total: 1, offset: 0, limit: 200 }), get: async () => ({ ...s.documents[0], sources: s.sources.filter(x => ['p1', 'p2'].includes(x.id)) }) }, courses: { list: async () => ({ courses: s.courses }) } };
  assert.equal((await readKnowledgeMaterials(ports))[0].identity, 'document:doc');
  await assert.rejects(resolveKnowledgeMaterial(ports, { identity: 'document:doc', revision: 'v1' }), { code: 'stale-material' });
  assert.notEqual(materialKey('A', before, '1'), materialKey('B', before, '1'));
});

test('adding readable pages to the same document byte version invalidates the extraction input, not the source revision', () => {
  const s = fixture(); s.documents[0].versions[1].sourceIds = ['p1'];
  const before = inputsFromState(s).find(m => m.documentId === 'doc');
  s.documents[0].versions[1].sourceIds.push('p2');
  const after = inputsFromState(s).find(m => m.documentId === 'doc');
  assert.notEqual(after.revision, before.revision);
  assert.equal(after.documentRevision, 'v2');
});
