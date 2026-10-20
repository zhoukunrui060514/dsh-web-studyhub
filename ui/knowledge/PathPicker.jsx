import React, { useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui } from '../i18n.js';
import { appendPath } from './view-state.js';
import { relationLabel } from './layout.js';
export default function PathPicker({ startNodeId, edgeIds, edges, nodes = [], onChange }) {
  const [error, setError] = useState('');
  const name = id => nodes.find(n => n.id === id)?.label || id;
  const label = e => `${name(e.from)} ${e.direction === 'directed' ? '→' : '↔'} ${name(e.to)} · ${ui(relationLabel(e.predicate))}`;
  let current = startNodeId;
  for (const id of edgeIds) { const edge = edges.find(e => e.id === id); if (edge) current = edge.from === current ? edge.to : edge.from; }
  return <section className="knowledge-path"><h4>{ui('按顺序选择链路')} ({edgeIds.length}/12)</h4><ol>{edgeIds.map((id, i) => <li key={i}>{edges.find(e => e.id === id) ? label(edges.find(e => e.id === id)) : id}</li>)}</ol>
    {edges.filter(e => [e.from, e.to].includes(current)).map(e => <Button className="knowledge-path-step" key={e.id} disabled={edgeIds.length >= 12} onClick={() => { try { onChange(appendPath({ startNodeId, edgeIds }, e, edges)); setError(''); } catch (failure) { setError(failure.message); } }}>{label(e)}{e.from !== current && e.direction === 'directed' ? ` (${ui('反向查看')})` : ''}</Button>)}
    {!!edgeIds.length && <Button className="knowledge-path-step" onClick={() => onChange({ startNodeId, edgeIds: edgeIds.slice(0, -1) })}>{ui('撤回最后一条')}</Button>}{error && <p role="alert">{error}</p>}
  </section>;
}
