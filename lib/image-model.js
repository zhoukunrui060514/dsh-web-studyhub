import http from 'node:http';
import https from 'node:https';
import { validateBookImage } from './book-assets.js';

export const IMAGE_TIMEOUT_MS = 300000;
const failure = (code, message = code) => Object.assign(new Error(message), { code });
/** Dedicated server-side capability. A paid HTTP request has no automatic retry. */
export function imageModel({ baseUrl, apiKey, model = 'gpt-image-2' } = {}) {
  if (!baseUrl || !apiKey) return undefined;
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/images/generations`), route = { provider: 'image-http', model };
  return Object.freeze({ route, async generate({ prompt, size = '1024x1024', quality = 'medium' }, signal) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(IMAGE_TIMEOUT_MS), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const body = JSON.stringify({ model, prompt, size, quality, n: 1, output_format: 'webp', response_format: 'b64_json' });
    const data = await new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(url, { method: 'POST', signal: combined,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
        const chunks = []; let bytes = 0;
        response.on('data', chunk => { bytes += chunk.length; if (bytes > 12 * 1024 * 1024) response.destroy(failure('image-response-too-large')); else chunks.push(chunk); });
        response.on('error', reject);
        response.on('end', () => {
          if (response.statusCode !== 200) return reject(failure('image-upstream-failed', `图像服务返回 ${response.statusCode}`));
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(failure('image-response-invalid')); }
        });
      });
      request.on('error', reject); request.end(body);
    });
    const encoded = data?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string') throw failure('image-response-invalid');
    const bytes = Buffer.from(encoded, 'base64'), asset = validateBookImage(bytes);
    return { bytes, mime: asset.mime, route, usage: data.usage || null };
  } });
}
export function imageModelFromEnv(env = process.env) {
  return imageModel({ baseUrl: env.STUDY_IMAGE_BASE_URL || env.STUDY_BASE_URL,
    apiKey: env.STUDY_IMAGE_API_KEY || env.STUDY_API_KEY, model: env.STUDY_IMAGE_MODEL || 'gpt-image-2' });
}
