import { digest, fail } from './curriculum.js';
import { assertMaterials } from './exam-point-list.js';

/** A small routing plan; each stage is executed and acknowledged by its existing owner. */
export function materialProcessingPlan(state, args, installed) {
  const routes = { document: ['materials', 'materials.document.import'], pdf: ['conversion', 'mineru.import'],
    audio: ['audio', 'audio.import'], subtitles: ['audio', 'audio.subtitles.import'] };
  const steps = [], sourceIds = [...new Set(args.sourceIds ?? [])];
  if (args.kind !== 'existing' && !routes[args.kind]) fail('invalid-processing-kind');
  if (args.kind === 'existing' && !sourceIds.length) fail('processing-source-required');
  const sources = sourceIds.map(id => state.sources.find(s => s.id === id && !s.archived));
  if (sources.some(s => !s)) fail('processing-source-unavailable');
  assertMaterials(sources);
  if (args.kind !== 'existing') {
    const [owner, operation] = routes[args.kind];
    steps.push({ stage: 'import', owner, status: installed[owner] && (owner !== 'conversion' || installed.materials) ? 'ready' : 'unavailable',
      receipt: owner === 'materials' ? 'documentId/sourceIds' : 'jobId (follow job status for documentId/sourceIds)',
      action: { operation, args: args.course !== undefined ? { course: args.course } : {} } });
  }
  if (args.generation) {
    const operations = { questions: 'generate', outline: 'generation.courseOutline.build', reading: 'generation.courseBook.build' };
    const operation = operations[args.generation];
    if (!operation) fail('invalid-processing-generation');
    const needsCourse = args.generation !== 'questions';
    steps.push({ stage: 'generation', owner: 'generation', requiresModel: true,
      status: !installed.generation ? 'unavailable' : args.kind !== 'existing' ? 'awaiting-materials' : needsCourse && args.course === undefined ? 'needs-course' : 'ready',
      receipt: 'jobId (generation/publish result is separate from import)',
      action: { operation, args: needsCourse ? (args.course !== undefined ? { course: args.course } : {}) : { sourceIds } } });
  }
  return { kind: args.kind, basis: sources.map(source => ({ sourceId: source.id, revision: digest([source.text, source.document ?? null]) })), steps,
    automatic: false, publication: 'Use the existing reviewed publication action; retry the original job or draft instead of importing again.' };
}

export const materialProcessingSchema = {
  input: { type: 'object', properties: {
    kind: { type: 'string', enum: ['existing', 'document', 'pdf', 'audio', 'subtitles'] },
    sourceIds: { type: 'array', maxItems: 500, items: { type: 'string' } }, course: { type: 'string' },
    generation: { type: 'string', enum: ['questions', 'outline', 'reading'] },
  }, required: ['kind'], additionalProperties: false }, output: { type: 'object', additionalProperties: true },
  description: 'Plan material import/conversion/transcription and optional generation as separate existing owner actions and receipts; no execution, placeholders or model calls.',
};
