import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { recordsQuery } from '../lib/learning-records.js';

test('history projection does bounded course-index work as attempt count grows',async t=>{
  const {service}=await fixture(t);
  const state=await service.store.read();
  state.attempts=Array.from({length:200},(_,i)=>({id:`a${i}`,deckId:'d',quiz_id:'q',grade:1}));
  const courses=state.courses;let reads=0;
  Object.defineProperty(state,'courses',{get(){reads++;return courses;},enumerable:true});
  assert.equal(recordsQuery(state,{scope:{kind:'all'}}).total,200);
  assert.ok(reads<10,`course collection read ${reads} times for a single query`);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'records-'));
  const service = new StudyService(root);
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  await service.store.update(s => {
    s.sources.push({ id: 's', title: '原文', text: '原文事实', courses: ['课程'], format: 'md' });
    s.decks.push({ id: 'd', title: '题组', course: '课程', sourceIds: ['s'], cards: [
      { id: 'q', kind: 'quiz', topic: '主题', prompt: '选甲', sourceIds: ['s'], options: [{ id: 'A', text: '甲', correct: true }, { id: 'B', text: '乙' }] },
    ] });
  });
  const scope = { kind: 'course', courseId: (await service.call('course.list')).courses.find(c => c.name === '课程').id };
  return { service, scope };
}
async function practice(service, scope, key) {
  let session = await service.call('learning.session.start', { scope, target: { kind: 'topic', deckId: 'd', topic: '主题' }, origin: 'reinforcement', requestId: key });
  for (const requestId of ['e', 'r']) session = await service.call('learning.session.advance', { id: session.id, version: session.version, requestId, skip: true, reason: '直接练习' });
  return service.call('learning.session.practice.start', { id: session.id, version: session.version, requestId: 'p' });
}

test('records and reinforcement derive actual answers once and link session, question and evidence without writes', async t => {
  const { service, scope } = await fixture(t);
  const first = await practice(service, scope, 'one');
  assert.equal(first.run.learningSessionId, first.session.id);
  await service.call('review.answer', { runId: first.run.id, cardId: 'q', selected: ['B'] });
  const before = await service.store.read();
  const weak = await service.call('learning.reinforcement.query', { scope });
  assert.equal(weak.total, 1);
  assert.equal(weak.items[0].links.sessionId, first.session.id);
  assert.equal(weak.items[0].links.target.topic, '主题');
  assert.equal(weak.items[0].links.materials[0].status, 'current');
  const records = await service.call('learning.records.query', { scope });
  assert.equal(records.items.filter(x => x.type === 'attempt').length, 1);
  const attempt = records.items.find(x => x.type === 'attempt');
  assert.equal(attempt.links.runId, first.run.id);
  assert.equal((await service.call('learning.records.get', { type: 'attempt', id: attempt.id })).record.quiz_id, 'q');
  assert.deepEqual(await service.store.read(), before);
  const second = await practice(service, scope, 'two');
  await service.call('review.answer', { runId: second.run.id, cardId: 'q', selected: ['A'] });
  assert.equal((await service.call('learning.reinforcement.query', { scope })).total, 0);
  assert.equal((await service.call('learning.records.query', { scope, type: 'attempt' })).total, 2);
});

test('records pagination binds filters and data; old references stay visible with explicit availability', async t => {
  const { service, scope } = await fixture(t);
  const first = await practice(service, scope, 'one');
  await service.call('review.answer', { runId: first.run.id, cardId: 'q', selected: ['A'] });
  const page = await service.call('learning.records.query', { scope, limit: 1 });
  assert.ok(page.nextCursor);
  await assert.rejects(service.call('learning.records.query', { scope: { kind: 'all' }, cursor: page.nextCursor }), { code: 'records-cursor-stale' });
  await service.store.update(s => { s.sources[0].text = '修改后的原文'; });
  await assert.rejects(service.call('learning.records.query', { scope, cursor: page.nextCursor }), { code: 'records-cursor-stale' });
  let row = (await service.call('learning.records.query', { scope, type: 'attempt' })).items[0];
  assert.equal(row.links.materials[0].status, 'stale');
  await service.store.update(s => { s.decks = []; s.sources = []; });
  row = (await service.call('learning.records.query', { scope: { kind: 'all' }, type: 'attempt' })).items[0];
  assert.equal(row.links.question.status, 'unavailable');
  assert.equal(row.links.materials[0].status, 'unavailable');
  assert.equal(row.course.id, scope.courseId, 'session course is retained after deck deletion');
});

