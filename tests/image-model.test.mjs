import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { imageModel, IMAGE_TIMEOUT_MS } from '../lib/image-model.js';
import { PNG } from './helpers/book-image.mjs';
test('image adapter uses actual PNG, server usage, one request and cancellation', async () => {
  let calls = 0, payload;
  const server = createServer(async (req, res) => { calls++; let body = ''; for await (const c of req) body += c; payload = JSON.parse(body); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }], usage: { input_tokens: 7, output_tokens: 11 } })); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const model = imageModel({ baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey: 'test', model: 'gpt-image-2' });
    const result = await model.generate({ prompt: 'mechanism' });
    assert.equal(result.mime, 'image/png'); assert.deepEqual(result.bytes, PNG); assert.equal(calls, 1); assert.equal(payload.model, 'gpt-image-2'); assert.equal(payload.output_format, 'webp');
    assert.equal(result.usage.input_tokens, 7); assert.equal(IMAGE_TIMEOUT_MS, 300000);
    const c = new AbortController(); c.abort(); await assert.rejects(model.generate({ prompt: 'x' }, c.signal)); assert.equal(calls, 1);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
test('upstream failures are never automatically retried', async () => {
  let calls = 0; const server = createServer((req, res) => { calls++; res.writeHead(503); res.end('{}'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await assert.rejects(imageModel({ baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'x' }).generate({ prompt: 'x' })); assert.equal(calls, 1); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
