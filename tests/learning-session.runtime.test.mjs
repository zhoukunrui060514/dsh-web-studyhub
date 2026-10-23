import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { courseOutlineMaterial } from '../lib/course-outline-book.js';
import { groupSourcesByDocument } from '../lib/source-groups.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'learning-session-'));
  const service = new StudyService(root);
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  await service.store.update(state => {
    state.sources.push({ id: 's', title: '材料', text: '这是原文知识', courses: ['课程'], format: 'md' });
    state.decks.push({ id: 'deck', title: '题组', course: '课程', sourceIds: ['s'], cards: [
      { id: 'q', kind: 'quiz', topic: '主题', prompt: '选甲', options: [{ id: 'A', text: '甲', correct: true }, { id: 'B', text: '乙' }], sourceIds: ['s'] },
    ] });
  });
  const courseId = (await service.call('course.list')).courses.find(course => course.name === '课程').id;
  return { root, service, args: { scope: { kind: 'course', courseId }, target: { kind: 'topic', deckId: 'deck', topic: '主题' }, origin: 'knowledge', requestId: 'start-1' } };
}

const update = (service, action, session, extra = {}) => service.call(`learning.session.${action}`, { id: session.id, version: session.version, requestId: `${action}:${session.version}`, ...extra });

test('different clicks and entry points reuse unfinished study and retain retry receipts', async t => {
  const { service, args } = await fixture(t);
  const sessions = await Promise.all(Array.from({ length: 4 }, (_, i) => service.call('learning.session.start', {
    ...args, origin: i % 2 ? 'reinforcement' : 'knowledge', requestId: `click-${i}`,
  })));
  assert.equal(new Set(sessions.map(s => s.id)).size, 1);
  let session = await update(service, 'record', sessions[0], { step: 'explain', content: '已经学到这里' });
  session = await update(service, 'advance', session);
  session = await update(service, 'pause', session);
  const reused = await service.call('learning.session.start', { ...args, requestId: 'later-click' });
  assert.equal(reused.id, session.id);
  assert.equal(reused.step, 'retell');
  assert.equal(reused.status, 'paused');
  assert.equal(reused.records.explain.content, '已经学到这里');
  await assert.rejects(service.call('learning.session.start', { ...args, requestId: 'later-click', origin: 'today' }), { code: 'learning-request-conflict' });
  assert.equal((await service.store.read()).learningSessions.length, 1);
});

test('completed study and changed material allow a new round without changing history', async t => {
  const { service, args } = await fixture(t);
  let session = await service.call('learning.session.start', args);
  for (let i = 0; i < 4; i++) session = await update(service, 'advance', session, { skip: true, reason: '本轮跳过' });
  const next = await service.call('learning.session.start', { ...args, requestId: 'next' });
  assert.notEqual(next.id, session.id);
  await service.store.update(state => { state.sources[0].text += '修订'; });
  const revised = await service.call('learning.session.start', { ...args, requestId: 'revised' });
  assert.notEqual(revised.id, next.id);
  assert.equal((await service.call('learning.session.get', { id: session.id })).status, 'completed');
  assert.equal((await service.call('learning.session.start', { ...args, requestId: 'next' })).id, next.id);
});

test('a reused start cannot take a receipt ID already used to save notes', async t => {
  const { service, args } = await fixture(t);
  const session = await service.call('learning.session.start', args);
  await update(service, 'record', session, { step: 'explain', content: '已有笔记', requestId: 'shared-id' });
  const before = await service.store.read();
  await assert.rejects(service.call('learning.session.start', { ...args, requestId: 'shared-id' }), { code: 'learning-request-conflict' });
  assert.deepEqual(await service.store.read(), before);
});

test('fixed session start is idempotent and content, pause, version conflicts and readonly history survive reload', async t => {
  const { root, service, args } = await fixture(t);
  const [one, two] = await Promise.all([service.call('learning.session.start', args), service.call('learning.session.start', args)]);
  assert.equal(one.id, two.id);
  assert.equal(one.schemaVersion, 1);
  assert.equal(one.step, 'explain');
  await assert.rejects(service.call('learning.session.start', { ...args, origin: 'today' }), { code: 'learning-request-conflict' });
  let session = await update(service, 'record', one, { step: 'explain', content: '讲解内容' });
  assert.equal((await update(service, 'record', one, { step: 'explain', content: '讲解内容' })).version, session.version);
  await assert.rejects(update(service, 'pause', one), { code: 'learning-version-conflict' });
  session = await update(service, 'advance', session, { requestId: 'advance-1' });
  assert.equal(session.step, 'retell');
  const replay = await update(service, 'advance', { ...session, version: one.version + 1 }, { requestId: 'advance-1' });
  assert.equal(replay.step, 'retell');
  session = await update(service, 'pause', session);
  assert.equal(session.status, 'paused');
  assert.equal((await update(service, 'pause', { ...session, version: session.version - 1 })).status, 'paused');
  await assert.rejects(update(service, 'record', session, { step: 'retell', content: '不应保存' }), { code: 'learning-session-paused' });
  session = await update(service, 'pause', session, { paused: false });
  const before = await service.store.read();
  const viewed = await service.call('learning.session.get', { id: session.id, step: 'explain' });
  assert.equal(viewed.records.explain.content, '讲解内容');
  assert.equal(viewed.step, 'retell');
  assert.deepEqual(await service.store.read(), before);
  const reopened = new StudyService(root);
  try { assert.equal((await reopened.call('learning.session.get', { id: session.id })).records.explain.content, '讲解内容'); }
  finally { await reopened.dispose(); }
  assert.equal((await service.store.read()).learningSessions.length, 1);
});

