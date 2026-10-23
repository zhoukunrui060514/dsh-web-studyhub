import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';

async function fixture(t, count = 7) {
  const root = await mkdtemp(join(tmpdir(), 'session-v2-'));
  const service = new StudyService(root);
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  await service.store.update(s => {
    s.sources.push({ id: 's', title: '原文', text: '负反馈维持稳态', courses: ['课程'], format: 'md' });
    s.decks.push({ id: 'd', title: '题组', course: '课程', sourceIds: ['s'], cards: Array.from({ length: count }, (_, i) => ({
      id: `q${i}`, kind: 'quiz', topic: '稳态', prompt: `问题${i}`, options: [{ id: 'A', text: '甲', correct: true }, { id: 'B', text: '乙' }], sourceIds: ['s'],
    })) });
  });
  const courseId = (await service.call('course.list')).courses.find(c => c.name === '课程').id;
  const args = { scope: { kind: 'course', courseId }, target: { kind: 'topic', deckId: 'd', topic: '稳态' }, origin: 'knowledge', requestId: 'start' };
  const session = await service.call('learning.session.start', args);
  const write = (action, current, extra = {}) => service.call(`learning.session.${action}`, { id: current.id, version: current.version, requestId: `${action}-${current.version}`, ...extra });
  return { service, args, session, write };
}

test('new sessions read without mandatory text, resume repeated starts and reject legacy writes', async t => {
  const { service, args, session, write } = await fixture(t);
  assert.equal(session.schemaVersion, 2);
  assert.equal(session.phase, 'reading');
  assert.equal((await service.call('learning.session.start', { ...args, requestId: 'click2' })).id, session.id);
  await assert.rejects(write('record', session, { step: 'retell', content: '不再要求' }), { code: 'learning-schema-incompatible' });
  const moved = await write('move', session, { phase: 'reading', readingPosition: { nodeKey: 'bk:node', offset: 12 } });
  assert.deepEqual(moved.readingPosition, { nodeKey: 'bk:node', offset: 12 });
  const paused = await write('pause', moved);
  assert.equal((await service.call('learning.session.start', { ...args, requestId: 'click3' })).status, 'paused');
  await assert.rejects(write('practice.start', paused), { code: 'learning-session-paused' });
});

test('practice caps five, reuses completed batch, next excludes actual attempts; finish preserves mastery', async t => {
  const { service, session, write } = await fixture(t);
  let first = await write('practice.start', session);
  const runId = first.run.id;
  const saved = (await service.store.read()).runs.find(r => r.id === runId);
  assert.equal(saved.entries.length, 5);
  for (let i = 0; i < saved.entries.length; i++) {
    await service.call('review.move', { runId, index: i });
    await service.call('review.answer', { runId, cardId: saved.entries[i].card.id, selected: ['A'] });
  }
  const beforeGet = await service.store.read();
  const viewed = await service.call('learning.session.get', { id: session.id });
  assert.equal(viewed.displayPhase, 'results');
  assert.deepEqual(await service.store.read(), beforeGet);
  first = await write('practice.start', first.session);
  assert.equal(first.run.id, runId);
  const next = await write('practice.next', first.session, { expectedRunId: runId });
  assert.notEqual(next.run.id, runId);
  const snapshot = await service.store.read();
  assert.equal(snapshot.runs.find(r => r.id === next.run.id).entries.length, 2);
  const mastery = structuredClone(snapshot.decks);
  const finished = await write('finish', next.session);
  assert.equal(finished.status, 'completed');
  const after = await service.store.read();
  assert.ok(after.runs.find(r => r.id === next.run.id).closedAt);
  assert.deepEqual(after.decks, mastery);
  const results = await service.call('learning.records.sessionResults', { id: session.id });
  assert.equal(results.sessionSummary.answered, 5);
  assert.equal(results.sessionSummary.unanswered, 2);
});

test('incomplete batch requires explicit close; close/next replay and competing writes stay atomic', async t => {
  const { service, session, write } = await fixture(t);
  const first = await write('practice.start', session);
  const before = await service.store.read();
  await assert.rejects(write('practice.next', first.session, { expectedRunId: first.run.id }), { code: 'learning-practice-incomplete' });
  assert.deepEqual(await service.store.read(), before);
  const closed = await write('practice.close', first.session, { expectedRunId: first.run.id });
  assert.equal(closed.session.phase, 'results');
  const request = { expectedRunId: first.run.id, requestId: 'next-once' };
  const results = await Promise.allSettled([
    write('practice.next', closed.session, request),
    write('practice.next', closed.session, { ...request, requestId: 'competitor' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const next = results.find(r => r.status === 'fulfilled').value;
  const replay = await write('practice.next', closed.session, request);
  assert.equal(replay.run.id, next.run.id);
  assert.equal((await service.store.read()).runs.length, 2);
});

test('v1 read is pure, failed upgrade rolls back and successful new write preserves history', async t => {
  const { service, session, write } = await fixture(t);
  const records = { explain: { content: '旧讲解', status: 'completed' }, retell: { content: '旧复述', status: 'pending' }, practice: { status: 'pending' }, summary: { content: '旧总结' } };
  await service.store.update(s => Object.assign(s.learningSessions[0], { schemaVersion: 1, step: 'retell', records, outcome: 'old' }));
  const before = await service.store.read();
  const view = await service.call('learning.session.get', { id: session.id });
  assert.equal(view.displayPhase, 'reading');
  assert.equal(view.schemaVersion, 1);
  assert.deepEqual(await service.store.read(), before);
  await assert.rejects(write('practice.next', session, { expectedRunId: 'missing' }));
  assert.deepEqual(await service.store.read(), before);
  const moved = await write('move', session, { phase: 'reading' });
  assert.equal(moved.schemaVersion, 2);
  assert.deepEqual(moved.records, records);
  assert.equal(moved.step, 'retell');
  assert.equal(moved.outcome, 'old');
});

test('stale material allows current run and finishing but forbids new batch', async t => {
  const { service, session, write } = await fixture(t);
  const first = await write('practice.start', session);
  await service.store.update(s => { s.sources[0].text += '更新'; });
  const resumed = await write('practice.start', first.session);
  assert.equal(resumed.run.id, first.run.id);
  const closed = await write('practice.close', resumed.session, { expectedRunId: first.run.id });
  const before = await service.store.read();
  await assert.rejects(write('practice.next', closed.session, { expectedRunId: first.run.id }), { code: 'learning-target-stale' });
  assert.deepEqual(await service.store.read(), before);
  assert.equal((await write('finish', closed.session)).status, 'completed');
});

test('all answered candidates return exhausted without fabricating a run', async t => {
  const { service, session, write } = await fixture(t, 1);
  const first = await write('practice.start', session);
  await service.call('review.answer', { runId: first.run.id, cardId: 'q0', selected: ['A'] });
  const next = await write('practice.next', first.session, { expectedRunId: first.run.id });
  assert.equal(next.status, 'exhausted');
  assert.equal(next.run, null);
  assert.equal((await service.store.read()).runs.length, 1);
});
