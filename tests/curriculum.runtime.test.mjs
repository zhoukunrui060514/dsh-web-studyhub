import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { courseOutlineMaterial } from '../lib/course-outline-book.js';
import { groupSourcesByDocument } from '../lib/source-groups.js';
import { inputFingerprint } from '../lib/exam-point-list.js';
import { courseNotesMaterial } from '../lib/course-book.js';

async function fixture(t, options) {
  const root = await mkdtemp(join(tmpdir(), 'curriculum-'));
  const service = new StudyService(root, options);
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  const sources = [
    { id: 's1', title: '第一讲', text: '甲知识的完整说明', format: 'md', courses: ['课程'] },
    { id: 's2', title: '第二讲', text: '乙知识的完整说明', format: 'md', courses: ['课程'] },
  ];
  const key = id => groupSourcesByDocument(sources).find(doc => doc.sourceIds.includes(id)).key;
  const outline = { ...courseOutlineMaterial({ title: '总纲', course: '课程', fingerprint: '12345678', orderBasis: { codes: ['numbering'] },
    nodes: [{ id: 'a', title: '甲', anchors: [key('s1')] }, { id: 'b', title: '乙', anchors: [key('s2')] }],
    other: { anchors: [] }, counts: { units: 2, leftover: 0, invalid: 0, repeated: 0 } }), createdAt: '2026-10-21T00:00:00Z' };
  await service.store.update(state => { state.sources.push(...sources, outline); });
  const courseId = (await service.call('course.list')).courses.find(course => course.name === '课程').id;
  return { service, root, outline, scope: { kind: 'course', courseId } };
}

test('three curriculum views share a revision; reading is pure; prepare is explicit and legacy-compatible', async t => {
  const { service, scope } = await fixture(t);
  const before = await service.store.read();
  const structure = await service.call('curriculum.get', { scope });
  assert.equal(structure.status, 'ok');
  assert.deepEqual(structure.nodes.map(node => node.id), ['a', 'b']);
  const reading = await service.call('curriculum.get', { scope, view: 'reading', nodeId: 'a' });
  const exam = await service.call('curriculum.get', { scope, view: 'exam' });
  assert.equal(reading.outlineRevision, structure.outlineRevision);
  assert.equal(exam.outlineRevision, structure.outlineRevision);
  assert.deepEqual(reading.nodes.map(node => node.id), ['a']);
  assert.equal(reading.nodes[0].reading.title, '甲');
  const first = await service.call('curriculum.get', { scope, limit: 1 });
  assert.ok(first.nextCursor);
  const second = await service.call('curriculum.get', { scope, limit: 1, cursor: first.nextCursor });
  assert.deepEqual(second.nodes.map(node => node.id), ['b']);
  await assert.rejects(service.call('curriculum.get', { scope, view: 'exam', cursor: first.nextCursor }), { code: 'curriculum-cursor-stale' });
  assert.deepEqual(await service.store.read(), before, 'queries do not initialize the book');
  await assert.rejects(service.call('curriculum.prepare', { scope, expectedRevision: 'old' }), { code: 'curriculum-stale' });
  const prepared = await service.call('curriculum.prepare', { scope, expectedRevision: structure.outlineRevision });
  assert.equal(prepared.status, 'ok');
  const legacy = await service.call('course.book.open', { course: '课程' });
  assert.equal(prepared.book.revision, legacy.revision);
  assert.deepEqual(prepared.book.nodes, legacy.nodes);
  await assert.rejects(service.call('curriculum.get', { scope: { kind: 'all' } }), { code: 'single-course-required' });
  await assert.rejects(service.call('curriculum.get', { scope, nodeId: 'missing' }), { code: 'curriculum-node-unavailable' });
});

async function examFixture(t) {
  const setup = await fixture(t);
  const quote = (sourceId, text) => ({ sourceId, quote: text, start: 0, end: text.length, role: 'lecture' });
  const list = { id: 'exam-list', title: '旧考点', provenance: 'exam-blueprint', format: 'md', text: '旧清单保持原样', courses: ['课程'],
    blueprint: { version: 1, inputs: [{ role: 'lecture', sourceIds: ['s1', 's2'], fingerprint: inputFingerprint(['甲知识的完整说明', '乙知识的完整说明']) }],
      points: [{ id: 'p1', title: '明确甲', evidence: [quote('s1', '甲知识')] },
        { id: 'p2', title: '跨节', evidence: [quote('s1', '甲知识'), quote('s2', '乙知识')] },
        { id: 'p3', title: '甲', evidence: [] }] } };
  await setup.service.store.update(state => state.sources.push(list));
  return { ...setup, list };
}

