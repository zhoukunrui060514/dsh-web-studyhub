// Private service symbols cannot be supplied through an action's JSON arguments.
export const KNOWLEDGE_RECONCILE = Symbol('knowledge reconcile composition');
export const KNOWLEDGE_ORIGIN = Symbol('trusted material entry');
export const MATERIAL_ACTIONS = new Set(['source.add', 'source.import', 'sources.ingest', 'source.archive', 'source.remove', 'source.courses.set',
  'document.import', 'document.attach', 'document.get', 'course.rename', 'course.merge']);
export async function triggerKnowledgeReconcile(runtime, reason, services = {}) {
  const result = await runtime.invoke('knowledge.v1', 'knowledge.settings.get', {}, { ...services, [KNOWLEDGE_RECONCILE]: reason });
  return result.receipts;
}
export async function afterKnowledgeMaterialCommit({ runtime, services, installed }, { action }) {
  if (!installed || !MATERIAL_ACTIONS.has(action.replace(/^materials\./, ''))) return;
  // The material is already committed. A scheduler failure must never turn a successful import into a failed import.
  await triggerKnowledgeReconcile(runtime, 'materials-changed', services).catch(() => {});
}
