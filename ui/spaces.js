/* The five spaces of the redesign (docs/superpowers/specs/2026-10-20-studyhub-ia-ui-restructure.md §2): the sidebar names a space, the space
   header names its views, and every page of ui/pages.js belongs to exactly one space (or to none: settings and the task console live in the shell).
   Plain data, free of ui() and React, so a DOM-free test can read it; labels are Chinese source text passed through ui() where shown.

   views    the pages the space header switches between, in order; a view the host does not offer (ui/capabilities.js) is left out
   members  the other pages that sit inside the space (a run, a sub-page or a page on its way out) and keep it lit in the sidebar
   label    the sidebar entry; a view's own label is VIEW_LABELS[page]
   Pages the plan retires or merges (课堂实录, 备考补习, 知识骨架) stay views until their stage lands, so every stage ships with every feature reachable. */

export const SPACES = Object.freeze([
  { id: 'today', label: '今天', glyph: 'today', views: ['library'], members: ['review', 'workflows'] },
  { id: 'materials', label: '资料', glyph: 'sources', views: ['sources', 'audio', 'live', 'generate'], members: [] },
  { id: 'knowledge', label: '知识', glyph: 'knowledge', views: ['book', 'knowledge', 'examprep', 'skeleton'], members: ['outline', 'graph'] },
  { id: 'practice', label: '练习', glyph: 'practice', views: ['bank', 'wrongbook', 'exam'], members: ['draft', 'manage'] },
  { id: 'records', label: '记录', glyph: 'records', views: ['records', 'notes', 'dashboard', 'board'], members: [] },
]);

/** The label of a page where it is a view of a space (the space header's tab, the "返回…" words). */
export const VIEW_LABELS = Object.freeze({
  library: '今天',
  sources: '资料库', audio: '录音与转写', live: '课堂实录', generate: '生成',
  book: '大纲', knowledge: '概念网络', examprep: '备考补习', skeleton: '知识骨架',
  bank: '题库', wrongbook: '待巩固', exam: '考试',
  records: '学习记录', notes: '笔记', dashboard: '统计', board: '待办',
});

/** The view a sub-page stands under in its space header (the 总纲 under 大纲, a draft under 题库); pages left out show no header (a run, a session). */
export const MEMBER_VIEWS = Object.freeze({ outline: 'book', draft: 'bank', manage: 'bank', graph: 'book' });

/** The view of its space a page lights in the space header: itself when it is a view, its MEMBER_VIEWS entry otherwise, else undefined (no header). */
export const headerViewOf = (page) => (SPACES.some((space) => space.views.includes(page)) ? page : MEMBER_VIEWS[page]);

export const SPACE_IDS = Object.freeze(SPACES.map((space) => space.id));

/** The space a page sits in, or undefined (settings, the task console, a page nobody knows). */
export const spaceOf = (page) => SPACES.find((space) => space.views.includes(page) || space.members.includes(page));

/** A space by id. */
export const spaceById = (id) => SPACES.find((space) => space.id === id);

/** Is the page one of the views its space header switches between? */
export const isView = (page) => SPACES.some((space) => space.views.includes(page));

/** The label of a page as a view, or undefined for a page that is not one. */
export const viewLabelOf = (page) => (isView(page) ? VIEW_LABELS[page] : undefined);

/** The views of a space that are available here, given `available(page)`. */
export const viewsOf = (space, available = () => true) => (space?.views || []).filter((page) => available(page));

/** Where the sidebar entry of a space leads: the view last opened in it when it is still available, else its first available view. */
export function entryOf(space, { last, available = () => true } = {}) {
  const views = viewsOf(space, available);
  return views.includes(last) ? last : views[0];
}