test('exam preview accounts for every legacy point without writing; apply persists explicit mappings idempotently', async t => {
  const { service, scope, list, root } = await examFixture(t);
  const before = await service.store.read();
  const examPage = await service.call('curriculum.get', { scope, view: 'exam', limit: 1 });
  const preview = await service.call('curriculum.examPoints.preview', { scope, listId: list.id });
  assert.deepEqual(preview.points.map(point => [point.id, point.status, point.nodeId]), [
    ['p1', 'mapped', 'a'], ['p2', 'ambiguous', null], ['p3', 'unplaced', null],
  ]);
  assert.deepEqual(preview.totals, { mapped: 1, ambiguous: 1, unplaced: 1, total: 3 });
  assert.deepEqual(await service.store.read(), before);
  const args = { scope, listId: list.id, expectedRevision: preview.outlineRevision, listRevision: preview.listRevision,
    requestId: 'confirm-1', mappings: [{ pointId: 'p2', nodeId: 'b' }, { pointId: 'p3', nodeId: null }] };
  const applied = await service.call('curriculum.examPoints.apply', args);
  assert.deepEqual(applied.points.map(point => point.nodeId), ['a', 'b', null]);
  await assert.rejects(service.call('curriculum.get', { scope, view: 'exam', limit: 1, cursor: examPage.nextCursor }), { code: 'curriculum-cursor-stale' });
  await service.call('curriculum.examPoints.apply', args);
  const after = await service.store.read();
  assert.deepEqual(after.sources.find(source => source.id === list.id), list);
  const marks = after.sources.find(source => source.id === preview.outlineId).curriculumExamPoints;
  assert.equal(marks.length, 1);
  assert.equal(marks[0].requests.length, 1);
  assert.deepEqual(after.decks, before.decks);
  const exam = await service.call('curriculum.get', { scope, view: 'exam', nodeId: 'b' });
  assert.deepEqual(exam.nodes[0].examPoints.map(point => point.id), ['p2']);
  const reopened = new StudyService(root);
  try {
    const again = await reopened.call('curriculum.examPoints.preview', { scope, listId: list.id });
    assert.equal(again.points.find(point => point.id === 'p2').nodeId, 'b');
  } finally { await reopened.dispose(); }
  await assert.rejects(service.call('curriculum.examPoints.apply', { ...args, mappings: [] }), { code: 'curriculum-request-conflict' });
  await assert.rejects(service.call('curriculum.examPoints.apply', { ...args, requestId: 'bad', expectedRevision: 'old' }), { code: 'curriculum-stale' });
  await assert.rejects(service.call('curriculum.examPoints.apply', { ...args, requestId: 'bad', mappings: [{ pointId: 'p2', nodeId: 'gone' }] }), { code: 'curriculum-node-unavailable' });
});

test('changed evidence invalidates automatic mappings and saved confirmation is visibly stale', async t => {
  const { service, scope, list } = await examFixture(t);
  const preview = await service.call('curriculum.examPoints.preview', { scope, listId: list.id });
  await service.call('curriculum.examPoints.apply', { scope, listId: list.id, expectedRevision: preview.outlineRevision,
    listRevision: preview.listRevision, requestId: 'first', mappings: [{ pointId: 'p2', nodeId: 'b' }] });
  await service.store.update(state => { state.sources.find(source => source.id === 's1').text = '修改后的原文'; });
  const next = await service.call('curriculum.examPoints.preview', { scope, listId: list.id });
  assert.equal(next.stale, true);
  assert.equal(next.points[0].status, 'unplaced');
  assert.equal(next.points[1].confirmationStale, true);
  assert.equal(next.points[1].nodeId, null);
  await assert.rejects(service.call('curriculum.examPoints.apply', { scope, listId: list.id, expectedRevision: preview.outlineRevision,
    listRevision: preview.listRevision, requestId: 'late', mappings: [] }), { code: 'curriculum-list-stale' });
  await service.store.update(state => { state.sources.find(source => source.id === list.id).courses = ['另一课程']; });
  await assert.rejects(service.call('curriculum.examPoints.preview', { scope, listId: list.id }), { code: 'curriculum-list-unavailable' });
});

test('curriculum is available without generation or a model', async t => {
  const { service, scope } = await fixture(t, { contexts: ['system', 'materials', 'bank', 'courses', 'study', 'curriculum'] });
  assert.equal((await service.call('curriculum.get', { scope })).total, 2);
  assert.equal(service.runtime.hasAction('curriculum.prepare'), true);
  assert.equal(service.runtime.hasAction('generation.courseOutline.build'), false);
});

