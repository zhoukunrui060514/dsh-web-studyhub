import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PAGES } from '../ui/pages.js';
import { SPACES, entryOf, spaceById } from '../ui/spaces.js';
import { pageAvailable } from '../ui/capabilities.js';
import { SETTINGS_CATEGORIES, settingsGroupState } from '../ui/settings-groups.js';
import { openInboxResult } from '../ui/app/inbox-open.js';
import { loadUi } from './helpers/ui-module.mjs';
import { readFile } from 'node:fs/promises';
const { controlItems, defaultsPatch, headerActions } = await loadUi(`export { controlItems, defaultsPatch, headerActions } from './ui/tasks/task-control.js';`);

test('historical audio jobs offer no resume, retry or configuration writes', () => {
  for (const status of ['failed', 'paused', 'running', 'complete']) {
    const job = { id: 'historical', type: 'audio-import', status };
    const actions = headerActions(job);
    assert.equal(actions.retry, false);
    assert.equal(actions.resume, false);
    assert.deepEqual(controlItems(job), []);
    assert.equal(defaultsPatch(job), null);
  }
});

test('historical transcript and file viewers keep results without audio restart actions', async () => {
  const reader = await readFile(new URL('../ui/document-preview/DocumentViewer.jsx', import.meta.url), 'utf8');
  const files = await readFile(new URL('../ui/tasks/AudioFiles.jsx', import.meta.url), 'utf8');
  assert.match(reader, /<AudioCorrections audio=\{source.audio\} \/>/);
  assert.doesNotMatch(reader, /audio.corrections.review/);
  assert.doesNotMatch(files, /audio.retry/);
});

test('retired recording pages cannot be restored by saved navigation or host capabilities', () => {
  for (const id of ['audio', 'live']) {
    assert.equal(PAGES[id], undefined);
    assert.equal(pageAvailable({ contexts: ['audio', 'recording'] }, id), false);
    assert.ok(SPACES.every(space => !space.views.includes(id) && !space.members.includes(id)));
    assert.equal(entryOf(spaceById('materials'), { last: id }), 'sources');
  }
});

test('historical recordings do not request retired audio settings', () => {
  assert.ok(!SETTINGS_CATEGORIES.some(category => category.id === 'audio'));
  const state = settingsGroupState({ data: { sources: [{ id: 'old', audio: {} }] }, status: { audio: { configured: false } } });
  assert.ok(!state.once.missing.includes('audio'));
  assert.ok(SETTINGS_CATEGORIES.some(category => category.id === 'mineru'));
});

test('historical audio notifications still lead to available material or task views', () => {
  for (const sourceIds of [[], ['saved-transcript']]) {
    const pages = [], opened = [];
    openInboxResult({ item: { kind: 'audio-result' }, result: { sourceIds } }, {
      remember() {}, showPage: id => pages.push(id), openAudioSources: ids => opened.push(ids), enterRun() {},
    });
    assert.deepEqual(pages, [sourceIds.length ? 'sources' : 'tasks']);
    assert.deepEqual(opened, sourceIds.length ? [sourceIds] : []);
  }
});

test('the shipped app no longer loads recording, transcription or their settings pages', async () => {
  const result = await build({ entryPoints: ['ui/App.jsx'], bundle: true, write: false,
    metafile: true, platform: 'browser', loader: { '.css': 'text' }, logLevel: 'silent' });
  const inputs = Object.keys(result.metafile.inputs);
  for (const path of ['ui/LiveClass.jsx', 'ui/AudioImport.jsx', 'ui/AudioDashboard.jsx', 'ui/settings/AudioPane.jsx', 'ui/AudioSettings.jsx']) {
    assert.ok(!inputs.includes(path), `${path} is still reachable`);
  }
  assert.ok(inputs.includes('ui/PdfConversion.jsx'));
});
