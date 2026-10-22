export function learningScope(data) {
  const name = data?.focus?.course;
  if (name == null || name === '*') return { kind: 'all' };
  if (!name) return { kind: 'unassigned' };
  const courseId = data.focus.courseId ?? data.focus.courses?.find(c => c.name === name)?.id;
  if (!courseId) throw Error('course-unavailable');
  return { kind: 'course', courseId, includeDescendants: false };
}

export function createSessionWriter(call) {
  let pending;
  return async (operation, args) => {
    const key = JSON.stringify([operation, args]);
    if (pending?.key !== key) pending = { key, requestId: crypto.randomUUID() };
    const result = await call(operation, { ...args, requestId: pending.requestId });
    pending = null;
    return result;
  };
}
export const sessionScope = ({ kind, courseId }) => ({ kind, ...(courseId ? { courseId } : {}) });
export const mergeSessionRead = (saved, read) => saved?.id === read.id && saved.version > read.version ? saved : read;
export function createStepAdvancer(record, advance) {
  let savedKey;
  return async (step, content) => {
    const key = JSON.stringify([step, content]);
    if (savedKey !== key) { await record(step, content); savedKey = key; }
    const result = await advance(); savedKey = null; return result;
  };
}

export function decisionDestination(operation) {
  const destinations = { 'learning.session.get': 'session', 'review.get': 'review', 'review.start': 'review',
    'source.get': 'source', 'source.list': 'materials', 'workflow.session.get': 'legacy' };
  if (!destinations[operation]) throw Error('unsupported-learning-action');
  return destinations[operation];
}
export const STEP_LABELS = { explain: '讲解', retell: '复述', practice: '练习', summary: '总结' };
export const STEPS = Object.keys(STEP_LABELS);
export const TYPE_LABELS = { session: '学习会话', run: '练习', attempt: '作答', note: '笔记' };
