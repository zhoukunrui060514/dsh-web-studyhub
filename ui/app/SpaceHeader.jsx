import React from 'react';
import { ui } from '../i18n.js';
import { VIEW_LABELS, headerViewOf, spaceOf, viewsOf } from '../spaces.js';
import { useInjectCss } from '../shared.js';
import css from './space-header.css';
import { useApp } from './app-context.js';

/* The space header (L1 of the redesign's hierarchy): the views of the space the page sits in, as one row of links under the top bar. A space with one
   available view has nothing to switch and draws nothing; so does a page that is no view (a practice run, a learning session, settings).
   The links navigate between pages, so they are a <nav> of buttons with aria-current, not a tablist. */
export default function SpaceHeader({ page }) {
  useInjectCss(css, 'study-space-header');
  const { spaces } = useApp();
  const lit = headerViewOf(page), space = lit ? spaceOf(lit) : undefined;
  const views = viewsOf(space, spaces.available);
  if (!space || views.length < 2) return null;
  return (
    <nav className="space-header" aria-label={ui(space.label)} data-space={space.id}>
      {views.map((view) => (
        <button key={view} type="button" className="space-header__view" data-view={view} data-tour={`nav-${view}`} data-usage={`nav.${view}`}
          aria-current={view === lit ? 'page' : undefined} onClick={() => { if (view !== page) spaces.open(view); }}>
          {ui(VIEW_LABELS[view])}
        </button>
      ))}
    </nav>
  );
}
