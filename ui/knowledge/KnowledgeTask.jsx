import React, { useEffect, useRef, useState } from 'react';
import { useStudy } from '../study-context.jsx';
import { Button } from '../components/index.js';
import { errorMessage, ui } from '../i18n.js';

export function useKnowledgeTask(data, course, onComplete, kinds = ['knowledge-skeleton-build']) {
  const { act, busy } = useStudy();
  const identity = JSON.stringify([data?.root, course]);
  const latest = useRef(identity), done = useRef(null), completing = useRef(onComplete), lock = useRef(false);
  latest.current = identity; completing.current = onComplete;
  const [state, setState] = useState(null);
  const current = state?.identity === identity ? state : null;
  const job = current?.jobId ? data?.jobs?.find(item => item.id === current.jobId || item.contract?.jobId === current.jobId)
    : data?.jobs?.find(item => kinds.includes(item.contract?.kind || item.type) && item.contract?.detail.course === course
      && ['running', 'queued'].includes(item.contract?.status || item.status));
  const status = job?.contract?.status || job?.status;
  const active = !!current?.submitting || !!(current?.jobId || job) && !['complete', 'failed', 'cancelled', 'interrupted'].includes(status);
  useEffect(() => {
    if (!current && job) setState({ identity, jobId: job.id });
  }, [current, job, identity]);
  useEffect(() => {
    if (!current?.jobId || status !== 'complete' || done.current === current.jobId) return;
    done.current = current.jobId;
    completing.current?.(job);
  }, [status, current?.jobId, job]);
  async function start(action, args) {
    if (lock.current || active || busy) return;
    lock.current = true;
    const origin = identity;
    setState({ identity, submitting: true });
    try {
      const result = await act(action, args, undefined, { rethrow: true });
      if (latest.current === origin) setState(result ? { identity: origin, jobId: result.jobId } : null);
      return result;
    } catch (failure) {
      if (latest.current === origin) setState({ identity: origin, error: errorMessage(failure) });
    } finally { lock.current = false; }
  }
  return { start, active, job, error: current?.error, submitting: current?.submitting };
}

export default function KnowledgeTask({ task, onOpen }) {
  const { navigate, act } = useStudy();
  const job = task.job, status = job?.contract?.status || job?.status;
  const failed = ['failed', 'interrupted'].includes(status);
  return <>
    {task.error && <p role="alert">{task.error}</p>}
    {(task.active || job) && <div className="loop-row" role={failed ? 'alert' : 'status'}>
      <strong>{ui(task.submitting ? '正在提交任务…' : status === 'complete' ? '已完成，内容已更新' : failed ? '生成未完成，可调整后重新生成' : status === 'cancelled' ? '任务已停止，已保存内容保留' : '正在后台整理，可继续浏览')}</strong>
      {job && status !== 'complete' && status !== 'cancelled' && <p>{job.contract?.error?.message || job.contract?.stage?.text || job.stage || ''}</p>}
      {job && <Button size="sm" variant="quiet" onClick={() => onOpen ? onOpen(job.id) : navigate('tasks')}>{ui('查看任务详情')}</Button>}
      {task.active && job && <Button size="sm" variant="quiet" onClick={() => act('job.control', { jobId: job.id, action: 'cancel' })}>{ui('停止')}</Button>}
    </div>}
  </>;
}
