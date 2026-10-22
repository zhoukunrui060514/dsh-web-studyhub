import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { useQuery } from './use-query.js';
import QueryStatus from './QueryStatus.jsx';
import { usePolling } from '../use-polling.js';
import { taskActionAllowed } from '../tasks/task-model.js';

const statuses = { complete: '已完成', completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断', queued: '排队中', running: '进行中', paused: '已暂停', draft: '待发布', notified: '有新通知', todo: '待办', done: '已完成' };
const labelOf = action => action.operation === 'board.get' ? '打开待办' : action.operation === 'inbox.mark' ? '标为已读' : action.operation === 'draft.publish.plan' ? '预览发布' : ({ cancel: '取消', retry: '重试', pause: '暂停', resume: '继续', set: '调整设置' }[action.args.action] || action.args.action);
export default function ActivityPage({ consoleView }) {
  const { data, core, nav, drafts, learn } = useApp();
  const [type, setType] = useState(''), [cursor, setCursor] = useState(null), [consoleOpen, setConsoleOpen] = useState(false);
  const query = useQuery(core.call, 'activity.query', { limit: 50, includeTasks: true, ...(type ? { type } : {}), ...(cursor ? { cursor } : {}) }, data.root);
  usePolling(() => { if (!query.loading) query.refresh(); }, { intervalMs: 5000, enabled: !cursor && query.value?.items.some(item => ['queued', 'running'].includes(item.status)) });
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const act = async action => {
    if (action.operation === 'board.get') { nav.navigate('board'); return; }
    if (action.operation === 'draft.publish.plan') { const draft = await core.call('draft.get', { id: action.args.id }); drafts.openDraft(draft, { navigation: true }); return; }
    await core.call(action.operation, action.args); setCursor(null); query.refresh(); await core.refresh();
  };
  return <section className="page loop-page"><h1>{ui('活动中心')}</h1>
    <Button variant="quiet" disabled={query.loading} onClick={() => { setCursor(null); query.refresh(); }}>{ui('刷新活动')}</Button>
    <nav className="loop-tabs" aria-label={ui('活动类型')}>{[['', '全部'], ['job', '任务'], ['notification', '通知'], ['draft', '草稿'], ['task', '待办']].map(([id, label]) => <Button key={id} variant="quiet" aria-pressed={id === type} onClick={() => { setType(id); setCursor(null); }}>{ui(label)}</Button>)}</nav>
    <QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />{error && <p role="alert">{error}</p>}
    {query.value?.total === 0 && <p className="loop-brief">{ui('当前学习库还没有活动。')}</p>}
    {query.value?.items.map(item => <article className="loop-row" key={`${item.type}:${item.id}`}><p className="loop-meta">{ui(statuses[item.status] || item.status)} · {item.at ? new Date(item.at).toLocaleString() : ''}</p><h2>{item.title || item.kind}</h2>
      {!!item.notifications.length && <p className="loop-meta">{ui(item.notifications.every(notification => notification.read) ? '通知已读' : '有未读通知')}</p>}
      <div className="loop-actions">{item.studyRef && <Button onClick={() => learn.openBoardReference(item.studyRef)}>{ui('打开学习内容')}</Button>}
        {item.actions.filter(action => action.args?.action !== 'set'
          && (action.operation !== 'job.control' || taskActionAllowed(item.kind, action.args.action))
          && (action.operation !== 'inbox.mark' || item.notifications.some(notification => action.args.ids.includes(notification.id) && !notification.read))).map((action, index) => <Button key={index} disabled={!!working} variant="quiet" onClick={() => run('action', () => act(action))}>{ui(labelOf(action)) || ui('打开待办')}</Button>)}
      </div></article>)}
    <div className="loop-actions">{cursor && <Button onClick={() => setCursor(null)}>{ui('回到第一页')}</Button>}{query.value?.nextCursor && <Button onClick={() => setCursor(query.value.nextCursor)}>{ui('下一页')}</Button>}</div>
    <details onToggle={event => setConsoleOpen(event.currentTarget.open)}><summary>{ui('任务详情与高级控制')}</summary>{consoleOpen && consoleView}</details>
  </section>;
}
