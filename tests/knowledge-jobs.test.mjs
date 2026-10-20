import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { createStudyRuntime } from '../lib/runtime/builtins.js';
import { createJobLifecycle } from '../lib/jobs/lifecycle.js';
import { createRuntimeWork } from '../lib/runtime/work.js';
import { managedRuntimeOptions } from './helpers/runtime-switch.mjs';
import { KNOWLEDGE_COLLECTIONS, knowledgeDefaults } from '../lib/contexts/knowledge/model.js';
import { Store } from '../lib/store.js';
import { inputsFromState } from '../lib/contexts/knowledge/materials.js';
import { knowledgeExtractDefinition } from '../lib/contexts/knowledge/jobs/extract.js';
import { submitKnowledgeBuild } from '../lib/contexts/knowledge/jobs/submit.js';

async function harness(t, complete) {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-jobs-')), scope = new Context(), store = new Store(root);
  for (const { name, ...d } of KNOWLEDGE_COLLECTIONS) store.registerCollection(name, d);
  await store.update(s => Object.assign(s, knowledgeDefaults(), { sources: [{ id: 'good', text: '甲乙', title: 'G' }, { id: 'bad', text: '丙丁', title: 'B' }] }));
  const managed = managedRuntimeOptions({ complete }), work = createRuntimeWork(), lifecycle = createJobLifecycle(root, work);
  lifecycle.register(scope, 'knowledge.v1', knowledgeExtractDefinition);
  const jobs = lifecycle.scoped({ domain: 'knowledge.v1', owner: managed.workOwner, executor: managed.jobExecutor, modelHost: managed.jobModelHost });
  const ports = { state: { read: () => store.read(), update: f => store.update(f) }, complete, libraryId: root, jobs, readMaterials: async () => inputsFromState(await store.read()) };
  t.after(async () => { await lifecycle.dispose(); await scope.fiber.dispose(); await rm(root, { recursive: true, force: true }); });
  return { ports, jobs, store, starts: managed.starts };
}
const response = source => JSON.stringify({ nodes: [{ id: 'a', label: '概念', definition: '定义', evidence: [{ sourceId: source.sourceId, quote: source.text, start: source.start, end: source.end, assertion: 'asserted' }] }], edges: [] });

test('unified extraction meters calls, publishes partial batches and retry skips completed material', async t => {
  let fail = true, active = 0, max = 0, goodCalls = 0;
  const h = await harness(t, async (_system, prompt) => {
    active++; max = Math.max(max, active);
    try { const s = JSON.parse(prompt).segments[0]; if (s.sourceId === 'bad' && fail) throw new Error('controlled bad material'); if (s.sourceId === 'good') goodCalls++; return response(s); }
    finally { active--; }
  });
  const receipt = await submitKnowledgeBuild(h.ports, { materials: await h.ports.readMaterials(), origin: 'manual' });
  assert.equal(receipt.accepted, true); assert.ok(receipt.jobId);
  const ended = await h.jobs.wait(receipt.jobId);
  assert.equal(ended.result.completeness, 'partial'); assert.equal(max, 1);
  assert.equal((await h.store.read()).knowledgeMaterials.find(m => m.identity === 'source:good').status, 'complete');
  assert.equal(ended.usage.calls, 2);
  fail = false; await h.jobs.control(receipt.jobId, 'retry');
  const retried = await h.jobs.wait(receipt.jobId);
  assert.equal(retried.result.completeness, 'complete'); assert.equal(goodCalls, 1);
  assert.deepEqual((await h.store.read()).decks, []);
});

test('cancel after dispatch never publishes model output and refusal leaves no running job', async t => {
  let entered; const entry = new Promise(r => { entered = r; }); let release;
  const h = await harness(t, async (_sys, prompt) => { entered(); await new Promise(r => { release = r; }); return response(JSON.parse(prompt).segments[0]); });
  const receipt = await submitKnowledgeBuild(h.ports, { materials: [(await h.ports.readMaterials())[0]], origin: 'manual' });
  await entry; await h.jobs.control(receipt.jobId, 'cancel'); release(); await h.jobs.wait(receipt.jobId);
  assert.equal((await h.store.read()).knowledgeEvidence.length, 0);
  const waiting = await submitKnowledgeBuild({ ...h.ports, jobs: null }, { materials: [(await h.ports.readMaterials())[1]], origin: 'manual' });
  assert.equal(waiting.accepted, false); assert.equal(waiting.status, 'waiting-executor'); assert.equal(waiting.jobId, undefined);
});

