const text = { type: 'string' }, integer = { type: 'integer', minimum: 1 };
const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const scope = object({ kind: { type: 'string', enum: ['course', 'unassigned', 'all'] }, courseId: text }, ['kind']);
const target = object({ kind: { type: 'string', enum: ['outline', 'topic'] }, nodeId: text, outlineRevision: text, deckId: text, topic: text }, ['kind']);
const step = { type: 'string', enum: ['explain', 'retell', 'practice', 'summary'] };
const identity = { id: text, version: integer };
const schema = (properties, required, description) => ({ input: object(properties, required), output: { type: 'object', additionalProperties: true }, description });
export const learningSessionSchemas = {
  'learning.session.start': schema({ scope, target, origin: { type: 'string', enum: ['today', 'knowledge', 'reinforcement'] }, requestId: text }, ['scope', 'target', 'origin', 'requestId'], 'Continue an unfinished session for the same course, target and material revision, or start a fixed explain/retell/practice/summary session; idempotent by requestId.'),
  'learning.session.get': schema({ id: text, step }, ['id'], 'Read persistent progress and basis availability, optionally looking back without advancing.'),
  'learning.session.record': schema({ ...identity, requestId: text, step, content: text }, ['id', 'version', 'requestId', 'step', 'content'], 'Save explanation, learner retelling or summary; never changes mastery or advances the step.'),
  'learning.session.advance': schema({ ...identity, requestId: text, skip: { type: 'boolean' }, reason: text }, ['id', 'version', 'requestId'], 'Complete the current step, or explicitly skip it with a reason. Practice needs real answered entries.'),
  'learning.session.pause': schema({ ...identity, requestId: text, paused: { type: 'boolean' } }, ['id', 'version', 'requestId'], 'Pause or resume a session without starting model work or changing its target.'),
  'learning.session.practice.start': schema({ ...identity, requestId: text }, ['id', 'version', 'requestId'], 'Atomically create and associate one existing study run; repeats return the same run; empty never creates a fake run.'),
  'learning.session.legacy.export': schema({ id: text, format: { type: 'string', enum: ['json', 'markdown'] } }, ['id'], 'Export the complete legacy workflow snapshot, records and history without migrating or truncating branches.'),
};
