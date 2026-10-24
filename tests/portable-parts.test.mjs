import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPortableBackup, joinPortableBackup, MAX_PORTABLE_PART_BYTES } from '../lib/portable-parts.js';

test('state larger than transport limit and images split into bounded verified portable parts', () => {
  const state = { version: 1, sources: [{ text: '原'.repeat(23 * 1024 * 1024) }], portableBookAssets: { format: 'study-book-assets/v1', files: [{ id: 'a'.repeat(64), dataBase64: 'AAAA' }] } };
  const split = splitPortableBackup(state);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) > 64 * 1024 * 1024);
  assert.ok(split.parts.length > 8);
  assert.ok(split.parts.every(p => Buffer.byteLength(JSON.stringify(p)) <= MAX_PORTABLE_PART_BYTES));
  assert.ok(split.manifest.parts.some(p => p.kind === 'assets'));
  assert.ok(split.manifest.parts.some(p => p.kind === 'state'));
  assert.deepEqual(joinPortableBackup(split.manifest, split.parts), state);
  assert.throws(() => joinPortableBackup(split.manifest, split.parts.slice(1)), /missing/);
  const corrupt = structuredClone(split.parts); corrupt[0].dataBase64 = 'AAAA';
  assert.throws(() => joinPortableBackup(split.manifest, corrupt), /hash|length/);
});
test('part identity and repeated uploads are deterministic within a prepared backup', () => {
  const state = { version: 1, sources: [] }, { manifest, parts } = splitPortableBackup(state);
  assert.deepEqual(joinPortableBackup(manifest, [parts[0], structuredClone(parts[0])]), state);
  const other = splitPortableBackup(state);
  assert.throws(() => joinPortableBackup(manifest, other.parts), /identity/);
});
