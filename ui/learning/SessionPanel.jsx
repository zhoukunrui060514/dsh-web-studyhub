import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button, Dialog } from '../components/index.js';
import Markdown from '../Markdown.jsx';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { createSessionWriter, createStepAdvancer, mergeSessionRead, STEP_LABELS, STEPS } from './model.js';
import { useQuery } from './use-query.js';

function StepEditor({ record, content, setContent, step, disabled, onSave, onAdvance }) {
  return <div className="loop-editor">
    {step === 'explain' && record.content && <Markdown text={record.content} />}
    <label>{ui(step === 'retell' ? '用自己的话复述' : step === 'summary' ? '这次学到了什么' : '讲解笔记')}
      <textarea value={content} maxLength={40000} disabled={disabled} onChange={event => setContent(event.target.value)} /></label>
    <div className="loop-actions"><Button disabled={disabled || !content.trim()} onClick={() => onSave(content)}>{ui('保存笔记')}</Button>
      <Button variant="primary" disabled={disabled || !content.trim()} onClick={() => onAdvance(content)}>{ui(step === 'summary' ? '保存并结束' : '保存并继续')}</Button></div>
  </div>;
}

export default function SessionPanel({ id, onClose }) {
  const { data, core, session: practice, learn } = useApp();
  const query = useQuery(core.call, 'learning.session.get', { id }, data.root);
  const [saved, setSaved] = useState(null), [viewed, setViewed] = useState(null), [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState({});
  useEffect(() => { if (query.value) setSaved(previous => mergeSessionRead(previous, query.value)); }, [query.value]);
  const write = useMemo(() => createSessionWriter(core.call), [core.call]);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const current = saved ?? query.value, currentRef = useRef(current); currentRef.current = current;
  const mutate = async (operation, args = {}) => {
    const previous = currentRef.current;
    const result = await write(operation, { id, version: previous.version, ...args });
    const next = result.session ?? result; currentRef.current = next; setSaved(next); return result;
  };
  const advance = useMemo(() => createStepAdvancer((step, content) => mutate('learning.session.record', { step, content }), () => mutate('learning.session.advance')), [write]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => query.refresh();
  const step = viewed ?? current?.step, past = current && step !== current.step;
  const disabled = !!working || current?.status !== 'active' || past;
  return <Dialog size="lg" title={current?.title || ui('学习会话')} onClose={onClose} busy={!!working} className="loop-session">
    {query.loading && !current && <p role="status">{ui('正在读取会话…')}</p>}
    {(query.error || error) && <div role="alert"><p>{query.error || error}</p><Button onClick={refresh}>{ui('重新读取进度')}</Button></div>}
    {current && <>
      <p className="loop-meta">{current.course.name || ui('未分类')} · {ui(current.status === 'completed' ? '已完成' : current.status === 'paused' ? '已暂停' : '进行中')}</p>
      <nav className="loop-steps" aria-label={ui('学习步骤')}>{STEPS.map((item, index) => <Button key={item} variant="quiet" aria-current={step === item ? 'step' : undefined}
        disabled={index > STEPS.indexOf(current.step)} onClick={() => setViewed(item)}>{index + 1} · {ui(STEP_LABELS[item])}</Button>)}</nav>
      {query.value?.basisStatus !== 'current' && <p className="loop-meta">{ui('原文可能已变化或不可用；已保存的学习记录仍保留。')}</p>}
      <div className="loop-step" key={step}>
        {step === 'practice' ? <>
          <p>{ui('使用题库中的实际题目练习。完成作答后回到这里继续总结。')}</p>
          <div className="loop-actions"><Button variant="primary" disabled={disabled} onClick={() => run('practice', async () => {
            const result = await mutate('learning.session.practice.start');
            if (!result.run) throw Error(ui('这个知识点还没有题目，可返回资料生成题目，或填写原因跳过。'));
            learn.rememberContext(learn.captureContext()); practice.enterRun(result.run); onClose();
          })}>{ui(current.records.practice.runId ? '回到练习' : '开始练习')}</Button>
          <Button disabled={disabled} onClick={() => run('advance', async () => { await mutate('learning.session.advance'); setViewed(null); })}>{ui('作答完成，进入总结')}</Button></div>
        </> : past || current.status === 'completed' ? <div className="loop-reading"><h3>{ui(STEP_LABELS[step])}</h3><Markdown text={current.records[step].content || current.records[step].reason || ui('这一步没有保存文字。')} /></div> : <StepEditor key={step} step={step} record={current.records[step]} content={drafts[step] ?? current.records[step].content} setContent={content => setDrafts(previous => ({ ...previous, [step]: content }))} disabled={disabled}
          onSave={content => run('save', () => mutate('learning.session.record', { step, content }))}
          onAdvance={content => run('advance', async () => { await advance(step, content); setViewed(null); await core.refresh(); })} />}
      </div>
      {current.status !== 'completed' && <div className="loop-footer"><Button disabled={!!working} onClick={() => run('pause', () => mutate('learning.session.pause', { paused: current.status !== 'paused' }))}>{ui(current.status === 'paused' ? '恢复学习' : '暂停学习')}</Button>
        {!past && <details><summary>{ui('跳过这一步')}</summary><label>{ui('跳过原因')}<input value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} /></label>
          <Button disabled={disabled || !reason.trim()} onClick={() => run('skip', async () => { await mutate('learning.session.advance', { skip: true, reason }); setViewed(null); setReason(''); await core.refresh(); })}>{ui('确认跳过')}</Button></details>}
      </div>}
      <details className="loop-basis"><summary>{ui('学习依据')}</summary>{current.materials.map(material => <Button key={material.sourceId} variant="quiet" onClick={() => learn.openLearningTarget({ kind: 'source', id: material.sourceId })}>{data.sources.find(source => source.id === material.sourceId)?.title || material.sourceId}</Button>)}</details>
    </>}
  </Dialog>;
}
