/* Native DSH acceptance of the reading/practice/image APIs. Every host, library and
   synthetic model stays in a new output/qa directory. No owner DSH installation. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import YAML from 'yaml';
import { StudyService } from '../../lib/service.js';
import { aiBlocks } from '../../lib/course-book-ai-text.js';
import { imageLibrary } from '../../tests/helpers/image-library.mjs';
import { PNG } from '../../tests/helpers/book-image.mjs';
import { scrubSecrets } from './env.mjs';
import { createFakeOpenAI } from './fake-openai.mjs';
import { DSH_PROFILE, FAKE_KEY_ENV, dshPatch, bootDsh, stopTree } from './dsh-e2e.mjs';
import { launchChromium } from './browser.mjs';
import { openPage } from './open-page.mjs';

const repo = resolve('.');
const artifactOnly = process.argv.includes('--artifact-only');
const out = join(repo, 'output/qa', `dsh-reading-images-${Date.now()}`);
const home = join(out, 'home'), workspace = join(out, 'documents/deepseek-harness/default-workspace'), root = join(workspace, '.dsh-study');
const bin = resolve(process.env.DSH_QA_BIN || '../studyhub-dev/output/qa/dsh-cli/node_modules/@deepseek-ai/dsh/lib/bin.js');
const env = { ...scrubSecrets(process.env), PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', SSH_TTY: 'audit', TEMP: join(out, 'tmp'), TMP: join(out, 'tmp') };
const summary = { startedAt: new Date().toISOString(), out, home, root, steps: [], fakeModels: true };
const run = (file, args, cwd = repo) => {
  const result = spawnSync(file, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 300000 });
  assert.equal(result.status, 0, `${args.slice(0, 3).join(' ')}: ${result.stdout}\n${result.stderr}`); return result.stdout;
};
let browser, dsh, textModel, imageServer, imageCalls = 0;
try {
  for (const p of [workspace, env.TMP, join(out, 'pack')]) await mkdir(p, { recursive: true });
  const npm = 'D:/DSH/node/node_modules/npm/bin/npm-cli.js';
  run(process.execPath, ['scripts/build.mjs']);
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', '--json', '--ignore-scripts', '--pack-destination', join(out, 'pack')]));
  const tgz = join(out, 'pack', packed[0].filename);
  run(process.execPath, [bin, '--profile', DSH_PROFILE, '--from-default-profile', 'web', '--dump-config'], workspace);
  if (artifactOnly) {
    const unpacked = join(out, 'unpacked'); await mkdir(unpacked); run('tar', ['-xzf', tgz, '-C', unpacked]);
    const profile = join(home, 'profiles', DSH_PROFILE), manifest = join(profile, 'package.json'), pkg = JSON.parse(await readFile(manifest, 'utf8'));
    const name = JSON.parse(await readFile(join(unpacked, 'package/package.json'), 'utf8')).name;
    await mkdir(join(profile, 'node_modules', name.split('/')[0]), { recursive: true }); await symlink(join(unpacked, 'package'), join(profile, 'node_modules', name), 'junction');
    pkg.dependencies[name] = `file:${join(unpacked, 'package')}`; pkg.dsh.profile.bundles.push(name); await writeFile(manifest, JSON.stringify(pkg, null, 2));
    summary.steps.push('packed artifact mounted in private profile with existing checkout dependencies');
  } else {
    run(process.execPath, [bin, 'plugin', '--profile', DSH_PROFILE, 'add', tgz], workspace);
    summary.steps.push('current plugin packed and installed into private DSH profile');
  }
  const seed = new StudyService(root), { state } = imageLibrary();
  await seed.store.update(s => { s.sources = state.sources; s.decks = state.decks; s.focus = state.focus; }); await seed.call('course.book.open'); await seed.dispose();
  textModel = await createFakeOpenAI({ port: 0 });
  imageServer = createServer(async (req, res) => { for await (const chunk of req) void chunk; imageCalls++; res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }] })); });
  await new Promise(done => imageServer.listen(0, '127.0.0.1', done));
  const patch = join(out, 'qa.patch.yml'); await writeFile(patch, YAML.stringify(dshPatch({ fakeModelUrl: textModel.url, documentsDirectory: join(out, 'documents') })));
  dsh = await bootDsh(bin, { env: { ...env, [FAKE_KEY_ENV]: 'synthetic-test-key', STUDY_IMAGE_MODEL: 'gpt-image-2', STUDY_IMAGE_BASE_URL: `http://127.0.0.1:${imageServer.address().port}/v1`, STUDY_IMAGE_API_KEY: 'synthetic-test-key' }, cwd: workspace, patch, port: 3203 });
  browser = await launchChromium(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(dsh.url, { waitUntil: 'networkidle' });
  for (let i = 0; i < 4 && !await page.locator('.study-app').isVisible().catch(() => false); i++) {
    const next = page.getByRole('button', { name: /^(继续|稍后配置|跳过|Continue|Configure later|Skip)$/ }).first();
    if (!await next.count()) break; const handle = await next.elementHandle(); await handle.click(); await page.waitForFunction(button => !button.isConnected, handle); await handle.dispose();
  }
  if (!await page.locator('.study-app').isVisible().catch(() => false)) {
    const box = page.getByRole('textbox').last(); await box.fill('你好，我想使用学习资料。'); await box.press('Enter');
    const tab = page.getByRole('tab', { name: /学习|Study/ }).first(); await tab.waitFor({ timeout: 60000 }); await tab.click();
  }
  await page.locator('.study-app').first().waitFor({ timeout: 60000 });
  const rpc = (method, payload) => page.evaluate(async ({ method, payload }) => (await (await fetch(`/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload }) })).json()).result, { method, payload });
  const sessions = (await rpc('session/list', { args: { _request: {} } })).value.items;
  const call = async (action, args = {}) => { const r = await rpc('study-workspace/call', { sessionId: sessions[0].sessionId, action, args }); assert.ok(r.ok, JSON.stringify(r.error)); return r.value; };
  const snapshot = await call('snapshot'); assert.equal(resolve(snapshot.root), root);
  const book = await call('course.book.open'), course = book.course, heading = book.nodes[0].children[0].hid;
  assert.equal((await call('generation.courseBook.imageStatus')).available, true);
  const input = { course, heading, words: 'writes each decision down', requestId: 'dsh-image' }, image = await call('generation.courseBook.illustrate', input);
  for (let i = 0; i < 120; i++) { const j = await call('job.status', { jobId: image.jobId }); if (!['queued', 'running'].includes(j.status)) { assert.equal(j.status, 'complete', JSON.stringify(j.error)); break; } await new Promise(done => setTimeout(done, 250)); }
  const block = aiBlocks((await call('course.book.open')).nodes[0].children[0].mine).find(b => b.metadata?.kind === 'figure'); assert.ok(block);
  const assetId = /studyhub:\/\/asset\/([a-f0-9]{64})/.exec(block.body)[1]; assert.equal((await call('materials.book.asset.get', { assetId })).dataBase64, PNG.toString('base64'));
  await call('generation.courseBook.illustrate', input); assert.equal(imageCalls, 1); summary.steps.push('native host image job, controlled asset and replay without duplicate HTTP request');
  const courseId = (await call('course.list')).courses.find(c => c.name === course).id, scope = { kind: 'course', courseId };
  const curriculum = await call('curriculum.get', { scope, view: 'structure' });
  const target = { kind: 'outline', nodeId: 'what', outlineRevision: curriculum.outlineRevision };
  const session = await call('learning.session.start', { scope, target, origin: 'knowledge', requestId: 'dsh-session' });
  assert.equal((await call('learning.session.start', { scope, target, origin: 'knowledge', requestId: 'double-click' })).id, session.id);
  const practice = await call('learning.session.practice.start', { id: session.id, version: session.version, requestId: 'dsh-practice' }); assert.ok(practice.run);
  const again = await call('learning.session.practice.start', { id: session.id, version: practice.session.version, requestId: 'dsh-practice-again' }); assert.equal(again.run.id, practice.run.id);
  await call('learning.session.finish', { id: session.id, version: again.session.version, requestId: 'dsh-finish' });
  const results = await call('learning.records.sessionResults', { id: session.id }); assert.equal(results.sessionSummary.answered, 0); summary.steps.push('native v2 session deduplication, practice reuse and factual results');
  await openPage(page, 'book'); await page.getByRole('button', { name: '阅读', exact: true }).click();
  await page.locator('.loop-reading .md-image-open').first().scrollIntoViewIfNeeded(); await page.locator('.loop-reading .md-image img').first().waitFor(); await page.screenshot({ path: join(out, 'native-reading.png') });
  assert.deepEqual(errors, []); summary.steps.push('native DSH Edge reading displays controlled image'); summary.imageCalls = imageCalls; summary.ok = true;
} catch (error) { summary.ok = false; summary.error = error.message; process.exitCode = 1; }
finally {
  await browser?.close(); stopTree(dsh?.child); if (dsh) await writeFile(join(out, 'dsh.log'), dsh.output().replace(/token=\S+/g, 'token=…'));
  await textModel?.close(); if (imageServer) await new Promise(done => imageServer.close(done)); summary.endedAt = new Date().toISOString();
  await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
}
