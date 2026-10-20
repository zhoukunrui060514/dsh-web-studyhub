import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui } from '../i18n.js';
export default function KnowledgeDetails({ detail, courses = [], nodes = [], onAsk, onOpenEvidence, onUpdate, onMerge }) {
  const item = detail?.item, [editing, setEditing] = useState(false), [text, setText] = useState(''), [error, setError] = useState('');
  useEffect(() => { setEditing(false); setError(''); }, [item?.id]);
  if (!item) return <p role="status">{detail?.reason || ui('正在加载详情')}</p>;
  const node = !item.from;
  const courseNames = ids => (ids || []).map(id => courses.find(c => c.id === id)?.name || id).join(' · ');
  const nodeName = id => nodes.find(n => n.id === id)?.label || id;
  return <section><h3>{item.label || `${nodeName(item.from)} ${item.direction === 'directed' ? '→' : '↔'} ${nodeName(item.to)}`}</h3>
    {detail.versionStatus === 'stale' && <p>{ui('依据旧版本')}</p>}{item.outsideFilter && <p>{ui('跨课程资料依据')}</p>}
    <p>{node ? item.definition : `${item.predicate} · ${item.conditions || ''}`}</p>{node && <p>{(item.aliases || []).join(' · ')}</p>}
    <p>{courseNames(item.courses)}</p>{item.note && <p>{item.note}</p>}
    <div className="knowledge-toolbar"><Button onClick={onAsk}>{ui('针对当前内容提问')}</Button><Button onClick={() => { setEditing(true); setText(node ? item.definition : item.conditions); }}>{ui('人工修订')}</Button></div>
    {editing && <div><textarea className="knowledge-textarea" aria-label={ui('修订内容')} value={text} onChange={e => setText(e.target.value)} /><Button onClick={async () => { try { await onUpdate({ id: item.id, [node ? 'definition' : 'conditions']: text }); setEditing(false); } catch (e) { setError(e.message); } }}>{ui('保存修订')}</Button></div>}
    {error && <p role="alert">{error}</p>}
    {(detail.merges || []).map(m => <div key={m.id}><p>{ui('可能同义的概念，需人工确认')}</p>{(m.concepts || []).map(n => <blockquote className="knowledge-quote" key={n.id}>{n.label} · {n.definition}<small>{courseNames(n.courses)}</small></blockquote>)}<Button onClick={() => onMerge(m.id, true).catch(e => setError(e.message))}>{ui('接受合并')}</Button><Button onClick={() => onMerge(m.id, false).catch(e => setError(e.message))}>{ui('保持独立')}</Button></div>)}
    <h4>{ui('资料依据')}</h4>{detail.evidence.map(e => <article key={e.id}><small>{courseNames(e.courses)}{e.outsideFilter && ` · ${ui('跨课程资料依据')}`} · {e.sourceId} · {e.revision?.slice(0, 12)} · {ui(e.assertion === 'inferred' ? '推断' : '资料直接陈述')} · {e.start}–{e.end}</small><blockquote className="knowledge-quote">{e.quote}</blockquote><Button onClick={() => onOpenEvidence(e)}>{ui('在原文中查看')}</Button></article>)}
  </section>;
}
