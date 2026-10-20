import { knowledgeError } from './model.js';

export function chunkMaterial(material, { maxChars = 8000, overlap = 400 } = {}) {
  if (!Number.isInteger(maxChars) || maxChars < 2 || maxChars > 8000 || !Number.isInteger(overlap) || overlap < 0 || overlap > 400 || overlap >= maxChars)
    throw knowledgeError('invalid-chunk-size');
  const chunks = [];
  for (const segment of material.segments) {
    let start = 0;
    while (start < segment.text.length) {
      let end = Math.min(segment.text.length, start + maxChars);
      if (end < segment.text.length && /[\uD800-\uDBFF]/.test(segment.text[end - 1])) end--;
      chunks.push({ id: `${material.identity}:${segment.sourceId}:${segment.start + start}:${segment.start + end}`, materialIdentity: material.identity, revision: material.revision,
        ...(material.documentRevision ? { documentRevision: material.documentRevision } : {}),
        segments: [{ ...segment, text: segment.text.slice(start, end), start: segment.start + start, end: segment.start + end }] });
      if (end === segment.text.length) break;
      start = Math.max(start + 1, end - overlap);
      if (/[\uDC00-\uDFFF]/.test(segment.text[start])) start++;
    }
  }
  return chunks;
}
