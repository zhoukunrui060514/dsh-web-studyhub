import { join } from 'node:path';
import { serializeJsonFile } from '../../atomic-json.js';
import { documentTopUp } from '../../coverage-state.js';
import { kindOf } from '../../job-contract.js';

/** Batch admission only; generation, coverage rounds and publication remain the existing pipeline. */
export function startUncovered({ root, read, generate, jobs, activeJob }, args) {
  if (!Array.isArray(args.documentIds) || !args.documentIds.length || args.documentIds.some(id => typeof id !== 'string' || !id))
    throw new Error('请选择需要补题的资料');
  return serializeJsonFile(join(root, '.jobs/uncovered-admission'), async () => {
    const result = { started: [], skipped: [], failed: [] };
    for (const documentId of new Set(args.documentIds)) {
      const found = documentTopUp(await read(), { documentId });
      const held = found?.coverage.sections.filter(section => section.evidenceIssue).map(section => ({
        key: section.key, sourceId: section.sourceId, title: section.title, page: section.page, reason: section.evidenceIssue,
      })) || [];
      const working = found && [...jobs.values()].some(job => job.root === root && activeJob(job) &&
        ((job.documentKey || job.part?.documentKey) === found.item.key || kindOf(job) === 'generation' && job.sourceIds?.some(id => found.item.sourceIds.includes(id))));
      if (!found || found.item.archived || working || !found.round.sections) {
        result.skipped.push({ documentId, reason: !found ? 'missing' : found.item.archived ? 'archived' : working || found.inFlight ? 'in-flight' : held.length ? 'no-evidence' : 'covered',
          ...(held.length ? { title: found.item.title, held } : {}) }); continue;
      }
      try {
        const started = await generate({ documentId: found.item.key, ...(found.candidates[0] ? { partOf: found.candidates[0].id } : {}), coverage: { autoComplete: true } });
        result.started.push({ documentId: found.item.key, title: found.item.title, jobId: started.jobId, sections: found.round.uncovered, ...(held.length ? { held } : {}) });
      } catch (error) { result.failed.push({ documentId, title: found.item.title, error: error.message }); }
    }
    return result;
  });
}
