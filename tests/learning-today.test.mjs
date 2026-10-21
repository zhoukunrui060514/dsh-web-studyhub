import test from 'node:test';
import assert from 'node:assert/strict';
import { learningToday } from '../lib/learning-today.js';
const now = Date.parse('2026-10-22T12:00:00+08:00');
const card = id => ({ id, kind: 'quiz', topic: '主题', prompt: '题目', options: [{ id: 'A', text: '甲', correct: true }] });
function fixture() { return { sources: [], documents: [], decks: [{ id: 'd', title: '题组', course: '课程', cards: [card('q')] }], drafts: [], courses: [{ id: 'c', name: '课程' }], attempts: [], runs: [], workflowSessions: [], learningSessions: [], settings: {}, focus: { mode: 'class', course: '*' } }; }
const run = (id, extra = {}) => ({ id, mode: 'review', deckId: 'd', index: 0, startedAt: '2026-10-22T10:00:00Z', entries: [{ card: card('q') }], ...extra });

test('one deterministic decision preserves continuation priority and carries explicit course without focus writes', () => {
  const state = fixture();
  state.runs.push(run('batch', { purpose: 'course', course: '课程' }), run('plain'));
  state.learningSessions.push({ id: 'session', course: { id: 'c', name: '课程' }, status: 'active', target: { kind: 'topic', deckId: 'd', topic: '主题' }, step: 'retell', updatedAt: '2026-10-22T11:00:00Z' });
  const before = structuredClone(state);
  let result = learningToday(state, { now });
  assert.equal(result.primary.kind, 'continue-practice');
  assert.equal(result.primary.target.runId, 'plain');
  assert.equal(result.primary.courses[0].id, 'c');
  assert.ok(result.secondary.length <= 3);
  assert.deepEqual(state, before);
  state.runs[1].closedAt = new Date(now).toISOString();
  assert.equal(learningToday(state, { now }).primary.kind, 'continue-course');
  state.runs[0].closedAt = new Date(now).toISOString();
  assert.equal(learningToday(state, { now }).primary.target.sessionId, 'session');
  state.learningSessions[0].status = 'completed';
  assert.equal(learningToday(state, { now }).primary.kind, 'next-course-batch');
});

test('inactive courses are not suggested; empty scoped courses offer reading then materials without mutation', () => {
  const state = fixture();
  state.courses[0].active = false;
  state.runs.push(run('parked'));
  assert.equal(learningToday(state, { now }).primary.kind, 'prepare-materials');
  state.courses[0].active = true;
  state.decks[0].cards = [];
  state.sources.push({ id: 's', title: '教材', text: '正文', courses: ['课程'] });
  assert.equal(learningToday(state, { scope: { kind: 'course', courseId: 'c' }, now }).primary.kind, 'read-material');
  state.sources[0].archived = true;
  assert.equal(learningToday(state, { scope: { kind: 'course', courseId: 'c' }, now }).primary.kind, 'prepare-materials');
});

test('due review remains a secondary action and an unfinished cross-course practice states its own course', () => {
  const state = fixture();
  state.decks.push({ id: 'b', title: '乙', course: '乙', cards: [card('x')] });
  state.courses.push({ id: 'bc', name: '乙' });
  state.decks[0].cards[0].review = { repetitions: 1, due_at: '2026-10-20T00:00:00Z', interval_days: 1 };
  state.attempts.push({ deckId: 'd', quiz_id: 'q', grade: 4 });
  state.runs.push(run('cross', { deckId: 'b', entries: [{ card: card('x') }] }));
  const result = learningToday(state, { scope: { kind: 'course', courseId: 'c' }, now });
  assert.equal(result.primary.target.runId, 'cross');
  assert.equal(result.primary.courses[0].id, 'bc');
  assert.ok(result.secondary.some(a => a.kind === 'due-review'));
});

test('unassigned questions and legacy learning stay actionable; recent learning wins within the same priority', () => {
  const state = fixture();
  state.workflowSessions.push({ id: 'old', status: 'active', updatedAt: '2026-10-22T10:00:00Z', scope: [{ deckId: 'd' }], currentStepId: 'read' });
  assert.equal(learningToday(state, { now }).primary.target.legacySessionId, 'old');
  state.learningSessions.push({ id: 'new', course: { id: 'c', name: '课程' }, status: 'paused', target: { kind: 'topic', deckId: 'd', topic: '主题' }, step: 'summary', updatedAt: '2026-10-22T11:00:00Z' });
  assert.equal(learningToday(state, { now }).primary.target.sessionId, 'new');
  state.learningSessions = []; state.workflowSessions = [];
  state.decks[0].course = '';
  const result = learningToday(state, { scope: { kind: 'unassigned' }, now });
  assert.equal(result.primary.kind, 'next-learning-round');
  assert.equal(result.primary.action.args.scope[0].deckId, 'd');
});

test('today keeps missing or archived session targets available only through history, not proactive continuation', () => {
  const state = fixture();
  state.learningSessions.push({ id: 'unavailable', course: { id: 'c', name: '课程' }, status: 'active', step: 'practice', target: { kind: 'topic', deckId: 'gone', topic: '主题' } });
  assert.notEqual(learningToday(state, { now }).primary.target.sessionId, 'unavailable');
  state.learningSessions[0].target.deckId = 'd'; state.decks[0].archived = true;
  assert.notEqual(learningToday(state, { now }).primary.target.sessionId, 'unavailable');
});
