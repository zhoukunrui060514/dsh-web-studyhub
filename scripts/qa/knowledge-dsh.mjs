import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ensureDsh, bootDsh, stopTree, dshPatch, parseDshArgs, DSH_PROFILE, FAKE_KEY_ENV } from './dsh-e2e.mjs';
import { scrubSecrets } from './env.mjs';
import { launchChromium } from './browser.mjs';
import { createFakeOpenAI } from './fake-openai.mjs';
import { KNOWLEDGE_TEXTS } from './knowledge-fixtures.mjs';
import { Store } from '../../lib/store.js';
import { KNOWLEDGE_COLLECTIONS } from '../../lib/contexts/knowledge/model.js';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const root = fileURLToPath(new URL('../../', import.meta.url));
function run(args, env, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 300000 });
  if (result.status !== 0) throw new Error(`${args[0]} failed: ${(result.stderr || result.stdout || '').slice(-3000)}`);
  return result.stdout.trim();
}
export async function runKnowledgeDshJourney(options) {
  const out = resolve(options.out), qa = resolve(root, 'output/qa');
  const suffix = options.materialsDir ? '-knowledge-materials' : options.realModel ? '-knowledge-real' : '-knowledge';
  const home = join(qa, `dsh-home${suffix}`), documents = join(qa, `dsh-documents${suffix}`);
  const workspace = join(documents, 'deepseek-harness/default-workspace'), pack = join(qa, 'dsh-pack-knowledge');
  const env = { ...scrubSecrets(process.env), DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', SSH_TTY: 'audit', [FAKE_KEY_ENV]: 'test-only' };
  const summary = { steps: [], artifacts: [], mode: options.realModel ? 'real-model' : 'deterministic-model', startedAt: new Date().toISOString() };
  const step = async (name, work) => { try { const value = await work(); summary.steps.push({ name, ok: true }); console.log(`ok ${name}`); return value; } catch (e) { summary.steps.push({ name, ok: false, error: e.message }); throw e; } };
  let dsh, model, browser, release, block = false, entered = false;
  try {
    await mkdir(out, { recursive: true });
    const bin = await ensureDsh(options, env);
    await mkdir(pack, { recursive: true });
    run([resolve(root, 'scripts/build.mjs')], env);
    const npmCli = process.env.npm_execpath || 'D:/DSH/node/node_modules/npm/bin/npm-cli.js';
    const tarName = run([npmCli, 'pack', '--ignore-scripts', '--pack-destination', pack], env).split(/\r?\n/).at(-1);
    // Only fixed, QA-owned paths are cleared. This never visits the real DSH home or learning library.
    if (!options.reuseHome) for (const path of [home, documents]) { assert.ok(path.startsWith(qa + '\\') || path.startsWith(qa + '/')); await rm(path, { recursive: true, force: true }); }
    await mkdir(home, { recursive: true }); await mkdir(workspace, { recursive: true });
    if (!options.reuseHome) {
      run([bin, '--profile', DSH_PROFILE, '--from-default-profile', 'web', '--dump-config'], env, workspace);
    }
    // Refresh only the QA plugin while retaining the private acceptance library.
    run([bin, 'plugin', '--profile', DSH_PROFILE, 'add', join(pack, tarName)], env, workspace);
    model = await createFakeOpenAI({ port: options.modelPort, beforeReply: async (_system, prompt) => { if (block && prompt.includes('knowledge-extract')) { entered = true; await new Promise(done => { release = done; }); } } });
    const patchData = dshPatch({ fakeModelUrl: model.url, documentsDirectory: documents });
    if (options.realModel) {
      if (!process.env.STUDYHUB_KNOWLEDGE_KEY) throw new Error('STUDYHUB_KNOWLEDGE_KEY is required for real model QA');
      env.STUDYHUB_KNOWLEDGE_KEY = process.env.STUDYHUB_KNOWLEDGE_KEY;
      const provider = Object.values(patchData[0].config.providers)[0];
      provider.baseURL = process.env.STUDYHUB_KNOWLEDGE_URL || 'http://127.0.0.1:8317/v1'; provider.apiKeyEnv = 'STUDYHUB_KNOWLEDGE_KEY';
      provider.models[0].id = 'gemini-3.8-flash-high'; patchData[1].config.model = 'gemini-3.8-flash-high';
    }
    const patch = join(out, 'qa.patch.yml'); await writeFile(patch, YAML.stringify(patchData));
    const boot = async () => { dsh = await bootDsh(bin, { env, cwd: workspace, patch, port: options.port }); };
    await step('boot-private-dsh', boot);
    browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const open = async () => {
      await page.goto(dsh.url, { waitUntil: 'networkidle' });
      await sleep(1500);
      const next = page.getByRole('button', { name: /^(继续|稍后配置|跳过|Continue|Configure later|Skip)$/ });
      for (let i = 0; i < 6 && await next.count(); i++) { const clicked = await next.first().elementHandle(); await clicked.click(); await page.waitForFunction(button => !button.isConnected, clicked); await clicked.dispose(); }
      if (!await page.locator('.study-app').isVisible().catch(() => false)) {
        const box = page.getByRole('textbox').last(); await box.fill('你好，我想使用学习资料。'); await box.press('Enter');
        await sleep(8000);
        const tab = page.getByRole('tab', { name: /学习|Study/ }); await tab.first().waitFor({ timeout: 60000 }); await tab.first().click();
      }
      await page.locator('.study-app').first().waitFor({ timeout: 60000 });
    };
    await step('open-study', open);
    const rpc = (method, payload) => page.evaluate(async ({ method, payload }) => { const response = await fetch(`/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload }) }); return (await response.json()).result; }, { method, payload });
    let sessionId = (await rpc('session/list', { args: { _request: {} } })).value.items[0].sessionId;
    const call = async (action, args = {}) => { const result = await rpc('study-workspace/call', { sessionId, action, args }); if (!result.ok) throw new Error(`${action}: ${result.error?.message}`); return result.value; };
    const wait = async (predicate, polls = 600) => { for (let i = 0; i < polls; i++) { const result = await predicate(); if (result) return result; await sleep(500); } throw new Error('Timed out waiting for persisted knowledge result'); };
    const snapshot = await call('snapshot'); const libraryRoot = snapshot.root; assert.ok(resolve(libraryRoot).startsWith(resolve(documents)));
    const store = new Store(libraryRoot); for (const { name, ...descriptor } of KNOWLEDGE_COLLECTIONS) store.registerCollection(name, descriptor);
    const refs = () => call('knowledge.materials').then(r => r.materials);
    const receipts = [];
    const waitJob = async jobId => wait(async () => { const s = await call('snapshot'), job = s.jobs.find(j => j.id === jobId || j.contract?.jobId === jobId); if (!job) return false; const status = job.contract?.status || job.status; if (['failed', 'cancelled', 'interrupted'].includes(status)) throw new Error(`Job ${status}: ${JSON.stringify(job.error || job.message || job).slice(0, 1500)}`); return status === 'complete' && job; }, options.materialsDir ? 3600 : 600);
    if (!options.materialsOnly && !options.reuseHome) {
    await step('import-two-courses-and-manual-native-build', async () => {
      for (const [i, text] of KNOWLEDGE_TEXTS.slice(0, 2).entries()) await call('source.add', { id: `kg-${i}`, title: `课程资料${i + 1}`, text, courses: [`课程${i + 1}`] });
      const result = await call('knowledge.build', { materials: await refs(), origin: 'manual' }); assert.equal(result.accepted, true); receipts.push(await waitJob(result.jobId));
      const graph = await call('knowledge.query'); assert.ok(graph.nodes.length >= 2); assert.ok(graph.edges.length >= 1);
      const materials = await call('knowledge.materials'); assert.equal(materials.courses.length >= 2, true);
      for (const course of materials.courses) assert.ok((await call('knowledge.query', { courseIds: [course.id] })).nodes.length);
      await page.locator('[data-tour="nav-knowledge"]').click(); await page.getByRole('button', { name: '构建／更新', exact: true }).waitFor();
      await page.screenshot({ path: join(out, '01-built.png'), fullPage: true }); summary.artifacts.push('01-built.png');
    });
    let threadId;
    await step('path-question-followup-and-exact-citations', async () => {
      const graph = await call('knowledge.query'), edge = graph.edges[0];
      const target = { kind: 'path', startNodeId: edge.to, edgeIds: [edge.id] };
      const first = await call('knowledge.ask', { target, question: '沿反方向查看这条关系，应如何理解条件与方向？' });
      assert.equal(first.status, 'complete'); threadId = first.threadId; assert.ok(first.messages.some(m => m.role === 'assistant' && m.citations.length));
      const follow = await call('knowledge.ask', { target, threadId, question: '请结合原文再说明一次，并区分推断。' }); assert.equal(follow.messages.filter(m => m.role === 'assistant').length, 2);
      for (const m of follow.messages) for (const e of m.citations || []) { const state = await store.read(), source = state.sources.find(s => s.id === e.sourceId); assert.equal(source.text.slice(e.start, e.end), e.quote); }
      summary.threadId = threadId;
    });
    await step('auto-new-import-completes-native-job', async () => {
      await call('knowledge.settings.set', { autoBuild: true });
      await call('source.add', { id: 'kg-auto', title: '自动新增资料', text: KNOWLEDGE_TEXTS[2], courses: ['课程3'] });
      const material = await wait(async () => (await refs()).find(m => m.identity === 'source:kg-auto' && m.processing.status === 'complete'));
      receipts.push(await waitJob(material.processing.jobId)); await call('knowledge.settings.set', { autoBuild: false });
    });
    if (!options.realModel) await step('cancel-blocked-extraction-does-not-publish', async () => {
      await call('source.add', { id: 'kg-cancel', title: '取消资料', text: KNOWLEDGE_TEXTS[0], courses: ['取消课程'] });
      block = true; const material = (await refs()).find(m => m.identity === 'source:kg-cancel'); const receipt = await call('knowledge.build', { materials: [material] });
      assert.equal(receipt.accepted, true); await wait(() => entered);
      await call('job.control', { jobId: receipt.jobId, action: 'cancel' }); release?.(); block = false;
      await sleep(500); assert.equal((await store.read()).knowledgeEvidence.some(e => e.materialIdentity === material.identity), false);
    });
    await step('archive-projection-and-history-availability', async () => {
      await call('source.archive', { id: 'kg-0', archived: true });
      const graph = await call('knowledge.query', { materialIds: ['source:kg-0'] }); assert.equal(graph.nodes.length, 0);
      const thread = await call('knowledge.thread.get', { threadId }); assert.ok(thread.messages.some(m => m.role === 'assistant'));
      await call('source.archive', { id: 'kg-0', archived: false });
    });
    if (!options.realModel) await step('changed-document-retains-old-answer-and-stale-projection', async () => {
      const imported = await call('materials.document.import', { filename: 'versioned.txt', format: 'txt', dataBase64: Buffer.from(KNOWLEDGE_TEXTS[0]).toString('base64'), courses: ['版本课程'] });
      summary.documentImport = imported.documentId;
      const material = (await refs()).find(m => m.identity === 'document:' + imported.documentId); assert.ok(material);
      const receipt = await call('knowledge.build', { materials: [material] }); await waitJob(receipt.jobId);
      const graph = await call('knowledge.query', { materialIds: [material.identity] }); const target = { kind: 'node', id: graph.nodes[0].id };
      const answer = await call('knowledge.ask', { target, filter: { materialIds: [material.identity] }, question: '请说明资料依据。' }); assert.equal(answer.status, 'complete');
      await call('materials.document.attach', { documentId: imported.documentId, filename: 'versioned.txt', format: 'txt', dataBase64: Buffer.from(KNOWLEDGE_TEXTS[0] + ' 更新后的新版本。').toString('base64') });
      const stale = await call('knowledge.query', { materialIds: [material.identity] }); assert.ok(stale.nodes.every(n => n.versionStatus === 'stale'));
      const history = await call('knowledge.thread.get', { threadId: answer.threadId }); assert.ok(history.messages.some(m => m.citations?.some(c => c.status === 'stale')));
    });
    await step('restart-preserves-graph-and-thread', async () => {
      await page.goto('about:blank'); stopTree(dsh.child); await sleep(700); await boot(); await open();
      sessionId = (await rpc('session/list', { args: { _request: {} } })).value.items.find(s => s.sessionId === sessionId)?.sessionId || sessionId;
      assert.ok((await call('knowledge.query')).nodes.length);
      assert.equal((await call('knowledge.thread.get', { threadId })).messages.filter(m => m.role === 'assistant').length, 2);
      await page.locator('[data-tour="nav-knowledge"]').click(); await page.screenshot({ path: join(out, '02-reloaded.png'), fullPage: true }); summary.artifacts.push('02-reloaded.png');
    });
    await step('final-state-and-real-executor-records', async () => {
      const state = await store.read(); for (const field of ['decks', 'drafts', 'attempts']) assert.equal(state[field].length, 0);
      assert.ok(state.knowledgeNodes.length); assert.equal(state.knowledgeConfig.autoBuild, false);
      summary.finalState = Object.fromEntries(['decks', 'drafts', 'attempts', 'knowledgeNodes', 'knowledgeEdges', 'knowledgeThreads'].map(k => [k, state[k].length]));
      summary.receipts = receipts.map(job => ({ id: job.contract?.jobId || job.id, status: job.contract?.status || job.status, runtime: job.contract?.runtime, attempts: job.contract?.attempts, usage: job.contract?.usage }));
      for (const r of summary.receipts) { assert.ok(r.runtime?.attempts?.some(a => a.executor?.ownerAgentId && a.executor.service === 'dsh-jobs')); assert.equal(r.status, 'complete'); } assert.deepEqual(errors, []);
    });
    }
    if (options.materialsDir) await step('user-pdf-library-real-extraction-and-citations', async () => {
      assert.equal(options.realModel, true, 'user material acceptance uses the requested real model');
      const directory = resolve(options.materialsDir), files = (await readdir(directory)).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
      assert.ok(files.length, 'PDF materials exist'); summary.userMaterials = [];
      for (const filename of files) {
        const bytes = await readFile(join(directory, filename)), hash = createHash('sha256').update(bytes).digest('hex');
        try {
        const imported = await call('materials.document.import', { filename, format: 'pdf', dataBase64: bytes.toString('base64'), courses: ['麻醉生理学精炼复习'] });
        const material = (await refs()).find(m => m.documentId === imported.documentId);
        assert.ok(material?.sourceIds.length, `readable PDF: ${filename}`);
        const accepted = await call('knowledge.build', { materials: [{ identity: material.identity, revision: material.revision }], origin: 'manual' });
        assert.ok(accepted.accepted || accepted.status === 'complete');
        if (accepted.jobId) receipts.push(await waitJob(accepted.jobId));
        const state = await store.read(), processing = state.knowledgeMaterials.find(m => m.identity === material.identity);
        assert.equal(processing.status, 'complete', filename);
        const evidence = state.knowledgeEvidence.filter(e => e.materialIdentity === material.identity && !e.superseded);
        assert.ok(evidence.length, `source-backed graph: ${filename}`);
        for (const e of evidence) assert.equal(state.sources.find(s => s.id === e.sourceId).text.slice(e.start, e.end), e.quote);
        assert.equal(createHash('sha256').update(await readFile(join(directory, filename))).digest('hex'), hash, 'original remains unchanged');
        summary.userMaterials.push({ filename, sha256: hash, documentId: imported.documentId, pages: material.sourceIds.length, evidenceCount: evidence.length, status: processing.status, jobId: accepted.jobId });
        } catch (error) {
          summary.userMaterials.push({ filename, sha256: hash, status: 'failed', error: error.message });
        }
        assert.equal(createHash('sha256').update(await readFile(join(directory, filename))).digest('hex'), hash, 'original remains unchanged');
        await writeFile(join(out, 'materials-progress.json'), JSON.stringify(summary.userMaterials, null, 2)); console.log(`${summary.userMaterials.at(-1).status} user PDF ${summary.userMaterials.length}/${files.length}: ${filename}`);
      }
      assert.deepEqual(summary.userMaterials.filter(m => m.status !== 'complete'), [], 'every user PDF must finish with verified citations');
      const graph = await call('knowledge.query'), edge = graph.edges.find(e => e.versionStatus === 'current');
      assert.ok(edge);
      const answer = await call('knowledge.ask', { target: { kind: 'edge', id: edge.id }, question: '请解释这条关系成立的条件和依据，区分资料陈述与推断，并引用原文。' });
      assert.equal(answer.status, 'complete'); assert.ok(answer.messages.at(-1).citations.length);
      const citedState = await store.read();
      for (const e of answer.messages.at(-1).citations) assert.equal(citedState.sources.find(s => s.id === e.sourceId)?.text.slice(e.start, e.end), e.quote);
      summary.userAnswer = answer; summary.userGraph = { totals: graph.totals, displayed: graph.displayed };
      await page.locator('[data-tour="nav-knowledge"]').click();
      await page.getByRole('button', { name: '刷新', exact: true }).click(); await sleep(600);
      await page.screenshot({ path: join(out, '03-user-materials.png'), fullPage: true }); summary.artifacts.push('03-user-materials.png');
      const state = await store.read(); for (const field of ['decks', 'drafts', 'attempts']) assert.equal(state[field].length, 0);
      summary.userFinalState = Object.fromEntries(['decks', 'drafts', 'attempts', 'knowledgeNodes', 'knowledgeEdges', 'knowledgeThreads'].map(k => [k, state[k].length]));
    });
  } catch (error) { summary.error = error.message; }
  finally { release?.(); await browser?.close(); stopTree(dsh?.child); await model?.close(); if (dsh) await writeFile(join(out, 'dsh.log'), dsh.output().replace(/token=\S+/g, 'token=REDACTED')); summary.ok = !summary.error && summary.steps.every(s => s.ok); summary.finishedAt = new Date().toISOString(); await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2)); }
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const realModel = process.argv.includes('--real-model');
  const materialsOnly = process.argv.includes('--materials-only');
  const args = process.argv.slice(2).filter(a => !['--real-model', '--materials-only'].includes(a));
  const materialArg = args.indexOf('--materials-dir'), materialsDir = materialArg >= 0 ? args.splice(materialArg, 2)[1] : undefined;
  const options = parseDshArgs(args);
  if (!process.argv.includes('--out')) options.out = resolve('output/qa/knowledge-dsh');
  const summary = await runKnowledgeDshJourney({ ...options, realModel, materialsDir, materialsOnly }); console.log(JSON.stringify(summary, null, 2)); process.exitCode = summary.ok ? 0 : 1;
}