test('practice uses a single atomic existing study run; real answers advance without a second grading system', async t => {
  const { service, args } = await fixture(t);
  let session = await service.call('learning.session.start', args);
  session = await update(service, 'record', session, { step: 'explain', content: '讲解' });
  session = await update(service, 'advance', session, { requestId: 'a1' });
  session = await update(service, 'record', session, { step: 'retell', content: '我能复述' });
  session = await update(service, 'advance', session, { requestId: 'a2' });
  const request = { id: session.id, version: session.version, requestId: 'practice-1' };
  const [first, second] = await Promise.all([service.call('learning.session.practice.start', request), service.call('learning.session.practice.start', request)]);
  assert.equal(first.run.id, second.run.id);
  session = first.session;
  assert.equal((await service.store.read()).runs.length, 1);
  await assert.rejects(update(service, 'advance', session, { requestId: 'premature' }), { code: 'learning-practice-incomplete' });
  await service.call('review.answer', { runId: first.run.id, cardId: 'q', selected: ['A'] });
  assert.equal((await service.store.read()).attempts.length, 1);
  session = await update(service, 'advance', session, { requestId: 'a3' });
  session = await update(service, 'record', session, { step: 'summary', content: '总结本次学习' });
  session = await update(service, 'advance', session, { requestId: 'a4' });
  assert.equal(session.status, 'completed');
  assert.equal(session.outcome, 'complete');
  assert.equal((await service.store.read()).attempts.length, 1);
});

async function atPractice(service, args) {
  let session = await service.call('learning.session.start', args);
  session = await update(service, 'advance', session, { requestId: 'e', skip: true, reason: '直接自测' });
  return update(service, 'advance', session, { requestId: 'r', skip: true, reason: '本轮跳过复述' });
}

test('separate session practices do not close one another; focus and course rename preserve the fixed target', async t => {
  const { service, args } = await fixture(t);
  await service.store.update(state => state.decks[0].cards.push({ ...state.decks[0].cards[0], id: 'q-other', topic: '另一主题' }));
  let first = await atPractice(service, args);
  const second = await atPractice(service, { ...args, target: { ...args.target, topic: '另一主题' }, requestId: 'start-2' });
  const one = await update(service, 'practice.start', first, { requestId: 'p' });
  const two = await update(service, 'practice.start', second, { requestId: 'p' });
  assert.notEqual(one.run.id, two.run.id);
  assert.ok((await service.store.read()).runs.every(run => !run.closedAt));
  await service.call('focus.set', { course: '*' });
  const renamed = await service.call('course.rename', { id: args.scope.courseId, name: '改名课程' });
  assert.ok(renamed);
  first = await service.call('learning.session.get', { id: first.id });
  assert.equal(first.course.name, '改名课程');
  assert.equal(first.course.id, args.scope.courseId);
  assert.equal(first.basisStatus, 'current');
});

test('a closed unfinished session practice starts a new answerable round and preserves the old answers', async t => {
  const { service, args } = await fixture(t);
  await service.store.update(state => state.decks[0].cards.push({ ...state.decks[0].cards[0], id: 'q2' }));
  let session = await atPractice(service, args);
  const first = await update(service, 'practice.start', session, { requestId: 'first-practice' });
  await service.call('review.answer', { runId: first.run.id, cardId: first.run.card.id, selected: ['A'] });
  await service.call('review.end', { runId: first.run.id });
  const before = await service.store.read();
  const oldRun = before.runs.find(run => run.id === first.run.id);
  session = first.session;
  const restartArgs = { id: session.id, version: session.version, requestId: 'restart-practice' };
  const [second, replay] = await Promise.all([
    service.call('learning.session.practice.start', restartArgs),
    service.call('learning.session.practice.start', restartArgs),
  ]);
  assert.notEqual(second.run.id, first.run.id);
  assert.equal(replay.run.id, second.run.id);
  assert.equal(second.run.closed, false);
  const after = await service.store.read();
  assert.deepEqual(after.runs.find(run => run.id === first.run.id), oldRun);
  assert.deepEqual(after.attempts, before.attempts);
  assert.equal(after.runs.length, 2);
  for (const cardId of ['q', 'q2']) {
    const raw = (await service.store.read()).runs.find(run => run.id === second.run.id);
    await service.call('review.move', { runId: raw.id, index: raw.entries.findIndex(entry => entry.card.id === cardId) });
    await service.call('review.answer', { runId: raw.id, cardId, selected: ['A'] });
  }
  session = await update(service, 'advance', second.session, { requestId: 'finish-restarted-practice' });
  assert.equal(session.step, 'summary');
});

