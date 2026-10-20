import { fingerprint } from './materials.js';
import { normalizeFilter, knowledgeError } from './model.js';
import { knowledgeDetail, projectedEvidence, resolvePath } from './query.js';
import { canonicalNode } from './merge.js';

export function prepareKnowledgeQuestion(state, materials, { target, filter = {}, question, threadId, libraryId = '' }) {
  if (typeof question !== 'string' || !question.trim()) throw knowledgeError('question-required');
  if (question.length > 4000) throw knowledgeError('question-too-long', '问题最多 4000 字符');
  if (!target || !['node', 'edge', 'path'].includes(target.kind)) throw knowledgeError('invalid-target');
  const normalized = target.kind === 'path' ? { kind: 'path', startNodeId: canonicalNode(state, target.startNodeId), edgeIds: [...target.edgeIds] }
    : { kind: target.kind, id: target.kind === 'node' ? canonicalNode(state, target.id) : target.id };
  const path = target.kind === 'path' ? resolvePath(state, normalized) : null;
  const targets = path ? [...new Set(path.nodes)].map(id => ({ kind: 'node', id })).concat(path.edges.map(e => ({ kind: 'edge', id: e.id }))) : [normalized];
  const details = targets.map(t => knowledgeDetail(state, materials, { ...t, filter }));
  if (details.some(d => !d.item)) throw knowledgeError('target-unavailable', '当前筛选或资料版本内目标不可用');
  if (path) path.edges = path.edges.map(edge => details.find(d => d.item.id === edge.id && d.item.from)?.item);
  const current = projectedEvidence(state, materials, filter, { currentOnly: true }).filter(e => targets.some(t => t.kind === e.targetKind && t.id === e.targetId));
  const baseKey = fingerprint([libraryId, normalized, normalizeFilter(filter)]), evidenceVersion = fingerprint(current.map(e => [e.id, e.revision, e.quote, e.courses]));
  const thread = threadId ? state.knowledgeThreads.find(t => t.id === threadId) : state.knowledgeThreads.find(t => t.baseKey === baseKey);
  if (threadId && (!thread || thread.baseKey !== baseKey || thread.libraryId !== libraryId)) throw knowledgeError('thread-target-mismatch');
  const sources = [...new Set(current.map(e => e.materialIdentity))].sort(), allowance = Math.floor(24000 / Math.max(1, sources.length)), evidence = [];
  let omittedEvidence = 0;
  for (const source of sources) {
    let remaining = allowance;
    for (const e of current.filter(e => e.materialIdentity === source)) {
      if (!remaining) { omittedEvidence++; continue; }
      let quote = e.quote.slice(0, remaining);
      if (/[\uD800-\uDBFF]$/.test(quote)) quote = quote.slice(0, -1);
      if (quote.length < e.quote.length) omittedEvidence++;
      if (quote) evidence.push({ ...e, quote, end: e.start + quote.length, excerpted: quote.length < e.quote.length });
      remaining -= quote.length;
    }
  }
  const successful = (thread?.messages || []).filter(m => m.role === 'assistant' && m.status === 'complete').slice(-6);
  const messages = successful.flatMap(a => {
    const q = thread.messages.find(m => m.role === 'user' && m.requestId === a.requestId);
    return q ? [{ role: 'user', text: q.text }, { role: 'assistant', text: a.text }] : [];
  });
  return { baseKey, threadKey: fingerprint([baseKey, evidenceVersion]), evidenceVersion, target: normalized, filter: normalizeFilter(filter),
    evidence, messages, omittedEvidence, staleHistory: !!thread && thread.evidenceVersion !== evidenceVersion, threadId: thread?.id,
    path, items: details.map(d => d.item), question };
}
