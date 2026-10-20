export const KNOWLEDGE_TEXTS = [
  '正常条件下，静脉回流增加促进心输出量增加。心输出量增加可促进动脉血压升高，但取决于外周阻力。',
  '课程二：静脉回流增加促进心输出量增加。外周阻力降低时，心输出量增加不一定导致动脉血压升高。',
  '新增课程：静脉回流增加促进心输出量增加。在外周阻力不变条件下，心输出量增加促进动脉血压升高。',
];
export function knowledgeFixtureReply(system, prompt) {
  if (!`${system}\n${prompt}`.includes('knowledge-extract') && !`${system}\n${prompt}`.includes('knowledge-qa')) return null;
  const match = prompt.indexOf('{"type":"knowledge-');
  if (match < 0) return null;
  let input;
  // The host may surround the JSON prompt with worker instructions.
  for (let end = prompt.lastIndexOf('}'); end > match; end = prompt.lastIndexOf('}', end - 1)) {
    try { input = JSON.parse(prompt.slice(match, end + 1)); break; } catch { /* find exact JSON end */ }
  }
  if (!input) return null;
  if (input.type === 'knowledge-qa') return JSON.stringify({ answer: '资料指出：静脉回流增加促进心输出量增加。反向查看不改变事实方向；血压变化需要结合外周阻力条件，链路连接不证明净因果效果。', citationIds: input.evidence.map(e => e.id), supplemental: false });
  const segment = input.segments[0];
  const evidence = [{ sourceId: segment.sourceId, quote: segment.text, start: segment.start, end: segment.end, assertion: 'asserted' }];
  const nodes = ['静脉回流增加', '心输出量增加', '动脉血压升高'].map((label, i) => ({ id: `n${i}`, label, aliases: [], definition: label, evidence }));
  return JSON.stringify({ nodes, edges: [
    { id: 'e0', from: 'n0', to: 'n1', predicate: 'promotes', conditions: '正常条件下', note: '', evidence },
    { id: 'e1', from: 'n1', to: 'n2', predicate: 'promotes', conditions: segment.text.includes('降低') ? '外周阻力降低时不一定升高' : '外周阻力不变', note: '必须结合条件判断', evidence: evidence.map(e => ({ ...e, assertion: 'inferred' })) },
  ] });
}
