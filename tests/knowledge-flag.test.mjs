import test from 'node:test';
import assert from 'node:assert/strict';
import { pageAvailable } from '../ui/capabilities.js';

test('the material knowledge graph page waits behind the knowledgeGraph feature (experimental features or the host switch)', () => {
  const data = { contexts: ['knowledge'] };
  assert.equal(pageAvailable(data, 'knowledge'), false);
  assert.equal(pageAvailable({ ...data, features: { knowledgeGraph: false } }, 'knowledge'), false);
  assert.equal(pageAvailable({ ...data, features: { knowledgeGraph: true } }, 'knowledge'), true);
});
