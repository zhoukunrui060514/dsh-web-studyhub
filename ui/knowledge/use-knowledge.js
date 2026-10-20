import { useCallback, useReducer, useRef, useState } from 'react';
import { useLiveEffect } from '../use-async.js';
import { initialKnowledgeView, reduceKnowledgeView } from './view-state.js';
export function useKnowledge({ call, act }) {
  const [view, dispatch] = useReducer(reduceKnowledgeView, initialKnowledgeView);
  const [filter, setFilter] = useState({ courseIds: [], materialIds: [], includeCrossCourse: false });
  const [query, setQuery] = useState(''), [materials, setMaterials] = useState([]), [courses, setCourses] = useState([]), [settings, setSettings] = useState({ autoBuild: false });
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useLiveEffect(isLive => {
    Promise.all([call('knowledge.materials'), call('knowledge.settings.get')]).then(([m, s]) => { if (isLive()) { setMaterials(m.materials); setCourses(m.courses); setSettings(s); } }, e => { if (isLive()) setError(e.message); });
  }, [call, version]);
  useLiveEffect(isLive => {
    const current = ++sequence.current;
    dispatch({ type: 'request', sequence: current }); setLoading(true);
    call('knowledge.query', { ...filter, query, ...(view.focusId ? { focusId: view.focusId, depth: view.depth } : {}) }).then(graph => {
      if (isLive() && current === sequence.current) { dispatch({ type: 'result', sequence: current, graph }); setError(''); }
    }, e => { if (isLive()) setError(e.message); }).finally(() => { if (isLive()) setLoading(false); });
  }, [call, filter, query, view.focusId, view.depth, version]);
  const write = useCallback(async (action, args) => {
    // call returns the domain receipt; act's shell wrapper catches errors and cannot be used as a receipt.
    const result = await call(action, args); refresh(); return result;
  }, [call, refresh]);
  return { view, dispatch, filter, setFilter, query, setQuery, materials, courses, settings, error, loading, refresh, write, act };
}
