import { recordsQuery, recordGet, reinforcementQuery } from '../../learning-records.js';

export function createOperations({ state }) {
  return { handlers: {
    'learning.records.query': async args => recordsQuery(await state.view(), args),
    'learning.records.get': async args => recordGet(await state.view(), args),
    'learning.reinforcement.query': async args => reinforcementQuery(await state.view(), args),
  }, mutations: {} };
}
