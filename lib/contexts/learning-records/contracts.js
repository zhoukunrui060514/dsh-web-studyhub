const text = { type: 'string' };
const type = { type: 'string', enum: ['session', 'run', 'attempt', 'note'] };
const scope = { type: 'object', properties: { kind: { type: 'string', enum: ['course', 'unassigned', 'all'] }, courseId: text, includeDescendants: { type: 'boolean' } }, required: ['kind'], additionalProperties: false };
const pagination = { limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: text };
const schema = (properties, required, description) => ({ input: { type: 'object', properties, required, additionalProperties: false }, output: { type: 'object', additionalProperties: true }, description });
export const learningRecordsSchemas = {
  'learning.records.query': schema({ scope, type, ...pagination }, ['scope'], 'Read bounded history from existing sessions, practice runs, answers and notes; no duplicate storage or generation.'),
  'learning.records.get': schema({ type, id: text }, ['type', 'id'], 'Read one original record and explicit question/session/material links, including unavailable historical references.'),
  'learning.reinforcement.query': schema({ scope, ...pagination }, ['scope'], 'Read current weak questions using the existing mastery calculation; only actual study answers change the result.'),
};
