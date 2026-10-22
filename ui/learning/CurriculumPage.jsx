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
import KnowledgeTask, { useKnowledgeTask } from '../knowledge/KnowledgeTask.jsx';
import { keepBook } from '../book/model.js';

function CourseContent({ scope, onReader, onOutline }) {
  const { data, core } = useApp(), learning = useLearning();
  const [view, setView] = useState('structure'), [cursor, setCursor] = useState(null), [filter, setFilter] = useState('');
  const query = useQuery(core.call, 'curriculum.get', { scope, view, limit: 200, ...(cursor ? { cursor } : {}) }, data.root, true, data.revision);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const result = query.value;
  const course = data.focus?.course;
  const task = useKnowledgeTask(data, course, () => { setCursor(null); query.refresh(); }, ['course-outline-build', 'course-book-build']);
  const shown = result?.nodes.filter(node => !filter.trim() || `${node.title} ${node.intro || ''}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())) || [];
  const byId = new Map(result?.nodes.map(node => [node.id, node]));
  const depthOf = node => {
    let depth = 0, parent = byId.get(node.parentId);
    while (parent && depth < 5) { depth++; parent = byId.get(parent.parentId); }
    return depth;
  };
  return <>
    <div className="loop-actions">
      <Button variant="primary" disabled={task.active || data.model?.ready === false} onClick={() => task.start('generation.courseOutline.build', { course })}>{ui(result?.outlineId ? '重新整理大纲' : '从资料生成大纲')}</Button>
      <Button disabled={task.active || data.model?.ready === false} onClick={() => task.start('generation.courseBook.build', { course })}>{ui('生成或更新阅读内容')}</Button>
      <Button variant="quiet" onClick={onOutline}>{ui('高级大纲编辑')}</Button>
    </div>
    <KnowledgeTask task={task} />
    <nav className="loop-tabs" aria-label={ui('大纲模式')}>{[['structure', '结构'], ['reading', '阅读'], ['exam', '考点']].map(([id, label]) =>
      <Button key={id} variant="quiet" aria-pressed={id === view} onClick={() => { setView(id); setCursor(null); }}>{ui(label)}</Button>)}</nav>
    <QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />{error && <p role="alert">{error}</p>}
    {result?.status === 'empty' && <div className="loop-brief"><h2>{ui('这门课还没有大纲')}</h2><p>{ui('先导入本课程资料，再点击上方生成大纲。生成阅读内容会同时准备所需的大纲，不必先出题。')}</p></div>}
    {view === 'reading' && result?.needsPrepare && <div className="loop-row"><p>{ui('阅读内容尚未与当前大纲同步。已保存的个人文字会保留。')}</p>
      <Button disabled={!!working} onClick={() => run('prepare', async () => { await core.call('curriculum.prepare', { scope, expectedRevision: result.outlineRevision }); query.refresh(); })}>{ui('同步阅读结构')}</Button></div>}
    {!!result?.nodes.length && <label>{ui('筛选本页知识点')}<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>}
    {filter && !shown.length && <p>{ui('没有匹配的知识点')}</p>}
    {shown.map(node => <article className="loop-row" key={node.id} style={{ marginInlineStart: `${depthOf(node) * 16}px` }}>
      <p className="loop-meta">{node.parentId ? ui('知识点') : ui('章节')}</p><h2>{node.title}</h2>
      {node.intro && <p>{node.intro}</p>}
      {view === 'reading' && <div className="loop-reading"><Markdown text={[node.reading?.gen, node.reading?.mine, node.reading?.qa].filter(Boolean).join('\n\n') || ui('尚未编写讲解，点击上方生成阅读内容，或打开完整阅读编辑器补充。')} /></div>}
      {view === 'exam' && <>{!node.examPoints?.length && !node.exam?.evidence?.length && <p className="loop-meta">{ui('暂无已映射考点')}</p>}{node.examPoints?.map(point => <p key={point.id || point.pointId}>{point.title || point.text || point.pointId}</p>)}{node.exam?.evidence?.map((place, index) => <blockquote key={index}>{place.quote}</blockquote>)}</>}
      <Button disabled={!!working} onClick={() => run('start', () => learning.startSession({ scope, target: { kind: 'outline', nodeId: node.id, outlineRevision: result.outlineRevision }, origin: 'knowledge' }))}>{ui('学这个知识点')}</Button>
      <Button variant="quiet" onClick={() => onReader(node)}>{ui('阅读与编辑')}</Button>
      {view === 'reading' && <Button variant="quiet" disabled={task.active || data.model?.ready === false} onClick={() => task.start('generation.courseBook.build', { course, point: node.id })}>{ui('生成本节阅读')}</Button>}
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
    {scope.kind === 'all' ? <p>{ui('请在顶栏选择一门课程，查看它的大纲。')}</p> : <CourseContent key={key} scope={scope} onReader={node => {
      if (node?.id) keepBook(data.root, data.focus.course, { target: `bk:${node.id}` });
      setEditing(true);
    }} onOutline={() => nav.navigate('outline')} />}
  </section>;
}
