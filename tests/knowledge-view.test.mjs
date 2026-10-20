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
  assert.ok(Object.values(a.positions).every(p => Number.isFinite(p.x) && p.x >= 0 && p.x <= a.bounds.width));
});
test('large knowledge graphs grow their world instead of compressing readable node spacing', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const { positions, bounds } = layoutKnowledge({ nodes, edges: [] });
  const points = Object.values(positions);
  assert.ok(bounds.width > 1000 || bounds.height > 600);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    assert.ok(Math.abs(points[i].x - points[j].x) >= 200 || Math.abs(points[i].y - points[j].y) >= 110, 'readable, non-overlapping node cells');
  }
});
test('narrowing a graph relays out its results instead of retaining remote world coordinates', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const large = layoutKnowledge({ nodes });
  const small = layoutKnowledge({ nodes: nodes.slice(-3), previousPositions: large.positions });
  assert.ok(Object.values(small.positions).every(p => p.x < 600 && p.y < 400));
});
test('replacing equally sized filter results never overlaps retained and newly visible concepts', () => {
  const first = layoutKnowledge({ nodes: [{ id: 'a' }, { id: 'b' }] });
  const next = layoutKnowledge({ nodes: [{ id: 'b' }, { id: 'c' }], previousPositions: first.positions });
  assert.notDeepEqual(next.positions.b, next.positions.c);
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
