import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { learningScope } from './model.js';
import { useQuery } from './use-query.js';
import { useLearning } from './LearningProvider.jsx';
import QueryStatus from './QueryStatus.jsx';

function ReinforcementList({ scope }) {
  const { data, core, intents } = useApp(), learning = useLearning();
  const [cursor, setCursor] = useState(null);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const query = useQuery(core.call, 'learning.reinforcement.query', { scope, limit: 50, ...(cursor ? { cursor } : {}) }, data.root, true, data.revision);
  return <><QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />{error && <p role="alert">{error}</p>}
    {query.value?.total === 0 && <p className="loop-brief">{ui('当前范围没有待巩固题目。')}</p>}
    {query.value?.items.map(item => <article className="loop-row" key={item.id}><p className="loop-meta">{item.course?.name || ui('未分类')} · {ui('最近评分')} {item.grade}</p>
      <h2>{item.topic}</h2><div className="loop-actions"><Button onClick={() => intents.practice([{ deckId: item.deckId, cardId: item.cardId }])}>{ui('再练这道题')}</Button>
        <Button variant="quiet" disabled={!!working || scope.kind === 'all' && !item.course?.id} onClick={() => run('start', () => learning.startSession({
          scope: item.course?.id ? { kind: 'course', courseId: item.course.id } : { kind: 'unassigned' },
          target: { kind: 'topic', deckId: item.deckId, topic: item.topic }, origin: 'reinforcement',
        }))}>{ui('先学这个主题')}</Button></div>
    </article>)}
    <div className="loop-actions">{cursor && <Button onClick={() => setCursor(null)}>{ui('回到第一页')}</Button>}{query.value?.nextCursor && <Button onClick={() => setCursor(query.value.nextCursor)}>{ui('下一页')}</Button>}</div>
  </>;
}
export default function ReinforcementPage({ legacy }) {
  const { data } = useApp(), scope = learningScope(data), [showLegacy, setShowLegacy] = useState(false);
  return <section className="page loop-page"><h1>{ui('待巩固')}</h1><p className="loop-meta">{ui('从实际作答中找到需要再练的内容。')}</p>
    <ReinforcementList key={JSON.stringify([data.root, scope])} scope={scope} />
    <details onToggle={event => setShowLegacy(event.currentTarget.open)}><summary>{ui('更多错题筛选与定制练习')}</summary>{showLegacy && legacy}</details>
  </section>;
}
