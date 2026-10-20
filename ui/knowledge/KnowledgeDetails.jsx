import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui } from '../i18n.js';
import { relationLabel } from './layout.js';
export default function KnowledgeDetails({ detail, courses = [], nodes = [], onAsk, onOpenEvidence, onUpdate, onMerge }) {
  const item = detail?.item, [editing, setEditing] = useState(false), [text, setText] = useState(''), [error, setError] = useState('');
  useEffect(() => { setEditing(false); setError(''); }, [item?.id]);
  if (!item) return <p role="status">{detail?.reason || ui('正在加载详情')}</p>;
  const node = !item.from;
  const courseNames = ids => (ids || []).map(id => courses.find(c => c.id === id)?.name || id).join(' · ');
  const nodeName = id => nodes.find(n => n.id === id)?.label || id;
  const readableQuote = quote => node && item.label && Array.from(item.label).length <= 10 ? quote.split(item.label).flatMap((part, i) => [i > 0 && <span className="knowledge-term" key={i}>{item.label}</span>, part]) : quote;
  return <section className="knowledge-detail-content"><h3>{item.label || `${nodeName(item.from)} ${item.direction === 'directed' ? '→' : '↔'} ${nodeName(item.to)}`}</h3>
    {detail.versionStatus === 'stale' && <p>{ui('依据旧版本')}</p>}{item.outsideFilter && <p>{ui('跨课程资料依据')}</p>}
    <p className="knowledge-definition">{node ? item.definition : `${ui(relationLabel(item.predicate))}${item.conditions ? ' · ' + item.conditions : ''}`}</p>{node && !!item.aliases?.length && <p>{(item.aliases || []).join(' · ')}</p>}
    {!!item.courses?.length && <p className="knowledge-course-names">{courseNames(item.courses)}</p>}{item.note && <p>{item.note}</p>}
    <div className="knowledge-toolbar"><Button onClick={onAsk}>{ui('针对当前内容提问')}</Button><Button onClick={() => { setEditing(true); setText(node ? item.definition : item.conditions); }}>{ui('人工修订')}</Button></div>
    {editing && <div><textarea className="knowledge-textarea" aria-label={ui('修订内容')} value={text} onChange={e => setText(e.target.value)} /><Button onClick={async () => { try { await onUpdate({ id: item.id, [node ? 'definition' : 'conditions']: text }); setEditing(false); } catch (e) { setError(e.message); } }}>{ui('保存修订')}</Button></div>}
    {error && <p role="alert">{error}</p>}
    {(detail.merges || []).map(m => <div key={m.id}><p>{ui('可能同义的概念，需人工确认')}</p>{(m.concepts || []).map(n => <blockquote className="knowledge-quote" key={n.id}>{n.label} · {n.definition}<small>{courseNames(n.courses)}</small></blockquote>)}<Button onClick={() => onMerge(m.id, true).catch(e => setError(e.message))}>{ui('接受合并')}</Button><Button onClick={() => onMerge(m.id, false).catch(e => setError(e.message))}>{ui('保持独立')}</Button></div>)}
    <h4>{ui('资料依据')}</h4>{detail.evidence.map(e => <article className="knowledge-evidence" key={e.id}><div className="knowledge-evidence-meta"><span>{courseNames(e.courses)}{e.outsideFilter && ` · ${ui('跨课程资料依据')}`}</span><span>{ui(e.assertion === 'inferred' ? '推断' : '资料直接陈述')}</span></div><blockquote className="knowledge-quote">{readableQuote(e.quote)}</blockquote><div className="knowledge-evidence-actions"><Button size="sm" onClick={() => onOpenEvidence(e)}>{ui('在原文中查看')}</Button><details className="knowledge-source-position"><summary>{ui('引用位置')}</summary><p>{e.sourceId}<br />{ui('版本')} {e.revision?.slice(0, 12)} · {e.start}–{e.end}</p></details></div></article>)}
  </section>;
}
