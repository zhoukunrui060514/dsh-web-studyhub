import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import Markdown from '../Markdown.jsx';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { learningScope } from './model.js';
import { useLearning } from './LearningProvider.jsx';
import { useQuery } from './use-query.js';
import QueryStatus from './QueryStatus.jsx';

function CourseContent({ scope, onReader, onOutline }) {
  const { data, core } = useApp(), learning = useLearning();
  const [view, setView] = useState('structure'), [cursor, setCursor] = useState(null);
  const query = useQuery(core.call, 'curriculum.get', { scope, view, limit: 50, ...(cursor ? { cursor } : {}) }, data.root);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const result = query.value;
  return <>
    <nav className="loop-tabs" aria-label={ui('大纲模式')}>{[['structure', '结构'], ['reading', '阅读'], ['exam', '考点']].map(([id, label]) =>
      <Button key={id} variant="quiet" aria-pressed={id === view} onClick={() => { setView(id); setCursor(null); }}>{ui(label)}</Button>)}</nav>
    <QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />{error && <p role="alert">{error}</p>}
    {result?.status === 'empty' && <div className="loop-brief"><h2>{ui('这门课还没有大纲')}</h2><p>{ui('先从已有资料整理课程结构，再按知识点学习。')}</p><Button onClick={onOutline}>{ui('整理课程大纲')}</Button></div>}
    {view === 'reading' && result?.needsPrepare && <div className="loop-row"><p>{ui('阅读内容尚未与当前大纲同步。已保存的个人文字会保留。')}</p>
      <Button disabled={!!working} onClick={() => run('prepare', async () => { await core.call('curriculum.prepare', { scope, expectedRevision: result.outlineRevision }); query.refresh(); })}>{ui('同步阅读结构')}</Button></div>}
    {result?.nodes.map(node => <article className="loop-row" key={node.id}>
      <p className="loop-meta">{node.parentId ? ui('知识点') : ui('章节')}</p><h2>{node.title}</h2>
      {view === 'reading' && <div className="loop-reading"><Markdown text={[node.reading?.gen, node.reading?.mine, node.reading?.qa].filter(Boolean).join('\n\n') || ui('尚未编写讲解，可在阅读编辑器中补充。')} /></div>}
      {view === 'exam' && <>{!node.examPoints?.length && <p className="loop-meta">{ui('暂无已映射考点')}</p>}{node.examPoints?.map(point => <p key={point.id || point.pointId}>{point.title || point.text || point.pointId}</p>)}</>}
      <Button disabled={!!working} onClick={() => run('start', () => learning.startSession({ scope, target: { kind: 'outline', nodeId: node.id, outlineRevision: result.outlineRevision }, origin: 'knowledge' }))}>{ui('学这个知识点')}</Button>
    </article>)}
    {result?.examPointsTruncated && <p>{ui('考点超过本页上限，请缩小知识点范围后查看。')}</p>}
    {!!result?.unplacedExamPoints && <p>{ui('尚未归入大纲的考点')}：{result.unplacedExamPoints}</p>}
    <div className="loop-actions">{cursor && <Button onClick={() => setCursor(null)}>{ui('回到第一页')}</Button>}{result?.nextCursor && <Button onClick={() => setCursor(result.nextCursor)}>{ui('下一页')}</Button>}</div>
    <details><summary>{ui('编辑与生成')}</summary><div className="loop-actions"><Button variant="quiet" onClick={onReader}>{ui('打开完整阅读编辑器')}</Button><Button variant="quiet" onClick={onOutline}>{ui('整理课程大纲')}</Button></div></details>
  </>;
}

export default function CurriculumPage({ reader }) {
  const { data, nav } = useApp(), [editing, setEditing] = useState(false);
  const scope = learningScope(data), key = JSON.stringify([data.root, scope]);
  if (editing) return <><Button variant="quiet" onClick={() => setEditing(false)}>{ui('返回统一大纲')}</Button>{reader}</>;
  return <section className="page loop-page"><h1>{ui('课程大纲')}</h1><p className="loop-meta">{ui('同一份课程结构，按需要切换阅读与考点。')}</p>
    {scope.kind === 'all' ? <p>{ui('请在顶栏选择一门课程，查看它的大纲。')}</p> : <CourseContent key={key} scope={scope} onReader={() => setEditing(true)} onOutline={() => nav.navigate('outline')} />}
  </section>;
}
