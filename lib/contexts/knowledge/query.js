import { fingerprint } from './materials.js';
import { normalizeFilter, knowledgeError } from './model.js';
import { canonicalNode } from './merge.js';

export function projectedEvidence(state, materials, filter = {}, { currentOnly = false } = {}) {
  const f = normalizeFilter(filter), byId = new Map(materials.map(m => [m.identity, m]));
  return state.knowledgeEvidence.flatMap(e => {
    const m = byId.get(e.materialIdentity);
    if (!m || m.archived || e.superseded || (f.materialIds.length && !f.materialIds.includes(m.identity))) return [];
    const stale = e.revision !== m.revision;
    if (currentOnly && stale) return [];
    const outsideFilter = f.courseIds.length > 0 && !m.courses.some(c => f.courseIds.includes(c));
    if (outsideFilter && !f.includeCrossCourse) return [];
    return [{ ...e, courses: m.courses, versionStatus: stale ? 'stale' : 'current', outsideFilter }];
  });
}
const revisionOf = (state, materials) => fingerprint([state.knowledgeNodes, state.knowledgeEdges, state.knowledgeEvidence,
  state.knowledgeMerges, materials.map(m => [m.identity, m.revision, m.archived, m.courses])]);
const ordered = values => values.sort((a, b) => a.id.localeCompare(b.id));

function projection(state, materials, filter) {
  const evidence = projectedEvidence(state, materials, filter), groups = new Map();
  for (const e of evidence) { const k = `${e.targetKind}:${e.targetId}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const project = (items, kind) => ordered(items.filter(n => groups.has(`${kind}:${n.id}`)).map(n => {
    const sources = groups.get(`${kind}:${n.id}`), current = sources.filter(e => e.versionStatus === 'current');
    const contribution = (current.at(-1) || sources.at(-1)).contribution || {};
    // Only editable semantic fields are projected. IDs and direction always come from stored graph records.
    const fields = kind === 'node' ? ['label', 'aliases', 'definition'] : ['conditions', 'note'];
    const values = Object.fromEntries(fields.filter(k => contribution[k] !== undefined).map(k => [k, contribution[k]]));
    return { ...n, ...values, ...n.manualOverrides, courses: [...new Set(sources.flatMap(e => e.courses))].sort(),
      versionStatus: current.length ? 'current' : 'stale', outsideFilter: sources.every(e => e.outsideFilter) };
  }));
  const nodes = project(state.knowledgeNodes, 'node').filter(n => canonicalNode(state, n.id) === n.id), ids = new Set(nodes.map(n => n.id));
  const edges = project(state.knowledgeEdges, 'edge').filter(e => ids.has(e.from) && ids.has(e.to));
  return { nodes, edges, evidence };
}

export function queryKnowledge(state, materials, request = {}) {
  let { nodes, edges } = projection(state, materials, request);
  if (request.query) { const q = String(request.query).toLocaleLowerCase(); nodes = nodes.filter(n => `${n.label} ${(n.aliases || []).join(' ')} ${n.definition || ''}`.toLocaleLowerCase().includes(q)); }
  if (request.focusId) {
    const focus = canonicalNode(state, request.focusId), visible = new Set([focus]), distances = new Map([[focus, 0]]);
    const depth = Math.min(6, Math.max(1, Math.floor(request.depth) || 1));
    for (let i = 0; i < depth; i++) {
      const previous = new Set(visible);
      for (const e of edges) if (previous.has(e.from) || previous.has(e.to)) {
        for (const id of [e.from, e.to]) if (!visible.has(id)) { visible.add(id); distances.set(id, i + 1); }
      }
    }
    nodes = nodes.filter(n => visible.has(n.id));
    nodes.sort((a, b) => distances.get(a.id) - distances.get(b.id) || a.id.localeCompare(b.id));
  }
  const allIds = new Set(nodes.map(n => n.id)); edges = edges.filter(e => allIds.has(e.from) && allIds.has(e.to));
  const totals = { nodes: nodes.length, edges: edges.length };
  const limit = (value, max) => Math.min(max, Math.max(1, Math.floor(Number(value)) || max));
  nodes = nodes.slice(0, limit(request.nodeLimit, 300));
  const ids = new Set(nodes.map(n => n.id)); edges = edges.filter(e => ids.has(e.from) && ids.has(e.to)).slice(0, limit(request.edgeLimit, 600));
  const displayed = { nodes: nodes.length, edges: edges.length };
  return { nodes, edges, totals, displayed, truncated: displayed.nodes < totals.nodes || displayed.edges < totals.edges, graphRevision: revisionOf(state, materials) };
}

export function knowledgeDetail(state, materials, { kind, id, filter = {} }) {
  const canonicalId = kind === 'node' ? canonicalNode(state, id) : id;
  const projected = projection(state, materials, filter), item = projected[kind === 'node' ? 'nodes' : 'edges'].find(n => n.id === canonicalId);
  if (!item) return { item: null, evidence: [], versionStatus: 'unavailable', reason: '当前筛选内无可用资料依据' };
  return { item, evidence: projected.evidence.filter(e => e.targetKind === kind && e.targetId === canonicalId), versionStatus: item.versionStatus,
    ...(canonicalId !== id ? { redirect: { oldId: id, canonicalId } } : {}),
    ...(kind === 'node' ? { relations: projected.edges.filter(e => e.from === canonicalId || e.to === canonicalId), merges: state.knowledgeMerges.filter(m => m.status === 'pending' && [m.nodeId, m.candidateId].includes(canonicalId))
      .map(m => ({ ...m, concepts: [m.nodeId, m.candidateId].map(id => projected.nodes.find(n => n.id === id)).filter(Boolean) })).filter(m => m.concepts.length === 2) } : {}) };
}

export function resolvePath(state, target) {
  if (target?.kind !== 'path' || !Array.isArray(target.edgeIds) || !target.edgeIds.length) throw knowledgeError('invalid-path');
  if (target.edgeIds.length > 12) throw knowledgeError('path-too-long', '链路最多 12 条关系，请分段提问');
  let current = canonicalNode(state, target.startNodeId);
  const nodes = [current], edges = [], traversals = [];
  for (const id of target.edgeIds) {
    const edge = state.knowledgeEdges.find(e => e.id === id);
    if (!edge || (edge.from !== current && edge.to !== current)) throw knowledgeError('disconnected-path', '请选择顺序相连的关系');
    const reversed = edge.from !== current;
    current = reversed ? edge.from : edge.to;
    edges.push(edge); nodes.push(current); traversals.push({ edgeId: id, reversed, from: nodes.at(-2), to: current });
  }
  return { nodes, edges, traversals };
}
