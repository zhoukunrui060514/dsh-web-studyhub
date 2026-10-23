import { sessionOf, request, replay, editable, touch } from './learning-session-shared.js';
import { resolveSessionTarget, learningError as fail } from './learning-session-target.js';

export const sessionPhase = session => session.schemaVersion === 2 ? session.phase
  : session.step === 'practice' ? 'practice' : session.step === 'summary' ? 'results' : 'reading';
export const currentRunId = session => session.schemaVersion === 2 ? session.currentRunId : session.records?.practice?.runId ?? null;
export const batchComplete = run => !!run?.entries.length && run.entries.every(entry => !!entry.feedback);
export function displayPhase(state, session) {
  const phase = sessionPhase(session), run = state.runs.find(run => run.id === currentRunId(session));
  return phase === 'practice' && (run?.closedAt || batchComplete(run)) ? 'results' : phase;
}
export function upgradeSession(session) {
  if (session.schemaVersion === 2) return;
  const phase = sessionPhase(session), runId = currentRunId(session);
  Object.assign(session, { schemaVersion: 2, phase, currentRunId: runId, readingPosition: null });
}
function ownRun(state, session) {
  const id = currentRunId(session);
  const run = state.runs.find(run => run.id === id);
  if (run && run.learningSessionId !== session.id) fail('learning-run-conflict');
  return run;
}
function save(session, receipt) { session.requests.push(receipt); touch(session); return session; }

export function sessionMove(state, args) {
  const session = sessionOf(state, args.id), receipt = request(args, 'move');
  if (replay(session, receipt)) return session;
  editable(session, args);
  if (!['reading', 'practice', 'results'].includes(args.phase)) fail('invalid-learning-phase');
  const run = ownRun(state, session);
  if (args.phase === 'practice' && (!run || run.closedAt)) fail('learning-run-unavailable');
  if (args.phase === 'results' && (!run || !run.closedAt && !batchComplete(run))) fail('learning-practice-incomplete');
  upgradeSession(session);
  session.phase = args.phase;
  if (args.readingPosition !== undefined) session.readingPosition = args.readingPosition;
  return save(session, receipt);
}
export function sessionFinish(state, args, mutate) {
  const session = sessionOf(state, args.id), receipt = request(args, 'finish');
  if (replay(session, receipt)) return session;
  editable(session, args);
  const run = ownRun(state, session);
  if (run && !run.closedAt) mutate('review.end', state, { runId: run.id });
  upgradeSession(session);
  session.status = 'completed';
  session.completedAt = new Date().toISOString();
  return save(session, receipt);
}
export function sessionPracticeV2(state, args, mutate, action = 'start') {
  const session = sessionOf(state, args.id), receipt = request(args, `practice.${action}`);
  if (replay(session, receipt)) return { ...session.requests.find(item => item.id === receipt.id).result, session };
  editable(session, args);
  const previous = ownRun(state, session);
  if (action !== 'start' && (!previous || previous.id !== args.expectedRunId)) fail('learning-run-conflict');
  if (action === 'next' && !previous.closedAt && !batchComplete(previous)) fail('learning-practice-incomplete');
  let result;
  if (action === 'close') {
    mutate('review.end', state, { runId: previous.id });
    result = { status: 'ok', runId: previous.id };
  } else if (action === 'start' && previous) {
    result = { status: 'ok', runId: previous.id };
  } else {
    const target = resolveSessionTarget(state, session.scope, session.target);
    if (target.basisRevision !== session.basisRevision || target.materials.some(m => m.revision === null)) fail('learning-target-stale');
    if (previous && !previous.closedAt) mutate('review.end', state, { runId: previous.id });
    const run = target.practiceScope.length ? mutate('review.start', state, { mode: 'path', scope: target.practiceScope, fresh: true, learningSessionId: session.id, learningBatch: true }) : null;
    result = run?.id ? { status: 'ok', runId: run.id } : { status: 'exhausted', reason: 'no-questions', runId: null };
  }
  upgradeSession(session);
  // Exhaustion retains the last batch so reopening still displays its results.
  if (result.runId) session.currentRunId = result.runId;
  const run = state.runs.find(run => run.id === session.currentRunId);
  session.phase = action === 'close' || result.status === 'exhausted' || run?.closedAt || batchComplete(run) ? 'results' : 'practice';
  receipt.result = result;
  save(session, receipt);
  return { ...result, session };
}
