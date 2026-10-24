import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicJson, readJsonFile, serializeJsonFile } from '../atomic-json.js';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
/** Paid-request receipts use the Jobs file writer. Kept independently of console cleanup;
 * they are runtime state, never portable learning content. */
export function imageReceipts(root) {
  const directory = join(root, '.jobs'), file = join(directory, 'image-receipts.json');
  const change = operation => serializeJsonFile(file, async () => {
    await mkdir(directory, { recursive: true });
    let store;
    try { store = await readJsonFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; store = { version: 1, requests: {}, entries: {} }; }
    const result = await operation(store); await atomicJson(file, store); return structuredClone(result);
  });
  const update = (id, fn) => change(store => { const entry = store.entries[id]; if (!entry) fail('image-receipt-missing'); fn(entry); return entry; });
  return Object.freeze({
    admit(requestId, payload, { fingerprint, plan } = {}) {
      if (typeof requestId !== 'string' || !requestId || requestId.length > 160) fail('image-request-id-required');
      const payloadHash = hash(payload);
      return change(store => {
        const previous = store.requests[requestId];
        if (previous && previous.hash !== payloadHash) fail('image-request-conflict');
        if (previous) return { ...store.entries[previous.id], fresh: false };
        let entry = Object.values(store.entries).find(item => item.fingerprint === (fingerprint || payloadHash) && ['admitted', 'sending', 'result'].includes(item.status));
        const fresh = !entry;
        entry ||= { id: randomUUID(), hash: payloadHash, fingerprint: fingerprint || payloadHash, status: 'admitted', payload, ...(plan ? { plan } : {}), createdAt: new Date().toISOString() };
        store.entries[entry.id] = entry; store.requests[requestId] = { id: entry.id, hash: payloadHash };
        return { ...entry, fresh };
      });
    },
    get: requestId => serializeJsonFile(file, async () => {
      try { const store = await readJsonFile(file); return structuredClone(store.entries[store.requests[requestId]?.id] || store.entries[requestId] || null); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }),
    sending: id => update(id, entry => { if (entry.status !== 'admitted') fail('image-result-unknown'); entry.status = 'sending'; }),
    result: (id, asset) => update(id, entry => { entry.asset = asset; entry.status = 'result'; }),
    committed: (id, receipt) => update(id, entry => { entry.receipt = receipt; entry.status = 'committed'; }),
    failed: (id, code) => update(id, entry => { if (entry.status === 'admitted') entry.status = 'failed'; else if (entry.status === 'sending') entry.status = 'unknown'; entry.error = code; }),
    reconcile: active => change(store => { for (const entry of Object.values(store.entries)) if (entry.status === 'sending' && !active(entry)) entry.status = 'unknown'; return null; }),
    job: (id, jobId) => update(id, entry => { entry.jobId = jobId; }),
  });
}
