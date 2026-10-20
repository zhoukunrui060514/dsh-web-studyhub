import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { ui, uiFormat } from '../i18n.js';
import { useStudy } from '../study-context.jsx';
export default function KnowledgeChat({ target, filter, threadId, onThreadChange, onOpenEvidence }) {
  const { call } = useStudy();
  const [thread, setThread] = useState({ messages: [] }), [question, setQuestion] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const generation = useRef(0), targetKey = JSON.stringify([target, filter]);
  useEffect(() => {
    const request = ++generation.current;
    setThread({ messages: [] }); setPending(false); setError(''); setQuestion('');
    call('knowledge.thread.get', { target, filter }).then(result => { if (request === generation.current) { setThread(result); onThreadChange?.(result.threadId); } }, e => { if (request === generation.current) setError(e.message); });
    return () => { generation.current = request + 1; };
  }, [call, targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async e => {
    e.preventDefault(); if (pending || !question.trim()) return;
    const request = generation.current, submitted = question;
    setPending(true); setError('');
    try {
      const result = await call('knowledge.ask', { target, filter, question: submitted, ...(thread.threadId || threadId ? { threadId: thread.threadId || threadId } : {}), requestId: crypto.randomUUID() });
      if (request === generation.current) { setThread(result); onThreadChange?.(result.threadId); if (result.status === 'failed') setError(result.error || ui('回答失败，请重试')); else setQuestion(''); }
    } catch (failure) { if (request === generation.current) setError(failure.message); }
    finally { if (request === generation.current) setPending(false); }
  };
  return <section className="knowledge-chat"><h3>{ui('围绕资料提问')}</h3>{thread.staleHistory && <p>{ui('依据旧版本')}</p>}
    <div aria-live="polite">{thread.messages.map(m => <article key={m.id} className="knowledge-message"><strong>{ui(m.role === 'user' ? '我的问题' : '资料解答')}</strong><p>{m.text}</p>{m.status === 'failed' && <p>{ui('回答失败，请重试')}</p>}{m.supplemental && <p>{ui('补充解释／资料未直接说明')}</p>}{m.citations?.map(c => <div key={c.id}>{c.status === 'stale' && <small>{ui('依据旧版本')}</small>}{c.status === 'missing' && <small>{ui('引用资料已不可用')}</small>}<Button onClick={() => onOpenEvidence(c)}>{ui('查看引用')} · {c.quote.slice(0, 70)}</Button></div>)}{!!m.unverifiedCitationIds?.length && <p>{ui('部分引用未通过核验')}</p>}</article>)}</div>
    {!!thread.omittedEvidence && <p>{uiFormat('已省略 {0} 条证据', [thread.omittedEvidence])}</p>}{error && <p role="alert">{error}</p>}
    <form onSubmit={send}><label>{ui('问题')}<textarea className="knowledge-textarea" maxLength={4000} value={question} onChange={e => setQuestion(e.target.value)} /></label><Button disabled={pending || !question.trim()} type="submit">{ui('发送问题')}</Button>{pending && <p role="status">{ui('正在生成回答')}</p>}</form>
  </section>;
}