test('registered production build routes to the unified runtime and never needs a bank', async t => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-builtins-'));
  const complete = async (_s, p) => response(JSON.parse(p).segments[0]);
  const managed = managedRuntimeOptions({ complete });
  const runtime = createStudyRuntime(root, { contexts: ['system', 'materials', 'courses', 'knowledge'], complete, ...managed });
  t.after(async () => { await runtime.dispose(); await rm(root, { recursive: true, force: true }); });
  await runtime.call('source.add', { title: '资料', text: '原文' });
  const list = await runtime.call('knowledge.materials');
  const receipt = await runtime.call('knowledge.build', { materials: list.materials, origin: 'manual' });
  assert.equal(receipt.accepted, true); assert.equal(managed.starts(), 1);
});

for (const sameMaterial of [false, true]) test(`retry cannot steal another active attempt's claim (same material: ${sameMaterial})`, async t => {
  let fail = true, entered, release; const started = new Promise(r => { entered = r; }), gate = new Promise(r => { release = r; });
  let active = 0, max = 0;
  const h = await harness(t, async (_s, prompt) => {
    if (fail) throw new Error('first fails');
    active++; max = Math.max(max, active); entered();
    try { await gate; return response(JSON.parse(prompt).segments[0]); } finally { active--; }
  });
  const refs = await h.ports.readMaterials(), a = await submitKnowledgeBuild(h.ports, { materials: [refs[0]] });
  await h.jobs.wait(a.jobId); fail = false;
  const b = await submitKnowledgeBuild(h.ports, { materials: [refs[sameMaterial ? 0 : 1]] });
  await started;
  const claim = (await h.store.read()).knowledgeMaterials.find(m => m.jobId === b.jobId).claimId;
  await h.jobs.control(a.jobId, 'retry');
  await new Promise(r => setTimeout(r, 60));
  try {
    assert.equal(max, 1);
    assert.equal((await h.store.read()).knowledgeMaterials.find(m => m.jobId === b.jobId).claimId, claim);
  } finally { release(); await h.jobs.wait(a.jobId); await h.jobs.wait(b.jobId); }
});

test('invalid model citations get one metered correction, with no ambiguous evidence published', async t => {
  let calls = 0;
  const complete = async (_s, prompt) => {
    const request = JSON.parse(prompt); calls++;
    if (calls === 1) return JSON.stringify({ nodes: [{ id: 'a', label: '甲', definition: '甲', evidence: [{ sourceId: 'good', quote: '甲', assertion: 'asserted' }] }], edges: [] });
    assert.equal(request.type, 'knowledge-extract');
    assert.equal(request.correction.code, 'invalid-evidence');
    assert.ok(request.correction.message.includes('甲'));
    return response(request.segments[0]);
  };
  const root = await mkdtemp(join(tmpdir(), 'knowledge-correction-'));
  const managed = managedRuntimeOptions({ complete });
  const runtime = createStudyRuntime(root, { contexts: ['system', 'materials', 'courses', 'knowledge'], complete, ...managed });
  t.after(async () => { await runtime.dispose(); await rm(root, { recursive: true, force: true, maxRetries: 5 }); });
  await runtime.call('source.add', { id: 'good', title: '重复引文', text: '甲乙甲' });
  const materials = (await runtime.call('knowledge.materials')).materials.filter(m => m.identity === 'source:good');
  await runtime.call('knowledge.build', { materials });
  for (let i = 0; i < 100 && ['queued', 'extracting'].includes((await runtime.storage.read()).knowledgeMaterials[0]?.status); i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(calls, 2);
  const state = await runtime.storage.read();
  assert.equal(state.knowledgeEvidence[0].quote, '甲乙甲');
  assert.equal(state.knowledgeMaterials[0].status, 'complete');
});
