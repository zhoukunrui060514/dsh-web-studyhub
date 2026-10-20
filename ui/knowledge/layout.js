// The world grows with the graph; the camera never compresses reading size.
export function layoutKnowledge({ nodes, edges = [], focusId, previousPositions = {}, width = 1000, height = 600 }) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * width / height * 110 / 220)));
  const adjacent = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) if (adjacent.has(e.from) && adjacent.has(e.to)) { adjacent.get(e.from).push(e.to); adjacent.get(e.to).push(e.from); }
  const ordered = [], seen = new Set();
  for (const n of [...nodes].sort((a, b) => a.id === focusId ? -1 : b.id === focusId ? 1 : a.id.localeCompare(b.id))) {
    const queue = [n.id];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]; if (seen.has(id)) continue;
      seen.add(id); ordered.push(id); queue.push(...adjacent.get(id).filter(next => !seen.has(next)).sort());
    }
  }
  const positions = {};
  const visible = new Set(nodes.map(n => n.id));
  const retained = Object.keys(previousPositions).every(id => visible.has(id)) ? previousPositions : {};
  ordered.forEach((id, i) => {
    positions[id] = retained[id] || { x: (i % columns) * 220 + 120, y: Math.floor(i / columns) * 110 + 70 };
  });
  const points = Object.values(positions);
  return { positions, bounds: { width: Math.max(width, ...points.map(p => p.x + 120)), height: Math.max(height, ...points.map(p => p.y + 70)) } };
}

export const relationLabel = predicate => ({ causes: '导致', promotes: '促进', inhibits: '抑制', 'part-of': '属于', prerequisite: '前提', contrasts: '对比', related: '相关' }[predicate] || predicate);
