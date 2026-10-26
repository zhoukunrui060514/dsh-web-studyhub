import React from 'react';
import { useApp } from '../app/app-context.js';
import { Button, PageHeader } from '../components/index.js';
import { InboxMessages } from '../Inbox.jsx';
import Markdown from '../Markdown.jsx';
import { markInboxRead } from '../quick-actions.js';
import { useQuery } from '../learning/use-query.js';
import { useInjectCss } from '../shared.js';
import { ui, uiFormat } from '../i18n.js';
import css from './inbox-page.css';

function Explanation({ selected, onBack }) {
  const { core, data, learn } = useApp();
  const query = useQuery(core.call, 'inbox.explanation', { id: selected.id }, data.root, true, data.revision);
  const point = query.value || selected.value;
  return <section className="page inbox-reading">
    <Button variant="quiet" icon="arrow-left" onClick={onBack}>{ui('返回信箱')}</Button>
    {query.error ? <p role="alert">{query.error}</p> : point && <>
      <PageHeader title={point.title} description={[point.course, point.deckTitle].filter(Boolean).join(' · ')} />
      {point.stale && <p className="muted">{ui('原题已更新，以下保留当时保存的讲解。')}</p>}
      <details className="inbox-reading__context"><summary>{ui('关联原题')}</summary><Markdown text={point.prompt} /></details>
      {point.question && <details className="inbox-reading__context"><summary>{ui('本次追问')}</summary><Markdown text={point.question} /></details>}
      <article className="inbox-reading__body"><Markdown text={point.body || ui('这条消息没有保留完整讲解。')} /></article>
      {!!point.citations.length && <section className="inbox-reading__sources"><h2>{ui('参考资料')}</h2>{point.citations.map((cite, i) => <blockquote key={`${cite.sourceId}-${i}`}>
        <Markdown text={cite.quote} /><cite>{cite.title}</cite><Button size="sm" variant="quiet" onClick={() => learn.openSourceAt(cite.sourceId)}>{ui('查看资料')}</Button>
      </blockquote>)}</section>}
    </>}
  </section>;
}

export default function InboxPage() {
  useInjectCss(css, 'study-inbox-page');
  const { data, core, inbox } = useApp();
  if (inbox.reader) return <Explanation key={`${data.root}:${inbox.reader.id}`} selected={inbox.reader} onBack={inbox.closeReader} />;
  return <section className="page inbox-page"><PageHeader title={ui('信箱')} description={uiFormat('{0} 条未读，讲解和后台结果都在这里。', [data.inbox?.unread || 0])}
    actions={<Button variant="quiet" disabled={!data.inbox?.unread} onClick={() => markInboxRead(core.quick)}>{ui('全部已读')}</Button>} />
    {core.quickApi.failures['inbox:read'] && <p role="alert">{core.quickApi.failures['inbox:read']}</p>}
    <InboxMessages inbox={data.inbox} busy={core.busy} onOpen={inbox.openInboxItem}
      onUndo={letter => core.act(letter.kind === 'rewrite' ? 'coach.revert' : 'card.revert', { deckId: letter.deckId, cardId: letter.cardId })} />
  </section>;
}
