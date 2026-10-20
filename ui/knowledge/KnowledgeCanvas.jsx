import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '../components/Button.jsx';
import { ui } from '../i18n.js';
import { knowledgeLabels, relationLabel } from './layout.js';
import { knowledgeNodeRadius } from './simulation.js';
import { useKnowledgeMotion } from './use-knowledge-motion.js';
export default function KnowledgeCanvas({ graph, positions, selection, onNodeSelect, onNodeFocus, onEdgeSelect }) {
  const marker = useId().replace(/:/g, ''), viewport = useRef(null), svg = useRef(null), gesture = useRef(null), suppressClick = useRef(false), inertia = useRef(null), focusAnimation = useRef(null), pendingSelect = useRef(null), automaticFit = useRef(true);
  const [size, setSize] = useState({ width: 900, height: 640 }), [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 }), [hovered, setHovered] = useState(null);
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const motion = useKnowledgeMotion(graph, positions), frame = motion.positions;
  const degrees = useMemo(() => { const result = {}; for (const e of graph.edges) { result[e.from] = (result[e.from] || 0) + 1; result[e.to] = (result[e.to] || 0) + 1; } return result; }, [graph.edges]);
  const activeId = hovered || (selection?.kind === 'node' ? selection.id : null);
  const neighbors = new Set(activeId ? [activeId] : []);
  for (const edge of graph.edges) if ([edge.from, edge.to].includes(activeId)) { neighbors.add(edge.from); neighbors.add(edge.to); }
  const fitCamera = points => {
    const values = Object.values(points); if (!values.length) return { x: 0, y: 0, zoom: 1 };
    const minX = Math.min(...values.map(p => p.x)), maxX = Math.max(...values.map(p => p.x)), minY = Math.min(...values.map(p => p.y)), maxY = Math.max(...values.map(p => p.y));
    const padding = graph.nodes.length <= 12 ? 190 : 90;
    const zoom = Math.max(.15, Math.min(1.4, (size.width - 32) / Math.max(100, maxX - minX + padding), (size.height - 48) / Math.max(100, maxY - minY + 110)));
    return { x: size.width / 2 - (minX + maxX) / 2 * zoom, y: size.height / 2 - (minY + maxY) / 2 * zoom, zoom };
  };
  useEffect(() => {
    const measure = () => setSize({ width: viewport.current.clientWidth || 900, height: viewport.current.clientHeight || 640 });
    measure(); const observer = new ResizeObserver(measure); observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  useEffect(() => { automaticFit.current = true; setCamera(fitCamera(positions)); }, [positions, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (motion.settled && automaticFit.current) setCamera(fitCamera(frame)); }, [motion.settled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (inertia.current) cancelAnimationFrame(inertia.current); if (focusAnimation.current) cancelAnimationFrame(focusAnimation.current); clearTimeout(pendingSelect.current); }, []);
  useEffect(() => {
    if (focusAnimation.current) cancelAnimationFrame(focusAnimation.current);
    const point = selection?.kind === 'node' && frame[selection.id];
    if (!point) { automaticFit.current = true; setCamera(fitCamera(frame)); return; }
    automaticFit.current = false;
    const start = cameraRef.current, zoom = Math.max(start.zoom, 1.25), target = { x: size.width / 2 - point.x * zoom, y: size.height / 2 - point.y * zoom, zoom };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setCamera(target); return; }
    const began = performance.now();
    const animate = time => { const t = Math.min(1, (time - began) / 280), ease = 1 - Math.pow(1 - t, 3); setCamera({ x: start.x + (target.x - start.x) * ease, y: start.y + (target.y - start.y) * ease, zoom: start.zoom + (target.zoom - start.zoom) * ease }); if (t < 1) focusAnimation.current = requestAnimationFrame(animate); };
    focusAnimation.current = requestAnimationFrame(animate);
    return () => { if (focusAnimation.current) cancelAnimationFrame(focusAnimation.current); };
  }, [selection?.id, selection?.kind, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomAt = (factor, x = size.width / 2, y = size.height / 2) => {
    automaticFit.current = false;
    setCamera(c => { const next = Math.max(.15, Math.min(6, c.zoom * factor)); return { x: x - (x - c.x) * next / c.zoom, y: y - (y - c.y) * next / c.zoom, zoom: next }; });
  };
  const zoomRef = useRef(zoomAt); zoomRef.current = zoomAt;
  useEffect(() => {
    const element = svg.current;
    const wheel = e => { e.preventDefault(); const box = element.getBoundingClientRect(); zoomRef.current(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * .0025), e.clientX - box.left, e.clientY - box.top); };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  const begin = e => {
    if (e.button !== 0) return;
    if (inertia.current) cancelAnimationFrame(inertia.current);
    if (focusAnimation.current) cancelAnimationFrame(focusAnimation.current);
    const node = e.target.closest('[data-node-id]');
    if (!node && e.target.closest('[role="button"]')) return;
    const point = node && frame[node.dataset.nodeId], c = cameraRef.current;
    gesture.current = { kind: node ? 'node' : 'pan', id: node?.dataset.nodeId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, vx: 0, vy: 0, x: c.x, y: c.y, moved: false, offsetX: point ? (e.clientX - svg.current.getBoundingClientRect().left - c.x) / c.zoom - point.x : 0, offsetY: point ? (e.clientY - svg.current.getBoundingClientRect().top - c.y) / c.zoom - point.y : 0 };
    (node || e.currentTarget).setPointerCapture(e.pointerId);
  };
  const move = e => {
    const drag = gesture.current; if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) < 4 && !drag.moved) return;
    drag.moved = true; automaticFit.current = false;
    drag.vx = e.clientX - drag.lastX; drag.vy = e.clientY - drag.lastY; drag.lastX = e.clientX; drag.lastY = e.clientY;
    if (drag.kind === 'node') { const box = svg.current.getBoundingClientRect(), c = cameraRef.current; motion.pin(drag.id, (e.clientX - box.left - c.x) / c.zoom - drag.offsetX, (e.clientY - box.top - c.y) / c.zoom - drag.offsetY); }
    else setCamera(c => ({ ...c, x: drag.x + dx, y: drag.y + dy }));
  };
  const end = () => {
    const drag = gesture.current; gesture.current = null; if (!drag) return;
    suppressClick.current = drag.kind === 'node' && drag.moved;
    if (drag.kind === 'node') { if (drag.moved) motion.release(drag.id); return; }
    if (!drag.moved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let vx = drag.vx, vy = drag.vy;
    const coast = () => { vx *= .84; vy *= .84; setCamera(c => ({ ...c, x: c.x + vx, y: c.y + vy })); if (Math.hypot(vx, vy) > .2) inertia.current = requestAnimationFrame(coast); else inertia.current = null; };
    inertia.current = requestAnimationFrame(coast);
  };
  const labels = knowledgeLabels({ nodes: graph.nodes, positions: frame, degrees, camera, ...size, selectedId: selection?.kind === 'node' ? selection.id : null, hoveredId: hovered, scopeLabel: ui('跨课程资料依据') });
  const scope = item => item.outsideFilter ? ` · ${ui('跨课程资料依据')}` : '';
  const nodeName = id => graph.nodes.find(n => n.id === id)?.label || id;
  const keyAction = action => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); } };
  return <div className="knowledge-canvas" data-settled={motion.settled} data-network="true">
    <div className="knowledge-canvas-bar"><span><span className="knowledge-mode-label">{ui(graph.nodes.length > 24 ? '关系网络' : '局部关系')}</span><span className="knowledge-zoom">{Math.round(camera.zoom * 100)}%</span></span><div className="knowledge-toolbar"><IconButton icon="plus" label={ui('放大')} onClick={() => zoomAt(1.3)} /><IconButton icon="minus" label={ui('缩小')} onClick={() => zoomAt(1 / 1.3)} /><Button size="sm" variant="quiet" onClick={() => { automaticFit.current = true; setCamera(fitCamera(frame)); }}>{ui('适应全图')}</Button></div></div>
    <div className="knowledge-viewport" ref={viewport}><svg ref={svg} viewBox={`0 0 ${size.width} ${size.height}`} aria-label={ui('知识图谱画布')} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" /></marker></defs>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
        {graph.edges.map(edge => { const a = frame[edge.from], b = frame[edge.to]; if (!a || !b) return null;
          const active = selection?.id === edge.id || [edge.from, edge.to].includes(activeId), faded = activeId && !active;
          const label = `${nodeName(edge.from)} ${edge.direction === 'directed' ? '→' : '↔'} ${nodeName(edge.to)} · ${ui(relationLabel(edge.predicate))}${scope(edge)}`;
          const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy)), inset = (knowledgeNodeRadius(degrees[edge.to]) + 4) / distance;
          return <g className="knowledge-edge" data-active={active || undefined} data-faded={faded || undefined} key={edge.id} role="button" tabIndex={0} aria-label={label} onClick={() => onEdgeSelect(edge.id)} onKeyDown={keyAction(() => onEdgeSelect(edge.id))}>
            <line className="knowledge-edge-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ strokeWidth: 12 / camera.zoom }} />
            <line className="knowledge-edge-line" x1={a.x} y1={a.y} x2={b.x - dx * inset} y2={b.y - dy * inset} strokeDasharray={edge.outsideFilter ? '6 4' : undefined} markerEnd={active && edge.direction === 'directed' ? `url(#${marker})` : undefined} />
            {active && <text className="knowledge-edge-label" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8 / camera.zoom} textAnchor="middle" style={{ fontSize: 13 / camera.zoom }}>{ui(relationLabel(edge.predicate))}</text>}<title>{label}</title>
          </g>;
        })}
        {graph.nodes.map(node => { const p = frame[node.id]; if (!p) return null;
          const degree = degrees[node.id] || 0, radius = Math.max((degree >= 2 ? 4 : degree ? 2.6 : 1.8) / camera.zoom, knowledgeNodeRadius(degree)), label = labels[node.id], selected = selection?.id === node.id;
          const hit = Math.max(12 / camera.zoom, radius), hitX = label ? Math.min(-hit, label.x - 3 / camera.zoom) : -hit, hitY = label ? Math.min(-hit, label.y - 17 / camera.zoom) : -hit;
          return <g className="knowledge-node" data-node-id={node.id} data-isolated={!degree || undefined} data-selected={selected || undefined} data-neighbor={neighbors.has(node.id) || undefined} data-faded={activeId && !neighbors.has(node.id) || undefined} key={node.id} role="button" tabIndex={0} aria-label={node.label + scope(node)} onPointerEnter={() => { if (!gesture.current) setHovered(node.id); }} onPointerLeave={() => { if (!gesture.current) setHovered(null); }} onFocus={() => setHovered(node.id)} onBlur={() => setHovered(null)} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } clearTimeout(pendingSelect.current); pendingSelect.current = setTimeout(() => onNodeSelect(node.id), 250); }} onDoubleClick={() => { clearTimeout(pendingSelect.current); onNodeFocus?.(node.id); }} onKeyDown={keyAction(() => onNodeSelect(node.id))} transform={`translate(${p.x} ${p.y})`}>
            <rect className="knowledge-node-hitbox" x={hitX} y={hitY} width={(label ? Math.max(hit, label.x + label.w + 3 / camera.zoom) : hit) - hitX} height={(label ? Math.max(hit, label.y + (label.scope ? 25 : 5) / camera.zoom) : hit) - hitY} />
            {selected && <circle className="knowledge-node-ring" r={radius + 6 / camera.zoom} />}
            <circle className="knowledge-node-dot" r={radius} strokeDasharray={node.outsideFilter ? '3 2' : undefined} />
            {label && <text x={label.x} y={label.y} style={{ fontSize: 15 / camera.zoom }}>{label.text}{label.scope && <tspan x={label.x} dy={20 / camera.zoom}>{label.scope}</tspan>}</text>}<title>{node.label + scope(node)}</title>
          </g>;
        })}
      </g>
    </svg></div><p className="knowledge-canvas-hint">{ui('滚轮缩放 · 拖动节点 · 双击聚焦')}</p>
  </div>;
}
