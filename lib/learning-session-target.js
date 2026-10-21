import { curriculumTarget, flatten, digest } from './curriculum.js';
import { openCourseBook } from './course-book-files.js';
import { courseOutline } from './course-outline.js';
import { documentIndex, leafSegments } from './course-book-inputs.js';
import { buildOutlineIndex } from './course-outline-index.js';
import { isLibraryListSource } from './exam-point-list.js';

export const learningError = code => { throw Object.assign(new Error(code), { code }); };
export function resolveSessionTarget(state, scope, target) {
  const selected = curriculumTarget(state, { scope });
  const course = { id: selected.scope.courseId, name: selected.course };
  let refs, title, explanation = '', practiceScope = [];
  if (target?.kind === 'outline') {
    if (!selected.outline || target.outlineRevision !== selected.outlineRevision) learningError('learning-target-stale');
    const node = flatten(selected.outline.courseOutline.nodes).find(node => node.id === target.nodeId);
    if (!node) learningError('learning-target-unavailable');
    title = node.title;
    const byId = new Map(state.sources.map(source => [source.id, source]));
    const docs = documentIndex(buildOutlineIndex(state, { course: course.name }).allDocuments);
    refs = leafSegments(byId, docs, flatten([node]).flatMap(node => node.anchors || [])).map(segment => segment.sourceId);
    const book = openCourseBook(state, { course: course.name }, { write: false });
    const ids = new Set(flatten([node]).map(node => `bk:${node.id}`));
    explanation = flatten(book.nodes).filter(node => ids.has(node.key)).flatMap(node => [book.notes ? node.gen : '', node.mine, node.qa]).filter(Boolean).join('\n\n');
    practiceScope = courseOutline(state, { course: course.name, pick: { keys: [`bk:${node.id}`] } }).practice.scope;
    target = { kind: 'outline', nodeId: node.id, outlineId: selected.outline.id, outlineRevision: selected.outlineRevision };
  } else if (target?.kind === 'topic') {
    const deck = state.decks.find(deck => deck.id === target.deckId && !deck.archived && !deck.systemKind
      && (deck.course ?? deck.folder ?? '') === course.name);
    if (!deck || typeof target.topic !== 'string' || !deck.cards.some(card => (card.topic || '未分类') === target.topic)) learningError('learning-target-unavailable');
    const cards = deck.cards.filter(card => !card.suspended && (card.topic || '未分类') === target.topic);
    title = target.topic;
    practiceScope = cards.slice(0, 100).map(card => ({ deckId: deck.id, cardId: card.id }));
    refs = [...(deck.sourceIds || []), ...cards.flatMap(card => [...(card.sourceIds || []), ...(card.selections || []).map(selection => selection.sourceId)])];
    target = { kind: 'topic', deckId: deck.id, topic: target.topic };
  } else learningError('invalid-learning-target');
  const byId = new Map(state.sources.map(source => [source.id, source]));
  const materials = [...new Set(refs)].sort().map(id => {
    const source = byId.get(id);
    return { sourceId: id, revision: source && !source.archived && !isLibraryListSource(source) ? digest([source.text, source.document ?? null]) : null };
  });
  return { course, target, title, explanation, practiceScope, materials, basisRevision: digest(materials) };
}
