import { sessionOf } from './learning-session-shared.js';
import { currentRunId } from './learning-session-v2.js';

const key = (deckId, cardId) => JSON.stringify([deckId, cardId]);
const graded = a => Number.isInteger(a.grade) && a.grade >= 0 && a.grade <= 5;

function aggregate(state, runs, attempts) {
  const questions = new Map(), ids = new Set(runs.map(r => r.id));
  const question = (deckId, cardId) => {
    const id = key(deckId, cardId);
    if (!questions.has(id)) questions.set(id, { deckId, cardId, delivered: false, snapshots: [], attempts: [], ungradable: false });
    return questions.get(id);
  };
  for (const run of runs) {
    for (const entry of run.entries) {
      const q = question(entry.deckId ?? run.deckId, entry.card.id);
      q.delivered = true;
      if (!entry.retry) q.snapshots.push({ runId: run.id, card: entry.card });
      if (entry.card.publicationUngrable) q.ungradable = true;
    }
    for (const ref of run.skippedQuestions || []) Object.assign(question(ref.deckId, ref.cardId), { delivered: true, ungradable: true });
  }
  for (const attempt of attempts) if (ids.has(attempt.runId)) question(attempt.deckId, attempt.quiz_id).attempts.push(attempt);
  let delivered = 0, answered = 0, unanswered = 0, pendingGrading = 0, ungradable = 0, unavailable = 0;
  const firstAnswers = { correct: 0, incorrect: 0, graded: 0, selfAssessed: 0, accuracy: null };
  const corrections = { retry: 0, updated: 0 };
  const rows = [];
  for (const q of questions.values()) {
    const live = state.decks.find(d => d.id === q.deckId)?.cards.find(c => c.id === q.cardId);
    const first = q.attempts.find(a => !a.retry && !a.updatedAfterOpening && graded(a)) ?? null;
    const hasAnswer = q.attempts.length > 0;
    const pending = hasAnswer && !q.attempts.some(graded);
    delivered += Number(q.delivered); answered += Number(hasAnswer);
    unanswered += Number(q.delivered && !hasAnswer); pendingGrading += Number(pending);
    ungradable += Number(q.ungradable); unavailable += Number(!live);
    corrections.retry += q.attempts.filter(a => a.retry).length;
    corrections.updated += q.attempts.filter(a => a.updatedAfterOpening).length;
    if (first?.assessment === 'graded') {
      firstAnswers.graded++;
      firstAnswers[first.grade >= 3 ? 'correct' : 'incorrect']++;
    } else if (first) firstAnswers.selfAssessed++;
    rows.push({ ...q, answered: hasAnswer, pendingGrading: pending, firstAnswer: first,
      unavailable: !live, dueAt: live?.review?.due_at ?? null, scheduleLabel: 'current',
      contentChanged: q.snapshots.length > 1 && q.snapshots.some(s => JSON.stringify(s.card) !== JSON.stringify(q.snapshots[0].card)) });
  }
  if (firstAnswers.graded) firstAnswers.accuracy = firstAnswers.correct / firstAnswers.graded;
  return { runIds: [...ids], delivered, answered, unanswered, pendingGrading, firstAnswers, corrections, ungradable, unavailable, questions: rows };
}

/** Read-only projection. Study owns both scoring and scheduling. */
export function sessionResults(state, args) {
  const session = sessionOf(state, args.id);
  const runs = state.runs.filter(run => run.learningSessionId === session.id);
  // Timestamp ties use persistent array order. Duplicate receipts do not add corrections.
  const attempts = [...new Map(state.attempts.map(a => [a.id, a])).values()]
    .map((a, order) => ({ a, order })).sort((x, y) => String(x.a.timestamp ?? '').localeCompare(String(y.a.timestamp ?? '')) || x.order - y.order).map(x => x.a);
  const current = runs.find(run => run.id === currentRunId(session));
  return { sessionId: session.id,
    currentBatch: current ? { runId: current.id, closed: !!current.closedAt, ...aggregate(state, [current], attempts) } : null,
    sessionSummary: aggregate(state, runs, attempts) };
}
