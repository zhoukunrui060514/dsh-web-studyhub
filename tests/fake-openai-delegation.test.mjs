import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeOpenAI } from '../scripts/qa/fake-openai.mjs';
import { reviewPrompts } from '../lib/generation.js';

test('DSH delegated review keeps candidate JSON separate from the instruction schema', async t => {
  const server = await createFakeOpenAI(); t.after(() => server.close());
  const { system, payload } = reviewPrompts({ sources: [], deck: { cards: [{ id: 'candidate-one', kind: 'flashcard' }] }, kind: 'flashcard', count: 1, structuralErrors: [] });
  const marker = '\n\nComplete only this bounded assessment task. Return the requested JSON as your final answer.\n\n';
  for (const delegated of [true, false]) {
    const messages = [{ role: 'system', content: delegated ? 'You are a StudyHub background worker.' : system },
      { role: 'user', content: delegated ? system + marker + payload : payload }];
    const response = await fetch(`${server.url}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'fake-tutor', messages }) });
    const body = await response.json(), review = JSON.parse(body.choices[0].message.content);
    assert.deepEqual(review.checks.map(c => c.cardId), ['candidate-one']);
  }
});
