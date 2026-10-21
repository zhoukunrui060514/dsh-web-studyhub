import { createCourseContentOperations } from '../../course-content-operations.js';
import { curriculumTarget, curriculumView, checkRevision, digest } from '../../curriculum.js';
import { openCourseBook } from '../../course-book-files.js';
import { examPreview, applyExamMappings, examAnnotations } from '../../curriculum-exam.js';

export function createOperations({ state }) {
  const content = createCourseContentOperations(state);
  return { mutations: {}, handlers: {
    'curriculum.get': async args => {
      const snapshot = await state.view();
      const points = args.view === 'exam' ? examAnnotations(snapshot, args) : [];
      const result = curriculumView(snapshot, args, args.view === 'exam' ? digest(points) : null);
      if (result.view !== 'exam') return result;
      const selected = new Set(result.nodes.map(node => node.id));
      const shown = points.filter(point => selected.has(point.nodeId)).slice(0, args.limit ?? 50);
      return { ...result, nodes: result.nodes.map(node => ({ ...node, examPoints: shown.filter(point => point.nodeId === node.id) })),
        examPointTotal: points.filter(point => selected.has(point.nodeId)).length,
        examPointsTruncated: points.filter(point => selected.has(point.nodeId)).length > shown.length,
        unplacedExamPoints: points.filter(point => point.nodeId === null).length };
    },
    'curriculum.examPoints.preview': async args => examPreview(await state.view(), args),
    'curriculum.examPoints.apply': async args => state.update(snapshot => applyExamMappings(snapshot, args)),
    'curriculum.prepare': async args => {
      let target;
      const book = await content.bookWrite(() => null, snapshot => {
        target = curriculumTarget(snapshot, args);
        checkRevision(target, args);
        return { view: openCourseBook(snapshot, { course: target.course }) };
      });
      return { status: book.status, course: target.course, courseId: target.scope.courseId,
        outlineId: target.outline?.id ?? null, outlineRevision: target.outlineRevision, book };
    },
  } };
}
