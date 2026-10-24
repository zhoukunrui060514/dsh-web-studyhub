import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { serializeJsonFile } from '../../../atomic-json.js';
import { imageReceipts } from '../../../jobs/image-receipts.js';
import { planAi } from './plan.js';
import { contentDigest } from './version.js';
import { COURSE_BOOK_IMAGE_KIND } from './jobs/course-book-image.js';

const fail = (code, message = code) => { throw Object.assign(new Error(message), { code }); };
export function createIllustrate(ports) {
  const { root, runtime, read, materials, work } = ports, receipts = imageReceipts(root);
  const active = entry => entry?.jobId && ['queued', 'running', 'cancelling'].includes(work.jobs.get(entry.jobId)?.status);
  const payloadOf = args => Object.fromEntries(['course', 'heading', 'words', 'instruction', 'after', 'replace', 'language', 'figurePlan', 'sourceRevision', 'expectedBlockRevision'].filter(k => args[k] !== undefined).map(k => [k, args[k]]));
  async function illustrate(args, request = {}) {
    if (!request.imageModel?.generate) fail('image-model-unavailable', '请先配置图像模型服务');
    return serializeJsonFile(join(root, '.jobs/image-admission'), async () => {
      await receipts.reconcile(active);
      const previous = await receipts.get(args.requestId), payload = payloadOf(args);
      let plan = previous?.plan;
      if (!plan) plan = planAi(await read(), { ...args, mode: args.words ? 'explain' : 'here', instruction: args.instruction || '画图解释这个知识点' });
      if (args.sourceRevision && args.sourceRevision !== plan.guard.sourceRevision || args.expectedBlockRevision && args.expectedBlockRevision !== plan.guard.expectedBlockRevision) fail('course-book-target-stale', '原讲解已经变动，请重新发起配图');
      let entry = await receipts.admit(args.requestId, payload, { plan, fingerprint: contentDigest([payload, plan.guard, request.imageModel.route]) });
      if (entry.status === 'committed') return { status: 'complete', blockId: entry.receipt.blockId, jobId: entry.jobId };
      if (active(entry)) return { status: 'running', blockId: entry.payload.replace || `img${entry.id.replaceAll('-', '')}`, jobId: entry.jobId };
      if (['sending', 'unknown'].includes(entry.status)) fail('image-result-unknown', '图像请求的结果未知，未再次发送；如需重新生成，请发起新请求');
      if (entry.status === 'failed') fail('image-request-failed', '这次图像请求已失败，请重新生成');
      const blockId = entry.payload.replace || `img${entry.id.replaceAll('-', '')}`;
      const input = { receiptId: entry.id, runId: randomUUID(), course: entry.plan.course, heading: entry.plan.leaf.hid, blockId, title: `画图解释 · ${entry.plan.leaf.title}` };
      const bindings = { courseBookImage: { root, receipts, imageModel: request.imageModel,
        write: block => materials('materials.book.aiWrite', block, request) } };
      const started = await runtime.jobs.submit(COURSE_BOOK_IMAGE_KIND, input, { executionTimeoutMs: 330000 }, bindings);
      await receipts.job(entry.id, started.runtime.legacyId);
      entry = await receipts.get(entry.id);
      return { status: entry.status === 'committed' ? 'complete' : 'running', jobId: started.runtime.legacyId, blockId };
    });
  }
  return { illustrate, async status(args, request = {}) {
    const entry = args.requestId ? await receipts.get(args.requestId) : null;
    return { available: !!request.imageModel?.generate, ...(entry ? { status: entry.status, jobId: entry.jobId, blockId: entry.receipt?.blockId, error: entry.error } : {}) };
  } };
}
