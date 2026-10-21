import { digest, pageOf, fail } from './curriculum.js';
import { win32 } from 'node:path';
import { jobContract } from './job-contract.js';

const clip = value => String(value ?? '').slice(0, 240);
const rootKey = value => win32.resolve(value).toLowerCase();

/** Read projections only; every write action names the original owner. */
export function activityQuery(state, jobs, args = {}, { root, board } = {}) {
  const rows = new Map(), aliases = new Map();
  for (const job of jobs.filter(j => j.root === root)) {
    const contract = job.contract ?? job.restoredContract ?? jobContract(job);
    const id = contract?.jobId ?? job.batchId ?? job.singleId ?? job.id;
    const at = job.finishedAt ?? job.startedAt ?? '';
    const key = `job:${id}`, previous = rows.get(key);
    const refs = contract?.result?.refs ?? [];
    const row = { type: 'job', id, at, status: contract?.status ?? job.status, title: clip(contract?.title ?? job.title ?? job.filename),
      kind: contract?.kind ?? job.type ?? 'generation', notifications: [], drafts: [...new Set([job.draftId, ...refs.filter(r => r.kind === 'draft').map(r => r.id)].filter(Boolean))],
      actions: Object.entries(contract?.actions ?? {}).filter(([, value]) => value.available).map(([action]) => ({ operation: 'job.control', args: { jobId: job.id, action } })) };
    if (!previous || String(at) >= String(previous.at)) rows.set(key, row);
    for (const alias of [id, job.id, job.batchId, job.singleId, job.runtime?.legacyId, contract?.attemptId].filter(Boolean)) aliases.set(alias, key);
  }
  for (const item of state.inbox) {
    const key = aliases.get(item.jobId) ?? (item.jobId ? `notification:job:${item.jobId}` : `notification:${item.id}`);
    let row = rows.get(key);
    if (!row) { row = { type: 'notification', id: item.jobId ?? item.id, at: item.at, status: 'notified', title: clip(item.detail), kind: item.kind, notifications: [], drafts: [], actions: [] }; rows.set(key, row); }
    row.notifications.push({ id: item.id, read: !!item.read });
    row.actions.push({ operation: 'inbox.mark', args: { ids: [item.id] } });
  }
  for (const row of rows.values()) for (const id of row.drafts) if (state.drafts.some(draft => draft.id === id))
    row.actions.push({ operation: 'draft.publish.plan', args: { id } });
  const included = new Set([...rows.values()].flatMap(row => row.drafts));
  for (const draft of state.drafts) if (!included.has(draft.id)) rows.set(`draft:${draft.id}`, { type: 'draft', id: draft.id,
    at: draft.updatedAt ?? draft.createdAt ?? '', status: 'draft', title: clip(draft.title), notifications: [], drafts: [draft.id],
    actions: [{ operation: 'draft.publish.plan', args: { id: draft.id } }] });
  const completed = new Set((board?.columns ?? []).filter(column => column.done).flatMap(column => column.cardIds));
  if (board) for (const task of Object.values(board.cards)) if (task.studyRef?.root && rootKey(task.studyRef.root) === rootKey(root))
    rows.set(`task:${task.id}`, { type: 'task', id: task.id, at: task.updatedAt ?? task.createdAt ?? '', status: completed.has(task.id) || task.learningTask?.completedDate ? 'done' : 'todo',
      title: clip(task.title), notifications: [], drafts: [], studyRef: task.studyRef,
      actions: [{ owner: 'host', operation: 'board.get', args: {} }] });
  const items = [...rows.values()].filter(row => (!args.type || row.type === args.type) && (!args.status || row.status === args.status))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)) || `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
  try { return pageOf(items, args, digest([root, args.type ?? null, args.status ?? null, !!args.includeTasks, items])); }
  catch (error) { if (error.code === 'curriculum-cursor-stale') fail('activity-cursor-stale'); throw error; }
}

export const activitySchema = {
  input: { type: 'object', properties: {
    type: { type: 'string', enum: ['job', 'notification', 'draft', 'task'] }, status: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: { type: 'string' }, includeTasks: { type: 'boolean' },
  }, additionalProperties: false }, output: { type: 'object', additionalProperties: true },
  description: 'Read a bounded activity projection of this library; fold job letters by stable identity. Optional host tasks stay in the host and actions retain their owners.',
};
