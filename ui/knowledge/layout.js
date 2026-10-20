import { createKnowledgeSimulation } from './simulation.js';
export function layoutKnowledge({ nodes, edges = [], previousPositions = {}, width = 1000, height = 700 }) {
  const ids = new Set(nodes.map(n => n.id));
  const retained = Object.keys(previousPositions).every(id => ids.has(id)) ? previousPositions : {};
  const simulation = createKnowledgeSimulation({ nodes, edges, positions: retained, width, height });
  simulation.tick(160);
  const positions = simulation.positions(), points = Object.values(positions);
  const minX = Math.min(0, ...points.map(p => p.x - 40)), minY = Math.min(0, ...points.map(p => p.y - 40));
  for (const p of points) { p.x -= minX; p.y -= minY; }
  return { positions, bounds: { width: Math.max(width, ...points.map(p => p.x + 40)), height: Math.max(height, ...points.map(p => p.y + 40)) } };
}
export const relationLabel = predicate => ({ causes: '导致', promotes: '促进', inhibits: '抑制', 'part-of': '属于', prerequisite: '前提', contrasts: '对比', related: '相关' }[predicate] || predicate);

// Labels stay at reading size, so choose free quadrants instead of shrinking text.
export function knowledgeLabels({ nodes, positions, degrees, camera, width, height, selectedId, hoveredId, scopeLabel = '' }) {
  const ranked = [...nodes].sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0) || a.id.localeCompare(b.id));
  const labels = {}, occupied = [], limit = nodes.length <= 24 || camera.zoom >= 1.5 ? 36 : 10;
  const overlap = (a, b) => a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 5 && a.y + a.h + 5 > b.y;
  for (const node of ranked) {
    const p = positions[node.id]; if (!p) continue;
    const important = node.id === selectedId || node.id === hoveredId;
    if (!important && (occupied.length >= limit || nodes.length > 24 && camera.zoom < 1.5 && !(degrees[node.id] >= 2))) continue;
    const x = p.x * camera.zoom + camera.x, y = p.y * camera.zoom + camera.y;
    if (x < 0 || y < 0 || x > width || y > height) continue;
    const text = Array.from(node.label).slice(0, 16).join('') + (Array.from(node.label).length > 16 ? '…' : '');
    const scope = node.outsideFilter ? scopeLabel : '';
    const measure = value => Array.from(value).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 15 : 8), 0);
    const w = Math.max(measure(text), measure(scope)), h = scope ? 42 : 22;
    const candidates = [{ x: x + 16, y: y - 11, w, h }, { x: x - w - 16, y: y - 11, w, h }, { x: x - w / 2, y: y + 15, w, h }, { x: x - w / 2, y: y - 37, w, h }];
    const box = candidates.find(b => b.x >= 4 && b.y >= 4 && b.x + b.w < width - 4 && b.y + b.h < height - 4 && !occupied.some(o => overlap(b, o)));
    if (box) { labels[node.id] = { text, scope, x: (box.x - camera.x) / camera.zoom - p.x, y: (box.y + 16 - camera.y) / camera.zoom - p.y, w: box.w / camera.zoom }; occupied.push(box); }
  }
  return labels;
}
