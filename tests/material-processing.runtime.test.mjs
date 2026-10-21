import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/pdf-convert-harness.mjs';
import { StudyService } from '../lib/service.js';

test('activity recovers a persisted PDF checkpoint without querying the old snapshot first',async t=>{
  const h=await harness(t,{runtime:false,state:{failWindowsOnce:[1]}});
  const started=await h.start(2); await h.settled(started.jobId);
  await h.service.dispose();
  const reopened=new StudyService(h.root); t.after(()=>reopened.dispose());
  const result=await reopened.call('activity.query');
  assert.ok(result.items.some(row=>row.type==='job'&&row.id===started.jobId));
});

test('PDF conversion survives audio removal and generation failure leaves readable imported material', async t => {
  const h = await harness(t);
  await h.service.runtime.disposeContext('audio');
  assert.ok(h.service.runtime.hasAction('mineru.import'));
  const started = await h.start(2, { course: '课程' });
  const done = await h.settled(started.jobId);
  assert.equal(done.status, 'complete');
  const before = await h.service.store.read();
  assert.equal(before.sources.length, 2);
  await assert.rejects(h.call('generate', { sourceIds: done.sourceIds, count: 1 }), /model/i);
  assert.equal((await h.service.store.read()).sources.length, before.sources.length);
  assert.ok((await h.call('source.get', { id: done.sourceIds[0] })).text);
});

test('processing plan separates import and generation receipts and never starts jobs or creates placeholder materials', async t => {
  const h = await harness(t);
  const before = await h.service.store.read();
  const plan = await h.call('materials.processing.plan', { kind: 'pdf', generation: 'questions' });
  assert.equal(plan.steps[0].action.operation, 'mineru.import');
  assert.equal(plan.steps[1].status, 'awaiting-materials');
  assert.equal(plan.steps[1].requiresModel, true);
  assert.deepEqual(await h.service.store.read(), before);
  assert.equal((await h.jobs()).length, 0);
  await assert.rejects(h.call('materials.document.import', { dataBase64: Buffer.from('bad').toString('base64'), filename: 'bad.pdf', format: 'pdf' }));
  assert.deepEqual(await h.service.store.read(), before);
  await assert.rejects(h.call('materials.processing.plan', { kind: 'existing', sourceIds: ['missing'], generation: 'questions' }), { code: 'processing-source-unavailable' });
});

test('unarchiving an old PDF checkpoint restores its retry action before the history fallback', async t => {
  const h = await harness(t, { runtime: false, state: { failWindowsOnce: [1] } });
  const start = await h.start(2);
  const failed = await h.settled(start.jobId);
  assert.equal(failed.status, 'failed');
  await h.call('job.archive', { jobId: failed.id });
  await h.call('job.unarchive', { jobId: failed.id });
  const retried = await h.call('mineru.retry', { jobId: failed.id });
  assert.equal((await h.settled(retried.jobId)).status, 'complete');
});

test('every generation route in processing plans is a callable public action', async t => {
  const h = await harness(t);
  for (const generation of ['questions', 'outline', 'reading']) {
    const plan = await h.call('materials.processing.plan', { kind: 'pdf', generation, course: '课程' });
    for (const step of plan.steps) assert.ok(h.service.runtime.hasAction(step.action.operation), step.action.operation);
  }
});
