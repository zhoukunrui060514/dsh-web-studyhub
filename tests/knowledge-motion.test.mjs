import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeSimulation } from '../ui/knowledge/simulation.js';
const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const edges = [{ from: 'a', to: 'b' }];
test('graph physics converges deterministically, keeping linked concepts closer than an isolated one', () => {
  const a = createKnowledgeSimulation({ nodes, edges }), b = createKnowledgeSimulation({ nodes, edges });
  a.tick(240); b.tick(240);
  assert.deepEqual(a.positions(), b.positions());
  assert.equal(a.active(), false);
  const p = a.positions(), distance = (x, y) => Math.hypot(p[x].x - p[y].x, p[x].y - p[y].y);
  assert.ok(distance('a', 'b') < distance('a', 'c'));
  assert.ok(Object.values(p).every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
});
test('dragging pins the selected concept and moves its neighbor; releasing settles without rewriting graph inputs', () => {
  const original = JSON.stringify({ nodes, edges });
  const simulation = createKnowledgeSimulation({ nodes, edges }); simulation.tick(240);
  const before = simulation.positions();
  simulation.pin('a', 100, 120); simulation.tick(25);
  assert.deepEqual(simulation.positions().a, { x: 100, y: 120 });
  assert.notDeepEqual(simulation.positions().b, before.b);
  simulation.release('a'); simulation.tick(240);
  assert.equal(simulation.active(), false);
  assert.equal(JSON.stringify({ nodes, edges }), original);
});
