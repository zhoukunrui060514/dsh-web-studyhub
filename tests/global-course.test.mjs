import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { setFocus } from '../lib/focus.js';
import { emptyState } from '../lib/store.js';

test('partial focus updates preserve all, unassigned and recover stale courses', () => {
  const state = emptyState();
  state.sources.push({ id: 'a', title: 'A', text: 'A', courses: ['Course A'] },
    { id: 'u', title: 'Unassigned', text: 'U', courses: [] });
  for (const course of ['*', '']) {
    setFocus(state, { course });
    for (const change of [{ mode: 'interview' }, { role: 'Doctor' }, { jd: 'Clinical practice' }, { targetTopics: ['Respiration'] }]) {
      setFocus(state, change);
      assert.equal(state.focus.course, course);
    }
  }
  setFocus(state, { course: null });
  assert.equal(setFocus(state, { role: 'New role' }).course, 'Course A');
  state.focus.course = 'Deleted course';
  assert.equal(setFocus(state, { role: 'Recover' }).course, 'Course A');
  assert.equal(setFocus(emptyState(), {}).course, null);
});

test('explicit all-courses focus persists, while null retains the legacy automatic default', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-global-course-'));
  const service = new StudyService(root);
  let restored;
  t.after(async () => { await service.dispose(); await restored?.dispose(); await rm(root, { recursive: true, force: true }); });
  await service.call('source.add', { title: 'Course A', text: 'A material.', course: 'Course A' });
  await service.call('source.add', { title: 'Course B', text: 'B material.', course: 'Course B' });
  await service.call('focus.set', { course: 'Course B' });
  assert.equal((await service.call('snapshot')).focus.course, 'Course B');
  await service.call('focus.set', { course: '*' });
  assert.equal((await service.call('snapshot')).focus.course, null, 'all courses is the aggregate scope');
  for (const change of [{ mode: 'interview' }, { role: 'Doctor' }, { jd: 'Clinical practice' }, { targetTopics: ['Respiration'] }]) {
    await service.call('focus.set', change);
    assert.equal((await service.store.read()).focus.course, '*');
    assert.equal((await service.call('snapshot')).focus.course, null);
  }
  restored = new StudyService(root);
  assert.equal((await restored.call('snapshot')).focus.course, null, 'all survives a fresh service');
  await restored.call('focus.set', { course: null });
  assert.ok((await restored.call('snapshot')).focus.course, 'legacy null still chooses an available course');
  await restored.call('focus.set', { course: 'Course A' });
  assert.equal((await restored.call('snapshot')).focus.course, 'Course A');
  await assert.rejects(restored.call('focus.set', { course: 'No such course' }), /已有课程/);
});
