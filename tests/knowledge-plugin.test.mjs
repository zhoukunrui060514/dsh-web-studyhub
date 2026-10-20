import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import * as knowledge from '../lib/plugins/knowledge.js';
import * as materials from '../lib/plugins/materials.js';
import { createStudyRuntime } from '../lib/runtime/builtins.js';
import { reads, fields } from '../lib/runtime/domain-contracts.js';
import { knowledgeSchemas } from '../lib/contexts/knowledge/contracts.js';
import { Store } from '../lib/store.js';

test('disposing waits for the initial reconciliation transaction to settle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-dispose-')), store = new Store(root);
  let entered, release; const started = new Promise(done => { entered = done; }), gate = new Promise(done => { release = done; });
  const update = store.update.bind(store);
  store.update = async (...args) => { entered(); await gate; return update(...args); };
  const runtime = createStudyRuntime(root, { contexts: ['system', 'materials', 'courses', 'knowledge'], storage: store });
  await started; let disposed = false; const done = Promise.resolve(runtime.dispose()).then(() => { disposed = true; });
  await new Promise(resolve => setTimeout(resolve, 30));
  try { assert.equal(disposed, false); } finally { release(); await done; await rm(root, { recursive: true, force: true }); }
});

test('knowledge installs and unloads independently, with public schemas and no bank dependency', async t => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-plugin-')), ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }); });
  await ctx.plugin(materials); const plugin = ctx.plugin(knowledge); await plugin;
  const runtime = ctx.studyRuntime.runtimeForLibrary(root);
  assert.ok(runtime.describe().find(d => d.api === 'knowledge.v1').operations.some(o => o.name === 'knowledge.ask' && o.input.properties.target));
  assert.equal(reads.knowledge.includes('bank'), false); assert.equal(fields.knowledge.includes('decks'), false);
  assert.equal(Object.hasOwn(knowledgeSchemas, 'knowledge.reconcile'), false);
  await plugin.dispose(); assert.equal(runtime.hasAction('knowledge.query'), false);
  assert.equal((await runtime.call('source.add', { title: 'remains', text: 'works' })).title, 'remains');
});
test('library snapshot carries only graph summary and content revision, never graph records or threads', async t => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-summary-')), runtime = createStudyRuntime(root);
  t.after(async () => { await runtime.dispose(); await rm(root, { recursive: true, force: true }); });
  const snapshot = await runtime.call('snapshot', {});
  assert.equal(snapshot.knowledge.autoBuild, false); assert.equal(snapshot.knowledge.nodeCount, 0);
  assert.equal(Object.hasOwn(snapshot.knowledge, 'nodes'), false); assert.equal(Object.hasOwn(snapshot.knowledge, 'threads'), false);
  assert.ok(snapshot.knowledge.graphRevision); assert.ok(JSON.stringify(snapshot.knowledge).length < 500);
  assert.equal(Object.hasOwn(await runtime.call('snapshot', { compact: true }), 'knowledge'), false);
});
