import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/app-context.js';
import { useInjectCss } from '../shared.js';
import { createSessionWriter, decisionDestination, sessionScope } from './model.js';
import SessionPanel from './SessionPanel.jsx';
import css from './loop.css';

const LearningContext = createContext(null);
export const useLearning = () => useContext(LearningContext);

export default function LearningProvider({ children }) {
  const { data, core, nav, learn, session } = useApp();
  const identity = JSON.stringify([data?.root, data?.focus?.course]);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  const [sessionId, setSessionId] = useState(null);
  const write = useMemo(() => createSessionWriter(core.call), [core.call]);
  useInjectCss(css, 'study-learning-loop');
  const api = {
    openSession: setSessionId,
    startSession: async args => { const result = await write('learning.session.start', { ...args, scope: sessionScope(args.scope) }); if (currentIdentity.current !== identity) return; setSessionId(result.id); await core.refresh(); },
    openDecision: async decision => {
      const { operation, args } = decision.action;
      const destination = decisionDestination(operation);
      if (destination === 'session') { setSessionId(args.id); return; }
      if (destination === 'materials') { nav.navigate('sources'); return; }
      if (destination === 'source') { await learn.openLearningTarget({ kind: 'source', id: args.id }); return; }
      if (destination === 'legacy') { nav.show.workflow(args.id); return; }
      const run = await core.call(operation, args);
      if (currentIdentity.current !== identity) return;
      learn.rememberContext(learn.captureContext()); session.enterRun(run);
    },
  };
  return <LearningContext.Provider value={api}>{children}
    {sessionId && <SessionPanel key={sessionId} id={sessionId} onClose={() => setSessionId(null)} />}
  </LearningContext.Provider>;
}
