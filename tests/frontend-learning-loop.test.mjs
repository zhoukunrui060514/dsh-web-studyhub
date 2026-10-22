import test from 'node:test';
import assert from 'node:assert/strict';
import { learningScope, sessionScope, mergeSessionRead, createSessionWriter, createStepAdvancer, decisionDestination } from '../ui/learning/model.js';

test('global scope preserves all, unassigned and exact course identity', () => {
  assert.deepEqual(learningScope({ focus: { course: '*' } }), { kind: 'all' });
  assert.deepEqual(learningScope({ focus: { course: '' } }), { kind: 'unassigned' });
  assert.deepEqual(learningScope({ focus: { course: 'A', courseId: 'a' } }), { kind: 'course', courseId: 'a', includeDescendants: false });
  assert.throws(() => learningScope({ focus: { course: 'removed' } }), /course-unavailable/);
});
test('failed session write retains request identity for retry, changed input is a new request', async () => {
  const calls = []; let fail = true;
  const write = createSessionWriter(async (op, args) => { calls.push({ op, args }); if (fail) throw Error('offline'); return { version: 2 }; });
  const args = { id: 's', version: 1, step: 'retell', content: 'my words' };
  await assert.rejects(write('learning.session.record', args)); fail = false;
  await write('learning.session.record', args);
  assert.equal(calls[0].args.requestId, calls[1].args.requestId);
  await write('learning.session.record', { ...args, content: 'changed' });
  assert.notEqual(calls[1].args.requestId, calls[2].args.requestId);
});
test('decisions use original owner without guessing targets', () => {
  assert.equal(decisionDestination('learning.session.get'), 'session');
  assert.equal(decisionDestination('review.start'), 'review');
  assert.equal(decisionDestination('source.get'), 'source');
  assert.equal(decisionDestination('workflow.session.get'), 'legacy');
  assert.throws(() => decisionDestination('unknown'), /unsupported-learning-action/);
});
test('session start uses its narrower scope contract', () => {
  assert.deepEqual(sessionScope({ kind: 'course', courseId: 'a', includeDescendants: false }), { kind: 'course', courseId: 'a' });
});
test('advance retry does not repeat an already acknowledged save', async () => {
  let records = 0, advances = 0;
  const next = createStepAdvancer(async () => { records++; }, async () => { if (++advances === 1) throw Error('response lost'); });
  await assert.rejects(next('retell', 'typed words'));
  await next('retell', 'typed words');
  assert.equal(records, 1); assert.equal(advances, 2);
});
test('late session read never rolls back an acknowledged write', () => {
  const saved = { id: 's', version: 2, step: 'retell' };
  assert.equal(mergeSessionRead(saved, { id: 's', version: 1 }), saved);
  assert.equal(mergeSessionRead(saved, { id: 's', version: 3 }).version, 3);
});
