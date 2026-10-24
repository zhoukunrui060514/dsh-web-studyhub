import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageReceipts } from '../lib/jobs/image-receipts.js';
test('durable admission, payload conflicts, active aliases and unknown send survive recreation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-receipts-'));
  try {
    let receipts = imageReceipts(root);
    const [a, b] = await Promise.all([receipts.admit('a', { prompt: 'p' }), receipts.admit('b', { prompt: 'p' })]);
    assert.equal(a.id, b.id); assert.equal(a.fresh, true); assert.equal(b.fresh, false);
    await assert.rejects(receipts.admit('a', { prompt: 'different' }), { code: 'image-request-conflict' });
    await receipts.sending(a.id); receipts = imageReceipts(root);
    assert.equal((await receipts.get('b')).status, 'sending');
    await assert.rejects(receipts.sending(a.id), { code: 'image-result-unknown' });
    await receipts.result(a.id, { id: 'hash' }); await receipts.committed(a.id, { blockId: 'block' });
    assert.equal((await receipts.admit('a', { prompt: 'p' })).receipt.blockId, 'block');
    assert.notEqual((await receipts.admit('regenerate', { prompt: 'p' })).id, a.id);
    assert.equal((await receipts.get('b')).status, 'committed');
  } finally { await rm(root, { recursive: true, force: true }); }
});
