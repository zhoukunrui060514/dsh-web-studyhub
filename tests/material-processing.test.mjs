import test from 'node:test';
import assert from 'node:assert/strict';
import { materialProcessingPlan } from '../lib/material-processing.js';
test('conversion without materials cannot promise a ready import', () => {
  const plan = materialProcessingPlan({ sources: [] }, { kind: 'pdf' }, { conversion: true, materials: false });
  assert.equal(plan.steps[0].status, 'unavailable');
});
