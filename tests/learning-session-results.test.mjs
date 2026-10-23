import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionResults } from '../lib/learning-session-results.js';

function fixture() {
  const card = id => ({ id, kind: 'quiz', prompt: id });
  return {
    learningSessions: [{ id: 's', schemaVersion: 2, currentRunId: 'r2' }],
    runs: [
      { id: 'r1', learningSessionId: 's', deckId: 'd', closedAt: 'x', entries: [{ card: card('A') }, { card: card('B') }, { card: card('A'), retry: true }] },
      { id: 'r2', learningSessionId: 's', deckId: 'd', entries: [{ card: card('A') }, { card: card('B') }, { card: card('C') }] },
      { id: 'other', learningSessionId: 'different', entries: [] },
    ],
    attempts: [
      { id: 'a1', runId: 'r1', deckId: 'd', quiz_id: 'A', timestamp: '2026-01-01', grade: 1, assessment: 'graded' },
      { id: 'a2', runId: 'r1', deckId: 'd', quiz_id: 'A', timestamp: '2026-01-02', grade: 4, retry: true, assessment: 'graded' },
      { id: 'a3', runId: 'r2', deckId: 'd', quiz_id: 'A', timestamp: '2026-01-03', grade: 4, assessment: 'graded' },
      { id: 'a4', runId: 'r2', deckId: 'd', quiz_id: 'B', timestamp: '2026-01-03', grade: null },
      { id: 'a5', runId: 'other', deckId: 'd', quiz_id: 'C', grade: 4 },
    ],
    decks: [{ id: 'd', cards: [card('A'), { ...card('B'), review: { due_at: '2026-11-01' } }, card('C')] }],
  };
}

test('session summary fixes earliest valid first answer and deduplicates coverage across batches', () => {
  const state = fixture(), before = structuredClone(state);
  const result = sessionResults(state, { id: 's' });
  const s = result.sessionSummary;
  assert.equal(s.delivered, 3); assert.equal(s.answered, 2); assert.equal(s.unanswered, 1);
  assert.equal(s.firstAnswers.incorrect, 1); assert.equal(s.firstAnswers.correct, 0);
  assert.equal(s.firstAnswers.graded, 1); assert.equal(s.firstAnswers.accuracy, 0);
  assert.equal(s.corrections.retry, 1); assert.equal(s.pendingGrading, 1);
  assert.equal(s.questions.find(q => q.cardId === 'A').firstAnswer.id, 'a1');
  assert.equal(result.currentBatch.firstAnswers.correct, 1);
  assert.equal(s.questions.find(q => q.cardId === 'A').dueAt, null);
  assert.equal(s.questions.find(q => q.cardId === 'B').dueAt, '2026-11-01');
  assert.deepEqual(state, before);
});

test('ungradable, invalid and updated attempts are distinct facts and corrections use attempt IDs', () => {
  const state = fixture();
  state.runs[0].skippedQuestions = [{ deckId: 'd', cardId: 'D', reason: 'ungradable' }];
  state.decks[0].cards = state.decks[0].cards.filter(c => c.id !== 'C');
  state.attempts.push({ id: 'updated', runId: 'r2', deckId: 'd', quiz_id: 'C', timestamp: '2026-01-04', grade: 4, updatedAfterOpening: true });
  state.attempts.push({ ...state.attempts.at(-1) });
  const s = sessionResults(state, { id: 's' }).sessionSummary;
  assert.equal(s.answered, 3); assert.equal(s.unanswered, 1);
  assert.equal(s.corrections.updated, 1);
  assert.equal(s.ungradable, 1); assert.equal(s.unavailable, 2);
  assert.equal(s.firstAnswers.graded, 1);
});

test('no practice returns honest empty results and absent sessions fail', () => {
  const state = fixture(); state.runs = []; state.attempts = [];
  const result = sessionResults(state, { id: 's' });
  assert.equal(result.currentBatch, null);
  assert.equal(result.sessionSummary.answered, 0);
  assert.equal(result.sessionSummary.firstAnswers.accuracy, null);
  assert.throws(() => sessionResults(state, { id: 'missing' }), { code: 'learning-session-unavailable' });
});
