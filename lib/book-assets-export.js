import { bookAssetReferences, readAssetBytes } from './book-assets.js';

export const MAX_EMBEDDED_EXPORT_BYTES = 16 * 1024 * 1024;
export async function withBookAssetExport(root, state, result) {
  if (result.status !== 'ok') return result;
  const references = bookAssetReferences(result.form === 'folder' ? result.files : result.text);
  if (!references.size) return result;
  const index = new Map(state.sources.flatMap(source => Object.values(source.bookDoc?.assets || {})).map(asset => [asset.id, asset]));
  const images = [], replacements = new Map(); let size = Buffer.byteLength(result.text || '');
  for (const id of references) {
    const asset = index.get(id);
    if (!asset) throw new Error('Export is missing an image descriptor');
    if (result.form === 'folder') {
      const name = `images/${id}.${asset.ext}`;
      images.push({ name, assetId: id, mime: asset.mime }); replacements.set(`studyhub://asset/${id}`, name);
    } else {
      const bytes = await readAssetBytes(root, asset), url = `data:${asset.mime};base64,${bytes.toString('base64')}`;
      size += url.length;
      if (size > MAX_EMBEDDED_EXPORT_BYTES) return { ...result, text: null, singleUnavailable: true, reason: '图片较多，请使用分文件导出，图片保存在 images 文件夹。' };
      replacements.set(`studyhub://asset/${id}`, url);
    }
  }
  const replace = text => { for (const [from, to] of replacements) text = text.replaceAll(from, to); return text; };
  return result.form === 'folder' ? { ...result, files: result.files.map(file => ({ ...file, text: replace(file.text) })), images }
    : { ...result, text: replace(result.text) };
}
