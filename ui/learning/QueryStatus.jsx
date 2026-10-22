import React from 'react';
import { Button } from '../components/index.js';
import { ui } from '../i18n.js';
export default function QueryStatus({ query, onRefresh = query.refresh }) {
  return <>{query.loading && <p role="status" className="loop-meta">{ui(query.value ? '正在更新…' : '正在读取…')}</p>}
    {query.error && <div role="alert"><p>{query.error}</p><Button onClick={onRefresh}>{ui('重新读取')}</Button></div>}</>;
}
