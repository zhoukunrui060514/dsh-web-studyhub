import { randomUUID } from 'node:crypto';

// The standalone preview owns its process tasks. This adapter implements the small
// native jobs surface used by dshJobExecutor; it never creates a real DSH Agent.
export function previewJobs(owner) {
  const records = new Map();
  const owned = (id, who) => {
    const record = records.get(id);
    if (!record || record.owner !== who) throw new Error('Preview job not found');
    return record;
  };
  return {
    start({ owner: who, run, label }) {
      if (who !== owner) throw new Error('Preview job owner mismatch');
      const id = randomUUID(), record = { id, owner, label, status: 'running', text: '', cancel: null };
      records.set(id, record);
      const execution = run({ append: text => { record.text += String(text); } });
      record.cancel = execution.cancel;
      Promise.resolve(execution.done).then(() => { record.status = 'completed'; }, () => { record.status = 'failed'; });
      return id;
    },
    get(id, who) { const { cancel: _cancel, ...view } = owned(id, who); return view; },
    kill(id, who, reason) { const record = owned(id, who); record.status = 'stopping'; return record.cancel?.(reason); },
    readAt(id, cursor = 0, who) { const record = owned(id, who); return { text: record.text.slice(cursor), cursor: record.text.length, status: record.status }; },
  };
}