test('explicit synchronization retains learner text and moves removed points into unplaced', async t => {
  const { service, scope, outline } = await fixture(t);
  const start = await service.call('curriculum.get', { scope });
  const prepared = await service.call('curriculum.prepare', { scope, expectedRevision: start.outlineRevision });
  const file = prepared.book.nodes[0].files.mine;
  await service.call('course.book.save', { course: '课程', file, version: 1, text: '这是必须保留的人工笔记' });
  const replacement = { ...courseOutlineMaterial({ ...outline.courseOutline, title: '重建总纲',
    nodes: [outline.courseOutline.nodes[1]], other: { anchors: outline.courseOutline.nodes[0].anchors } }), createdAt: '2026-10-22T00:00:00Z' };
  await service.store.update(state => state.sources.push(replacement));
  const next = await service.call('curriculum.get', { scope });
  await assert.rejects(service.call('curriculum.prepare', { scope, expectedRevision: start.outlineRevision }), { code: 'curriculum-stale' });
  const synced = await service.call('curriculum.prepare', { scope, expectedRevision: next.outlineRevision });
  assert.match(synced.book.unplaced.text, /这是必须保留的人工笔记/);
});

test('queries and mappings stay isolated between libraries; evidence changes invalidate paging cursors', async t => {
  const left = await examFixture(t), right = await examFixture(t);
  const first = await left.service.call('curriculum.examPoints.preview', { scope: left.scope, listId: left.list.id, limit: 1 });
  await left.service.call('curriculum.examPoints.apply', { scope: left.scope, listId: left.list.id, expectedRevision: first.outlineRevision,
    listRevision: first.listRevision, requestId: 'only-left', mappings: [{ pointId: 'p3', nodeId: 'b' }] });
  const other = await right.service.call('curriculum.examPoints.preview', { scope: right.scope, listId: right.list.id });
  assert.equal(other.points[2].nodeId, null);
  await assert.rejects(left.service.call('curriculum.examPoints.preview', { scope: left.scope, listId: left.list.id, limit: 1, cursor: first.nextCursor }), { code: 'curriculum-cursor-stale' });
  const before = await left.service.store.read();
  await assert.rejects(left.service.call('curriculum.examPoints.apply', { scope: left.scope, listId: left.list.id, expectedRevision: first.outlineRevision,
    listRevision: first.listRevision, requestId: 'invalid-point', mappings: [{ pointId: 'gone', nodeId: 'a' }] }), { code: 'invalid-curriculum-mapping' });
  assert.deepEqual(await left.service.store.read(), before);
});

test('nested reading pages exclude descendant bodies and keep original parent references', async t => {
  const { service, scope, outline } = await fixture(t);
  const nested = { ...courseOutlineMaterial({ ...outline.courseOutline, title: '嵌套总纲',
    nodes: [{ id: 'chapter', title: '第一章', children: outline.courseOutline.nodes }] }), createdAt: '2026-10-22T00:00:00Z' };
  await service.store.update(state => state.sources.push(nested));
  const page = await service.call('curriculum.get', { scope, view: 'reading', limit: 1 });
  assert.equal(page.nodes.length, 1);
  assert.equal(page.nodes[0].id, 'chapter');
  assert.equal(page.nodes[0].reading.children, undefined, 'parent must not bypass pagination by carrying descendants');
  const leaf = await service.call('curriculum.get', { scope, nodeId: 'a' });
  assert.equal(leaf.nodes[0].parentId, 'chapter');
});

test('reading cursor tracks unprepared projected content rather than only the numeric book revision', async t => {
  const { service, scope, outline } = await fixture(t);
  const first = await service.call('curriculum.get', { scope, view: 'reading', limit: 1 });
  const notes = courseNotesMaterial({ title: '新讲解', course: '课程', outlineId: outline.id, language: 'zh', papers: [], counts: {},
    leaves: [{ id: 'b', title: '乙', anchors: outline.courseOutline.nodes[1].anchors,
      body: { fingerprint: 'f'.repeat(16), points: ['新增知识点 [^1]'], explain: '这是新讲解 [^1]',
        cites: [{ n: 1, sourceId: 's2', quote: '乙知识', start: 0, end: 3 }] } }] });
  await service.store.update(state => state.sources.push(notes));
  const latest = await service.call('curriculum.get', { scope, view: 'reading', offset: 1, limit: 1 });
  assert.equal(latest.bookRevision, first.bookRevision, 'both are projected, unpersisted revision 1');
  assert.match(latest.nodes[0].reading.gen, /这是新讲解/);
  await assert.rejects(service.call('curriculum.get', { scope, view: 'reading', limit: 1, cursor: first.nextCursor }), { code: 'curriculum-cursor-stale' });
});
