import { resolveLearningScope, resolveLegacyLearningScope } from './course-scope.js';
import { courseIndex, courseOf } from './courses.js';
import { courseActivityRules } from './course-active.js';
import { courseBatch } from './course-route.js';
import { latestOutcomes, cardLevel, isDue, planPath } from './mastery.js';
import { roundOptions } from './daily-path.js';
import { isLibraryListSource } from './exam-point-list.js';
import { currentCourseOutline } from './course-outline-book.js';
import { digest, flatten } from './curriculum.js';

function targetAvailable(state, session) {
  const target = session.target;
  if (target?.kind === 'topic') return state.decks.some(d => d.id === target.deckId && !d.archived && !d.systemKind &&
    courseOf(d, state) === session.course.name && d.cards.some(c => (c.topic || '未分类') === target.topic));
  if (target?.kind === 'outline') {
    const outline = currentCourseOutline(state.sources, session.course.name);
    return !!outline && outline.id === target.outlineId && digest([outline.id, outline.courseOutline]) === target.outlineRevision &&
      flatten(outline.courseOutline.nodes).some(n => n.id === target.nodeId);
  }
  return false;
}

/** One rule-based decision, shared by the API, compact snapshot and coach. No I/O or writes. */
export function learningToday(state, args = {}) {
  const now = args.now ?? Date.now();
  if (!Number.isFinite(now)) throw Object.assign(new Error('invalid-time'), { code: 'invalid-time' });
  const scope = args.scope ? resolveLearningScope(state, args.scope) : resolveLegacyLearningScope(state, state.focus?.mode === 'interview' ? '*' : undefined);
  const index = courseIndex(state), rules = courseActivityRules(state), outcome = latestOutcomes(state.attempts);
  const course = name => ({ id: index.resolve(name)?.id ?? null, name });
  const inside = name => scope.kind === 'all' || (scope.kind === 'unassigned' ? name === '' : scope.courseIds.includes(index.resolve(name)?.id));
  const active = state.decks.filter(d => !d.archived && !d.systemKind && rules.deckActive(d));
  const scoped = active.filter(d => inside(courseOf(d, state)));
  const candidates = [];
  const add = (kind, priority, at, courses, target, action, reason) => candidates.push({ kind, priority, at, courses, target, action, reason });
  for (const run of state.runs) {
    if (run.closedAt || run.workflowSessionId || run.learningSessionId || !(run.index < run.entries.length)) continue;
    const pending = run.entries.slice(run.index).filter(e => !e.feedback);
    if (!pending.length) continue;
    const decks = [...new Set(pending.map(e => e.deckId ?? run.deckId))].map(id => active.find(d => d.id === id));
    // Continuing a mixed run must not implicitly restart a parked or removed deck.
    if (decks.some(d => !d)) continue;
    if (pending.some(e => !decks.find(d => d.id === (e.deckId ?? run.deckId))?.cards.some(c => c.id === e.card.id && !c.suspended))) continue;
    const courses = [...new Set(decks.map(d => courseOf(d, state)))].map(course);
    const batch = run.purpose === 'course', daily = run.mode === 'path' || run.mode === 'new';
    add(batch ? 'continue-course' : daily ? 'continue-learning' : 'continue-practice', batch ? 1 : daily ? 2 : 0,
      run.updatedAt ?? run.startedAt, courses, { runId: run.id }, { operation: 'review.get', args: { runId: run.id } },
      batch ? '继续尚未完成的课程批次' : daily ? '继续尚未完成的今日学习' : '先完成已经开始的练习');
  }
  for (const session of state.learningSessions) {
    if (!['active', 'paused'].includes(session.status) || !session.course || !inside(session.course.name) || !rules.status(session.course.name).active) continue;
    if (session.course.id && !index.byId.has(session.course.id)) continue;
    if (!targetAvailable(state, session)) continue;
    add('continue-session', 2, session.updatedAt ?? session.createdAt, [session.course], { sessionId: session.id, step: session.step },
      { operation: 'learning.session.get', args: { id: session.id } }, session.status === 'paused' ? '恢复已暂停的四步学习' : '接着完成四步学习');
  }
  for (const session of state.workflowSessions) {
    if (!['active', 'paused'].includes(session.status)) continue;
    const decks = session.scope?.length ? session.scope.map(ref => active.find(d => d.id === ref.deckId)) : scoped;
    if (!decks?.length || decks.some(d => !d) || !decks.some(d => inside(courseOf(d, state)))) continue;
    add('continue-legacy-session', 2, session.updatedAt ?? session.createdAt, [...new Set(decks.map(d => courseOf(d, state)))].map(course),
      { legacySessionId: session.id, stepId: session.currentStepId }, { operation: 'workflow.session.get', args: { id: session.id } }, '继续已有学习流程，保留原步骤和记录');
  }
  const names = [...new Set(scoped.map(d => courseOf(d, state)))];
  for (const name of names.filter(Boolean)) {
    const batch = courseBatch(state, { course: name, now, outcome });
    if (batch && (batch.fresh.length || batch.reviews.length)) add('next-course-batch', 3, '', [course(name)],
      { course: name, fresh: batch.fresh.length, reviews: batch.reviews.length },
      { operation: 'review.start', args: { mode: 'course', course: name } }, batch.label || '按课程顺序学习下一批');
  }
  const unassigned = scoped.filter(d => courseOf(d, state) === '');
  if (unassigned.length && planPath(unassigned, outcome, { now, ...roundOptions(state) }).size > 0)
    add('next-learning-round', 3, '', [course('')], { course: '' },
      { operation: 'review.start', args: { mode: 'path', scope: unassigned.map(d => ({ deckId: d.id })) } }, '继续未分类题目的下一轮学习');
  const due = scoped.flatMap(deck => deck.cards.filter(card => !card.suspended && cardLevel(card, outcome(deck.id, card.id)) !== 'new' && isDue(card, now))
    .map(card => ({ deckId: deck.id, cardId: card.id })));
  if (due.length) add('due-review', 4, '', names.map(course), { count: due.length },
    { operation: 'review.start', args: { mode: 'due', scope: scoped.map(d => ({ deckId: d.id })) } }, '复习已经到期的题目');
  if (!candidates.length) {
    const source = state.sources.find(s => !s.archived && !isLibraryListSource(s) && s.text &&
      (s.courses ?? [s.course ?? '']).some(name => inside(name) && rules.status(name).active));
    if (source) add('read-material', 5, '', (source.courses ?? [source.course ?? '']).map(course), { sourceId: source.id },
      { operation: 'source.get', args: { id: source.id } }, '当前没有待练习题，先阅读已有资料');
    else add('prepare-materials', 6, '', scope.kind === 'course' ? [course(scope.path)] : [], { scope },
      { operation: 'source.list', args: scope.kind === 'course' ? { course: scope.path } : {} }, '先选择或导入学习资料');
  }
  candidates.sort((a, b) => a.priority - b.priority || String(b.at ?? '').localeCompare(String(a.at ?? '')) || JSON.stringify(a.target).localeCompare(JSON.stringify(b.target)));
  const clean = ({ priority: _priority, at: _at, ...value }) => value;
  const primary = clean(candidates[0]);
  const rest = candidates.slice(1);
  const secondary = rest.slice(0, 3);
  const dueAction = rest.find(c => c.kind === 'due-review');
  if (dueAction && !secondary.includes(dueAction)) secondary.splice(2, 1, dueAction);
  return { scope, primary, secondary: secondary.map(clean), reason: primary.reason };
}
