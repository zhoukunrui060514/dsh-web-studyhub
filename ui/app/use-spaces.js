import { useCallback, useEffect } from 'react';
import { pageAvailable } from '../capabilities.js';
import { browserSession, readJSON, writeJSON } from '../storage.js';
import { entryOf, isView, spaceById, spaceOf } from '../spaces.js';

/* The five spaces as the shell uses them: which one is lit, where its sidebar entry leads (the view last opened in it, this tab only), and the
   one way to open a page of a space. 复习全书 is the one view whose entry is decided by the host: the course's book when it has been written,
   else the 总纲 page that offers to write it (ui/book/model.js bookEntryPage). */

const KEY = 'study-space-views:v1';
const readLast = () => {
  const value = readJSON(KEY, undefined, browserSession());
  return value && typeof value === 'object' ? value : {};
};

/** Remember the view the learner is on, per space, for this tab. */
export function useRememberView(page) {
  useEffect(() => {
    if (!isView(page)) return;
    const space = spaceOf(page);
    const last = readLast();
    if (last[space.id] !== page) writeJSON(KEY, { ...last, [space.id]: page }, browserSession());
  }, [page]);
}

/**
 * @param data   the snapshot (what is available)
 * @param nav    the app's navigator
 * @param openBook  () => Promise<void>: opens 复习全书 the way its entry decides
 * @returns { current, available(page), entry(spaceId), go(spaceId), open(page) }
 */
export function useSpaces({ data, nav, openBook }) {
  const available = useCallback((page) => !!data && pageAvailable(data, page), [data]);
  const current = spaceOf(nav.navPage)?.id;
  const entry = useCallback((id) => entryOf(spaceById(id), { last: readLast()[id], available }), [available]);
  const open = useCallback((page) => {
    if (page === 'book') return openBook();
    nav.navigate(page, { animate: true, keepTrail: false, enter: 'user' });
    return undefined;
  }, [nav, openBook]);
  const go = useCallback((id) => { const page = entry(id); if (page) open(page); }, [entry, open]);
  return { current, available, entry, go, open };
}
