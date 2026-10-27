import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/index.js';
import { ui, uiFormat, errorMessage } from '../i18n.js';
import { useStudy } from '../study-context.jsx';
import { evidenceIssueText, sectionName } from './copy.js';

export default function MaterialTopUp({ documentIds, modelReady, onTasks }) {
  const { call } = useStudy(), locked = useRef(false), live = useRef(true);
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => () => { live.current = false; }, []);
  const start = async () => {
    if (locked.current) return; locked.current = true; setBusy(true); setError(''); setResult(null);
    try { const value = await call('generate.uncovered', { documentIds }); if (live.current) setResult(value); }
    catch (e) { if (live.current) setError(errorMessage(e)); }
    finally { locked.current = false; if (live.current) setBusy(false); }
  };
  return <div className="material-topup">
    <Button variant="secondary" icon="sparkle" disabled={busy || !modelReady || !documentIds.length} onClick={start}>{ui(busy ? '正在安排补题…' : '一键补齐未覆盖')}</Button>
    {result && <div role="status" className="material-topup__result">
      <p>{uiFormat('已启动 {0} 份资料，跳过 {1} 份，失败 {2} 份。', [result.started.length, result.skipped.length, result.failed.length])}</p>
      <p>{ui(result.started.length ? '后台按未覆盖小节生成草稿，检查发布后即可练习。' : '已覆盖、正在出题或缺少文字证据的部分会跳过；具体页面见下方。')}</p>
      {result.failed.map(item => <p key={item.documentId}>{item.title}：{item.error}</p>)}
      {[...result.started, ...result.skipped].filter(item => item.held?.length).map(item => <details key={item.documentId}>
        <summary>{uiFormat('「{0}」有 {1} 个页面暂不补题', [item.title, item.held.length])}</summary>
        <ul>{item.held.map(section => <li key={section.key}>{sectionName(section)}：{evidenceIssueText(section.reason)}</li>)}</ul>
      </details>)}
      <Button size="sm" variant="quiet" onClick={onTasks}>{ui('查看任务')}</Button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
