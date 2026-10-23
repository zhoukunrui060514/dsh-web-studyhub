import { digest } from './curriculum.js';
import { learningError as fail } from './learning-session-target.js';
export const now = () => new Date().toISOString();
export const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value;
export const text = (value, limit = 40000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) fail('invalid-learning-content');
  return value.trim();
};
export function sessionOf(state, id) {
  const session = state.learningSessions.find(session => session.id === id);
  if (!session) fail('learning-session-unavailable');
  return session;
}
export function request(args, action) {
  return { id: text(args.requestId, 200), action, payload: digest(ordered(Object.fromEntries(Object.entries(args).filter(([key]) => !['version', 'requestId'].includes(key))))) };
}
export function replay(session, receipt) {
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
