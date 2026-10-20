import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui, uiFormat } from '../i18n.js';
import { useInjectCss } from '../shared.js';
import css from './knowledge.css';
import { useStudy } from '../study-context.jsx';
import { useLiveEffect } from '../use-async.js';
import { Checkbox } from '../components/Choice.jsx';
import { useKnowledge } from './use-knowledge.js';
import { layoutKnowledge } from './layout.js';
import KnowledgeCanvas from './KnowledgeCanvas.jsx';
import BuildDialog from './BuildDialog.jsx';
import KnowledgeDetails from './KnowledgeDetails.jsx';
import KnowledgeChat from './KnowledgeChat.jsx';
import PathPicker from './PathPicker.jsx';
import { appendPath } from './view-state.js';
const EMPTY_GRAPH = { nodes: [], edges: [], displayed: { nodes: 0, edges: 0 }, totals: { nodes: 0, edges: 0 } };
export default function KnowledgePage({ openSource, openTasks }) {
  useInjectCss(css, 'study-knowledge');
  const { call } = useStudy();
  const k = useKnowledge({ call }), [building, setBuilding] = useState(false), previous = useRef({}), workspace = useRef(null);
  const [detail, setDetail] = useState(null), [asking, setAsking] = useState(null), [path, setPath] = useState(null), [evidenceError, setEvidenceError] = useState('');
  const selection = k.view.selection, selectionKey = JSON.stringify([selection, k.filter]);
  useLiveEffect(() => {
    if (selection && window.matchMedia('(max-width: 1100px)').matches) workspace.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [selection?.id]);
  useLiveEffect(isLive => {
    setDetail(null); setAsking(null); setPath(null); setEvidenceError('');
    if (selection) call(`knowledge.${selection.kind}.get`, { id: selection.id, filter: k.filter }).then(value => { if (isLive()) setDetail(value); }, e => { if (isLive()) setEvidenceError(e.message); });
  }, [call, selectionKey, k.view.graph?.graphRevision]);
  const openEvidence = async e => {
    setEvidenceError('');
    try {
      const listed = await call('knowledge.materials'), material = listed.materials.find(m => m.identity === e.materialIdentity);
      if (!material || material.archived) throw new Error(ui('引用资料已不可用'));
      if (material.revision !== e.revision || e.status === 'stale' || e.versionStatus === 'stale') throw new Error(ui('依据旧版本，当前原文已变化，无法精确定位此引用'));
      await openSource(e);
    } catch (failure) { setEvidenceError(failure.message); }
  };
  const graph = k.view.graph || EMPTY_GRAPH;
  const pathRecords = useRef({ nodes: new Map(), edges: new Map() });
  const pathScope = JSON.stringify([k.filter, k.query, graph.graphRevision]);
  if (pathRecords.current.scope !== pathScope) pathRecords.current = { scope: pathScope, nodes: new Map(), edges: new Map() };
  for (const n of graph.nodes) pathRecords.current.nodes.set(n.id, n);
  for (const e of graph.edges) pathRecords.current.edges.set(e.id, e);
  const pathNodes = [...pathRecords.current.nodes.values()], pathEdges = [...pathRecords.current.edges.values()];
  const scope = item => item.outsideFilter ? ` · ${ui('跨课程资料依据')}` : '';
  const chooseEdge = id => {
    if (!path) { k.dispatch({ type: 'select', target: { kind: 'edge', id } }); return; }
    try { setPath(appendPath(path, pathEdges.find(e => e.id === id), pathEdges)); setEvidenceError(''); }
    catch (error) { setEvidenceError(error.message); }
  };
  const layoutScope = JSON.stringify([k.filter, k.query, k.view.focusId]);
  const layout = useMemo(() => {
    const result = layoutKnowledge({ ...graph, focusId: k.view.focusId, previousPositions: previous.current.scope === layoutScope ? previous.current.positions : {} });
    previous.current = { scope: layoutScope, positions: result.positions }; return result;
  }, [graph, layoutScope, k.view.focusId]);
  const multi = (event, key) => { k.dispatch({ type: 'reset' }); k.setFilter(f => ({ ...f, [key]: [...event.target.selectedOptions].map(o => o.value) })); };
  return <section className="page knowledge-page"><header className="knowledge-heading"><h2>{ui('知识图谱')}</h2></header>
    <div className="knowledge-controls"><label className="knowledge-field knowledge-search"><span className="knowledge-search-label">{ui('搜索概念')}</span><input className="knowledge-input" placeholder={ui('搜索概念')} value={k.query} onChange={e => k.setQuery(e.target.value)} /></label><Button size="sm" onClick={() => setBuilding(true)}>{ui('构建／更新')}</Button><details className="knowledge-filters-panel"><summary>{ui('筛选与构建设置')}{!!(k.filter.courseIds.length + k.filter.materialIds.length) && <span> · {k.filter.courseIds.length + k.filter.materialIds.length}</span>}</summary><div className="knowledge-filters"><label className="knowledge-field">{ui('课程')}<select className="knowledge-select" multiple aria-label={ui('课程')} value={k.filter.courseIds} onChange={e => multi(e, 'courseIds')}>{k.courses.map(c => <option key={c.id} value={c.id}>{c.name || c.title || c.id}</option>)}</select></label><label className="knowledge-field">{ui('资料')}<select className="knowledge-select" multiple aria-label={ui('资料')} value={k.filter.materialIds} onChange={e => multi(e, 'materialIds')}>{k.materials.map(m => <option key={m.identity} value={m.identity}>{m.title || m.identity}</option>)}</select></label><Checkbox label={ui('包含跨课程关系')} checked={k.filter.includeCrossCourse} onChange={checked => k.setFilter(f => ({ ...f, includeCrossCourse: checked }))} /><Checkbox label={ui('自动构建新资料')} checked={k.settings.autoBuild} onChange={checked => k.write('knowledge.settings.set', { autoBuild: checked }).catch(() => {})} /><p className="knowledge-setting-note">{ui('自动构建仅处理开启后新导入或后续变更的资料；已有资料请明确补建。')}</p></div></details></div>
    {k.error && <p role="alert">{k.error}</p>}{k.loading && <p role="status">{ui('正在加载图谱')}</p>}
    {building && <BuildDialog materials={k.materials} write={k.write} onClose={() => setBuilding(false)} openTasks={openTasks} />}
    <div className="knowledge-graph-bar"><p>{uiFormat('当前显示 {0} / 总计 {1}', [graph.displayed.nodes, graph.totals.nodes])} · {uiFormat('关系 {0} / {1}', [graph.displayed.edges, graph.totals.edges])}</p><div className="knowledge-toolbar"><Button size="sm" variant="quiet" onClick={k.refresh}>{ui('刷新')}</Button><Button size="sm" disabled={!k.view.history.length} onClick={() => k.dispatch({ type: 'back' })}>{ui('返回')}</Button><Button size="sm" onClick={() => k.dispatch({ type: 'reset' })}>{ui('全局视图')}</Button><Button size="sm" disabled={!k.view.focusId || k.view.depth >= 6} onClick={() => k.dispatch({ type: 'expand' })}>{ui('继续展开')}</Button></div></div>
    {!graph.nodes.length && <p>{ui('尚无可见图谱，请选择资料构建或调整筛选。')}</p>}
    <div className="knowledge-workspace" ref={workspace}><div className="knowledge-graph-column"><KnowledgeCanvas graph={graph} positions={layout.positions} selection={k.view.selection} onNodeSelect={id => k.dispatch(path ? { type: 'focus', id, preserveSelection: true } : { type: 'select', target: { kind: 'node', id } })} onNodeFocus={id => k.dispatch({ type: 'focus', id, preserveSelection: !!path })} onEdgeSelect={chooseEdge} />
      <details className="knowledge-list"><summary>{ui('节点与关系列表')}</summary>{graph.nodes.map(n => <Button className="knowledge-list-item" key={n.id} onClick={() => k.dispatch({ type: 'focus', id: n.id, preserveSelection: !!path })}>{n.label}{scope(n)}</Button>)}{graph.edges.map(e => <Button className="knowledge-list-item" key={e.id} onClick={() => chooseEdge(e.id)}>{graph.nodes.find(n => n.id === e.from)?.label} {e.direction === 'directed' ? '→' : '↔'} {graph.nodes.find(n => n.id === e.to)?.label} · {e.predicate}{scope(e)}</Button>)}</details>
    </div>{selection && <aside className="knowledge-details"><div className="knowledge-details-bar"><span>{ui('概念与证据')}</span><Button size="sm" variant="quiet" onClick={() => k.dispatch({ type: 'select', target: null })}>{ui('关闭详情')}</Button></div>{evidenceError && <p role="alert">{evidenceError}</p>}
      <KnowledgeDetails detail={detail} courses={k.courses} nodes={pathNodes} onAsk={() => setAsking(selection)} onOpenEvidence={openEvidence} onUpdate={async args => { await k.write(`knowledge.${selection.kind}.update`, args); }} onMerge={async (id, accept) => k.write(`knowledge.merge.${accept ? 'accept' : 'reject'}`, { id })} />
      {selection.kind === 'node' && <><Button className="knowledge-path-start" onClick={() => k.dispatch({ type: 'focus', id: selection.id, preserveSelection: !!path })}>{ui('聚焦概念')}</Button><Button className="knowledge-path-start" onClick={() => setPath({ startNodeId: selection.id, edgeIds: [] })}>{ui('从这里选择链路')}</Button>{path && <><PathPicker {...path} nodes={pathNodes} edges={pathEdges} onChange={setPath} /><Button className="knowledge-path-start" disabled={!path.edgeIds.length} onClick={() => setAsking({ kind: 'path', ...path })}>{ui('针对链路提问')}</Button></>}</>}
      {asking && <KnowledgeChat target={asking} filter={k.filter} onOpenEvidence={openEvidence} />}
    </aside>}</div>
  </section>;
}

