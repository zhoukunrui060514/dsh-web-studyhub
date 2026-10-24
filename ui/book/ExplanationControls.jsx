import React, { useEffect, useRef, useState } from 'react';
import { AppContext, useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui, errorMessage } from '../i18n.js';
import { modelReadiness } from '../generation-status.js';
import { useQuery } from '../learning/use-query.js';
import { usePolling } from '../use-polling.js';

export function useImageCapability() {
  const app = React.useContext(AppContext);
  return useQuery(app?.core.call, 'generation.courseBook.imageStatus', {}, app?.data.root, !!app).value?.available === true;
}
const readSaved = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Runtime receipt remains authoritative if browser storage is disabled. */ } };

/** Shared explicit image action for BookAsk, curriculum and learning. No submission on mount. */
export function FigureControls({ course, heading, words = '', handoff, after, onChanged }) {
  const { core, data } = useApp();
  const identity = JSON.stringify([data.root, course, heading, words, after]), key = `studyhub.figure:${identity}`;
  const [local, setLocal] = useState(() => ({ key, value: readSaved(key), busy: false, error: '' }));
  const current = local.key === key ? local : { key, value: readSaved(key), busy: false, error: '' };
  const live = useRef(identity), locked = useRef(false); live.current = identity;
  const value = current.value || (handoff ? { requestId: handoff.requestId, args: { course, heading, words, after, instruction: handoff.figurePlan.prompt, ...handoff } } : null);
  const query = useQuery(core.call, 'generation.courseBook.imageStatus', value ? { requestId: value.requestId } : {}, identity);
  const available = query.value?.available, status = query.value?.status, active = ['admitted', 'sending'].includes(status);
  usePolling(async () => { query.refresh(); }, { intervalMs: 1500, enabled: active });
  const notified = useRef('');
  useEffect(() => {
    if (status !== 'committed' || notified.current === value?.requestId) return;
    notified.current = value?.requestId; onChanged?.(); core.refresh();
  }, [status, value?.requestId, onChanged, core]);
  useEffect(() => () => { live.current = null; }, []);
  const send = async fresh => {
    if (locked.current) return; locked.current = true;
    const started = identity;
    const request = !fresh && value ? value : { requestId: crypto.randomUUID(), args: handoff && value ? value.args : { course, heading, ...(words ? { words } : {}) } };
    save(key, request); setLocal({ key, value: request, busy: true, error: '' });
    try { await core.call('generation.courseBook.illustrate', { ...request.args, requestId: request.requestId }); if (live.current === started) query.refresh(); }
    catch (error) { if (live.current === started) setLocal({ key, value: request, busy: false, error: errorMessage(error) }); }
    finally { locked.current = false; if (live.current === started) setLocal(old => ({ ...old, busy: false })); }
  };
  const unknown = status === 'unknown' || status === 'failed';
  return <div className="explanation-figures" data-figure-controls="" data-figure-request={value?.requestId} data-figure-status={status} data-figure-key={key}>
    <Button size="sm" variant="secondary" disabled={!available || current.busy || active} onClick={() => send(status === 'committed' || unknown)}>
      {ui(current.busy || active ? '正在配图…' : status === 'committed' ? '重新画图' : status === 'result' ? '重试保存配图' : unknown ? '重新生成图像' : handoff ? '生成讲解配图' : '画图解释')}</Button>
    {active && query.value?.jobId && <Button size="sm" variant="quiet" onClick={async () => { await core.call('job.cancel', { jobId: query.value.jobId }); query.refresh(); }}>{ui('取消配图')}</Button>}
    {status === 'result' && <span>{ui('图片已生成，点击重试保存不会再次生成。')}</span>}
    {unknown && <span role="status">{ui('上次请求结果未知；重新生成会发起新的图像请求。')}</span>}
    {!available && !query.loading && <span>{ui('图像模型未配置，仍可阅读和练习。')}</span>}
    {current.error && <span role="alert">{current.error}</span>}
    {query.error && <span role="alert">{query.error}<Button size="sm" onClick={query.refresh}>{ui('刷新状态')}</Button></span>}
  </div>;
}

export default function ExplanationControls({ course, node, onChanged }) {
  const { core, data } = useApp(), available = useImageCapability();
  const [allowFigure, setAllowFigure] = useState(false), [job, setJob] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  usePolling(async () => {
    const result = await core.call('job.status', { jobId: job });
    if (!live.current || ['running', 'queued', 'cancelling'].includes(result.status)) return;
    setJob(null); setBusy(false);
    if (result.status === 'failed') setError(result.error?.message || '讲解生成失败');
    else { onChanged?.(); core.refresh(); }
  }, { enabled: !!job, intervalMs: 1500 });
  const explain = async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { const result = await core.call('generation.courseBook.explain', { course, heading: node.hid, mode: 'here', instruction: '请系统讲解这一节，先解释概念，再逐步说明机制，并用资料支持的例子帮助理解。', allowFigure }); if (live.current) setJob(result.jobId); }
    catch (error) { if (live.current) { setError(errorMessage(error)); setBusy(false); } }
    finally { locked.current = false; }
  };
  return <div className="explanation-controls">
    <div className="loop-actions"><Button size="sm" disabled={busy || !modelReadiness(data).ready} onClick={explain}>{ui(busy ? '正在编写讲解…' : '讲解这一节')}</Button>
      {available && <label><input type="checkbox" checked={allowFigure} onChange={e => setAllowFigure(e.target.checked)} />{ui('本次允许配图')}</label>}</div>
    <FigureControls key={JSON.stringify([data.root, course, node.hid])} course={course} heading={node.hid} onChanged={onChanged} />
    {error && <p role="alert">{error}</p>}
  </div>;
}
