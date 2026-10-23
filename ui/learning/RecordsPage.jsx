import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
import { learningScope, STEP_LABELS, TYPE_LABELS } from './model.js';
import { useQuery } from './use-query.js';
import { useLearning } from './LearningProvider.jsx';
import QueryStatus from './QueryStatus.jsx';
import LegacyExport from './LegacyExport.jsx';
import Markdown from '../Markdown.jsx';
import SessionResults from './SessionResults.jsx';

function RecordContent({ detail }) {
  const record = detail.record;
  if (detail.type === 'session') return <>{detail.results && <SessionResults results={detail.results} />}{Object.entries(record.records ?? {}).map(([step, value]) => value.content && <section key={step}><h3>{ui(STEP_LABELS[step])}</h3><Markdown text={value.content} /></section>)}</>;
  if (detail.type === 'note') return <Markdown text={record.markdown || ui('这篇笔记还没有正文。')} />;
  if (detail.type === 'run') return <ol>{record.entries.map((entry, index) => <li key={index}><Markdown text={entry.card.prompt} /><p className="loop-meta">{ui(entry.feedback ? '已作答' : '尚未作答')}</p></li>)}</ol>;
  return <><p>{ui('评分')}：{record.grade}</p><p className="loop-meta">{ui('打开关联练习，可以查看当时的题目、答案与反馈。')}</p></>;
}

function RecordDetail({ type, id, onClose }) {
  const { data, core, learn } = useApp();
  const query = useQuery(core.call, 'learning.records.get', { type, id }, data.root, true, data.revision);
  const detail = query.value;
  return <div className="loop-detail"><Button variant="quiet" onClick={onClose}>{ui('收起详情')}</Button>
    <QueryStatus query={query} />
    {detail && <><RecordContent detail={detail} />
      {detail.links.materials.map(ref => <p key={ref.sourceId}><Button variant="quiet" disabled={ref.status === 'unavailable'} onClick={() => learn.openLearningTarget({ kind: 'source', id: ref.sourceId })}>{data.sources.find(source => source.id === ref.sourceId)?.title || ref.sourceId}</Button> · {ui({ current: '原文有效', stale: '原文已变化', unavailable: '原文不可用', unversioned: '历史记录未保存原文版本' }[ref.status])}</p>)}
    </>}
  </div>;
}

function RecordList({ scope }) {
  const { data, core, nav, intents } = useApp(), learning = useLearning();
  const [type, setType] = useState(''), [cursor, setCursor] = useState(null), [detail, setDetail] = useState(null);
  const query = useQuery(core.call, 'learning.records.query', { scope, ...(type ? { type } : {}), limit: 50, ...(cursor ? { cursor } : {}) }, data.root, true, data.revision);
  return <>
    <nav className="loop-tabs" aria-label={ui('记录类型')}>{[['', '全部'], ...Object.entries(TYPE_LABELS)].map(([id, label]) => <Button key={id} variant="quiet" aria-pressed={id === type} onClick={() => { setType(id); setCursor(null); setDetail(null); }}>{ui(label)}</Button>)}</nav>
    <QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />
    {query.value?.total === 0 && <p className="loop-brief">{ui('这个范围还没有学习记录。完成一次学习或练习后，会在这里留下记录。')}</p>}
    {query.value?.items.map(item => <article className="loop-row" key={`${item.type}:${item.id}`}>
      <p className="loop-meta">{ui(TYPE_LABELS[item.type])} · {item.at ? new Date(item.at).toLocaleString() : ui('时间未知')} · {item.courses.map(course => course.name || ui('未分类')).join('、') || ui('历史归属未知')}</p>
      <h2>{item.title || ui(TYPE_LABELS[item.type])}</h2>
      {(item.phase || item.step) && <p>{ui(({ reading: '阅读中', practice: '练习中', results: '结果' })[item.phase] || STEP_LABELS[item.step])} · {ui(item.status === 'completed' ? '已结束' : item.status === 'paused' ? '已暂停' : '进行中')}</p>}
      {item.type === 'run' && <p>{ui('已作答')} {item.answered} / {item.total}</p>}
      {item.type === 'attempt' && <p>{ui('评分')}：{item.grade}{item.retry ? ` · ${ui('同轮回忆')}` : ''}</p>}
      <div className="loop-actions">
        {item.links.sessionId && <Button onClick={() => learning.openSession(item.links.sessionId)}>{ui('打开学习会话')}</Button>}
        {item.links.runId && <Button onClick={() => intents.openRun(item.links.runId)}>{ui('查看练习')}</Button>}
        {item.type === 'note' && <Button onClick={() => nav.show.note(item.id)}>{ui('打开笔记')}</Button>}
        <Button variant="quiet" onClick={() => setDetail({ type: item.type, id: item.id })}>{ui('查看记录详情')}</Button>
      </div>
      {detail?.type === item.type && detail.id === item.id && <RecordDetail type={detail.type} id={detail.id} onClose={() => setDetail(null)} />}
    </article>)}
    <div className="loop-actions">{cursor && <Button onClick={() => setCursor(null)}>{ui('回到第一页')}</Button>}{query.value?.nextCursor && <Button onClick={() => { setDetail(null); setCursor(query.value.nextCursor); }}>{ui('下一页')}</Button>}</div>
  </>;
}
export default function RecordsPage() {
  const { data } = useApp(), scope = learningScope(data), [exportsOpen, setExportsOpen] = useState(false);
  return <section className="page loop-page"><h1>{ui('学习记录')}</h1><p className="loop-meta">{ui('回看每次学习、作答和笔记，沿记录返回原文。')}</p><RecordList key={JSON.stringify([data.root, scope])} scope={scope} />
    <details onToggle={event => setExportsOpen(event.currentTarget.open)}><summary>{ui('旧内容与完整导出')}</summary>{exportsOpen && <LegacyExport />}</details></section>;
}
