import { randomUUID } from 'node:crypto';
import { digest } from './curriculum.js';
import { resolveSessionTarget, learningError as fail } from './learning-session-target.js';

export const STEPS = Object.freeze(['explain', 'retell', 'practice', 'summary']);
const now = () => new Date().toISOString();
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value;
const text = (value, limit = 40000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) fail('invalid-learning-content');
  return value.trim();
};
export function sessionOf(state, id) {
  const session = state.learningSessions.find(session => session.id === id);
  if (!session) fail('learning-session-unavailable');
  return session;
}
function request(args, action) {
  return { id: text(args.requestId, 200), action, payload: digest(ordered(Object.fromEntries(Object.entries(args).filter(([key]) => !['version', 'requestId'].includes(key))))) };
}
function replay(session, receipt) {
  const previous = session.requests.find(item => item.id === receipt.id);
  if (!previous) return false;
  if (previous.action !== receipt.action || previous.payload !== receipt.payload) fail('learning-request-conflict');
  return true;
}
export function editable(session, args) {
  if (session.version !== args.version) fail('learning-version-conflict');
  if (session.status === 'paused') fail('learning-session-paused');
  if (session.status === 'completed') fail('learning-session-completed');
}
export function touch(session) { session.version++; session.updatedAt = now(); }
export function sessionStart(state, args) {
  const receipt = request(args, 'start');
  const previous = state.learningSessions.find(session => session.startRequestId === receipt.id);
  if (previous) { replay(previous, receipt); return previous; }
  if (!['today', 'knowledge', 'reinforcement'].includes(args.origin)) fail('invalid-learning-origin');
  const resolved = resolveSessionTarget(state, args.scope, args.target);
  const session = { id: randomUUID(), schemaVersion: 1, version: 1, startRequestId: receipt.id, origin: args.origin,
    scope: { kind: args.scope.kind, ...(resolved.course.id ? { courseId: resolved.course.id, includeDescendants: false } : {}) },
    ...resolved, step: 'explain', status: 'active', outcome: null,
    records: Object.fromEntries(STEPS.map(step => [step, { status: 'pending', content: step === 'explain' ? resolved.explanation : '' }])),
    requests: [receipt], createdAt: now(), updatedAt: now() };
  delete session.explanation;
  delete session.practiceScope;
  state.learningSessions.push(session);
  return session;
}
export function sessionGet(state, args) {
  const session = sessionOf(state, args.id);
  if (args.step !== undefined && !STEPS.includes(args.step)) fail('invalid-learning-step');
  let basisStatus;
  try {
    const current = resolveSessionTarget(state, session.scope, session.target);
    basisStatus = current.materials.some(material => material.revision === null) ? 'unavailable' : current.basisRevision === session.basisRevision ? 'current' : 'stale';
  } catch (error) {
    if (!['learning-target-unavailable', 'learning-target-stale', 'course-unavailable'].includes(error.code)) throw error;
    basisStatus = error.code === 'learning-target-stale' ? 'stale' : 'unavailable';
  }
  return { ...session, basisStatus, viewedStep: args.step ?? session.step };
}
export function sessionRecord(state, args) {
  const session = sessionOf(state, args.id), receipt = request(args, 'record');
  if (replay(session, receipt)) return session;
  editable(session, args);
  const index = STEPS.indexOf(args.step);
  if (index < 0 || index > STEPS.indexOf(session.step) || args.step === 'practice') fail('invalid-learning-step');
  session.records[args.step].content = text(args.content);
  session.requests.push(receipt);
  touch(session);
  return session;
}
export function sessionPause(state, args) {
  const session = sessionOf(state, args.id), receipt = request(args, 'pause');
  if (replay(session, receipt)) return session;
  if (session.version !== args.version) fail('learning-version-conflict');
  if (session.status === 'completed') fail('learning-session-completed');
  session.status = args.paused === false ? 'active' : 'paused'; session.requests.push(receipt); touch(session);
  return session;
}
export function sessionAdvance(state, args) {
  const session = sessionOf(state, args.id), receipt = request(args, 'advance');
  if (replay(session, receipt)) return session;
  editable(session, args);
  const step = session.step, record = session.records[step];
  if (args.skip === true) Object.assign(record, { status: 'skipped', reason: text(args.reason, 1000) });
  else {
    if (step === 'practice') {
      const run = state.runs.find(run => run.id === record.runId);
      if (!run?.entries.length || !run.entries.every(entry => entry.feedback)) fail('learning-practice-incomplete');
    } else if (!record.content.trim()) fail('learning-content-required');
    const skipped = step === 'practice' ? state.runs.find(run => run.id === record.runId)?.skippedQuestions?.length ?? 0 : 0;
    record.status = skipped ? 'completed-with-skips' : 'completed';
    if (skipped) record.skippedQuestions = skipped;
  }
  record.completedAt = now();
  const next = STEPS[STEPS.indexOf(step) + 1];
  if (next) session.step = next;
  else { session.status = 'completed'; session.outcome = STEPS.some(step => session.records[step].status !== 'completed') ? 'with-skips' : 'complete'; }
  session.requests.push(receipt); touch(session);
  return session;
}
export function sessionPractice(state, args, mutate) {
  const session = sessionOf(state, args.id), receipt = request(args, 'practice.start');
  if (replay(session, receipt)) return { ...session.requests.find(item => item.id === receipt.id).result, session };
  editable(session, args);
  if (session.step !== 'practice') fail('invalid-learning-step');
  if (session.records.practice.runId) {
    receipt.result = { status: 'ok', runId: session.records.practice.runId };
    session.requests.push(receipt); touch(session);
    return { ...receipt.result, session };
  }
  const target = resolveSessionTarget(state, session.scope, session.target);
  if (target.basisRevision !== session.basisRevision || target.materials.some(material => material.revision === null)) fail('learning-target-stale');
  if (!target.practiceScope.length) {
    receipt.result = { status: 'empty', reason: 'no-questions', runId: null };
    session.requests.push(receipt); touch(session);
    return { ...receipt.result, session };
  }
  const run = mutate('review.start', state, { mode: 'path', scope: target.practiceScope, fresh: true, learningSessionId: session.id });
  session.records.practice.runId = run.id;
  receipt.result = { status: 'ok', runId: run.id };
  session.requests.push(receipt); touch(session);
  return { status: 'ok', session, runId: run.id };
}
