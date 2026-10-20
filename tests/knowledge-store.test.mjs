import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../lib/store.js';
import { createBuiltinEnvironment } from '../lib/runtime/builtins.js';
import { StudyRuntime } from '../lib/runtime.js';
import { KNOWLEDGE_FIELDS, KNOWLEDGE_COLLECTIONS, knowledgeDefaults } from '../lib/contexts/knowledge/model.js';

test('knowledge contributions survive absent plugin writes and backup restore, including future fields', async t => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  for (const { name, ...descriptor } of KNOWLEDGE_COLLECTIONS) store.registerCollection(name, descriptor);
  await store.update(s => Object.assign(s, knowledgeDefaults(), {
    knowledgeNodes: [{ id: 'n', future: { nested: [1, 2] } }],
    knowledgeEvidence: [{ id: 'e', targetId: 'n', future: { unknown: true } }],
  }));
  const before = await store.read();
  const absent = new Store(root);
  await absent.scoped(['settings']).update(s => { s.settings.locale = 'en'; });
  const backup = await absent.read();
  await absent.restore(backup);
  const restored = await new Store(root).read();
  for (const field of KNOWLEDGE_FIELDS) assert.deepEqual(restored[field], before[field]);
  assert.equal(restored.version, before.version);
  assert.equal(KNOWLEDGE_FIELDS.includes('decks'), false);
  assert.equal(KNOWLEDGE_COLLECTIONS.find(x => x.name === 'knowledgeConfig').mode, 'whole');
});

test('registered knowledge defaults and settings are isolated from question bank writes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-runtime-'));
  const runtime = new StudyRuntime(root);
  t.after(async () => { runtime.dispose(); await rm(root, { recursive: true, force: true }); });
  const env = createBuiltinEnvironment(root, runtime);
  for (const id of ['system', 'materials', 'courses', 'knowledge']) env.install(id);
  assert.deepEqual(await runtime.call('knowledge.settings.get'), { schemaVersion: 1, autoBuild: false, lastEnabledAt: null });
  const config = await runtime.call('knowledge.settings.set', { autoBuild: true, decks: [{ id: 'bad' }] });
  assert.equal(config.autoBuild, true);
  assert.ok(config.lastEnabledAt);
  assert.deepEqual((await runtime.storage.read()).decks, []);
  assert.deepEqual(knowledgeDefaults().knowledgeConfig, { schemaVersion: 1, autoBuild: false, lastEnabledAt: null });
});
