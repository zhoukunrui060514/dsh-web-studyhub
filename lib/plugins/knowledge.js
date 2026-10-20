import { acquireContexts } from '../runtime/lifecycle.js';
export const name = 'studyhub-knowledge';
export const inject = [];
export function apply(ctx) { acquireContexts(ctx, ['knowledge']); }
