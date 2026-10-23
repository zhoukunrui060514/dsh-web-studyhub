import { curriculumTarget, flatten, fail } from './curriculum.js';
import { openCourseBook } from './course-book-files.js';

/** Shared curriculum reading projection. No writes, generation or guessed topic matches. */
export function resolveLearningReading(state, args, selected = curriculumTarget(state, args)) {
  const { course, outline, outlineRevision } = selected;
  const book = outline ? openCourseBook(state, { course }, { write: false, questions: Number.MAX_SAFE_INTEGER }) : null;
  const all = flatten(book?.nodes), target = args.target;
  let nodes = all, questions = [], references = [], mapping = 'outline';
  if (target?.kind === 'outline') {
    const ids = new Set(flatten(outline?.courseOutline.nodes).filter(n => n.id === target.nodeId || n.parentId === target.nodeId).map(n => `bk:${n.id}`));
    const root = flatten(outline?.courseOutline.nodes).find(n => n.id === target.nodeId);
    if (!root) fail('curriculum-node-unavailable');
    for (const n of flatten([root])) ids.add(`bk:${n.id}`);
    nodes = all.filter(n => ids.has(n.key));
  } else if (target?.kind === 'topic') {
    const deck = state.decks.find(d => d.id === target.deckId && !d.archived && !d.systemKind && (d.course ?? d.folder ?? '') === course);
    if (!deck) fail('learning-target-unavailable');
    const cards = deck.cards.filter(c => !c.suspended && (c.topic || '未分类') === target.topic);
    const ids = new Set(cards.map(c => c.id));
    nodes = all.filter(n => n.leaf && n.questions?.some(q => q.deckId === deck.id && ids.has(q.cardId)));
    mapping = nodes.length ? 'explicit' : 'unmapped';
    questions = cards.map(c => ({ deckId: deck.id, cardId: c.id, prompt: c.prompt, explanation: c.explanation || '' }));
    // Only validated exact quotations, never a whole course source presented as a selected passage.
    references = cards.flatMap(c => [...(c.citations || []), ...(c.selections || [])]).flatMap(ref => {
      const source = state.sources.find(s => s.id === ref.sourceId && !s.archived);
      const quote = typeof ref.quote === 'string' ? ref.quote.trim() : '';
      return source && quote && source.text?.includes(quote) ? [{ sourceId: source.id, title: source.title, quote: quote.slice(0, 6000) }] : [];
    });
    references = [...new Map(references.map(ref => [JSON.stringify([ref.sourceId, ref.quote]), ref])).values()];
  }
  const hasContent = nodes.some(n => n.mine?.trim() || n.qa?.trim() || book?.notes && n.gen?.trim());
  return { status: hasContent ? 'ok' : 'incomplete', course, outlineRevision,
    nodes, mapping, references, questions, needsPrepare: !book || book.changed, bookRevision: book?.revision ?? null,
    unplaced: book?.unplaced ?? null, files: book?.files ?? {}, hasGeneratedContent: !!book?.notes };
}
