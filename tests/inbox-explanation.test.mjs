import test from 'node:test';
import assert from 'node:assert/strict';
import { StudyService } from '../lib/service.js';
import { privateRoot } from './helpers/model-family-baseline.mjs';
import { notify } from '../lib/inbox.js';

async function world(t, options = {}) {
  const service = new StudyService(await privateRoot(t, 'inbox-reader-'), options); t.after(() => service.dispose());
  await service.store.update(s => {
    s.sources.push({ id: 's', title: '原资料', text: '负反馈调节通过反向作用维持内环境稳态。', format: 'md', courses: ['生理'] });
    s.decks.push({ id: 'd', title: '生理题组', course: '生理', cards: [{ id: 'c', kind: 'flashcard', topic: '负反馈', objective: '解释负反馈调节机制', prompt: '什么是负反馈？', answer: '反向调节', hint: '与偏差方向相反', explanation: '维持稳态。', misconception: '所有调节都会放大偏差。', citations: [{ sourceId: 's', quote: '负反馈调节通过反向作用维持内环境稳态。' }] }] });
  }); return service;
}
test('opening a model explanation reads a standalone point and never creates or moves a review run', async t => {
  const s = await world(t), answer = '完整机制讲解。'.repeat(500);
  const reply = await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '请解释机制', answer, source: 'assistant' });
  const letter = (await s.call('inbox')).items[0], before = await s.call('export');
  assert.equal(letter.followupId, reply.item.id);
  const query = await s.call('inbox.explanation', { id: letter.id }); assert.equal(query.body, answer); assert.equal(query.title, '负反馈'); assert.equal(query.citations[0].title, '原资料');
  assert.deepEqual(await s.call('export'), before, 'query is read-only');
  const opened = await s.call('inbox.open', { id: letter.id }); assert.equal(opened.kind, 'explanation'); assert.equal(opened.body, answer);
  const after = await s.call('export'); assert.deepEqual(after.runs, before.runs); assert.deepEqual(after.attempts, before.attempts); assert.deepEqual(after.decks, before.decks); assert.equal((await s.call('inbox')).unread, 0);
});
test('legacy notifications resolve their own reply and preserve historical text after a card edit', async t => {
  const s = await world(t);
  await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '旧问题', answer: '旧回答' });
  const old = (await s.call('inbox')).items[0]; await s.call('inbox.read', { ids: [old.id] });
  await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '新问题', answer: '新回答' });
  await s.store.update(state => { delete state.inbox.find(m => m.id === old.id).followupId; state.decks[0].cards[0].answer = '新版答案'; });
  const result = await s.call('inbox.explanation', { id: old.id }); assert.equal(result.body, '旧回答'); assert.equal(result.stale, true);
  await s.store.update(state => { state.decks[0].cards = []; });
  await assert.rejects(s.call('inbox.explanation', { id: old.id }), /不在题库|不存在/);
});
test('quality and rewrite notices expose the explanation without practice side effects', async t => {
  const s = await world(t);
  for (const kind of ['improve', 'rewrite']) {
    await s.store.update(state => { notify(state, { kind, deckId: 'd', cardId: 'c' }); });
    const result = await s.call('inbox.open', { id: (await s.call('inbox')).items[0].id });
    assert.equal(result.kind, 'explanation'); assert.equal(result.body, '维持稳态。');
  }
  assert.equal((await s.call('export')).runs.length, 0);
});

test('a legacy letter with a repeated question resolves the answer saved before its notification', async t => {
  const s = await world(t);
  await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '同一个问题', answer: '旧版回答' });
  const letter = (await s.call('inbox')).items[0]; await s.call('inbox.read', { ids: [letter.id] });
  await s.store.update(state => {
    const old = state.inbox.find(m => m.id === letter.id); delete old.followupId; old.at = '2026-10-01T00:00:01.000Z';
    state.decks[0].cards[0].followups[0].at = '2026-10-01T00:00:00.000Z'; state.decks[0].cards[0].answer = '新版知识';
  });
  await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '同一个问题', answer: '新版回答' });
  const old = await s.call('inbox.explanation', { id: letter.id }); assert.equal(old.body, '旧版回答'); assert.equal(old.stale, true);
});

test('model followup producer and merged notifications keep their new answer identity', async t => {
  const s = await world(t, { completeLight: async () => JSON.stringify({ question: '模型的新问题', answer: '模型的新回答' }) });
  await s.call('card.followup.add', { deckId: 'd', cardId: 'c', question: '之前的问题', answer: '之前的回答' });
  const reply = await s.call('card.followup', { deckId: 'd', cardId: 'c', question: '模型的新问题' });
  const letter = (await s.call('inbox')).items[0]; assert.equal(letter.followupId, reply.item.id);
  assert.equal((await s.call('inbox.explanation', { id: letter.id })).body, '模型的新回答');
  await s.store.update(state => { notify(state, { kind: 'followup', deckId: 'd', cardId: 'c', detail: '没有标识的新通知' }); });
  assert.equal((await s.call('inbox')).items[0].followupId, undefined, 'a legacy producer must not retain a different reply ID');
});

test('quality and rewrite messages retain their own explanation after later edits and reverts', async t => {
  const s = await world(t), ref = { deckId: 'd', cardId: 'c' };
  await s.call('card.update', { ...ref, patch: { explanation: '第一次讲解' }, reason: '第一次改题' });
  const first = (await s.call('inbox')).items[0]; await s.call('inbox.read', { ids: [first.id] });
  await s.store.update(state => { notify(state, { kind: 'rewrite', ...ref, detail: '反馈改题讲解' }); });
  const rewrite = (await s.call('inbox')).items[0];
  await s.call('card.update', { ...ref, patch: { prompt: '新版原题', explanation: '后来讲解' }, reason: '后续改题' });
  let point = await s.call('inbox.explanation', { id: first.id }); assert.equal(point.body, '第一次讲解'); assert.equal(point.prompt, '什么是负反馈？'); assert.equal(point.stale, true);
  await s.call('card.revert', ref); await s.call('card.revert', ref);
  assert.equal((await s.call('inbox.explanation', { id: first.id })).body, '第一次讲解');
  assert.equal((await s.call('inbox.explanation', { id: rewrite.id })).body, '第一次讲解');
});

test('legacy quality messages resolve a retained revision and show missing content after it is gone', async t => {
  const s = await world(t), ref = { deckId: 'd', cardId: 'c' };
  await s.call('card.update', { ...ref, patch: { explanation: '第一次讲解' }, reason: '旧改题通知' });
  const first = (await s.call('inbox')).items[0]; await s.call('inbox.read', { ids: [first.id] });
  await s.store.update(state => { delete state.inbox.find(m => m.id === first.id).explanationSnapshot; });
  await s.call('card.update', { ...ref, patch: { explanation: '后来讲解' }, reason: '后续修改' });
  assert.equal((await s.call('inbox.explanation', { id: first.id })).body, '第一次讲解');
  await s.call('card.revert', ref); await s.call('card.revert', ref);
  const lost = await s.call('inbox.explanation', { id: first.id }); assert.equal(lost.body, ''); assert.equal(lost.missingContent, true);
});

test('real card edits preserve staleFrom as the history marker for followup reading', async t => {
  const s = await world(t), ref = { deckId: 'd', cardId: 'c' };
  await s.call('card.followup.add', { ...ref, question: '讲解原题', answer: '原来的回答' });
  const letter = (await s.call('inbox')).items[0];
  await s.call('card.update', { ...ref, patch: { prompt: '实质改变后的题干' } });
  assert.equal((await s.call('inbox.explanation', { id: letter.id })).stale, true);
});