test('ordinary cross-course runs and card notes belong to each course without unknown history becoming unassigned', async t => {
  const { service, scope } = await fixture(t);
  await service.store.update(s => {
    s.decks.push({ id: 'other', title: '英语', course: '英语', cards: [] });
    s.runs.push({ id: 'mixed', mode: 'review', startedAt: new Date().toISOString(), entries: [
      { deckId: 'd', card: { id: 'q' } }, { deckId: 'other', card: { id: 'x' } },
    ], scope: [{ deckId: 'd' }, { deckId: 'other' }] });
    s.notes.push({ id: 'note', title: '笔记', cards: [{ deckId: 'd', cardId: 'q' }], markdown: '正文' });
    s.attempts.push({ id: 'orphan', deckId: 'deleted', quiz_id: 'lost', grade: 1, timestamp: new Date().toISOString() });
  });
  const records = await service.call('learning.records.query', { scope });
  assert.ok(records.items.some(r => r.id === 'mixed'));
  assert.ok(records.items.some(r => r.id === 'note'));
  assert.equal(records.items.find(r => r.id === 'mixed').courses.length, 2);
  assert.equal((await service.call('learning.records.query', { scope: { kind: 'unassigned' } })).total, 0);
  assert.ok((await service.call('learning.records.query', { scope: { kind: 'all' } })).items.some(r => r.id === 'orphan'));
});

test('optional summary failures cannot roll back answers or completed sessions; completion reuses the existing composer', async t => {
  const { service, scope } = await fixture(t);
  const first = await practice(service, scope, 'one');
  const invoke = service.runtime.invoke.bind(service.runtime);
  let calls = 0;
  service.runtime.invoke = async (api, action, ...rest) => {
    if (api === 'notes.v1' && action === 'note.daily.advance') { calls++; throw new Error('model offline'); }
    return invoke(api, action, ...rest);
  };
  await service.call('review.answer', { runId: first.run.id, cardId: 'q', selected: ['A'] });
  assert.equal((await service.store.read()).attempts.length, 1);
  let session = await service.call('learning.session.advance', { id: first.session.id, version: first.session.version, requestId: 'answered' });
  session = await service.call('learning.session.record', { id: session.id, version: session.version, requestId: 'summary', step: 'summary', content: '人工总结' });
  const before = calls;
  session = await service.call('learning.session.advance', { id: session.id, version: session.version, requestId: 'complete' });
  assert.equal(session.status, 'completed');
  assert.equal(calls, before + 1);
  assert.equal((await service.store.read()).attempts.length, 1);
  assert.equal((await service.store.read()).notes.length, 0);
});

test('historical answer provenance uses the immutable run card instead of replacement live evidence', async t => {
  const { service, scope } = await fixture(t);
  const run = await service.call('review.start', { mode: 'quiz', deckId: 'd', fresh: true });
  await service.call('review.answer', { runId: run.id, cardId: 'q', selected: ['A'] });
  await service.store.update(s => {
    s.sources.push({ id: 'replacement', title: '替换资料', text: '新的原文', courses: ['课程'], format: 'md' });
    s.decks[0].cards[0].sourceIds = ['replacement']; s.decks[0].sourceIds = ['replacement'];
  });
  const answer = (await service.call('learning.records.query', { scope, type: 'attempt' })).items[0];
  assert.ok(answer.links.materials.some(m => m.sourceId === 's'));
  assert.ok(!answer.links.materials.some(m => m.sourceId === 'replacement'));
});