test('archiving then restoring a deck can restart unfinished practice; a completed closed practice is reused', async t => {
  const { service, args } = await fixture(t);
  const session = await atPractice(service, args);
  const first = await update(service, 'practice.start', session, { requestId: 'first-practice' });
  await service.call('deck.archive', { id: 'deck', archived: true });
  await service.call('deck.archive', { id: 'deck', archived: false });
  const second = await update(service, 'practice.start', first.session, { requestId: 'after-restore' });
  assert.notEqual(second.run.id, first.run.id);
  await service.call('review.answer', { runId: second.run.id, cardId: 'q', selected: ['A'] });
  await service.call('review.end', { runId: second.run.id });
  const reopened = await update(service, 'practice.start', second.session, { requestId: 'completed-practice' });
  assert.equal(reopened.run.id, second.run.id);
  assert.equal((await service.store.read()).runs.length, 2);
  assert.equal((await update(service, 'advance', reopened.session, { requestId: 'finish' })).step, 'summary');
});

test('citation-only topics retain their material basis and reject changed or removed sources before practice', async t => {
  const { service, args } = await fixture(t);
  await service.store.update(state => {
    delete state.decks[0].sourceIds;
    delete state.decks[0].cards[0].sourceIds;
    state.decks[0].cards[0].citations = [{ sourceId: 's', quote: '这是原文知识' }];
  });
  const session = await atPractice(service, args);
  assert.deepEqual(session.materials.map(ref => ref.sourceId), ['s']);
  assert.equal((await service.call('learning.session.get', { id: session.id })).basisStatus, 'current');
  await service.store.update(state => { state.sources[0].text = '已变更的原文'; });
  assert.equal((await service.call('learning.session.get', { id: session.id })).basisStatus, 'stale');
  await assert.rejects(update(service, 'practice.start', session, { requestId: 'stale-citation' }), { code: 'learning-target-stale' });
  await service.store.update(state => { state.sources[0].archived = true; });
  assert.equal((await service.call('learning.session.get', { id: session.id })).basisStatus, 'unavailable');
  await assert.rejects(update(service, 'practice.start', session, { requestId: 'removed-citation' }), { code: 'learning-target-stale' });
});

test('empty practice stays empty and explicit skips never claim completed practice or add attempts', async t => {
  const { service, args } = await fixture(t);
  await service.store.update(state => { state.decks[0].cards[0].suspended = true; });
  let session = await atPractice(service, args);
  const result = await update(service, 'practice.start', session, { requestId: 'empty' });
  assert.equal(result.status, 'empty');
  assert.equal(result.run, null);
  assert.equal((await service.store.read()).runs.length, 0);
  await service.store.update(state => { state.decks[0].cards[0].suspended = false; });
  const replay = await update(service, 'practice.start', session, { requestId: 'empty' });
  assert.equal(replay.status, 'empty', 'an empty receipt must not later create a run on replay');
  session = result.session;
  session = await update(service, 'advance', session, { requestId: 'skip-p', skip: true, reason: '没有可练习题目' });
  session = await update(service, 'record', session, { step: 'summary', content: '本次只阅读，没有作答' });
  session = await update(service, 'advance', session, { requestId: 'end' });
  assert.equal(session.outcome, 'with-skips');
  assert.equal(session.records.practice.status, 'skipped');
  assert.equal((await service.store.read()).attempts.length, 0);
});

