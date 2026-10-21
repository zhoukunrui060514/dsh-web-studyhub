import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';

test('the due suggestion executes the existing deck review contract and queues only due cards',async t=>{
  const root=await mkdtemp(join(tmpdir(),'today-due-'));const service=new StudyService(root);
  t.after(async()=>{await service.dispose();await rm(root,{recursive:true,force:true});});
  await service.store.update(s=>{
    for(const id of ['one','two']){
      s.decks.push({id,title:id,course:'课程',cards:[{id:`${id}-due`,kind:'quiz',topic:'主题',review:{repetitions:2,due_at:'2020-01-01T00:00:00Z'},options:[{id:'A',text:'甲',correct:true}]},{id:`${id}-future`,kind:'quiz',topic:'主题',review:{repetitions:2,due_at:'2099-01-01T00:00:00Z'},options:[{id:'A',text:'甲',correct:true}]}]});
      s.attempts.push({id:`attempt-${id}`,deckId:id,quiz_id:`${id}-due`,grade:4,timestamp:'2020-01-01T00:00:00Z'});
    }
  });
  const today=await service.call('learning.today.get');
  const due=[today.primary,...today.secondary].find(row=>row.kind==='due-review');assert.ok(due);
  const run=await service.call(due.action.operation,due.action.args);
  const entries=(await service.store.read()).runs.find(item=>item.id===run.id).entries;
  assert.ok(entries.length);assert.equal(entries.length,due.target.count);
  assert.ok(entries.every(entry=>entry.card.id.endsWith('-due')));
  assert.ok(entries.every(entry=>(entry.deckId??run.deckId)===due.target.deckId));
});

test('today API, snapshot and coach share one pure decision and every suggested operation exists', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-22T12:00:00+08:00') });
  const root = await mkdtemp(join(tmpdir(), 'today-'));
  const service = new StudyService(root);
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  await service.store.update(s => {
    s.decks.push({ id: 'd', title: '题组', course: '课程', cards: [{ id: 'q', kind: 'quiz', topic: '主题', prompt: '选甲', options: [{ id: 'A', text: '甲', correct: true }] }] });
  });
  const before = await service.store.read();
  const today = await service.call('learning.today.get');
  assert.deepEqual(await service.call('coach.today'), today);
  assert.deepEqual((await service.call('snapshot', { compact: true })).learningToday, today);
  assert.deepEqual(await service.store.read(), before);
  for (const action of [today.primary, ...today.secondary]) assert.ok(service.runtime.hasAction(action.action.operation), action.action.operation);
  const run = await service.call(today.primary.action.operation, today.primary.action.args);
  assert.equal((await service.call('learning.today.get')).primary.target.runId, run.id);
  await service.call('review.answer', { runId: run.id, cardId: 'q', selected: ['A'] });
  assert.notEqual((await service.call('learning.today.get')).primary.target.runId, run.id);
});

test('private daily plan retains host budget and attaches the same learning decision', async t => {
  const home = await mkdtemp(join(tmpdir(), 'today-plan-'));
  const previous = process.env.DSH_HOME; process.env.DSH_HOME = home;
  const service = new StudyService(join(home, 'library'));
  t.after(async () => { await service.dispose(); if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous; await rm(home, { recursive: true, force: true }); });
  const plan = await service.call('daily.plan.get', { date: '2026-10-22' });
  assert.deepEqual(plan.learningToday, await service.call('learning.today.get'));
  assert.equal(typeof plan.budgetMinutes, 'number');
  assert.equal(typeof plan.spentMinutes, 'number');
});
