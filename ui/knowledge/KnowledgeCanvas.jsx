import React, { useId, useRef, useState } from 'react';
import { Button, IconButton } from '../components/Button.jsx';
import { ui } from '../i18n.js';
export default function KnowledgeCanvas({ graph, positions, selection, onNodeSelect, onEdgeSelect }) {
  const marker = useId().replace(/:/g, ''), drag = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const nodeName = id => graph.nodes.find(n => n.id === id)?.label || id;
  const scope = item => item.outsideFilter ? ` · ${ui('跨课程资料依据')}` : '';
  return <div className="knowledge-canvas">
    <div className="knowledge-toolbar"><IconButton icon="plus" label={ui('放大')} onClick={() => setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) }))} /><IconButton icon="minus" label={ui('缩小')} onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.3, c.zoom / 1.25) }))} /><Button onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>{ui('重置视图')}</Button></div>
    <svg viewBox="0 0 1000 600" aria-label={ui('知识图谱画布')} onPointerDown={e => { if (e.target === e.currentTarget) { drag.current = { x: e.clientX, y: e.clientY, panX: camera.x, panY: camera.y }; e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => {
      if (drag.current) { const ratio = 1000 / e.currentTarget.getBoundingClientRect().width; setCamera({ ...camera, x: drag.current.panX + (e.clientX - drag.current.x) * ratio, y: drag.current.panY + (e.clientY - drag.current.y) * ratio }); }
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerEnter={() => { if (drag.current && drag.current.panX === undefined) { drag.current.panX = camera.x; drag.current.panY = camera.y; } }}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor" /></marker></defs>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
        {graph.edges.map(edge => { const a = positions[edge.from], b = positions[edge.to]; if (!a || !b) return null; const label = `${nodeName(edge.from)} ${edge.direction === 'directed' ? '→' : '↔'} ${nodeName(edge.to)} · ${edge.predicate}${scope(edge)}`; return <g key={edge.id} role="button" tabIndex={0} aria-label={label} onClick={() => onEdgeSelect(edge.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdgeSelect(edge.id); } }}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeDasharray={edge.outsideFilter ? '6 4' : undefined} strokeWidth={selection?.id === edge.id ? 4 : 1.5} markerEnd={edge.direction === 'directed' ? `url(#${marker})` : undefined} />{edge.outsideFilter && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8}>{ui('跨课程资料依据')}</text>}<title>{label}</title></g>; })}
        {graph.nodes.map(node => { const p = positions[node.id]; return <g key={node.id} role="button" tabIndex={0} aria-label={node.label + scope(node)} onClick={() => onNodeSelect(node.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodeSelect(node.id); } }} transform={`translate(${p.x} ${p.y})`}><circle r={selection?.id === node.id ? 23 : 18} stroke={node.outsideFilter ? 'currentColor' : undefined} strokeDasharray={node.outsideFilter ? '4 3' : undefined} /><text y="35" textAnchor="middle">{node.label.slice(0, 16)}{scope(node)}</text><title>{node.label + scope(node)}</title></g>; })}
      </g>
    </svg>
  </div>;
}

