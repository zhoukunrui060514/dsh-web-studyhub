import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { switchOptions } from './helpers/runtime-switch.mjs';

async function fixture(t, complete) {
  const root = await mkdtemp(join(tmpdir(), 'skeleton-build-'));
  const service = new StudyService(root, { complete, ...switchOptions('runtime', { complete, paths: [] }) });
  t.after(() => service.dispose());
  await service.store.update(s => {
    s.sources.push({ id: 's1', title: '神经系统', text: '去极化后达到阈值，引发动作电位。', courses: ['生理'] });
    s.decks.push({ id: 'd1', title: '生理题库', course: '生理', cards: [{ id: 'q1', kind: 'flashcard', topic: '动作电位', prompt: '动作电位如何产生？', answer: '去极化达到阈值', citations: [{ sourceId: 's1', quote: '去极化后达到阈值' }] }] });
  });
  return service;
}
async function settled(service, jobId) {
  for (let i = 0; i < 200; i++) {
    const job = service.runtime.work.jobs.get(jobId);
    if (job && ['complete', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error('task did not settle');
}
const answer = { title: '动作电位骨架', overview: '从阈值理解动作电位', nodes: [{ id: 'n1', term: '阈值', meaning: '引发动作电位所需的膜电位', cards: ['q1'] }], relations: [] };

test('a skeleton can be generated and opened through one real runtime task without a chat host', async t => {
  let input;
  const service = await fixture(t, async (system, prompt) => { input = JSON.parse(prompt); return JSON.stringify(answer); });
  const started = await service.call('skeleton.generate', { scope: [{ deckId: 'd1', topic: '动作电位' }] });
  const job = await settled(service, started.jobId);
  assert.equal(job.status, 'complete', job.contract?.error?.message);
  assert.equal(input.context.cards[0].cardId, 'q1');
  assert.ok(input.context.evidence.length);
  const saved = (await service.call('skeleton.list', { course: '生理' })).skeletons[0];
  assert.equal(saved.title, answer.title);
  assert.equal((await service.call('skeleton.get', { id: saved.id })).nodes[0].cards[0].cardId, 'q1');
  assert.ok(job.contract.result.refs.some(ref => ref.kind === 'skeleton' && ref.id === saved.id));
});

test('invalid model output fails the task without saving a partial skeleton', async t => {
  const service = await fixture(t, async () => JSON.stringify({ ...answer, nodes: [{ ...answer.nodes[0], cards: ['unknown'] }] }));
  const started = await service.call('skeleton.generate', { scope: [{ deckId: 'd1' }] });
  assert.equal((await settled(service, started.jobId)).status, 'failed');
  assert.equal((await service.call('skeleton.list')).skeletons.length, 0);
});

test('topic grouping runs inside the application and keeps other courses groups', async t => {
  const service = await fixture(t, async () => JSON.stringify({ groups: [{ title: '神经生理', topics: ['动作电位'] }] }));
  await service.store.update(s => {
    s.decks.push({ id: 'other', title: '药理', course: '药理', cards: [{ id: 'q2', topic: '药代动力学', prompt: '药物代谢', answer: '肝脏' }] });
    s.topicGroups.push({ id: 'other-group', title: '药理组', topics: ['药代动力学'] });
  });
  const started = await service.call('skeleton.groups.generate', { course: '生理' });
  assert.equal((await settled(service, started.jobId)).status, 'complete');
  assert.equal((await service.call('skeleton.topics', { course: '生理' })).groups.groups[0].title, '神经生理');
  assert.ok((await service.call('skeleton.topics', { course: '药理' })).groups.groups.some(group => group.title === '药理组'));
});

test('an update cannot overwrite an edit made while the model was running', async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const service = await fixture(t, async () => { await held; return JSON.stringify(answer); });
  const old = await service.call('skeleton.save', { skeleton: { ...answer, scope: [{ deckId: 'd1' }] } });
  const started = await service.call('skeleton.generate', { id: old.id, expectedUpdatedAt: old.updatedAt, instruction: '补充阈值与动作电位的关系' });
  await service.store.update(s => { s.skeletons[0].title = '用户修改'; s.skeletons[0].updatedAt = 'changed'; });
  release();
  assert.equal((await settled(service, started.jobId)).status, 'failed');
  assert.equal((await service.call('skeleton.get', { id: old.id })).title, '用户修改');
});

test('cancelling a skeleton build keeps previously saved structures', async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const service = await fixture(t, async () => { await held; return JSON.stringify(answer); });
  const started = await service.call('skeleton.generate', { scope: [{ deckId: 'd1' }] });
  await service.call('job.control', { jobId: started.jobId, action: 'cancel' });
  release();
  assert.equal((await settled(service, started.jobId)).status, 'cancelled');
  assert.equal((await service.call('skeleton.list')).skeletons.length, 0);
});

test('merging new topics preserves existing groups and sends only ungrouped topics', async t => {
  let payload;
  const service = await fixture(t, async (_system, prompt) => { payload = JSON.parse(prompt); return JSON.stringify({ groups: [{ title: '新组', topics: payload.topics.map(topic => topic.key) }] }); });
  await service.store.update(s => {
    s.topicGroups.push({ id: 'kept', title: '我的分组', topics: ['动作电位'] });
    s.decks[0].cards.push({ id: 'q2', kind: 'flashcard', topic: '静息电位', prompt: '静息电位', answer: '内负外正' });
  });
  const started = await service.call('skeleton.groups.generate', { course: '生理', mode: 'merge' });
  assert.equal((await settled(service, started.jobId)).status, 'complete');
  assert.deepEqual(payload.topics.map(topic => topic.topic), ['静息电位']);
  assert.ok((await service.call('skeleton.topics', { course: '生理' })).groups.groups.some(group => group.id === 'kept' && group.title === '我的分组'));
});

test('an incomplete grouping cannot remove existing topic ownership', async t => {
  const service = await fixture(t, async () => JSON.stringify({ groups: [{ title: '错误分组', topics: [] }] }));
  await service.store.update(s => { s.topicGroups.push({ id: 'kept', title: '我的分组', topics: ['动作电位'] }); });
  const started = await service.call('skeleton.groups.generate', { course: '生理' });
  assert.equal((await settled(service, started.jobId)).status, 'failed');
  assert.equal((await service.call('skeleton.topics', { course: '生理' })).groups.groups[0].title, '我的分组');
});
