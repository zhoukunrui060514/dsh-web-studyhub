import { useCallback, useEffect, useRef, useState } from 'react';
import { createKnowledgeSimulation } from './simulation.js';
export function useKnowledgeMotion(graph, positions) {
  const [frame, setFrame] = useState(positions), [settled, setSettled] = useState(false);
  const simulation = useRef(null), animation = useRef(null), reduced = useRef(false);
  const advance = useCallback(function advance() {
    animation.current = null;
    const engine = simulation.current; if (!engine) return;
    engine.tick(reduced.current ? 240 : 3); setFrame(engine.positions());
    if (engine.active()) animation.current = requestAnimationFrame(advance);
    else setSettled(true);
  }, []);
  const run = useCallback(() => { setSettled(false); if (animation.current === null) animation.current = requestAnimationFrame(advance); }, [advance]);
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    simulation.current = createKnowledgeSimulation({ ...graph, positions });
    setFrame(positions); run();
    return () => { if (animation.current !== null) cancelAnimationFrame(animation.current); animation.current = null; simulation.current = null; };
  }, [positions, run]); // eslint-disable-line react-hooks/exhaustive-deps
  return { positions: frame, settled,
    pin: (id, x, y) => { simulation.current?.pin(id, x, y); run(); },
    release: id => { simulation.current?.release(id); run(); },
  };
}
