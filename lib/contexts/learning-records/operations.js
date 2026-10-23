import { recordsQuery, recordGet, reinforcementQuery } from '../../learning-records.js';
import { sessionResults } from '../../learning-session-results.js';

export function createOperations({ state }) {
  return { handlers: {
    'learning.records.sessionResults': async args => sessionResults(await state.view(), args),
    'learning.records.query': async args => recordsQuery(await state.view(), args),
    'learning.records.get': async args => recordGet(await state.view(), args),
    'learning.reinforcement.query': async args => reinforcementQuery(await state.view(), args),
  }, mutations: {} };
}
