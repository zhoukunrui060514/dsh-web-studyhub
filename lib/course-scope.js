import { courseIndex } from './courses.js';
import { courseScope, courseOrder, coursePath } from './course-tree.js';
import { knownCourseNames, courseScopes } from './source-courses.js';
import { courseActivityRules } from './course-active.js';
import { currentCourse } from './focus.js';

const fail = code => { throw Object.assign(new Error(code), { code }); };

function resolve(state, kind, course = null, path = null, includeDescendants = false) {
  const known = knownCourseNames(state), index = courseIndex(state);
  const within = courseScope(path, known), order = courseOrder(known);
  const members = kind === 'unassigned' ? [] : index.entities.filter(item => kind === 'all' ||
    (includeDescendants ? within(item.name) : item.id === course?.id))
    .sort((a, b) => order(a.name, b.name));
  const rules = courseActivityRules(state);
  return { kind, courseId: course?.id ?? null, path, includeDescendants,
    courseIds: members.map(item => item.id), activeCourseIds: members.filter(item => rules.status(item.name).active).map(item => item.id) };
}

/** Pure course membership; activity is reported separately, never silently filtered. */
export function resolveLearningScope(state, scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) fail('invalid-scope');
  if (scope.kind === 'all' || scope.kind === 'unassigned') return resolve(state, scope.kind);
  if (scope.kind !== 'course' || typeof scope.courseId !== 'string' || !scope.courseId ||
    (scope.includeDescendants !== undefined && typeof scope.includeDescendants !== 'boolean')) fail('invalid-scope');
  const course = courseIndex(state).byId.get(scope.courseId);
  if (!course) fail('course-unavailable');
  return resolve(state, 'course', course, course.name, scope.includeDescendants !== false);
}

/** Adapter for legacy focus defaults, course aliases and implicit parent paths. */
export function resolveLegacyLearningScope(state, value) {
  const selected = value == null ? currentCourse(state) : value;
  if (selected == null || selected === '*') return resolve(state, 'all');
  if (selected === '') return resolve(state, 'unassigned');
  if (typeof selected !== 'string') fail('invalid-scope');
  const course = courseIndex(state).resolve(selected);
  if (course) return resolve(state, 'course', course, course.name, true);
  const known = knownCourseNames(state);
  const path = courseScopes(state, known).find(name => name && coursePath(name, known) === coursePath(selected, known));
  if (!path) fail('course-unavailable');
  return resolve(state, 'course', null, path, true);
}
