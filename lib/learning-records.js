import { resolveLearningScope } from './course-scope.js';
import { courseIndex, courseOf } from './courses.js';
import { digest, fail, pageOf } from './curriculum.js';
import { latestOutcomes, cardLevel } from './mastery.js';
import { displayPhase } from './learning-session-v2.js';
import { sessionResults } from './learning-session-results.js';

const kinds = { session: 'learningSessions', run: 'runs', attempt: 'attempts', note: 'notes' };
const stamp = r => r.updatedAt ?? r.timestamp ?? r.createdAt ?? r.startedAt ?? '';

function contextOf(state, type, record, index) {
  const run = type === 'run' ? record : type === 'attempt' ? state.runs.find(r => r.id === record.runId) : null;
  const session = type === 'session' ? record : state.learningSessions.find(s => s.id === run?.learningSessionId);
  const deckId = type === 'attempt' ? record.deckId : run?.deckId;
  const deck = state.decks.find(d => d.id === deckId);
  const course = session?.course ?? (type === 'note' && record.daily
    ? { id: record.daily.courseId, name: record.daily.course }
    : deck ? { id: deck.courseId ?? index.resolve(courseOf(deck, index))?.id ?? null, name: courseOf(deck, index) }
      : run?.course ? { id: index.resolve(run.course)?.id ?? null, name: run.course } : null);
  const refs = type === 'run' ? (run.entries ?? []).map(e => e.deckId ?? run.deckId)
    : type === 'note' ? (record.cards ?? []).map(c => c.deckId) : [];
  const courses = course ? [course] : [...new Map(refs.flatMap(id => {
    const item = state.decks.find(d => d.id === id);
    return item ? [[courseOf(item, index), { id: item.courseId ?? index.resolve(courseOf(item, index))?.id ?? null, name: courseOf(item, index) }]] : [];
  })).values()];
  return { run, session, deck, course: course ?? (courses.length === 1 ? courses[0] : null), courses };
}

function linksOf(state, type, record, { run, session, deck }) {
  const cardId = type === 'attempt' ? record.quiz_id : null;
  const card = deck?.cards.find(c => c.id === cardId);
  const saved = run?.entries?.find(e => (e.deckId ?? run.deckId) === record.deckId && e.card.id === cardId)?.card;
  const evidence = saved ?? card;
  const refs = session?.materials ?? [...new Set([
    ...(evidence?.sourceIds ?? []), ...(!saved ? deck?.sourceIds ?? [] : []),
    ...(evidence?.citations ?? []).map(c => c.sourceId),
    ...(evidence?.selections ?? []).map(c => c.sourceId),
  ])].map(sourceId => ({ sourceId, revision: null }));
  return {
    ...(run ? { runId: run.id, reading: run.reading ?? null } : {}),
    ...(session ? { sessionId: session.id, target: session.target } : {}),
    ...(cardId ? { question: { deckId: record.deckId, cardId, status: card ? 'current' : 'unavailable' } } : {}),
    materials: refs.map(ref => {
      const source = state.sources.find(s => s.id === ref.sourceId);
      return { ...ref, status: !source || source.archived ? 'unavailable'
        : ref.revision === null ? 'unversioned'
          : digest([source.text, source.document ?? null]) === ref.revision ? 'current' : 'stale' };
    }),
  };
}

function summary(state, type, record, index) {
  const context = contextOf(state, type, record, index);
  const { course, courses } = context;
  return { type, id: record.id, at: stamp(record), course, courses,
    title: String(record.title ?? record.topic ?? record.daily?.day ?? '').slice(0, 240),
    ...(type === 'session' ? { status: record.status, phase: displayPhase(state, record), step: record.step, outcome: record.outcome } : {}),
    ...(type === 'run' ? { mode: record.mode, answered: record.entries.filter(e => e.feedback).length,
      total: record.entries.length, closed: !!record.closedAt } : {}),
    ...(type === 'attempt' ? { grade: record.grade, retry: !!record.retry, updatedAfterOpening: !!record.updatedAfterOpening } : {}),
    ...(type === 'note' ? { kind: record.kind ?? 'note', generationStatus: record.generation?.status ?? null } : {}),
    links: linksOf(state, type, record, context) };
}

function inScope(row, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'unassigned') return row.courses.some(course => course.name === '');
  return row.courses.some(course => scope.courseIds.includes(course.id));
}

function page(items, args, query) {
  const revision = digest([query, items]);
  try { return pageOf(items, args, revision); }
  catch (error) { if (error.code === 'curriculum-cursor-stale') fail('records-cursor-stale'); throw error; }
}

export function recordsQuery(state, args) {
  const scope = resolveLearningScope(state, args.scope), index = courseIndex(state);
  if (args.type && !kinds[args.type]) fail('invalid-record-type');
  const items = Object.entries(kinds).filter(([type]) => !args.type || type === args.type)
    .flatMap(([type, field]) => state[field].map(record => summary(state, type, record, index)))
    .filter(row => inScope(row, scope)).sort((a, b) => String(b.at).localeCompare(String(a.at)) || `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  return page(items, args, [scope, args.type ?? null]);
}

export function recordGet(state, args) {
  const field = kinds[args.type];
  if (!field) fail('invalid-record-type');
  const record = state[field].find(r => r.id === args.id);
  if (!record) fail('record-unavailable');
  return { ...summary(state, args.type, record, courseIndex(state)), record,
    ...(args.type === 'session' ? { results: sessionResults(state, { id: record.id }) } : {}) };
}

export function reinforcementQuery(state, args) {
  const scope = resolveLearningScope(state, args.scope), outcome = latestOutcomes(state.attempts), index = courseIndex(state);
  const latest = new Map();
  for (const attempt of state.attempts) if (!attempt.retry && !attempt.updatedAfterOpening) latest.set(JSON.stringify([attempt.deckId, attempt.quiz_id]), attempt);
  const items = state.decks.filter(d => !d.archived && !d.systemKind).flatMap(deck => deck.cards
    .filter(card => !card.suspended && cardLevel(card, outcome(deck.id, card.id)) === 'weak')
    .map(card => {
      const attempt = latest.get(JSON.stringify([deck.id, card.id]));
      return { ...summary(state, 'attempt', attempt, index), level: 'weak', deckId: deck.id, cardId: card.id, topic: card.topic ?? '未分类' };
    })).filter(row => inScope(row, scope)).sort((a, b) => String(b.at).localeCompare(String(a.at)) || a.id.localeCompare(b.id));
  return page(items, args, ['reinforcement', scope]);
}
