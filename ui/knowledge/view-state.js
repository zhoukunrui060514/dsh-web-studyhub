export const initialKnowledgeView = { focusId: null, depth: 1, history: [], selection: null, sequence: 0, graph: null };
export function reduceKnowledgeView(state, event) {
  if (event.type === 'request') return { ...state, sequence: event.sequence };
  if (event.type === 'result') return event.sequence === state.sequence ? { ...state, graph: event.graph } : state;
  if (event.type === 'focus') return { ...state, history: [...state.history, { focusId: state.focusId, depth: state.depth }], focusId: event.id, depth: 1, selection: event.preserveSelection ? state.selection : { kind: 'node', id: event.id } };
  if (event.type === 'back') { const previous = state.history.at(-1); return previous ? { ...state, ...previous, history: state.history.slice(0, -1) } : state; }
  if (event.type === 'expand') return { ...state, depth: Math.min(6, state.depth + 1) };
  if (event.type === 'reset') return { ...initialKnowledgeView, sequence: state.sequence };
  if (event.type === 'select') return { ...state, selection: event.target };
  return state;
}
export function appendPath(path, edge, edges) {
  if (path.edgeIds.length >= 12) throw new Error('链路最多 12 条关系，请分段提问');
  let current = path.startNodeId;
  for (const id of path.edgeIds) { const e = edges.find(item => item.id === id); if (!e || ![e.from, e.to].includes(current)) throw new Error('请选择顺序相连的关系'); current = e.from === current ? e.to : e.from; }
  if (![edge.from, edge.to].includes(current)) throw new Error('请选择顺序相连的关系');
  return { ...path, edgeIds: [...path.edgeIds, edge.id] };
}