test('study question skips remain visible as partial practice, rather than full completion', async t => {
  const { service, args } = await fixture(t);
  await service.store.update(state => {
    const good = state.decks[0].cards[0];
    state.decks[0].cards.unshift({ ...good, id: 'bad', publicationUngrable: true });
  });
  let session = await atPractice(service, args);
  const started = await update(service, 'practice.start', session, { requestId: 'p' });
  const raw = (await service.store.read()).runs.find(run => run.id === started.run.id);
  const badIndex = raw.entries.findIndex(entry => entry.card.id === 'bad');
  await service.call('review.move', { runId: raw.id, index: badIndex });
  await service.call('review.skip', { runId: raw.id, cardId: 'bad' });
  await service.call('review.move', { runId: raw.id, index: 0 });
  await service.call('review.answer', { runId: raw.id, cardId: 'q', selected: ['A'] });
  session = await update(service, 'advance', started.session, { requestId: 'done-p' });
  assert.equal(session.records.practice.status, 'completed-with-skips');
  session = await update(service, 'record', session, { step: 'summary', content: '有一道题不能评分，已跳过' });
  session = await update(service, 'advance', session, { requestId: 'end' });
  assert.equal(session.outcome, 'with-skips');
  assert.equal((await service.store.read()).attempts.length, 1);
});

test('stale source blocks a new run, preserves content; legacy export is complete and read-only', async t => {
  const { service, args } = await fixture(t);
  const session = await atPractice(service, args);
  await service.store.update(state => {
    state.sources[0].text = '发生变化的原文';
    state.workflowSessions.push({ id: 'legacy', template: { steps: [{ id: 'branch', kind: 'recall', retry: 'branch' }] }, records: { branch: { answer: '旧回答' } }, history: ['保留历史'] });
  });
  assert.equal((await service.call('learning.session.get', { id: session.id })).basisStatus, 'stale');
  await assert.rejects(update(service, 'practice.start', session, { requestId: 'stale' }), { code: 'learning-target-stale' });
  const before = await service.store.read();
  const exported = await service.call('learning.session.legacy.export', { id: 'legacy', format: 'json' });
  assert.deepEqual(JSON.parse(exported.content), before.workflowSessions[0]);
  const markdown = await service.call('learning.session.legacy.export', { id: 'legacy', format: 'markdown' });
  assert.match(markdown.content, /旧回答/);
  assert.match(markdown.content, /保留历史/);
  assert.deepEqual(await service.store.read(), before);
});

test('outline target reuses exact curriculum identity, survives reload and rejects changed outline before practice', async t => {
  const { service, args } = await fixture(t);
  const state = await service.store.read();
  const anchor = groupSourcesByDocument(state.sources)[0].key;
  const outline = courseOutlineMaterial({ title: '总纲', course: '课程', fingerprint: '12345678', orderBasis: { codes: ['numbering'] },
    nodes: [{ id: 'node', title: '知识点', anchors: [anchor] }], other: { anchors: [] }, counts: { units: 1 } });
  await service.store.update(state => state.sources.push(outline));
  const curriculum = await service.call('curriculum.get', { scope: args.scope });
  const input = { ...args, target: { kind: 'outline', nodeId: 'node', outlineRevision: curriculum.outlineRevision } };
  const session = await atPractice(service, input);
  assert.equal(session.target.outlineId, curriculum.outlineId);
  await service.store.update(state => { state.sources.find(source => source.id === outline.id).archived = true; });
  await assert.rejects(update(service, 'practice.start', session, { requestId: 'gone' }), { code: 'learning-target-stale' });
  assert.equal((await service.call('learning.session.get', { id: session.id })).basisStatus, 'stale');
});

test('practice commit failure rolls back both run and association; a different library never sees the session', async t => {
  const left = await fixture(t), right = await fixture(t);
  const session = await atPractice(left.service, left.args);
  const before = await left.service.store.read();
  const commit = left.service.store.commit;
  left.service.store.commit = async () => { throw new Error('test disk failure'); };
  try { await assert.rejects(update(left.service, 'practice.start', session, { requestId: 'atomic' }), /test disk failure/); }
  finally { left.service.store.commit = commit; }
  assert.deepEqual(await left.service.store.read(), before);
  await assert.rejects(right.service.call('learning.session.get', { id: session.id }), { code: 'learning-session-unavailable' });
  const result = await update(left.service, 'practice.start', session, { requestId: 'atomic' });
  assert.equal(result.session.records.practice.runId, result.run.id);
  const exported = await left.service.call('export');
  assert.equal(exported.learningSessions[0].id, session.id);
});

test('semantically identical start requests ignore JSON property order; missing source is visible as unavailable', async t => {
  const { service, args } = await fixture(t);
  const first = await service.call('learning.session.start', args);
  const second = await service.call('learning.session.start', {
    requestId: args.requestId, origin: args.origin, target: { topic: args.target.topic, deckId: args.target.deckId, kind: args.target.kind }, scope: args.scope,
  });
  assert.equal(second.id, first.id);
  await service.store.update(state => { state.sources = []; });
  assert.equal((await service.call('learning.session.get', { id: first.id })).basisStatus, 'unavailable');
});
