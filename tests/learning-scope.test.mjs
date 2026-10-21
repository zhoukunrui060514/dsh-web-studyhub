import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLearningScope, resolveLegacyLearningScope } from '../lib/course-scope.js';
import { courseIdFor } from '../lib/courses.js';
import { emptyState } from '../lib/store.js';

const id = courseIdFor;
function fixture() {
  const state = emptyState();
  state.courses = ['A', 'A / child', 'Aardvark', 'TCP/IP', 'Only / child'].map(name => ({ id: id(name), name, aliases: [] }));
  state.courses[0].active = false;
  state.courses[1].active = true;
  state.courses[2].aliases = ['Old name'];
  state.sources = state.courses.map((course, n) => ({ id: `source-${n}`, title: course.name, text: 'Material', courses: [course.name] }));
  return state;
}
function freeze(value) { for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item); return Object.freeze(value); }

test('all and unassigned are distinct, pure, stable scopes', () => {
  const state = freeze(fixture());
  const result = resolveLearningScope(state, { kind: 'all' });
  assert.equal(result.courseId, null);
  assert.equal(result.path, null);
  assert.equal(result.courseIds.length, 5);
  assert.ok(!result.activeCourseIds.includes(id('A')));
  assert.ok(result.activeCourseIds.includes(id('A / child')));
  assert.deepEqual(resolveLearningScope(state, { kind: 'unassigned' }), {
    kind: 'unassigned', courseId: null, path: null, includeDescendants: false, courseIds: [], activeCourseIds: [],
  });
  assert.deepEqual(resolveLearningScope(state, { kind: 'all' }), result);
  assert.deepEqual(resolveLearningScope(emptyState(), { kind: 'all' }).courseIds, []);
});

test('explicit parent includes descendants, exact scope retains parked course', () => {
  const state = fixture();
  const parent = resolveLearningScope(state, { kind: 'course', courseId: id('A') });
  assert.deepEqual(parent.courseIds, [id('A'), id('A / child')]);
  assert.deepEqual(parent.activeCourseIds, [id('A / child')]);
  assert.deepEqual(resolveLearningScope(state, { kind: 'course', courseId: id('A'), includeDescendants: false }).courseIds, [id('A')]);
  assert.deepEqual(resolveLearningScope(state, { kind: 'course', courseId: id('TCP/IP') }).courseIds, [id('TCP/IP')]);
});

test('legacy aliases resolve stable IDs; implicit parent has no invented ID', () => {
  const state = fixture();
  assert.equal(resolveLegacyLearningScope(state, 'Old name').courseId, id('Aardvark'));
  const parent = resolveLegacyLearningScope(state, 'Only');
  assert.equal(parent.courseId, null);
  assert.equal(parent.path, 'Only');
  assert.deepEqual(parent.courseIds, [id('Only / child')]);
  assert.deepEqual(resolveLegacyLearningScope(state, 'A').courseIds, [id('A'), id('A / child')]);
});

test('legacy defaults preserve persisted all and distinguish unassigned', () => {
  const state = fixture();
  state.focus = { course: '*' };
  assert.equal(resolveLegacyLearningScope(state, null).kind, 'all');
  assert.equal(resolveLegacyLearningScope(state, undefined).kind, 'all');
  assert.equal(resolveLegacyLearningScope(state, '*').kind, 'all');
  assert.equal(resolveLegacyLearningScope(state, '').kind, 'unassigned');
  state.focus.course = 'A / child';
  assert.equal(resolveLegacyLearningScope(state, null).courseId, id('A / child'));
  assert.equal(resolveLegacyLearningScope(emptyState(), null).kind, 'all');
});

test('implicit parents remain available when only course records survive', () => {
  const state = fixture();
  state.sources = [];
  const parent = resolveLegacyLearningScope(state, 'Only');
  assert.equal(parent.courseId, null);
  assert.deepEqual(parent.courseIds, [id('Only / child')]);
});

test('invalid shapes and unknown targets produce distinct errors without writes', () => {
  const state = freeze(fixture());
  for (const scope of [null, [], {}, { kind: 'wrong' }, { kind: 'course' }, { kind: 'course', courseId: 42 },
    { kind: 'course', courseId: id('A'), includeDescendants: 'yes' }]) {
    assert.throws(() => resolveLearningScope(state, scope), { code: 'invalid-scope' });
  }
  assert.throws(() => resolveLearningScope(state, { kind: 'course', courseId: 'missing' }), { code: 'course-unavailable' });
  assert.throws(() => resolveLegacyLearningScope(state, 'Missing'), { code: 'course-unavailable' });
  assert.throws(() => resolveLegacyLearningScope(state, 42), { code: 'invalid-scope' });
});
