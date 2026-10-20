import { chunkMaterial } from '../chunks.js';
import { citationCatalog, EXTRACTION_SYSTEM, validateExtraction } from '../extraction.js';
import { EXTRACTOR_VERSION, knowledgeError } from '../model.js';
import { ACTIVE_KNOWLEDGE } from './submit.js';
import { id } from '../../../util.js';
import { resolveKnowledgeMaterial } from '../materials.js';
import { presentKnowledge } from './view.js';

const POLICY = Object.freeze({ purpose: 'other', feature: 'other', requestedEffort: 'default', executionMode: 'direct', budget: null });
export const knowledgeExtractDefinition = {
  kind: 'knowledge-extract', version: 1, title: '资料知识图谱', legacyFields: [],
  capabilities: { cancel: true, retry: true, pauseMode: 'unsupported', recoveryMode: 'none', set: false, executionModes: ['direct'] },
  initialPresentation: input => presentKnowledge(input, { done: 0, stage: 'queued' }),
  async run(context, input, { knowledge: ports }) {
    const claimId = context.attemptId;
    await ports.state.update(s => {
      const ownedInitial = m => m.claimId === input.claimId && (!m.jobId || m.jobId === context.jobId);
      if (s.knowledgeMaterials.some(m => ACTIVE_KNOWLEDGE.has(m.status) && m.claimId && !ownedInitial(m)))
        throw knowledgeError('knowledge-busy', '已有图谱任务正在运行，请待其完成后重试');
      for (const ref of input.materials) {
        let m = s.knowledgeMaterials.find(m => m.identity === ref.identity);
        if (m?.publishedRevision === ref.revision && m.extractorVersion === EXTRACTOR_VERSION) continue;
        if (!m) { m = { id: id(), identity: ref.identity }; s.knowledgeMaterials.push(m); }
        Object.assign(m, { claimId, claimEpoch: ports.runtimeEpoch, jobId: context.jobId, revision: ref.revision, status: 'queued', intent: true, origin: input.origin });
      }
    });
    const progress = { done: 0, stage: 'extracting', materials: [] }, refs = [];
    let sequence = 0, failed = 0;
    const show = () => context.present(presentKnowledge(input, progress));
    const mark = (identity, values) => ports.state.update(s => { const m = s.knowledgeMaterials.find(x => x.identity === identity); if (m?.claimId === claimId) Object.assign(m, values); });
    const extract = async chunk => {
      context.signal.throwIfAborted();
      try {
        let correction;
        for (let attempt = 0; attempt < 2; attempt++) {
          context.signal.throwIfAborted();
          const raw = await context.gateway.step(`knowledge:${++sequence}`, POLICY).complete(EXTRACTION_SYSTEM,
            JSON.stringify({ type: 'knowledge-extract', ...chunk, citations: citationCatalog(chunk), ...(correction ? { correction } : {}) }));
          context.signal.throwIfAborted(); progress.stage = 'validating'; show();
          try { return [validateExtraction(raw, chunk)]; }
          catch (error) {
            if (attempt || !['invalid-evidence', 'invalid-extraction'].includes(error.code)) throw error;
            correction = { code: error.code, message: error.message,
              instruction: 'The previous extraction was rejected. Re-extract the entire segment. Every evidence item must select an existing citationId from the supplied catalog and an assertion. Return valid JSON only.' };
          }
        }
      } catch (error) {
        if (error.code !== 'extraction-overflow') throw error;
        const length = chunk.segments.reduce((n, s) => n + s.text.length, 0);
        if (length <= 2) throw error;
        const size = Math.max(2, Math.floor(length / 2));
        const smaller = chunkMaterial({ identity: chunk.materialIdentity, revision: chunk.revision, documentRevision: chunk.documentRevision, segments: chunk.segments }, { maxChars: size, overlap: Math.min(400, Math.floor(size / 4)) });
        const results = [];
        for (const part of smaller) results.push(...await extract(part));
        return results;
      }
    };
    try {
      for (const ref of input.materials) {
        context.signal.throwIfAborted(); progress.identity = ref.identity;
        const saved = (await ports.state.read()).knowledgeMaterials.find(m => m.identity === ref.identity);
        if (saved?.publishedRevision === ref.revision && saved.extractorVersion === EXTRACTOR_VERSION) { progress.done++; continue; }
        await mark(ref.identity, { status: 'extracting', jobId: context.jobId });
        try {
          const material = await resolveKnowledgeMaterial(ports, ref), batches = [];
          for (const chunk of chunkMaterial(material)) { progress.stage = 'extracting'; show(); batches.push(...await extract(chunk)); }
          const batch = { nodes: [], edges: [], evidence: [], mergeProposals: [] };
          batches.forEach((b, i) => {
            const prefix = `${i}:`;
            batch.nodes.push(...b.nodes.map(n => ({ ...n, id: prefix + n.id })));
            batch.edges.push(...b.edges.map(e => ({ ...e, id: prefix + e.id, from: prefix + e.from, to: prefix + e.to })));
            batch.evidence.push(...b.evidence.map(e => ({ ...e, targetId: prefix + e.targetId })));
          });
          context.signal.throwIfAborted(); progress.stage = 'publishing'; show();
          const result = await ports.publish({ ref, batch, claimId, extractorVersion: EXTRACTOR_VERSION, signal: context.signal });
          if (!result.published && result.reason !== 'already-current') throw Object.assign(new Error(result.reason), { code: result.reason });
          refs.push({ kind: 'knowledge-material', id: ref.identity });
          progress.materials.push({ identity: ref.identity, status: 'complete' });
        } catch (error) {
          context.signal.throwIfAborted(); failed++;
          await mark(ref.identity, { status: error.code === 'stale-material' ? 'pending' : 'failed', reason: error.code || 'extraction-failed', claimId: null });
          progress.materials.push({ identity: ref.identity, status: 'failed', error: error.message });
        }
        progress.done++; show();
      }
      progress.stage = failed ? 'partial' : 'complete'; show();
      if (failed === input.materials.length) throw new Error('所选资料均提取失败，请查看逐资料状态后重试');
      return { refs, completeness: failed ? 'partial' : 'complete' };
    } finally {
      await ports.state.update(s => { for (const m of s.knowledgeMaterials) if (m.claimId === claimId) Object.assign(m, { status: context.signal.aborted ? 'cancelled' : 'failed', claimId: null }); }).catch(() => {});
      void ports.jobs?.wait(context.jobId).then(() => ports.onSettled?.()).catch(() => {});
    }
  },
};
