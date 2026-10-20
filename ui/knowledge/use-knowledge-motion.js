import { useCallback, useEffect, useRef, useState } from 'react';
import { createKnowledgeSimulation } from './simulation.js';
export function useKnowledgeMotion(graph, positions) {
  const [frame, setFrame] = useState(positions), [settled, setSettled] = useState(false);
  const simulation = useRef(null), animation = useRef(null), reduced = useRef(false), current = useRef(positions), topology = useRef(null), graphRef = useRef(graph);
  graphRef.current = graph;
  const advance = useCallback(function advance() {
    animation.current = null;
    const engine = simulation.current; if (!engine) return;
    engine.tick(reduced.current ? 240 : 3); current.current = engine.positions(); setFrame(current.current);
    if (engine.active()) animation.current = requestAnimationFrame(advance);
    else setSettled(true);
  }, []);
  const run = useCallback(() => { setSettled(false); if (animation.current === null) animation.current = requestAnimationFrame(advance); }, [advance]);
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const key = graph.nodes.map(n => n.id).join('|') + ':' + graph.edges.map(e => e.id).join('|');
    if (key === topology.current) return;
    const first = topology.current === null; topology.current = key;
    if (animation.current !== null) cancelAnimationFrame(animation.current); animation.current = null;
    simulation.current = null;
    const start = Object.fromEntries(graph.nodes.map(n => [n.id, current.current[n.id] || positions[n.id]]));
    if (first || reduced.current) { current.current = positions; setFrame(positions); setSettled(true); return; }
    setSettled(false); const began = performance.now();
    const morph = time => {
      const t = Math.min(1, (time - began) / 360), ease = t * t * (3 - 2 * t);
      current.current = Object.fromEntries(Object.entries(positions).map(([id, end]) => { const a = start[id] || end; return [id, { x: a.x + (end.x - a.x) * ease, y: a.y + (end.y - a.y) * ease }]; }));
      setFrame(current.current);
      if (t < 1) animation.current = requestAnimationFrame(morph); else { animation.current = null; setSettled(true); }
    };
    animation.current = requestAnimationFrame(morph);
  }, [positions, run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (animation.current !== null) cancelAnimationFrame(animation.current); }, []);
  return { positions: frame, settled,
    pin: (id, x, y) => {
      if (!simulation.current) { if (animation.current !== null) cancelAnimationFrame(animation.current); animation.current = null; simulation.current = createKnowledgeSimulation({ ...graphRef.current, positions: current.current }); }
      simulation.current.pin(id, x, y); run();
    },
    release: id => { simulation.current?.release(id); run(); },
  };
}
