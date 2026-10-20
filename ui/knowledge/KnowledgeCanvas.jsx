import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, IconButton } from '../components/Button.jsx';
import { ui } from '../i18n.js';
import { relationLabel } from './layout.js';
const labelLines = text => { const chars = Array.from(text); return chars.length <= 11 ? [text] : [chars.slice(0, 11).join(''), chars.slice(11, 21).join('') + (chars.length > 21 ? '…' : '')]; };
export default function KnowledgeCanvas({ graph, positions, selection, onNodeSelect, onEdgeSelect }) {
  const marker = useId().replace(/:/g, ''), drag = useRef(null), viewport = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const displayPositions = size.width < 450 && graph.nodes.length <= 6 ? Object.fromEntries(Object.entries(positions).sort(([, a], [, b]) => a.y - b.y || a.x - b.x).map(([id], i) => [id, { x: 120, y: 70 + i * 110 }])) : positions;
  const points = Object.values(displayPositions), minX = Math.min(120, ...points.map(p => p.x)), minY = Math.min(70, ...points.map(p => p.y));
  const maxX = Math.max(120, ...points.map(p => p.x)), maxY = Math.max(70, ...points.map(p => p.y));
  const readCamera = () => ({ x: maxX - minX + 220 <= size.width ? (size.width - minX - maxX) / 2 : 120 - minX, y: maxY - minY + 140 <= size.height ? (size.height - minY - maxY) / 2 : 80 - minY, zoom: 1 });
  useEffect(() => {
    const element = viewport.current;
    const measure = () => setSize({ width: element.clientWidth || 800, height: element.clientHeight || 560 });
    measure(); const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, []);
  const scene = graph.nodes.map(n => n.id).join('|');
  useEffect(() => { setCamera(readCamera()); }, [scene, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = factor => setCamera(c => { const next = Math.max(.12, Math.min(2.5, c.zoom * factor)); return { x: size.width / 2 - (size.width / 2 - c.x) * next / c.zoom, y: size.height / 2 - (size.height / 2 - c.y) * next / c.zoom, zoom: next }; });
  const fit = () => { const next = Math.min(1, (size.width - 48) / (maxX - minX + 190), (size.height - 48) / (maxY - minY + 90)); setCamera({ x: size.width / 2 - (minX + maxX) / 2 * next, y: size.height / 2 - (minY + maxY) / 2 * next, zoom: next }); };
  const nodeName = id => graph.nodes.find(n => n.id === id)?.label || id;
  const scope = item => item.outsideFilter ? ` · ${ui('跨课程资料依据')}` : '';
  const endpoint = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, scale = Math.max(Math.abs(dx) / 90, Math.abs(dy) / 32); return scale ? { x: a.x + dx / scale, y: a.y + dy / scale } : a; };
  const overview = camera.zoom < .9;
  return <div className="knowledge-canvas" data-compact={graph.nodes.length <= 2 || undefined}>
    <div className="knowledge-canvas-bar"><span>{ui(overview ? '全图概览' : '阅读视图')} <span className="knowledge-zoom">{Math.round(camera.zoom * 100)}%</span></span><div className="knowledge-toolbar"><IconButton icon="plus" label={ui('放大')} onClick={() => zoom(1.25)} /><IconButton icon="minus" label={ui('缩小')} onClick={() => zoom(.8)} /><Button size="sm" variant="quiet" onClick={fit}>{ui('适应全图')}</Button><Button size="sm" variant="quiet" onClick={() => setCamera(readCamera())}>{ui('重置视图')}</Button></div></div>
    <div className="knowledge-viewport" ref={viewport}>
      <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-label={ui('知识图谱画布')} onPointerDown={e => { if (!e.target.closest('[role="button"]')) { drag.current = { x: e.clientX, y: e.clientY, panX: camera.x, panY: camera.y }; e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => { if (drag.current) setCamera(c => ({ ...c, x: drag.current.panX + e.clientX - drag.current.x, y: drag.current.panY + e.clientY - drag.current.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" /></marker></defs>
        <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
          {graph.edges.map(edge => {
            const a = displayPositions[edge.from], b = displayPositions[edge.to]; if (!a || !b) return null;
            const from = endpoint(a, b), to = endpoint(b, a), active = selection?.id === edge.id || selection?.id === edge.from || selection?.id === edge.to;
            const label = `${nodeName(edge.from)} ${edge.direction === 'directed' ? '→' : '↔'} ${nodeName(edge.to)} · ${ui(relationLabel(edge.predicate))}${scope(edge)}`;
            return <g className="knowledge-edge" data-active={active || undefined} key={edge.id} role="button" tabIndex={0} aria-label={label} onClick={() => onEdgeSelect(edge.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdgeSelect(edge.id); } }}>
              <line className="knowledge-edge-hit" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
              <line className="knowledge-edge-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeDasharray={edge.outsideFilter ? '6 4' : undefined} markerEnd={edge.direction === 'directed' ? `url(#${marker})` : undefined} />
              {!overview && <text className="knowledge-edge-label" x={(a.x + b.x) / 2 + (Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? 14 : 0)} y={(a.y + b.y) / 2 + (Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? 5 : -10)} textAnchor={Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? 'start' : 'middle'}>{ui(relationLabel(edge.predicate))}{edge.outsideFilter ? ' · ' + ui('跨课程资料依据') : ''}</text>}<title>{label}</title>
            </g>;
          })}
          {graph.nodes.map(node => { const p = displayPositions[node.id]; return <g className="knowledge-node" data-selected={selection?.id === node.id || undefined} key={node.id} role="button" tabIndex={0} aria-label={node.label + scope(node)} onClick={() => onNodeSelect(node.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodeSelect(node.id); } }} transform={`translate(${p.x} ${p.y})`}>
            <rect x="-90" y="-32" width="180" height="64" rx="10" strokeDasharray={node.outsideFilter ? '4 3' : undefined} />
            {!overview && <><text textAnchor="middle">{labelLines(node.label).map((line, i, lines) => <tspan key={i} x="0" y={lines.length === 1 ? 5 : i * 20 - 5}>{line}</tspan>)}</text>{node.outsideFilter && <text className="knowledge-scope-label" y="52" textAnchor="middle">{ui('跨课程资料依据')}</text>}</>}<title>{node.label + scope(node)}</title>
          </g>; })}
        </g>
      </svg>
    </div><p className="knowledge-canvas-hint">{ui(overview ? '选择概念进入阅读视图，查看相邻关系与原文证据。' : '拖动浏览，选择概念查看证据')}</p>
  </div>;
}
