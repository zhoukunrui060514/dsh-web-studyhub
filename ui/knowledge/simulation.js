const angle = Math.PI * (3 - Math.sqrt(5));
export const knowledgeNodeRadius = degree => Math.min(13, 3.5 + Math.sqrt(degree || 0) * 2.2);

// A small, bounded force system for the graph's existing 300-node display limit.
// Coordinates are view state only; source records and semantic edges stay untouched.
export function createKnowledgeSimulation({ nodes, edges = [], positions = {}, width = 1000, height = 700 }) {
  const ordered = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const adjacent = new Map(ordered.map(n => [n.id, []]));
  const links = edges.filter(e => adjacent.has(e.from) && adjacent.has(e.to) && e.from !== e.to);
  for (const e of links) { adjacent.get(e.from).push(e.to); adjacent.get(e.to).push(e.from); }
  const components = [], visited = new Set();
  for (const node of ordered) {
    if (visited.has(node.id)) continue;
    const queue = [node.id], component = []; visited.add(node.id);
    for (let i = 0; i < queue.length; i++) { const id = queue[i]; component.push(id); for (const next of adjacent.get(id)) if (!visited.has(next)) { visited.add(next); queue.push(next); } }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const particles = new Map(); let cluster = 0, isolated = 0;
  const singletons = components.filter(c => c.length === 1).length;
  for (const component of components) {
    const alone = component.length === 1;
    const theta = alone ? isolated++ * Math.PI * 2 / Math.max(1, singletons) : cluster * angle;
    const radius = alone ? (nodes.length > 12 ? Math.min(width, height) * .62 : 220) : cluster++ ? 90 * Math.sqrt(cluster) : 0;
    const anchorX = width / 2 + Math.cos(theta) * radius, anchorY = height / 2 + Math.sin(theta) * radius;
    component.sort((a, b) => adjacent.get(b).length - adjacent.get(a).length || a.localeCompare(b));
    component.forEach((id, i) => {
      const r = component.length > 1 ? 30 * Math.sqrt(i + 1) : 0;
      const seed = positions[id] || { x: anchorX + Math.cos(i * angle) * r, y: anchorY + Math.sin(i * angle) * r };
      particles.set(id, { id, x: seed.x, y: seed.y, vx: 0, vy: 0, ax: anchorX, ay: anchorY, radius: knowledgeNodeRadius(adjacent.get(id).length) });
    });
  }
  const list = [...particles.values()]; let alpha = 1, ticks = 0;
  const active = () => alpha > .004 && ticks < 240;
  function tick(count = 1) {
    for (let iteration = 0; iteration < count && active(); iteration++) {
      for (const p of list) { p.vx += (p.ax - p.x) * .008 * alpha; p.vy += (p.ay - p.y) * .008 * alpha; }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]; let dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) + Math.abs(dy) < .01) { dx = Math.cos(i + j * angle) * .1; dy = Math.sin(i + j * angle) * .1; }
        const d2 = dx * dx + dy * dy, distance = Math.sqrt(d2), minimum = a.radius + b.radius + 10;
        const repulsion = (18 / (d2 + 16) + Math.max(0, minimum - distance) * .22 / distance) * alpha;
        const x = dx * repulsion, y = dy * repulsion; a.vx -= x; a.vy -= y; b.vx += x; b.vy += y;
      }
      for (const e of links) {
        const a = particles.get(e.from), b = particles.get(e.to), dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy)), strength = (distance - (nodes.length <= 12 ? 145 : 80)) / distance * .035 * alpha;
        a.vx += dx * strength; a.vy += dy * strength; b.vx -= dx * strength; b.vy -= dy * strength;
      }
      for (const p of list) {
        p.vx *= .72; p.vy *= .72;
        if (p.pin) { p.x = p.pin.x; p.y = p.pin.y; p.vx = p.vy = 0; }
        else { p.x += p.vx; p.y += p.vy; }
      }
      alpha *= .968; ticks++;
    }
  }
  return {
    tick, active,
    positions: () => Object.fromEntries(list.map(p => [p.id, { x: p.x, y: p.y }])),
    pin(id, x, y) { const p = particles.get(id); if (p) { p.pin = { x, y }; p.x = x; p.y = y; alpha = Math.max(alpha, .45); ticks = 0; } },
    release(id) { const p = particles.get(id); if (p) { delete p.pin; p.ax = p.x; p.ay = p.y; alpha = Math.max(alpha, .35); ticks = 0; } },
  };
}
