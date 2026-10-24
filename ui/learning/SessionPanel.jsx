import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button, Dialog } from '../components/index.js';
import Markdown from '../Markdown.jsx';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { createSessionWriter, mergeSessionRead, STEP_LABELS } from './model.js';
import { useQuery } from './use-query.js';
import LearningReader from './LearningReader.jsx';
import SessionResults from './SessionResults.jsx';

const phaseLabels = { reading: '阅读', practice: '练习', results: '结果' };
export default function SessionPanel({ id, onClose }) {
  const { data, core, session: practice, learn, nav } = useApp();
  const query = useQuery(core.call, 'learning.session.get', { id }, data.root, true, data.revision);
  const [saved, setSaved] = useState(null), [notice, setNotice] = useState(''), [showCurrent, setShowCurrent] = useState(false);
  useEffect(() => { if (query.value) setSaved(previous => mergeSessionRead(previous, query.value)); }, [query.value]);
  const write = useMemo(() => createSessionWriter(core.call), [core.call]);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const current = saved ?? query.value, currentRef = useRef(current); currentRef.current = current;
  const reading = useQuery(core.call, 'curriculum.get', { scope: current?.scope, target: current?.target, view: 'reading' }, data.root, !!current && (current.status !== 'completed' || current.schemaVersion === 2 || showCurrent), data.revision);
  const results = useQuery(core.call, 'learning.records.sessionResults', { id }, data.root, !!current, data.revision);
  const position = useRef(null);
  const mutate = async (operation, args = {}) => {
    const previous = currentRef.current;
    const result = await write(operation, { id, version: previous.version, ...args });
    const next = result.session ?? result; currentRef.current = next; setSaved(next);
    if (args.readingPosition) position.current = null;
    await core.refresh(); query.refresh(); results.refresh(); return result;
  };
  const phase = current?.displayPhase ?? current?.phase;
  const disabled = !!working || current?.status !== 'active';
  const runId = current?.currentRunId ?? current?.records?.practice?.runId;
  const move = next => run('move', () => mutate('learning.session.move', { phase: next, ...(position.current ? { readingPosition: position.current } : {}) }));
  const start = action => run('practice', async () => {
    if (position.current && currentRef.current.status === 'active') await mutate('learning.session.move', { phase: 'reading', readingPosition: position.current });
    if (currentRef.current.schemaVersion === 1) await mutate('learning.session.move', { phase: 'reading' });
    const result = await mutate(`learning.session.practice.${action}`, action === 'next' ? { expectedRunId: currentRef.current.currentRunId } : {});
    if (!result.run) { setNotice(ui('本次范围已没有未答题目，可以返回阅读或结束学习。')); return; }
    if (result.session.phase === 'results') return;
    learn.rememberContext(learn.captureContext()); practice.enterRun(result.run); onClose();
  });
  const close = () => run('exit', async () => {
    if (position.current && currentRef.current?.status === 'active') await mutate('learning.session.move', { phase: 'reading', readingPosition: position.current });
    onClose();
  });
  return <Dialog size="lg" title={current?.title || ui('学习会话')} onClose={close} busy={!!working} className="loop-session">
    {query.loading && !current && <p role="status">{ui('正在读取会话…')}</p>}
    {(query.error || error) && <div role="alert"><p>{query.error || error}</p><Button onClick={() => query.refresh()}>{ui('重新读取进度')}</Button></div>}
    {current && <>
      <p className="loop-meta">{current.course.name || ui('未分类')} · {ui(current.status === 'completed' ? '已结束' : current.status === 'paused' ? '已暂停' : '进行中')}</p>
      {current.status !== 'completed' && <nav className="loop-steps" aria-label={ui('学习位置')}>
        {Object.entries(phaseLabels).map(([item, label]) => <Button key={item} variant="quiet" aria-current={phase === item ? 'step' : undefined}
          disabled={disabled || item === 'results' && !runId || item === 'practice' && phase === 'results'}
          onClick={() => item === 'practice' ? start('start') : move(item)}>{ui(label)}</Button>)}
      </nav>}
      {query.value?.basisStatus !== 'current' && <p className="loop-meta">{ui('原文已变化或不可用；当前练习和历史仍保留，新练习需要从当前知识点重新开始。')}</p>}
      {notice && <p role="status">{notice}</p>}
      {current.status === 'completed' && current.records && !showCurrent ? <div className="loop-reading">
        <h3>{ui('当时的学习记录')}</h3>{Object.entries(current.records).map(([key, record]) => record.content && <section key={key}><h4>{ui(STEP_LABELS[key] || key)}</h4><Markdown text={record.content} /></section>)}
        <Button onClick={() => setShowCurrent(true)}>{ui('打开当前课件')}</Button>
      </div> : (phase === 'reading' || showCurrent) && <div className="loop-step">
        {reading.error && <p role="alert">{reading.error}</p>}
        {reading.value && <LearningReader reading={reading.value} onChanged={reading.refresh} position={current.readingPosition} onPosition={value => { position.current = value; }} />}
        {reading.loading && !reading.value && <p role="status">{ui('正在读取内容…')}</p>}
        {reading.value?.status === 'incomplete' && <Button variant="quiet" onClick={() => { nav.navigate('curriculum'); onClose(); }}>{ui('到课程大纲准备内容')}</Button>}
      </div>}
      {phase === 'practice' && <div className="loop-step"><p>{ui('练习使用现有题库与评分。可以继续作答，也可以结束本批查看部分结果。')}</p>
        <Button variant="primary" disabled={disabled} onClick={() => start('start')}>{ui('回到练习')}</Button>
        <Button disabled={disabled} onClick={() => run('close', () => mutate('learning.session.practice.close', { expectedRunId: runId }))}>{ui('结束本批')}</Button>
      </div>}
      {(phase === 'results' || current.status === 'completed') && results.value && <SessionResults results={results.value} />}
      {results.error && <p role="alert">{results.error}</p>}
      {current.status !== 'completed' && <div className="loop-actions">
        {phase === 'reading' && <Button variant="primary" disabled={disabled} onClick={() => start('start')}>{ui('做题检验')}</Button>}
        {phase === 'results' && <><Button disabled={disabled} onClick={() => move('reading')}>{ui('返回阅读')}</Button><Button variant="primary" disabled={disabled} onClick={() => start('next')}>{ui('下一批练习')}</Button></>}
        <Button disabled={disabled} onClick={() => run('finish', () => mutate('learning.session.finish'))}>{ui('结束本次学习')}</Button>
        <Button variant="quiet" disabled={!!working} onClick={() => run('pause', () => mutate('learning.session.pause', { paused: current.status !== 'paused' }))}>{ui(current.status === 'paused' ? '恢复学习' : '暂停学习')}</Button>
      </div>}
    </>}
  </Dialog>;
}
