import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { detectRasterImageMime, MAX_LOCAL_IMAGE_BYTES } from './study-image-policy.js';
import { exportHistoryFiles } from './course-book-history.js';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const HASH = /^[a-f0-9]{64}$/;
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
const crc32 = bytes => { let crc = 0xffffffff; for (const b of bytes) crc = CRC[(crc ^ b) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; };
export const assetHash = bytes => createHash('sha256').update(bytes).digest('hex');
export function assetId(value) { if (!HASH.test(String(value))) fail('book-asset-invalid'); return value; }

function png(bytes) {
  let at = 8, header, ended = false; const data = [];
  while (at + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(at), end = at + 12 + length;
    if (end > bytes.length || crc32(bytes.subarray(at + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail('book-image-invalid');
    const kind = bytes.toString('ascii', at + 4, at + 8), body = bytes.subarray(at + 8, end - 4);
    if (!header && kind !== 'IHDR') fail('book-image-invalid');
    if (kind === 'IHDR') { if (header || length !== 13) fail('book-image-invalid'); header = body; }
    if (kind === 'IDAT') data.push(body);
    at = end;
    if (kind === 'IEND') { if (length || at !== bytes.length) fail('book-image-invalid'); ended = true; break; }
  }
  if (!ended || !data.length) fail('book-image-invalid');
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4), depth = header[8], color = header[9], channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!width || !height || !channels || ![1, 2, 4, 8, 16].includes(depth) || header[10] || header[11] || header[12] > 1) fail('book-image-invalid');
  const passes = header[12] ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const rows = passes.map(([x, y, dx, dy]) => [Math.max(0, Math.ceil((width - x) / dx)), Math.max(0, Math.ceil((height - y) / dy))])
    .filter(([w, h]) => w && h).map(([w, h]) => [Math.ceil(w * channels * depth / 8) + 1, h]);
  const size = rows.reduce((n, [length, h]) => n + length * h, 0);
  if (size > 128 * 1024 * 1024) fail('book-image-invalid');
  const decoded = inflateSync(Buffer.concat(data), { maxOutputLength: size });
  if (decoded.length !== size) fail('book-image-invalid');
  let offset = 0;
  for (const [length, h] of rows) for (let row = 0; row < h; row++, offset += length) if (decoded[offset] > 4) fail('book-image-invalid');
}
function webp(bytes) {
  if (bytes.length < 25 || bytes.readUInt32LE(4) + 8 !== bytes.length) fail('book-image-invalid');
  let at = 12, image = false;
  while (at + 8 <= bytes.length) {
    const type = bytes.toString('ascii', at, at + 4), size = bytes.readUInt32LE(at + 4), end = at + 8 + size;
    if (end > bytes.length) fail('book-image-invalid');
    if (type === 'VP8L') { if (size < 5 || bytes[at + 8] !== 0x2f) fail('book-image-invalid'); image = true; }
    if (type === 'VP8 ') { if (size < 10 || bytes.toString('hex', at + 11, at + 14) !== '9d012a') fail('book-image-invalid'); image = true; }
    at = end + (size % 2);
  }
  if (at !== bytes.length || !image) fail('book-image-invalid');
}
export function validateBookImage(value) {
  const bytes = Buffer.from(value);
  if (bytes.length > MAX_LOCAL_IMAGE_BYTES) fail('book-image-too-large');
  const mime = detectRasterImageMime(bytes);
  try { if (mime === 'image/png') png(bytes); else if (mime === 'image/webp') webp(bytes); else fail('book-image-invalid'); }
  catch (error) { if (error.code === 'book-image-invalid') throw error; fail('book-image-invalid'); }
  return { id: assetHash(bytes), mime, bytes: bytes.length, ext: mime === 'image/png' ? 'png' : 'webp' };
}
export async function putBookAsset(root, value) {
  const bytes = Buffer.from(value), asset = validateBookImage(bytes), directory = join(root, 'book-assets');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${asset.id}.${asset.ext}`), temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes);
  try { await rename(temporary, path); } finally { await unlink(temporary).catch(() => {}); }
  return asset;
}
export function bookAssetReferences(value) {
  const ids = new Set();
  const visit = item => {
    if (typeof item === 'string') for (const match of item.matchAll(/studyhub:\/\/asset\/([a-f0-9]{64})\b/g)) ids.add(match[1]);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value); return ids;
}
export async function readAssetBytes(root, asset) {
  assetId(asset.id);
  if (!['png', 'webp'].includes(asset.ext)) fail('book-asset-invalid');
  const bytes = await readFile(join(root, 'book-assets', `${asset.id}.${asset.ext}`));
  const actual = validateBookImage(bytes);
  if (JSON.stringify(actual) !== JSON.stringify({ id: asset.id, mime: asset.mime, bytes: asset.bytes, ext: asset.ext })) fail('book-asset-invalid');
  return bytes;
}
export async function readBookAsset(root, state, id) {
  assetId(id);
  const books = state.sources.filter(s => s.bookDoc), histories = await exportHistoryFiles(root);
  const referenced = bookAssetReferences([books.map(s => s.bookDoc.files), histories]);
  const asset = books.map(s => s.bookDoc.assets?.[id]).find(Boolean);
  if (!asset || !referenced.has(id)) fail('book-asset-unavailable');
  const bytes = await readAssetBytes(root, asset);
  return { assetId: id, mime: asset.mime, bytes: asset.bytes, dataBase64: bytes.toString('base64') };
}
