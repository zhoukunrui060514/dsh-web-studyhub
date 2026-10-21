import { isExamPointListSource } from './exam-point-list.js';
import { fail, digest, pageOf } from './curriculum.js';

const collections = state => ({ skeleton: state.skeletons, template: state.workflowTemplates, workflow: state.workflowSessions,
  'exam-points': state.sources.filter(isExamPointListSource), note: state.notes });

export function legacyInventory(state, args = {}) {
  const groups = collections(state);
  return { counts: Object.fromEntries(Object.entries(groups).map(([type, items]) => [type, items.length])),
    ...pageOf(Object.entries(groups).flatMap(([type, items]) => items.map(item => ({ type, id: item.id,
      title: String(item.title ?? item.topic ?? item.template?.title ?? '').slice(0, 240),
      references: { scope: item.scope ?? null, cards: item.cards?.map(c => ({ deckId: c.deckId, cardId: c.cardId })) ?? [],
        sourceIds: item.sourceIds ?? [], nodeCount: item.nodes?.length ?? 0 },
      migration: type === 'workflow' ? 'explicit-preview-required' : 'retained-exportable' }))), args, digest(groups)),
    host: { included: false, retained: ['board', 'notebook registry', 'live recording files', 'credentials'],
      reason: 'Host data is not part of a learning-library export. Existing host APIs retain ownership.' } };
}

export function legacyExport(state, args) {
  const group = collections(state)[args.type];
  if (!group) fail('invalid-legacy-type');
  const item = group.find(item => item.id === args.id);
  if (!item) fail('legacy-unavailable');
  const json = JSON.stringify(item, null, 2);
  return { type: args.type, id: item.id, format: args.format ?? 'json',
    content: args.format === 'markdown' ? `# ${item.title ?? item.topic ?? item.id}\n\n${item.markdown ?? item.text ?? ''}\n\n完整原始对象（含元数据与历史）：\n\n\`\`\`json\n${json}\n\`\`\`\n` : json };
}

export const legacySchemas = {
  'legacy.inventory': { input: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: { type: 'string' } }, additionalProperties: false }, output: { type: 'object', additionalProperties: true }, description: 'Read legacy object counts and bounded references with explicit migration/export status; never migrate or remove data.' },
  'legacy.export': { input: { type: 'object', properties: { type: { type: 'string', enum: ['skeleton', 'template', 'workflow', 'exam-points', 'note'] }, id: { type: 'string' }, format: { type: 'string', enum: ['json', 'markdown'] } }, required: ['type', 'id'], additionalProperties: false },
    output: { type: 'object', additionalProperties: true }, description: 'Export one complete original object, including branches, manual text and note metadata; no truncation or migration.' },
};
