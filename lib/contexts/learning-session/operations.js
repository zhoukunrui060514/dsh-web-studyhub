import { sessionStart, sessionGet, sessionRecord, sessionPause, sessionAdvance, sessionPractice } from '../../learning-session.js';
import { projection } from '../../study-state.js';
import { learningError } from '../../learning-session-target.js';
import { sessionMove, sessionFinish, sessionPracticeV2 } from '../../learning-session-v2.js';

export function createOperations({ state, ports }) {
  const practice = action => async args => state.update(snapshot => {
    const legacy = snapshot.learningSessions.find(s => s.id === args.id)?.schemaVersion === 1;
    const result = legacy && action === 'start' ? sessionPractice(snapshot, args, ports.mutate) : sessionPracticeV2(snapshot, args, ports.mutate, action);
    const run = result.runId ? snapshot.runs.find(run => run.id === result.runId) : null;
    return { status: result.status, ...(result.reason ? { reason: result.reason } : {}), session: result.session, run: run ? projection(snapshot, run) : null };
  });
  return { handlers: {
    'learning.session.legacy.export': async args => {
      const snapshot = await state.view();
      const legacy = snapshot.workflowSessions.find(session => session.id === args.id);
      if (!legacy) learningError('learning-legacy-unavailable');
      const json = JSON.stringify(legacy, null, 2);
      return { id: legacy.id, format: args.format ?? 'json', content: args.format === 'markdown'
        ? `# ${legacy.template?.title || legacy.topic || legacy.id}\n\n原始流程、记录与历史：\n\n\`\`\`json\n${json}\n\`\`\`\n` : json };
    },
    'learning.session.get': async args => sessionGet(await state.view(), args),
    'learning.session.practice.start': practice('start'),
    'learning.session.practice.next': practice('next'),
    'learning.session.practice.close': practice('close'),
    'learning.session.finish': async args => state.update(snapshot => sessionFinish(snapshot, args, ports.mutate)),
  }, mutations: {
    'learning.session.start': sessionStart, 'learning.session.record': sessionRecord,
    'learning.session.advance': sessionAdvance, 'learning.session.pause': sessionPause,
    'learning.session.move': sessionMove,
  } };
}
