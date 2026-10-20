// A bounded grid avoids a force simulation on every render; surviving nodes keep their place.
export function layoutKnowledge({ nodes, previousPositions = {}, width = 1000, height = 600 }) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * width / height)));
  const rows = Math.max(1, Math.ceil(nodes.length / columns));
  const positions = {};
  [...nodes].sort((a, b) => a.id.localeCompare(b.id)).forEach((node, i) => {
    positions[node.id] = previousPositions[node.id] || { x: (i % columns + 0.5) * width / columns, y: (Math.floor(i / columns) + 0.5) * height / rows };
  });
  return { positions, bounds: { width, height } };
}
