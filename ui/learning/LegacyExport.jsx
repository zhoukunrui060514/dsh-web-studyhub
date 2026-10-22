import React, { useState } from 'react';
import { useApp } from '../app/app-context.js';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
import { useAsyncAction } from '../use-async.js';
import { useQuery } from './use-query.js';
import QueryStatus from './QueryStatus.jsx';

export default function LegacyExport() {
  const { data, core } = useApp(), [cursor, setCursor] = useState(null);
  const query = useQuery(core.call, 'legacy.inventory', { limit: 50, ...(cursor ? { cursor } : {}) }, data.root);
  const { run, working, error } = useAsyncAction({ exclusive: true });
  const download = async (item, format) => {
    const result = await core.call('legacy.export', { type: item.type, id: item.id, format });
    const url = URL.createObjectURL(new Blob([result.content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${item.type}-${item.id}.${format === 'json' ? 'json' : 'md'}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <><QueryStatus query={query} onRefresh={() => { setCursor(null); query.refresh(); }} />{error && <p role="alert">{error}</p>}
    <p>{ui('导出保留旧对象的完整内容和历史。宿主设置、凭据和录音文件不在此导出中。')}</p>
    {query.value?.total === 0 && <p>{ui('没有旧对象。')}</p>}
    {query.value?.items.map(item => <div className="loop-row" key={`${item.type}:${item.id}`}><strong>{item.title || item.id}</strong><div className="loop-actions">{['json', 'markdown'].map(format => <Button key={format} disabled={!!working} variant="quiet" onClick={() => run('export', () => download(item, format))}>{ui(format === 'json' ? '导出 JSON' : '导出 Markdown')}</Button>)}</div></div>)}
    <div className="loop-actions">{cursor && <Button onClick={() => setCursor(null)}>{ui('回到第一页')}</Button>}{query.value?.nextCursor && <Button onClick={() => setCursor(query.value.nextCursor)}>{ui('下一页')}</Button>}</div>
  </>;
}
