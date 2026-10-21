export const learningTodaySchema = {
  input: { type: 'object', properties: {
    scope: { type: 'object', properties: { kind: { type: 'string', enum: ['all', 'unassigned', 'course'] }, courseId: { type: 'string' }, includeDescendants: { type: 'boolean' } }, required: ['kind'], additionalProperties: false },
    now: { type: 'number' },
  }, additionalProperties: false }, output: { type: 'object', additionalProperties: true },
  description: 'Read one deterministic next learning action and at most three alternatives, with explicit course targets and reasons; never changes focus or starts model work.',
};
