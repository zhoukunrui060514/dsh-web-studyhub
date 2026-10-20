import { id as newId } from '../../util.js';
import { knowledgeError } from './model.js';
const key = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
const names = n => [n.label, ...(n.aliases || [])].map(key);

export function mergeCandidates(state, batch, { createId = newId } = {}) {
  const pool = [...state.knowledgeNodes], nodes = [], edges = [], mergeProposals = [], nodeMap = new Map(), edgeMap = new Map();
  for (const n of batch.nodes) {
    const candidates = pool.filter(p => names(p).some(name => names(n).includes(name)));
    const semanticMatch = candidates.find(p => key(n.definition) && key(p.definition) === key(n.definition));
    const match = semanticMatch && pool.find(p => p.id === canonicalNode(state, semanticMatch.id));
    const node = match || { ...n, id: createId(), createdAt: new Date().toISOString(), manualOverrides: {} };
    nodeMap.set(n.id, node.id);
    if (!nodes.some(x => x.id === node.id)) nodes.push(structuredClone(node));
    if (!match) {
      pool.push(node);
      for (const candidateId of new Set(candidates.map(p => canonicalNode(state, p.id)))) mergeProposals.push({ id: createId(), nodeId: node.id, candidateId, status: 'pending', reason: 'Matching name or alias; meaning needs confirmation' });
    }
  }
  for (const e of batch.edges) {
    let from = nodeMap.get(e.from), to = nodeMap.get(e.to);
    if (e.direction === 'undirected' && from > to) [from, to] = [to, from];
    const match = [...state.knowledgeEdges, ...edges].find(p => p.from === from && p.to === to && p.predicate === e.predicate && p.conditions === e.conditions && p.note === e.note);
    const edge = match || { ...e, id: createId(), from, to, manualOverrides: {} };
    edgeMap.set(e.id, edge.id);
    if (!edges.some(x => x.id === edge.id)) edges.push(structuredClone(edge));
  }
  const evidence = batch.evidence.map(e => ({ ...e, id: createId(), targetId: (e.targetKind === 'node' ? nodeMap : edgeMap).get(e.targetId) }));
  return { nodes, edges, evidence, mergeProposals };
}

export function canonicalNode(state, nodeId) {
  const seen = new Set(); let current = nodeId;
  for (;;) {
    if (seen.has(current)) throw knowledgeError('merge-cycle');
    seen.add(current);
    const redirect = state.knowledgeMerges.find(m => m.oldId === current && m.canonicalId);
    if (!redirect) return current;
    current = redirect.canonicalId;
  }
}
export function acceptMerge(state, proposalId) {
  const p = state.knowledgeMerges.find(m => m.id === proposalId && m.nodeId && m.candidateId);
  if (!p || p.status === 'rejected') throw knowledgeError('merge-unavailable');
  if (p.status === 'accepted') return { canonicalId: canonicalNode(state, p.candidateId) };
  const from = canonicalNode(state, p.nodeId), to = canonicalNode(state, p.candidateId);
  if (!state.knowledgeNodes.some(n => n.id === from) || !state.knowledgeNodes.some(n => n.id === to)) throw knowledgeError('node-unavailable');
  if (from !== to) {
    for (const e of state.knowledgeEdges) { if (e.from === from) e.from = to; if (e.to === from) e.to = to; }
    for (const e of state.knowledgeEvidence) if (e.targetKind === 'node' && e.targetId === from) e.targetId = to;
    state.knowledgeMerges.push({ id: newId(), oldId: from, canonicalId: to, status: 'redirect' });
  }
  p.status = 'accepted';
  return { canonicalId: to };
}
export function rejectMerge(state, proposalId) {
  const p = state.knowledgeMerges.find(m => m.id === proposalId && m.status === 'pending');
  if (!p) throw knowledgeError('merge-unavailable');
  p.status = 'rejected';
}
