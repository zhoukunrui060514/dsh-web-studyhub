import { id } from '../../util.js';
import { EXTRACTOR_VERSION } from './model.js';
import { inputsFromState } from './materials.js';
import { ACTIVE_KNOWLEDGE, submitKnowledgeBuild } from './jobs/submit.js';

export async function reconcileKnowledge(ports, { reason }) {
  const refs = await ports.state.update(s => {
    const config = s.knowledgeConfig, materials = inputsFromState(s), candidates = [];
    for (const m of s.knowledgeMaterials) {
      if (ACTIVE_KNOWLEDGE.has(m.status) && m.claimId && m.claimEpoch !== ports.runtimeEpoch) {
        Object.assign(m, { status: m.jobId ? 'interrupted' : 'pending', claimId: null });
      } else if (ACTIVE_KNOWLEDGE.has(m.status) && m.jobId) {
        const physical = ports.jobPresence?.(m.jobId);
        if (physical && ['cancelled', 'failed', 'interrupted'].includes(physical)) Object.assign(m, { status: physical, claimId: null });
      }
      if (!config.autoBuild && m.origin === 'auto' && !ACTIVE_KNOWLEDGE.has(m.status)) Object.assign(m, { intent: false, status: m.status === 'complete' ? 'complete' : 'cancelled' });
    }
    for (const material of materials) {
      if (material.archived) continue;
      let m = s.knowledgeMaterials.find(x => x.identity === material.identity);
      const changed = m && m.revision !== material.revision;
      const afterEnable = material.importedRevision !== null && config.lastEnabledRevision !== undefined
        ? material.importedRevision > config.lastEnabledRevision : material.importedAt && material.importedAt > config.lastEnabledAt;
      const auto = config.autoBuild && material.eligibleAuto && (m?.followAuto || afterEnable || reason === 'backfill');
      if (!m && auto) { m = { id: id(), identity: material.identity, status: 'pending', origin: reason === 'backfill' ? 'backfill' : 'auto' }; s.knowledgeMaterials.push(m); }
      if (!m) continue;
      if (auto && (!m.intent || changed) && !ACTIVE_KNOWLEDGE.has(m.status)) Object.assign(m, { followAuto: true, intent: true, revision: material.revision, status: 'pending', origin: reason === 'backfill' ? 'backfill' : 'auto' });
      if (m.publishedRevision === material.revision && m.extractorVersion === EXTRACTOR_VERSION) continue;
      if (m.intent && ['pending', 'waiting-model', 'waiting-executor'].includes(m.status)) candidates.push({ identity: material.identity, revision: material.revision, origin: m.origin });
    }
    return candidates;
  });
  if (!refs.length) return [];
  const receipts = [];
  // One claim per library. Remaining origins remain durable pending intents, dispatched at settlement.
  for (const origin of ['manual', 'backfill', 'auto']) {
    const materials = refs.filter(r => r.origin === origin);
    if (materials.length) receipts.push(await submitKnowledgeBuild(ports, { materials, origin }));
  }
  return receipts;
}
