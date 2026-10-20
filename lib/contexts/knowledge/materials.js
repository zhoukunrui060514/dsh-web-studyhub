import { createHash } from 'node:crypto';
import { isCourseInventorySource, isLibraryListSource } from '../../exam-point-list.js';
import { knowledgeError } from './model.js';

export const fingerprint = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const generated = s => isLibraryListSource(s) || isCourseInventorySource(s) || s.hidden === true || s.generated === true ||
  ['generated', 'system', 'skeleton', 'draft', 'question-bank'].includes(s.knowledgeOrigin);
const courseIds = (sources, courses) => [...new Set(sources.flatMap(s => {
  const names = s.courses || [s.course || s.audio?.course].filter(Boolean);
  return [...(s.courseIds || []).filter(id => courses.some(c => c.id === id)), ...names.flatMap(name => courses.filter(c => c.name === name || c.aliases?.includes(name)).map(c => c.id))];
}))].sort();

function fromDescriptor(doc, sources, courses) {
  const usable = sources.filter(s => !generated(s) && typeof s.text === 'string' && s.text.trim());
  if (!usable.length) return null;
  const legacy = doc.legacy === true && usable.length === 1 && !usable[0].document?.id;
  const version = doc.versions?.find(v => v.revision === doc.currentRevision);
  return {
    identity: legacy ? `source:${usable[0].id}` : `document:${doc.documentId || doc.id}`,
    revision: legacy ? fingerprint(usable[0].text) : fingerprint([doc.currentRevision || doc.revision, usable.map(s => [s.id, s.text])]),
    ...(!legacy ? { documentRevision: doc.currentRevision || doc.revision } : {}),
    ...(!legacy ? { documentId: doc.documentId || doc.id } : {}),
    sourceIds: usable.map(s => s.id), title: doc.title || usable[0].title || usable[0].id,
    courses: courseIds(usable, courses), importedAt: version?.importedAt || doc.importedAt || usable[0].importedAt || usable[0].createdAt || null,
    importedRevision: usable.some(s => Number.isInteger(s.knowledgeImportedRevision)) ? Math.max(...usable.map(s => s.knowledgeImportedRevision || 0)) : null,
    eligibleAuto: !doc.legacy || usable.every(s => ['user-document', 'user-text', 'user-transcript'].includes(s.knowledgeOrigin)),
    archived: doc.archived === true || usable.every(s => s.archived === true),
    segments: usable.map(s => ({ sourceId: s.id, text: s.text, start: 0, end: s.text.length, ...(s.document?.page ? { page: s.document.page } : {}) })),
  };
}

/** Pure projection of the materials participant, also used under the publication lock. No bank inference. */
export function inputsFromState({ documents = [], sources = [], courses = [] }) {
  const known = new Set(documents.flatMap(d => (d.versions || []).flatMap(v => v.sourceIds || []))), result = [];
  for (const doc of documents) {
    const version = doc.versions?.find(v => v.revision === doc.currentRevision);
    const value = fromDescriptor(doc, (version?.sourceIds || []).map(id => sources.find(s => s.id === id)).filter(Boolean), courses);
    if (value) result.push(value);
  }
  const seen = new Set();
  for (const source of sources) {
    if (known.has(source.id) || seen.has(source.id) || generated(source)) continue;
    const members = source.document?.id ? sources.filter(s => !known.has(s.id) && s.document?.id === source.document.id) : [source];
    members.forEach(s => seen.add(s.id));
    const value = fromDescriptor({ id: source.document?.materialId || `legacy-${source.document?.id || source.id}`, legacy: true,
      title: source.title, currentRevision: source.document?.id ? fingerprint(members.map(s => [s.id, s.text])) : undefined }, members, courses);
    if (value) result.push(value);
  }
  return result.sort((a, b) => a.identity.localeCompare(b.identity));
}

export async function readKnowledgeMaterials({ materials, courses }) {
  const courseResult = await courses.list(), allCourses = courseResult.courses || courseResult;
  const result = [];
  for (let offset = 0; ;) {
    const page = await materials.list({ includeArchived: true, offset, limit: 200 });
    const docs = page.documents || page;
    for (const doc of docs) {
      const full = await materials.get({ documentId: doc.documentId || doc.id });
      const value = fromDescriptor(full, full.sources || [], allCourses);
      if (value) result.push(value);
    }
    offset += docs.length;
    if (Array.isArray(page) || !docs.length || offset >= page.total) break;
  }
  return result;
}
export async function resolveKnowledgeMaterial(ports, ref) {
  const all = ports.readMaterials ? await ports.readMaterials() : await readKnowledgeMaterials(ports);
  const found = all.find(m => m.identity === ref.identity);
  if (!found || found.archived) throw knowledgeError('material-unavailable', '资料已删除或归档');
  if (found.revision !== ref.revision) throw knowledgeError('stale-material', '资料版本已改变');
  return found;
}
export const materialKey = (libraryId, ref, extractorVersion) => fingerprint([libraryId, ref.identity, ref.revision, extractorVersion]);
