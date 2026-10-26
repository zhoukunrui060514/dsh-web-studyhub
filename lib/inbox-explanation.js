import { findCard } from './prereq.js';
import { followupDigest, followupSource } from './followup.js';
import { opensExplanation } from './inbox-kinds.js';

export const snapshotExplanation = card => ({ digest: followupDigest(card), content: structuredClone(followupSource(card)) });

function savedVersion(card, letter) {
  if (letter.explanationSnapshot) return letter.explanationSnapshot;
  const revisions = card.revisions || [], at = Date.parse(letter.at);
  const index = revisions.findLastIndex(revision => Date.parse(revision.at) <= at &&
    (revision.reason === letter.detail || letter.kind === 'rewrite' && revision.reason?.startsWith('陪学按反馈修改')));
  if (index < 0) return null;
  const content = revisions[index + 1]?.content || card;
  return { content, digest: followupDigest(content) };
}

/** Read the saved answer through references; opening a letter never turns reading into practice. */
export function inboxExplanation(state, { id }) {
  const letter = state.inbox.find(m => m.id === id);
  if (!letter || !opensExplanation(letter.kind)) throw new Error('这条讲解消息不存在');
  let found; try { found = findCard(state, letter); } catch { throw new Error('这道题已经不在题库里了'); }
  const { deck, card } = found, history = card.followups || [];
  const reply = letter.kind === 'followup' ? letter.followupId ? history.find(r => r.id === letter.followupId)
    : [...history].reverse().find(r => (r.originalQuestion === letter.detail || r.question === letter.detail) && Date.parse(r.at) <= Date.parse(letter.at)) : null;
  const missingReply = letter.kind === 'followup' && !reply;
  const version = letter.kind === 'followup' ? null : savedVersion(card, letter), point = version?.content || card;
  const missingContent = letter.kind !== 'followup' && !version;
  return { kind: 'explanation', id, deckId: deck.id, cardId: card.id, title: point.topic || point.objective || point.prompt,
    course: deck.course || deck.folder || '', deckTitle: deck.title, prompt: point.prompt, answer: point.answer || '',
    question: reply?.question || letter.detail || '', body: reply?.answer || (missingReply || missingContent ? '' : point.explanation || point.answer || ''),
    missingReply, missingContent, stale: letter.kind === 'followup' ? !!reply && (!!reply.staleFrom || reply.digest !== followupDigest(card)) : !version || version.digest !== followupDigest(card),
    citations: (point.citations || []).map(cite => ({ sourceId: cite.sourceId, title: state.sources.find(s => s.id === cite.sourceId)?.title || '原资料', quote: cite.quote || '' })) };
}
