import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadUi } from './helpers/ui-module.mjs';
const m = await loadUi(`export {default as Canvas} from './ui/knowledge/KnowledgeCanvas.jsx'; export {default as Details} from './ui/knowledge/KnowledgeDetails.jsx'; export {default as Path} from './ui/knowledge/PathPicker.jsx';`);
const nodes = [{ id: 'a', label: '概念甲' }, { id: 'b', label: '概念乙', outsideFilter: true }];
const edges = [{ id: 'ab', from: 'a', to: 'b', predicate: 'promotes', direction: 'directed', outsideFilter: true }];
test('cross-course graph and mixed-course evidence visibly identify scope and course names', () => {
  const canvas = renderToStaticMarkup(React.createElement(m.Canvas, { graph: { nodes, edges }, positions: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } } }));
  assert.match(canvas, /跨课程资料依据/);
  const detail = { item: nodes[0], evidence: [{ id: 'eA', courses: ['A'], quote: '甲' }, { id: 'eB', courses: ['B'], outsideFilter: true, quote: '乙' }] };
  const html = renderToStaticMarkup(React.createElement(m.Details, { detail, courses: [{ id: 'A', name: '课程甲' }, { id: 'B', name: '课程乙' }], nodes }));
  assert.match(html, /课程甲/); assert.match(html, /课程乙/); assert.match(html, /跨课程资料依据/);
});
test('path choices identify concepts and ordered relationships rather than opaque identifiers', () => {
  const html = renderToStaticMarkup(React.createElement(m.Path, { startNodeId: 'a', edgeIds: ['ab'], edges, nodes }));
  assert.match(html, /概念甲/); assert.match(html, /概念乙/); assert.doesNotMatch(html, />ab</);
});
