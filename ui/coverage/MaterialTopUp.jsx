import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/index.js';
import { ui, uiFormat, errorMessage } from '../i18n.js';
import { useStudy } from '../study-context.jsx';

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
      <p>{ui(result.started.length ? '后台按未覆盖小节生成草稿，检查发布后即可练习。' : '已覆盖或正在出题的部分会自动跳过。')}</p>
      {result.failed.map(item => <p key={item.documentId}>{item.title}：{item.error}</p>)}
      <Button size="sm" variant="quiet" onClick={onTasks}>{ui('查看任务')}</Button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
