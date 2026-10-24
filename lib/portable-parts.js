import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PORTABLE_MANIFEST = 'study-backup-parts/v1';
export const MAX_PORTABLE_PART_BYTES = 8 * 1024 * 1024;
export const MAX_SINGLE_BACKUP_BYTES = 60 * 1024 * 1024;
const CHUNK = 5 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const validId = id => { if (!/^[0-9a-f-]{36}$/.test(String(id))) throw new Error('Invalid backup identity'); return id; };
export function splitPortableBackup(backup) {
  const { portableBookAssets, ...state } = backup, id = randomUUID(), parts = [], streams = [];
  for (const [kind, value] of [['state', state], ...(portableBookAssets ? [['assets', portableBookAssets]] : [])]) {
    const bytes = Buffer.from(JSON.stringify(value));
    streams.push({ kind, bytes: bytes.length, sha256: sha(bytes) });
    for (let at = 0, index = 0; at < bytes.length; at += CHUNK, index++) {
      const chunk = bytes.subarray(at, at + CHUNK), name = `${id}-${kind}-${index}.json`;
      parts.push({ format: 'study-backup-part/v1', backupId: id, kind, index, name, bytes: chunk.length, sha256: sha(chunk), dataBase64: chunk.toString('base64') });
    }
  }
  const manifest = { format: PORTABLE_MANIFEST, id, streams, parts: parts.map(({ dataBase64: _data, ...part }) => part),
    summary: { courses: state.courses?.length || 0, sources: state.sources?.length || 0, decks: state.decks?.length || 0, cards: (state.decks || []).reduce((n, d) => n + (d.cards?.length || 0), 0), attempts: state.attempts?.length || 0 } };
  return { manifest, parts };
}
export function verifyPortableManifest(manifest) {
  if (manifest?.format !== PORTABLE_MANIFEST || !Array.isArray(manifest.parts) || !manifest.parts.length || !Array.isArray(manifest.streams)) throw new Error('Invalid backup manifest');
  validId(manifest.id);
  const names = new Set();
  for (const part of manifest.parts) {
    if (!['state', 'assets'].includes(part.kind) || !Number.isInteger(part.index) || part.index < 0 || part.name !== `${manifest.id}-${part.kind}-${part.index}.json` || part.backupId !== manifest.id || !Number.isInteger(part.bytes) || part.bytes < 1 || part.bytes > CHUNK || !/^[a-f0-9]{64}$/.test(part.sha256) || names.has(part.name)) throw new Error('Invalid backup part descriptor');
    names.add(part.name);
  }
  return manifest;
}
export function verifyPortablePart(manifest, part) {
  verifyPortableManifest(manifest);
  if (part?.backupId !== manifest.id) throw new Error('Backup part identity mismatch');
  const expected = manifest.parts.find(p => p.name === part.name);
  if (!expected || Object.keys(expected).some(k => part[k] !== expected[k])) throw new Error('Backup part identity mismatch');
  if (typeof part.dataBase64 !== 'string' || Buffer.byteLength(JSON.stringify(part)) > MAX_PORTABLE_PART_BYTES) throw new Error('Backup part length exceeds limit');
  const bytes = Buffer.from(part.dataBase64, 'base64');
  if (bytes.length !== expected.bytes || bytes.toString('base64') !== part.dataBase64) throw new Error('Backup part length mismatch');
  if (sha(bytes) !== expected.sha256) throw new Error('Backup part hash mismatch');
  return bytes;
}
export function joinPortableBackup(manifest, parts) {
  verifyPortableManifest(manifest);
  const found = new Map();
  for (const part of parts) {
    const bytes = verifyPortablePart(manifest, part);
    found.set(part.name, bytes);
  }
  if (manifest.parts.some(part => !found.has(part.name))) throw new Error('Backup is missing parts');
  const result = {};
  for (const stream of manifest.streams) {
    const descriptors = manifest.parts.filter(p => p.kind === stream.kind).sort((a, b) => a.index - b.index);
    if (descriptors.some((p, i) => p.index !== i)) throw new Error('Backup is missing part indices');
    const bytes = Buffer.concat(descriptors.map(p => found.get(p.name)));
    if (bytes.length !== stream.bytes || sha(bytes) !== stream.sha256) throw new Error('Backup stream hash or length mismatch');
    result[stream.kind] = JSON.parse(bytes.toString('utf8'));
  }
  if (!result.state || manifest.streams.filter(s => s.kind === 'state').length !== 1 || new Set(manifest.streams.map(s => s.kind)).size !== manifest.streams.length || manifest.parts.some(p => !result[p.kind])) throw new Error('Backup is missing a valid stream');
  return { ...result.state, ...(result.assets ? { portableBookAssets: result.assets } : {}) };
}

/** Staging shares this library's existing backup/export/restore owner. Never changes library state. */
export function portableTransfers(root) {
  const directory = id => join(root, '.portable-transfers', validId(id));
  const manifestOf = async id => JSON.parse(await readFile(join(directory(id), 'manifest.json'), 'utf8'));
  const save = async manifest => {
    verifyPortableManifest(manifest); await mkdir(directory(manifest.id), { recursive: true });
    await writeFile(join(directory(manifest.id), 'manifest.json'), JSON.stringify(manifest));
  };
  const upload = async (id, part) => {
    const manifest = await manifestOf(id); verifyPortablePart(manifest, part);
    await writeFile(join(directory(id), part.name), JSON.stringify(part)); return { uploaded: part.name };
  };
  return {
    export: async backup => {
      const { manifest, parts } = splitPortableBackup(backup); await save(manifest);
      for (const part of parts) await upload(manifest.id, part);
      return { mode: 'parts', manifest };
    },
    prepare: async manifest => { await save(manifest); return { transferId: manifest.id }; }, upload,
    part: async (id, name) => {
      const manifest = await manifestOf(id);
      if (!manifest.parts.some(p => p.name === name)) throw new Error('Unknown backup part');
      return JSON.parse(await readFile(join(directory(id), name), 'utf8'));
    },
    assemble: async id => {
      const manifest = await manifestOf(id), parts = [];
      for (const part of manifest.parts) {
        try { parts.push(JSON.parse(await readFile(join(directory(id), part.name), 'utf8'))); }
        catch (error) { if (error.code === 'ENOENT') throw new Error('Backup is missing parts'); throw error; }
      }
      return joinPortableBackup(manifest, parts);
    },
  };
}
