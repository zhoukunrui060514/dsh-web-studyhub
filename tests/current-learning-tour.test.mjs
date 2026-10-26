import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { TOUR_STEPS, availableTourSteps, tourStepCopy } from '../ui/tour/steps.js';

const step = id => TOUR_STEPS.find(item => item.id === id);

test('the tour sends new learners to the current reading/practice flow', () => {
  assert.equal(step('workflows').page, 'book');
  assert.match(step('workflows').body, /阅读.*练习.*结果/);
  assert.match(step('workflows').body, /直接做题/);
  assert.doesNotMatch(step('workflows').body, /复述|换课程|示例里有一次/);
});

test('the tour explains material top-up and the standalone sidebar inbox', async () => {
  assert.match(step('sources').body, /一键补齐未覆盖/);
  assert.match(step('nav').body, /信箱在侧栏/);
  assert.doesNotMatch(step('nav').body, /信箱也在顶栏/);
  const inbox = step('inbox');
  assert.equal(inbox?.page, 'inbox');
  assert.equal(inbox.anchor, 'nav-inbox');
  assert.match(inbox.body, /讲解.*独立阅读/);
  const steps = availableTourSteps(TOUR_STEPS, { full: true, pageAvailable: page => page !== 'workflows' });
  assert.ok(steps.includes(inbox));
  assert.ok(steps.includes(step('workflows')));
  const sidebar = await readFile(new URL('../ui/app/AppSidebar.jsx', import.meta.url), 'utf8');
  const curriculum = await readFile(new URL('../ui/learning/CurriculumPage.jsx', import.meta.url), 'utf8');
  assert.ok(sidebar.includes(`data-tour="${inbox.anchor}"`));
  assert.ok(curriculum.includes(`data-tour="${step('workflows').anchor}"`));
});

test('all active tour copy has an English translation', async () => {
  const locales = new URL('../ui/locales/', import.meta.url);
  const files = (await readdir(locales)).filter(name => /^en(\..+)?\.json$/.test(name));
  const en = Object.assign({}, ...await Promise.all(files.map(async name => JSON.parse(await readFile(new URL(name, locales), 'utf8')))));
  for (const item of TOUR_STEPS) for (const text of tourStepCopy(item)) {
    assert.ok(en[text], `${item.id}: ${text}`);
    assert.doesNotMatch(en[text], /[\u3400-\u9fff]/u);
  }
});
