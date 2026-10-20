export function presentKnowledge(input, progress) {
  return observed => ({ title: '资料知识图谱', stage: { code: `knowledge.${progress.stage || observed.status}`, text: progress.error || progress.stage || observed.status },
    progress: { done: progress.done || 0, total: input.materials.length, unit: 'materials', percent: null, segments: [] },
    detail: { materials: progress.materials || [], materialIdentity: progress.identity || null }, legacy: {} });
}
