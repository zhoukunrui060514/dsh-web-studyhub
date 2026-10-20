import React, { useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui } from '../i18n.js';
import Dialog from '../components/Dialog.jsx';
import { Checkbox } from '../components/Choice.jsx';
export default function BuildDialog({ materials, write, onClose, openTasks }) {
  const [selected, setSelected] = useState([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const build = async origin => { setBusy(true); try { const result = await write('knowledge.build', { origin, materials: materials.filter(m => selected.includes(m.identity)).map(m => ({ identity: m.identity, revision: m.revision })) }); setNotice(result.accepted ? ui('已提交后台任务') : ui(result.status || '已保存构建意图')); } catch (e) { setNotice(e.message); } finally { setBusy(false); } };
  return <Dialog title={ui('构建／更新')} onClose={onClose}><h3>{ui('选择资料构建知识图谱')}</h3><p>{ui('自动构建仅处理开启后新导入或后续变更的资料；已有资料请明确补建。')}</p>
    {materials.filter(m => !m.archived).map(m => <Checkbox key={m.identity} label={m.title || m.identity} hint={`${ui(m.processing?.status || 'pending')} ${m.processing?.reason ? ui(m.processing.reason) : ''}`} checked={selected.includes(m.identity)} onChange={checked => setSelected(s => checked ? [...s, m.identity] : s.filter(id => id !== m.identity))} />)}
    <p role="status">{notice}</p><div className="knowledge-toolbar"><Button disabled={busy || !selected.length} onClick={() => build('manual')}>{ui('构建所选资料')}</Button><Button disabled={busy} onClick={() => build('backfill')}>{ui('补建已有资料')}</Button><Button onClick={openTasks}>{ui('查看任务')}</Button><Button onClick={onClose}>{ui('关闭')}</Button></div>
  </Dialog>;
}
