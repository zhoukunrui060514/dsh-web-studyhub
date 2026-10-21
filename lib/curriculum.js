import { createHash } from 'node:crypto';
import { resolveLearningScope } from './course-scope.js';
import { currentCourseOutline } from './course-outline-book.js';
import { openCourseBook } from './course-book-files.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const fail = code => { throw Object.assign(new Error(code), { code }); };
export const flatten = (nodes, parentId = null) => (nodes || []).flatMap(node => [{ ...node, parentId }, ...flatten(node.children, node.id)]);

export function curriculumTarget(state, args) {
  const scope = resolveLearningScope(state, args.scope);
  if (scope.kind === 'all') fail('single-course-required');
  const course = scope.kind === 'unassigned' ? '' : scope.path;
  const outline = currentCourseOutline(state.sources, course);
  return { scope, course, outline, outlineRevision: outline ? digest([outline.id, outline.courseOutline]) : null };
}

export function checkRevision(target, args) {
  if (!Object.hasOwn(args, 'expectedRevision') || args.expectedRevision !== target.outlineRevision) fail('curriculum-stale');
}

export function pageOf(items, args, revision) {
  const limit = args.limit === undefined ? 50 : args.limit;
  let offset = args.offset === undefined ? 0 : args.offset;
  if (args.cursor !== undefined) {
    let cursor;
    try { cursor = JSON.parse(Buffer.from(args.cursor, 'base64url').toString('utf8')); } catch { fail('invalid-pagination'); }
    if (cursor?.revision !== revision) fail('curriculum-cursor-stale');
    offset = cursor.offset;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) fail('invalid-pagination');
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit,
    nextCursor: offset + limit < items.length ? Buffer.from(JSON.stringify({ offset: offset + limit, revision })).toString('base64url') : null };
}

export function curriculumView(state, args = {}, dataRevision = null) {
  const target = curriculumTarget(state, args), { outline, course, scope, outlineRevision } = target;
  const view = args.view ?? 'structure';
  if (!['structure', 'reading', 'exam'].includes(view)) fail('invalid-curriculum-view');
  const all = flatten(outline?.courseOutline.nodes);
  const selected = args.nodeId ? all.find(node => node.id === args.nodeId) : null;
  if (args.nodeId && !selected) fail('curriculum-node-unavailable');
  const nodes = selected ? flatten([selected], selected.parentId) : all;
  const book = view === 'reading' && outline ? openCourseBook(state, { course }, { write: false }) : null;
  const page = pageOf(nodes, args, digest([course, outlineRevision, view, args.nodeId ?? null,
    book ? [book.revision, book.nodes, book.unplaced] : null, dataRevision]));
  const { items, ...pagination } = page;
  const reading = new Map(flatten(book?.nodes).map(({ children: _children, ...node }) => [node.key.replace(/^bk:/, ''), node]));
  return { status: outline ? 'ok' : 'empty', course, courseId: scope.courseId, outlineId: outline?.id ?? null, outlineRevision, view,
    ...pagination, nodes: items.map(({ children: _children, ...node }) => ({ ...node,
      ...(view === 'reading' ? { reading: reading.get(node.id) ?? null } : {}),
      ...(view === 'exam' ? { exam: node.exam ?? null } : {}) })),
    ...(book ? { bookRevision: book.revision, needsPrepare: book.changed, unplaced: book.unplaced } : {}) };
}
