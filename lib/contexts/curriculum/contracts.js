const text = { type: 'string' };
const scope = { type: 'object', properties: { kind: { type: 'string', enum: ['course', 'unassigned', 'all'] }, courseId: text, includeDescendants: { type: 'boolean' } }, required: ['kind'], additionalProperties: false };
const target = { type: 'object', properties: { kind: { type: 'string', enum: ['outline', 'topic'] }, nodeId: text, outlineId: text, outlineRevision: text, deckId: text, topic: text }, required: ['kind'], additionalProperties: false };
const query = { scope, target, nodeId: text, limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: text, offset: { type: 'integer', minimum: 0 } };
const schema = (properties, required, description) => ({ input: { type: 'object', properties, required, additionalProperties: false },
  output: { type: 'object', additionalProperties: true }, description });
const revision = { oneOf: [text, { type: 'null' }] };
export const curriculumSchemas = {
  'curriculum.get': schema({ ...query, view: { type: 'string', enum: ['structure', 'reading', 'exam'] } }, ['scope'], 'Read one course structure, projected reading or exam annotations without initializing a book.'),
  'curriculum.prepare': schema({ scope, expectedRevision: revision }, ['scope', 'expectedRevision'], 'Explicitly initialize or synchronize the review book against the expected outline revision, preserving learner edits.'),
  'curriculum.examPoints.preview': schema({ ...query, listId: text }, ['scope', 'listId'], 'Account for all legacy exam points as mapped, ambiguous or unplaced; no writes.'),
  'curriculum.examPoints.apply': schema({ scope, listId: text, expectedRevision: revision, listRevision: text, requestId: text,
    mappings: { type: 'array', maxItems: 300, items: { type: 'object', properties: { pointId: text, nodeId: revision }, required: ['pointId', 'nodeId'], additionalProperties: false } } },
  ['scope', 'listId', 'expectedRevision', 'listRevision', 'requestId', 'mappings'], 'Persist explicit point ownership with revision checks and an idempotency key; keep the original list unchanged.'),
};
