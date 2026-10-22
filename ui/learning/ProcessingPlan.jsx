import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';

export default function ProcessingPlan() {
  const { data, core, nav, set } = useApp();
  const [kind, setKind] = useState('document'), [plan, setPlan] = useState(null);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const course = data.focus?.course;
  return <details className="loop-row"><summary>{ui('资料处理流程')}</summary>
    <p>{ui('先保存原文，再按需要生成题目或课程内容。生成失败时，已导入资料仍保留。')}</p>
    <label>{ui('资料类型')} <select value={kind} onChange={event => { setKind(event.target.value); setPlan(null); }}>{[['document', '文档'], ['pdf', 'PDF 转换'], ['audio', '录音'], ['subtitles', '字幕']].map(([id, label]) => <option key={id} value={id}>{ui(label)}</option>)}</select></label>
    <Button disabled={!!working} onClick={() => run('plan', async () => setPlan(await core.call('materials.processing.plan', { kind, generation: 'questions', ...(course != null && course !== '*' ? { course } : {}) })))}>{ui('查看处理步骤')}</Button>
    {error && <p role="alert">{error}</p>}
    {plan && <ol>{plan.steps.map(step => <li className="loop-row" key={step.stage}><strong>{ui(step.stage === 'import' ? '导入并保存原文' : '从保存的资料生成题目')}</strong><p>{ui(step.stage === 'import' ? '完成后可在资料库读取原文和跟踪任务。' : '导入完成后选择资料，再打开生成页面；此操作需要模型。')}</p>
      {step.status === 'unavailable' ? <p>{ui('当前宿主未启用所需组件。')}</p> : <Button variant="quiet" onClick={() => step.stage === 'generation' ? nav.navigate('generate') : kind === 'audio' || kind === 'subtitles' ? nav.navigate('audio') : set.setModal({ type: 'add' })}>{ui(step.stage === 'generation' ? '前往生成' : '前往导入')}</Button>}
    </li>)}</ol>}
  </details>;
}
