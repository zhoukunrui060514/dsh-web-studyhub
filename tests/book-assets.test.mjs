import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { putBookAsset, readBookAsset, validateBookImage } from '../lib/book-assets.js';
import { aiBlock, aiBlocks, replaceAiBlock } from '../lib/course-book-ai-text.js';

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
test('immutable raster storage deduplicates by content; current and history references authorize only this library', async t => {
  const root = await mkdtemp(join(tmpdir(), 'book-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const asset = await putBookAsset(root, PNG);
  assert.equal(asset.mime, 'image/png');
  assert.deepEqual(await putBookAsset(root, PNG), asset);
  const state = { sources: [{ course: '课程', bookDoc: { assets: { [asset.id]: asset }, files: { 'n.mine.md': { text: `![回路](studyhub://asset/${asset.id})` } } } }] };
  const image = await readBookAsset(root, state, asset.id);
  assert.equal(image.dataBase64, PNG.toString('base64'));
  await assert.rejects(readBookAsset(root, { sources: [] }, asset.id), { code: 'book-asset-unavailable' });
  await assert.rejects(readBookAsset(root, state, '../escape'), { code: 'book-asset-invalid' });
});
test('corrupt, truncated and over-budget raster is refused before saving', () => {
  assert.throws(() => validateBookImage(PNG.subarray(0, 30)), { code: 'book-image-invalid' });
  assert.throws(() => validateBookImage(Buffer.alloc(2 * 1024 * 1024 + 1)), { code: 'book-image-too-large' });
  const corrupt = Buffer.from(PNG); corrupt[48] ^= 1;
  assert.throws(() => validateBookImage(corrupt), { code: 'book-image-invalid' });
});
test('image metadata roundtrips in AI blocks, replacement and history without embedding image bytes', () => {
  const metadata = { kind: 'figure', assetId: 'a'.repeat(64), model: 'gpt-image-2', sourceRevision: 'revision', requestId: 'r', caption: '负反馈', alt: '箭头返回输入' };
  const raw = aiBlock({ id: 'img', at: 'h:n', about: '稳态', body: `![箭头返回输入](studyhub://asset/${metadata.assetId})\n\n负反馈`, mode: 'figure', metadata });
  assert.deepEqual(aiBlocks(raw)[0].metadata, metadata);
  const next = replaceAiBlock(raw, 'img', raw.replace('负反馈\n<!--', '负反馈机制\n<!--'));
  assert.deepEqual(aiBlocks(next)[0].metadata, metadata);
  assert.ok(raw.length < 2000);
});
