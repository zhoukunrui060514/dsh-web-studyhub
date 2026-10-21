import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyService } from '../lib/service.js';
import { resolveLegacyLearningScope } from '../lib/course-scope.js';

test('course normalization and existing read actions stay read-only and library-local', async t => {
  const roots = await Promise.all([1, 2].map(() => mkdtemp(join(tmpdir(), 'study-b0-'))));
  const services = roots.map(root => new StudyService(root));
  let reopened;
  t.after(async () => {
    await Promise.all([...services, reopened].filter(Boolean).map(service => service.dispose()));
    await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })));
  });
  for (const [index, service] of services.entries()) {
    await service.call('source.add', { title: `Private ${index}`, text: `Library ${index} only`, course: 'Shared name' });
    await service.call('focus.set', { course: '*' });
  }
  for (const [index, service] of services.entries()) {
    const before = await service.store.read();
    const snapshot = await service.call('snapshot');
    const courses = await service.call('course.list');
    assert.equal(snapshot.focus.course, null);
    assert.equal(courses.courses.length, 1);
    assert.equal(resolveLegacyLearningScope(before, null).kind, 'all');
    assert.deepEqual(before.sources.map(source => source.title), [`Private ${index}`]);
    const after = await service.store.read();
    assert.equal(after.revision, before.revision);
    assert.deepEqual(after.sources, before.sources);
  }
  reopened = new StudyService(roots[0]);
  assert.equal((await reopened.store.read()).focus.course, '*');
  assert.equal((await reopened.call('snapshot')).focus.course, null);
});

test('minimal course installation exposes existing reads without generation or model', async t => {
  const root = await mkdtemp(join(tmpdir(), 'study-b0-minimal-'));
  const service = new StudyService(root, { contexts: ['system', 'materials', 'bank', 'courses'] });
  t.after(async () => { await service.dispose(); await rm(root, { recursive: true, force: true }); });
  assert.deepEqual((await service.call('course.list')).courses, []);
  const domains = service.runtime.describe();
  assert.ok(domains.some(domain => domain.api === 'courses.v1'));
  assert.ok(!domains.some(domain => domain.api === 'generation.v1'));
  const capabilities = service.runtime.capabilities();
  assert.equal(capabilities.find(domain => domain.api === 'courses.v1').operations.find(op => op.name === 'course.list').available, true);
  assert.ok(!capabilities.some(domain => domain.api === 'generation.v1'));
  assert.equal(service.runtime.hasAction('course.list'), true);
  assert.equal(service.runtime.hasAction('generation.courseOutline.build'), false);
});
