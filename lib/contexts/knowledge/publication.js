import { inputsFromState } from './materials.js';
import { mergeCandidates } from './merge.js';
import { EXTRACTOR_VERSION } from './model.js';
import { id } from '../../util.js';

/** state.update is the scoped runtime transaction; materials are read inside its Store lock. */
export async function publishMaterial(context, { ref, batch, claimId, extractorVersion = EXTRACTOR_VERSION, signal }) {
  signal?.throwIfAborted();
  return context.state.update(s => {
    signal?.throwIfAborted();
    let processing = s.knowledgeMaterials.find(m => m.identity === ref.identity);
    if (!processing) { processing = { id: id(), identity: ref.identity }; s.knowledgeMaterials.push(processing); }
    if (claimId && processing.claimId !== claimId) return { published: false, reason: 'stale-claim' };
    const current = inputsFromState(s).find(m => m.identity === ref.identity);
    if (!current || current.archived || current.revision !== ref.revision) {
      Object.assign(processing, { status: 'pending', reason: 'stale-material', claimId: null });
      return { published: false, reason: 'stale-material' };
    }
    if (processing.publishedRevision === ref.revision && processing.extractorVersion === extractorVersion)
      return { published: false, reason: 'already-current' };
    // ID resolution happens under the same lock as publication, so parallel materials cannot fork a semantic match.
    const merged = mergeCandidates(s, batch);
    for (const e of s.knowledgeEvidence) if (e.materialIdentity === ref.identity) e.superseded = true;
    for (const [field, values] of [['knowledgeNodes', merged.nodes], ['knowledgeEdges', merged.edges], ['knowledgeMerges', merged.mergeProposals]])
      for (const value of values) if (!s[field].some(x => x.id === value.id)) s[field].push(value);
    s.knowledgeEvidence.push(...merged.evidence.map(e => ({ ...e, courses: current.courses })));
    Object.assign(processing, { revision: ref.revision, publishedRevision: ref.revision, extractorVersion, status: 'complete', reason: null, claimId: null });
    signal?.throwIfAborted();
    return { published: true };
  });
}
