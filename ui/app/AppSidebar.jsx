import React, { useLayoutEffect, useRef, useState } from 'react';
import { ui } from '../i18n.js';
import { SPACES } from '../spaces.js';
import { countDocuments } from '../../lib/source-groups.js';
import { NavItem } from '../SideNav.jsx';
import UpdateCenter from '../UpdateCenter.jsx';
import { Button, Icon } from '../components/index.js';
import { useInjectCss } from '../shared.js';
import css from './app-shell.css';
import { useApp } from './app-context.js';

/** What the number beside a space says: the documents of 资料, the overdue and due-today cards of 记录's board. */
function spaceHint(id, { data, board }) {
  if (id === 'materials' && data) { const n = countDocuments(data.sources); return n > 0 ? n : undefined; }
  if (id === 'records' && board.due.overdue + board.due.today > 0) return board.due.overdue + board.due.today;
  return undefined;
}

/* The sidebar of the redesign: the five spaces (ui/spaces.js), then settings. Nothing is grouped, folded or reordered: five rows fit any window.
   Language, appearance and the feature tour live in 设置; the update notice stays at the foot because it is news, not a setting. */
export default function AppSidebar() {
  useInjectCss(css, 'study-app-shell');
  const { data, host, core, shell, nav, board, spaces } = useApp();
  const { sidebarNarrow } = shell;
  const navRef = useRef(null), [navMark, setNavMark] = useState(null);
  /* One highlight glides to the active space instead of each row switching its own background, so a change of space reads as movement. */
  useLayoutEffect(() => {
    const element = navRef.current;
    if (!element) return undefined;
    const measure = () => {
      const active = element.querySelector('.nav[aria-current="page"]');
      setNavMark((mark) => {
        const next = active ? { top: active.offsetTop, height: active.offsetHeight } : null;
        return mark?.top === next?.top && mark?.height === next?.height ? mark : next;
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [spaces.current, sidebarNarrow, !!data]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleLabel = sidebarNarrow ? ui('展开侧边栏') : ui('收起侧边栏');
  return (
    <aside className={sidebarNarrow ? 'sidebar is-narrow' : 'sidebar'}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><Icon name="brand" size={26} /></span>
        <div>{ui('StudyHub')}</div>
        <Button variant="quiet" size="sm" className="collapse-toggle" data-usage="nav.collapse" aria-label={toggleLabel} aria-expanded={!sidebarNarrow}
          title={toggleLabel} onClick={() => shell.setSidebarCollapsed((value) => !value)}>
          <Icon name={sidebarNarrow ? 'arrow-right' : 'arrow-left'} size={14} />
        </Button>
      </div>
      <nav ref={navRef} className="side-nav side-spaces" data-tour="nav" aria-label={ui('空间')}>
        {navMark && <span className="nav-mark" aria-hidden="true" style={{ transform: `translateY(${navMark.top}px)`, height: navMark.height }} />}
        {SPACES.map((space) => {
          const target = spaces.entry(space.id), label = ui(space.label), hint = spaceHint(space.id, { data, board });
          return (
            <NavItem key={space.id} data-space={space.id} data-tour={`nav-${space.id}`} data-usage={`nav.${space.id}`} active={spaces.current === space.id}
              glyph={space.glyph} label={label} title={sidebarNarrow ? label : undefined} disabled={!target} hint={hint}
              hintClass={space.id === 'records' && hint ? 'nav-count is-due' : 'nav-count'} onClick={() => spaces.go(space.id)} />
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <UpdateCenter call={core.call} host={host} compact={sidebarNarrow} />
        <NavItem glyph="settings" label={ui('设置')} active={nav.navPage === 'settings'} title={sidebarNarrow ? ui('设置') : undefined} data-tour="nav-settings" data-usage="nav.settings"
          onClick={() => nav.navigate('settings', { animate: true, keepTrail: false })} />
      </div>
    </aside>
  );
}
