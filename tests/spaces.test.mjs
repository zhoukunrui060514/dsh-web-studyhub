import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SPACES, SPACE_IDS, spaceOf, spaceById, headerViewOf, viewsOf, entryOf } from '../ui/spaces.js';
import { PAGES } from '../ui/pages.js';
import { pageAvailable } from '../ui/capabilities.js';

test('five spaces own every learner page exactly once; shell utilities remain outside', () => {
  assert.deepEqual(SPACE_IDS, ['today', 'materials', 'knowledge', 'practice', 'records']);
  const owned = SPACES.flatMap(s => [...s.views, ...s.members]);
  assert.equal(new Set(owned).size, owned.length);
  for (const id of Object.keys(PAGES)) {
    if (['settings', 'tasks'].includes(id)) continue;
    assert.ok(spaceOf(id), id);
  }
  assert.equal(spaceOf('settings'), undefined);
  assert.equal(spaceOf('tasks'), undefined);
  assert.equal(headerViewOf('outline'), 'book');
  assert.equal(headerViewOf('draft'), 'bank');
  assert.equal(headerViewOf('review'), undefined);
});

test('a space remembers a reachable view and falls back safely when capabilities or flags change', () => {
  const space = spaceById('knowledge');
  const available = id => pageAvailable({ contexts: ['knowledge'], features: {} }, id);
  assert.ok(!viewsOf(space, available).includes('knowledge'));
  assert.equal(entryOf(space, { last: 'knowledge', available }), viewsOf(space, available)[0]);
  assert.equal(entryOf(space, { last: 'exam' }), 'book');
  assert.equal(entryOf(space, { last: 'skeleton' }), 'skeleton');
  assert.equal(entryOf(space, { available: () => false }), undefined);
});

test('remaining page-level course scopes follow the shell instead of keeping an independent pin', async () => {
  for (const name of ['Skeleton.jsx', 'exam-prep/ExamPrep.jsx', 'CaseWorkspace.jsx']) {
    const source = await readFile(new URL(`../ui/${name}`, import.meta.url), 'utf8');
    assert.match(source, /useCourseScope\(/, name);
    assert.doesNotMatch(source, /usePageScope\([^\n]*['"](?:skeleton|examprep|exam)['"]/, name);
  }
});
