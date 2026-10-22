import { useEffect, useState } from 'react';
import { errorMessage } from '../i18n.js';

// Retain content during a same-scope refresh; a scope change fences both display and late replies.
export function useQuery(call, operation, args, identity, enabled = true, refreshVersion = null) {
  const key = JSON.stringify([identity, operation, args]);
  const [state, setState] = useState({ key, value: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    if (!enabled) return;
    setState(previous => ({ key, value: previous.key === key ? previous.value : null, loading: true, error: '' }));
    call(operation, JSON.parse(key)[2]).then(value => {
      if (live) setState({ key, value, loading: false, error: '' });
    }, error => {
      if (live) setState(previous => ({ ...previous, key, loading: false, error: errorMessage(error) }));
    });
    return () => { live = false; };
  }, [call, key, revision, enabled, operation, refreshVersion]);
  return { ...(state.key === key ? state : { value: null, loading: enabled, error: '' }),
    refresh: () => setRevision(value => value + 1) };
}
