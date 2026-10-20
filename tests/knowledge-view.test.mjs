import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES } from '../ui/pages.js';
import { layoutKnowledge } from '../ui/knowledge/layout.js';
import { initialKnowledgeView, reduceKnowledgeView, appendPath } from '../ui/knowledge/view-state.js';
test('knowledge entry is independent; bounded layout is deterministic and preserves visible positions', () => {
  assert.deepEqual(PAGES.knowledge.needs, ['knowledge']);
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const a = layoutKnowledge({ nodes, edges: [], width: 1000, height: 600 });
  assert.deepEqual(a, layoutKnowledge({ nodes, edges: [], width: 1000, height: 600 }));
  const b = layoutKnowledge({ nodes: nodes.slice(0, 5), previousPositions: a.positions, width: 1000, height: 600 });
  assert.deepEqual(b.positions['0'], a.positions['0']);
  assert.ok(Object.values(a.positions).every(p => Number.isFinite(p.x) && p.x >= 0 && p.x <= 1000));
});
test('navigation remembers focus; stale graph responses cannot replace a new filter', () => {
  let s = reduceKnowledgeView(initialKnowledgeView, { type: 'focus', id: 'a' });
  s = reduceKnowledgeView(s, { type: 'focus', id: 'b' });
  assert.equal(reduceKnowledgeView(s, { type: 'back' }).focusId, 'a');
  s = reduceKnowledgeView(s, { type: 'request', sequence: 2 });
  assert.equal(reduceKnowledgeView(s, { type: 'result', sequence: 1, graph: { nodes: ['old'] } }), s);
});
test('ordered paths preserve stored direction and reject disconnected and overlong additions', () => {
  const edges = [{ id: 'ab', from: 'a', to: 'b', direction: 'directed' }, { id: 'bc', from: 'b', to: 'c', direction: 'directed' }];
  let path = appendPath({ startNodeId: 'c', edgeIds: [] }, edges[1], edges);
  path = appendPath(path, edges[0], edges);
  assert.deepEqual(path.edgeIds, ['bc', 'ab']);
  assert.equal(edges[1].from, 'b');
  assert.throws(() => appendPath({ startNodeId: 'a', edgeIds: [] }, edges[1], edges));
  assert.throws(() => appendPath({ startNodeId: 'a', edgeIds: Array(12).fill('ab') }, edges[0], edges));
});
