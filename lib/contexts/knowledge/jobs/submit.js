import { id } from '../../../util.js';
import { EXTRACTOR_VERSION, knowledgeError } from '../model.js';
import { materialKey, resolveKnowledgeMaterial } from '../materials.js';
import { publishMaterial } from '../publication.js';

export const ACTIVE_KNOWLEDGE = new Set(['queued', 'extracting', 'validating', 'publishing']);
export async function submitKnowledgeBuild(ports, { materials, origin = 'manual' }) {
  if (!Array.isArray(materials) || !materials.length || !['manual', 'backfill', 'auto'].includes(origin)) throw knowledgeError('invalid-build', '请先选择资料');
  const refs = [];
  for (const ref of materials) { const m = await resolveKnowledgeMaterial(ports, ref); if (!refs.some(r => r.identity === m.identity)) refs.push({ identity: m.identity, revision: m.revision }); }
  const claimId = id(), waiting = !ports.complete ? 'waiting-model' : !ports.jobs ? 'waiting-executor' : null;
  const prepared = await ports.state.update(s => {
    const requested = [];
    for (const ref of refs) {
      let entry = s.knowledgeMaterials.find(m => m.identity === ref.identity);
      if (!entry) { entry = { id: id(), identity: ref.identity }; s.knowledgeMaterials.push(entry); }
      if (entry.publishedRevision === ref.revision && entry.extractorVersion === EXTRACTOR_VERSION) continue;
      if (ACTIVE_KNOWLEDGE.has(entry.status) && entry.claimId) continue;
      Object.assign(entry, { revision: ref.revision, extractorVersion: EXTRACTOR_VERSION, key: materialKey(ports.libraryId, ref, EXTRACTOR_VERSION), origin,
        followAuto: origin === 'auto' || entry.followAuto === true, intent: true, status: waiting || 'pending', reason: waiting, jobId: null });
      requested.push(ref);
    }
    if (!requested.length) return { refs: [], status: 'complete' };
    if (waiting) return { refs: [], status: waiting };
    if (s.knowledgeMaterials.some(m => ACTIVE_KNOWLEDGE.has(m.status) && m.claimId)) return { refs: [], status: 'pending' };
    for (const ref of requested) Object.assign(s.knowledgeMaterials.find(m => m.identity === ref.identity), { claimId, claimEpoch: ports.runtimeEpoch, status: 'queued' });
    return { refs: requested, status: 'queued' };
  });
  const materialIds = refs.map(r => r.identity);
  if (!prepared.refs.length) return { accepted: false, status: prepared.status, materialIds };
  try {
    const job = await ports.jobs.submit('knowledge-extract', { materials: prepared.refs, origin, claimId }, {}, {
      knowledge: { ...ports, publish: args => publishMaterial(ports, args) },
    });
    await ports.state.update(s => { for (const m of s.knowledgeMaterials) if (m.claimId === claimId) m.jobId = job.jobId; });
    void ports.jobs.wait(job.jobId).then(() => ports.onSettled?.()).catch(() => {});
    return { accepted: true, jobId: job.jobId, status: job.status, materialIds };
  } catch (error) {
    const status = error.code === 'executor-unavailable' || error.code === 'scope-unloaded' ? 'waiting-executor' : 'failed';
    await ports.state.update(s => { for (const m of s.knowledgeMaterials) if (m.claimId === claimId) Object.assign(m, { status, reason: error.code || 'submit-failed', claimId: null, jobId: null }); });
    return { accepted: false, status, materialIds, reason: error.code || 'submit-failed' };
  }
}
