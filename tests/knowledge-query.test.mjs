import test from 'node:test';
import assert from 'node:assert/strict';
import { queryKnowledge, knowledgeDetail, resolvePath } from '../lib/contexts/knowledge/query.js';
import { knowledgeDefaults } from '../lib/contexts/knowledge/model.js';

export function graphFixture() {
  const state = knowledgeDefaults();
  state.knowledgeNodes = ['a', 'b', 'c'].map(id => ({ id, label: id, aliases: [], definition: `definition ${id}`, manualOverrides: {} }));
  state.knowledgeEdges = [{ id: 'ab', from: 'a', to: 'b', predicate: 'promotes', direction: 'directed', conditions: '条件' }, { id: 'bc', from: 'b', to: 'c', predicate: 'inhibits', direction: 'directed' }];
  state.knowledgeEvidence = [
    ...['a', 'b', 'c'].flatMap(targetId => ['A', 'B'].map(course => ({ id: `n-${targetId}-${course}`, targetKind: 'node', targetId, materialIdentity: `source:${course}`, revision: 'r', quote: targetId, courses: [course], contribution: { label: targetId } }))),
    ...['ab', 'bc'].map(targetId => ({ id: `e-${targetId}`, targetKind: 'edge', targetId, materialIdentity: targetId === 'ab' ? 'source:A' : 'source:B', revision: 'r', quote: '甲乙', courses: [], contribution: {} })),
  ];
  const materials = ['A', 'B'].map(c => ({ identity: `source:${c}`, revision: 'r', archived: false, courses: [c] }));
  return { state, materials };
}
test('course filter applies to relationship contributions even when both endpoints are visible; cross-course is marked', () => {
  const { state, materials } = graphFixture();
  assert.deepEqual(queryKnowledge(state, materials, { courseIds: ['A'] }).edges.map(e => e.id), ['ab']);
  assert.equal(queryKnowledge(state, materials, { courseIds: ['A'], includeCrossCourse: true }).edges.find(e => e.id === 'bc').outsideFilter, true);
  const before = queryKnowledge(state, materials, {});
  state.knowledgeThreads.push({ id: 'thread', messages: [] });
  assert.equal(queryKnowledge(state, materials, {}).graphRevision, before.graphRevision);
  materials[0].revision = 'new';
  assert.equal(knowledgeDetail(state, materials, { kind: 'edge', id: 'ab' }).versionStatus, 'stale');
  assert.notEqual(queryKnowledge(state, materials, {}).graphRevision, before.graphRevision);
  materials[0].archived = true;
  assert.equal(queryKnowledge(state, materials, {}).edges.some(e => e.id === 'ab'), false);
});

test('merge decisions expose both supported meanings and courses for comparison', () => {
  const { state, materials } = graphFixture();
  state.knowledgeMerges.push({ id: 'proposal', nodeId: 'a', candidateId: 'b', status: 'pending' });
  const detail = knowledgeDetail(state, materials, { kind: 'node', id: 'a' });
  assert.deepEqual(detail.merges[0].concepts.map(n => [n.label, n.definition]), [['a', 'definition a'], ['b', 'definition b']]);
});
test('global display is bounded without truncating totals; stable focus, search, redirect and reversed paths', () => {
  const { state, materials } = graphFixture();
  state.knowledgeNodes = Array.from({ length: 301 }, (_, i) => ({ id: `n${String(i).padStart(3, '0')}`, label: `point ${i}` }));
  state.knowledgeEdges = Array.from({ length: 601 }, (_, i) => ({ id: `e${String(i).padStart(3, '0')}`, from: 'n000', to: `n${String(i % 300 + 1).padStart(3, '0')}`, direction: 'directed' }));
  state.knowledgeEvidence = [...state.knowledgeNodes.map(n => ({ id: `ev${n.id}`, targetKind: 'node', targetId: n.id })), ...state.knowledgeEdges.map(e => ({ id: `ev${e.id}`, targetKind: 'edge', targetId: e.id }))]
    .map(e => ({ ...e, materialIdentity: 'source:A', revision: 'r', contribution: {} }));
  const view = queryKnowledge(state, materials, { nodeLimit: 10000, edgeLimit: 10000 });
  assert.equal(view.totals.nodes, 301); assert.equal(view.totals.edges, 601); assert.equal(view.nodes.length, 300); assert.ok(view.edges.length <= 600); assert.equal(view.truncated, true);
  assert.deepEqual(queryKnowledge(state, materials, { nodeLimit: 10000, edgeLimit: 10000 }), view);
  assert.equal(queryKnowledge(state, materials, { query: 'point 300' }).nodes[0].id, 'n300');
  state.knowledgeEdges = state.knowledgeNodes.slice(0, 300).map((n, i) => ({ id: `star${i}`, from: 'n300', to: n.id, direction: 'directed' }));
  state.knowledgeEvidence.push(...state.knowledgeEdges.map(e => ({ id: `ev-${e.id}`, targetKind: 'edge', targetId: e.id, materialIdentity: 'source:A', revision: 'r' })));
  const focused = queryKnowledge(state, materials, { focusId: 'n300' });
  assert.equal(focused.nodes[0].id, 'n300');
  assert.equal(focused.edges.length, 299);
  const small = graphFixture();
  assert.deepEqual(queryKnowledge(small.state, small.materials, { focusId: 'a' }).nodes.map(n => n.id), ['a', 'b']);
  const reverse = resolvePath(small.state, { kind: 'path', startNodeId: 'c', edgeIds: ['bc', 'ab'] });
  assert.equal(reverse.traversals[0].reversed, true); assert.equal(reverse.edges[0].from, 'b');
  assert.throws(() => resolvePath(small.state, { kind: 'path', startNodeId: 'a', edgeIds: ['bc'] }), { code: 'disconnected-path' });
  small.state.knowledgeMerges.push({ id: 'redirect', oldId: 'old-a', canonicalId: 'a' });
  assert.equal(knowledgeDetail(small.state, small.materials, { kind: 'node', id: 'old-a' }).redirect.canonicalId, 'a');
});
