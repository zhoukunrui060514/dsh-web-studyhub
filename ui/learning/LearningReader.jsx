import React, { useLayoutEffect, useRef } from 'react';
import Markdown from '../Markdown.jsx';
import { ui } from '../i18n.js';

/** One content body for curriculum and learning. No model calls on render. */
export function ReadingNode({ node }) {
  return <article className="loop-reading" data-reading-node={node.key}>
    <Markdown text={[node.gen, node.mine, node.qa].filter(Boolean).join('\n\n') || ui('这一节尚未编写讲解。')} />
  </article>;
}
export default function LearningReader({ reading, onPosition, position }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = position?.offset ?? 0; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="loop-reader" ref={ref} onScroll={event => {
    const element = event.currentTarget;
    const visible = [...element.querySelectorAll('[data-reading-node]')].find(node => node.getBoundingClientRect().bottom > element.getBoundingClientRect().top);
    if (visible) onPosition?.({ nodeKey: visible.dataset.readingNode, offset: element.scrollTop });
  }}>
    {reading.status === 'incomplete' && <p className="loop-meta">{ui('还没有完整讲解。可以先读已有内容、直接做题，或到课程大纲准备阅读内容。')}</p>}
    {reading.nodes.filter(node => node.leaf).map(node => <section key={node.key}>
      <h3>{node.title}</h3><ReadingNode node={node} />
    </section>)}
    {!reading.nodes.length && <>
      {reading.references.map((ref, i) => <blockquote key={`${ref.sourceId}-${i}`}><Markdown text={ref.quote} /><cite>{ref.title}</cite></blockquote>)}
      {reading.questions.filter(q => q.explanation).map(q => <section key={`${q.deckId}-${q.cardId}`}><h3>{ui('已有题目讲解')}</h3><Markdown text={q.prompt} /><Markdown text={q.explanation} /></section>)}
    </>}
  </div>;
}
