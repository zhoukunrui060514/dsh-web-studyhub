import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLearningReading } from '../lib/curriculum-reading.js';
import { curriculumView } from '../lib/curriculum.js';
import { courseOutlineMaterial } from '../lib/course-outline-book.js';
import { groupSourcesByDocument } from '../lib/source-groups.js';

function fixture() {
  const state = { sources: [{ id: 's', title: '原文', text: '负反馈稳定内环境。另一个话题不应冒充选段。', courses: ['课程'], format: 'md' }], documents: [],
    decks: [{ id: 'd', course: '课程', sourceIds: ['s'], cards: [{ id: 'q', kind: 'quiz', topic: '稳态', prompt: '反馈', explanation: '这是题目讲解', citations: [{ sourceId: 's', quote: '负反馈稳定内环境。' }] }] }],
    attempts: [], runs: [], courses: [{ id: 'c', name: '课程' }], settings: {}, focus: { course: '课程' } };
  const anchor = groupSourcesByDocument(state.sources)[0].key;
  state.sources.push(courseOutlineMaterial({ title: '大纲', course: '课程', fingerprint: '12345678', orderBasis: { codes: ['numbering'] }, nodes: [{ id: 'n', title: '稳态', anchors: [anchor] }], other: { anchors: [] }, counts: { units: 1 } }));
  return state;
}
const scope = { kind: 'course', courseId: 'c' };
test('reading query is pure and shares curriculum reading nodes without preparing files', () => {
  const state = fixture(), before = structuredClone(state);
  const reading = resolveLearningReading(state, { scope, target: { kind: 'outline', nodeId: 'n' } });
  const curriculum = curriculumView(state, { scope, view: 'reading', nodeId: 'n' });
  assert.equal(reading.nodes[0].key, curriculum.nodes[0].reading.key);
  assert.equal(reading.needsPrepare, true);
  assert.deepEqual(state, before);
});
test('topic uses actual question mappings and references; never title similarity or whole source fallback', () => {
  const state = fixture();
  const reading = resolveLearningReading(state, { scope, target: { kind: 'topic', deckId: 'd', topic: '稳态' } });
  assert.equal(reading.nodes.length, 1);
  assert.equal(reading.mapping, 'explicit');
  state.decks[0].cards[0].citations = [];
  state.decks[0].sourceIds = [];
  const fallback = resolveLearningReading(state, { scope, target: { kind: 'topic', deckId: 'd', topic: '稳态' } });
  assert.equal(fallback.nodes.length, 0);
  assert.equal(fallback.mapping, 'unmapped');
  assert.equal(fallback.questions[0].explanation, '这是题目讲解');
  assert.equal(fallback.references.length, 0);
  assert.ok(!JSON.stringify(fallback).includes('另一个话题'));
});
