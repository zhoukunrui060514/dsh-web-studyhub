import { AI_DESCRIPTION } from './jobs/messages.js';

const text = { type: 'string' };
const object = (properties, extra = {}) => ({ type: 'object', additionalProperties: true, properties, ...extra });

/** Contract of the 复习全书's 弄懂 / 加一段 task (generation.courseBook.explain). */
export const courseBookAiJobSchemas = {
  'courseBook.explain': { description: AI_DESCRIPTION,
    input: object({ course: text, heading: text, words: text, instruction: text, mode: { type: 'string', enum: ['explain', 'write', 'here', 'follow'] }, after: text, replace: text,
      allowFigure: { type: 'boolean' }, requestId: text, language: { type: 'string', enum: ['zh', 'en'] } }),
    output: object({ jobId: text, status: text, blockId: text }) },
  'courseBook.illustrate': { description: 'Generate one source-grounded explanation image. Requires a stable requestId; repeat it to resume without paying again.',
    input: object({ course: text, heading: text, words: text, instruction: text, after: text, replace: text, requestId: text, language: text, sourceRevision: text, expectedBlockRevision: text, figurePlan: { type: 'object' } }, { required: ['course', 'heading', 'requestId'] }), output: object({ jobId: text, status: text, blockId: text }) },
  'courseBook.imageStatus': { description: 'Read image capability and one request receipt without starting work.', input: object({ requestId: text }), output: object({ available: { type: 'boolean' }, status: text, jobId: text, blockId: text }) },
};
