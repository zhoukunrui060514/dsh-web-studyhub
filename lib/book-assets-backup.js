import { bookAssetReferences, validateBookImage, readAssetBytes, putBookAsset } from './book-assets.js';

export const BOOK_ASSETS_BACKUP = 'study-book-assets/v1';
const descriptors = state => new Map((state.sources || []).flatMap(s => Object.values(s.bookDoc?.assets || {})).map(asset => [asset.id, asset]));
const references = (state, history) => bookAssetReferences([(state.sources || []).filter(s => s.bookDoc).map(s => s.bookDoc.files), history]);
export async function exportBookAssets(root, state, history = []) {
  const index = descriptors(state), files = [];
  for (const id of [...references(state, history)].sort()) {
    const asset = index.get(id);
    if (!asset) throw new Error(`Backup is missing image descriptor ${id}`);
    const bytes = await readAssetBytes(root, asset);
    files.push({ ...asset, dataBase64: bytes.toString('base64') });
  }
  return { format: BOOK_ASSETS_BACKUP, files };
}
export function verifyBookAssets(section, state, history = []) {
  if (!section || section.format !== BOOK_ASSETS_BACKUP || !Array.isArray(section.files)) throw new Error('Unreadable portable book assets');
  const found = new Map(), index = descriptors(state);
  for (const file of section.files) {
    if (typeof file.dataBase64 !== 'string' || file.dataBase64.length > 2_796_204) throw new Error('Invalid portable image bytes');
    const bytes = Buffer.from(file.dataBase64, 'base64');
    if (bytes.toString('base64') !== file.dataBase64) throw new Error('Invalid portable image encoding');
    const actual = validateBookImage(bytes);
    if (['id', 'mime', 'bytes', 'ext'].some(k => actual[k] !== file[k] || index.has(file.id) && index.get(file.id)[k] !== actual[k])) throw new Error('Portable image hash or descriptor mismatch');
    if (found.has(file.id)) throw new Error('Duplicate portable image');
    found.set(file.id, { ...actual, dataBase64: file.dataBase64 });
  }
  for (const id of references(state, history)) if (!found.has(id)) throw new Error(`Portable backup is missing image ${id}`);
  return [...found.values()];
}
export async function restoreBookAssets(root, files) {
  for (const file of files) await putBookAsset(root, Buffer.from(file.dataBase64, 'base64'));
}
