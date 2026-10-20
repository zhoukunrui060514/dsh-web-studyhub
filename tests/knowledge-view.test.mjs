import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES } from '../ui/pages.js';
import { knowledgeLabels, layoutKnowledge } from '../ui/knowledge/layout.js';
import { initialKnowledgeView, reduceKnowledgeView, appendPath } from '../ui/knowledge/view-state.js';
test('knowledge entry is independent; network layout is deterministic and bounded', () => {
  assert.deepEqual(PAGES.knowledge.needs, ['knowledge']);
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const a = layoutKnowledge({ nodes, edges: [], width: 1000, height: 600 });
  assert.deepEqual(a, layoutKnowledge({ nodes, edges: [], width: 1000, height: 600 }));
  const b = layoutKnowledge({ nodes: nodes.slice(0, 5), previousPositions: a.positions, width: 1000, height: 600 });
  assert.deepEqual(b, layoutKnowledge({ nodes: nodes.slice(0, 5), width: 1000, height: 600 }));
  assert.ok(Object.values(a.positions).every(p => Number.isFinite(p.x) && p.x >= 0 && p.x <= a.bounds.width));
});
test('large knowledge networks keep distinct finite dot positions without compressing name labels', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const { positions, bounds } = layoutKnowledge({ nodes, edges: [] });
  const points = Object.values(positions);
  assert.ok(bounds.width >= 1000 && bounds.height >= 600);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) > 8, 'distinct network dots');
  }
});
test('narrowing a graph relays out its results instead of retaining remote world coordinates', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({ id: String(i) }));
  const large = layoutKnowledge({ nodes });
  const small = layoutKnowledge({ nodes: nodes.slice(-3), previousPositions: large.positions });
  assert.deepEqual(small, layoutKnowledge({ nodes: nodes.slice(-3) }));
});
test('network labels stay inside the viewport and avoid each other at overview scale', () => {
  const nodes = [{ id: 'a', label: '概念甲' }, { id: 'b', label: '概念乙' }, { id: 'c', label: '概念丙' }];
  const positions = { a: { x: 100, y: 100 }, b: { x: 130, y: 100 }, c: { x: 160, y: 100 } };
  const labels = knowledgeLabels({ nodes, positions, degrees: {}, camera: { x: 0, y: 0, zoom: 1 }, width: 300, height: 200, selectedId: 'a' });
  assert.ok(labels.a);
  const boxes = Object.entries(labels).map(([id, l]) => ({ x: positions[id].x + l.x, y: positions[id].y + l.y - 16, w: l.w, h: 22 }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }
});
test('replacing equally sized filter results never overlaps retained and newly visible concepts', () => {
  const first = layoutKnowledge({ nodes: [{ id: 'a' }, { id: 'b' }] });
  const next = layoutKnowledge({ nodes: [{ id: 'b' }, { id: 'c' }], previousPositions: first.positions });
  assert.notDeepEqual(next.positions.b, next.positions.c);
});

test('cross-course scope participates in label bounds as a second readable line', () => {
  const labels = knowledgeLabels({ nodes: [{ id: 'a', label: '长名称的跨课程概念需要保留范围', outsideFilter: true }], positions: { a: { x: 150, y: 100 } }, degrees: {}, camera: { x: 0, y: 0, zoom: 1 }, width: 300, height: 200, selectedId: 'a', scopeLabel: '跨课程资料依据' });
  assert.equal(labels.a.scope, '跨课程资料依据');
  assert.ok(labels.a.x + 150 >= 4 && labels.a.x + 150 + labels.a.w < 296);
  assert.ok(labels.a.y + 100 + 26 < 196);
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
