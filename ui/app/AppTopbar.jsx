import React, { useContext } from 'react';
import { ui, uiFormat } from '../i18n.js';
import { isTransientStudyError } from '../transport.js';
import PageScope, { CourseChangeContext } from '../PageScope.jsx';
import { spaceOf, viewLabelOf } from '../spaces.js';
import { useTaskBadge } from '../tasks/use-task-badge.js';
import { Button, Icon } from '../components/index.js';
import { useApp } from './app-context.js';
import { rankCourses } from '../course-names.js';

/** The folder a learner recognises: the default library is a hidden folder inside its workspace. */
export function libraryFolderName(root) {
  const text = String(root || '');
  const parts = text.split(/[\\/]+/).filter(Boolean);
  const last = parts.at(-1) || text;
  return last === '.dsh-study' && parts.length > 1 ? parts.at(-2) : last;
}

/** Top-bar "学习库：<folder>" (P03): where the library lives, one click from the folder control in Settings (学习库与模型). */
export function LibraryChip({ root, onOpen }) {
  if (!root) return null;
  return (
    <Button variant="quiet" size="sm" className="library-location" title={root} aria-label={uiFormat('学习库位置：{0}。打开设置可更改', [root])} onClick={onOpen}>
      <Icon name="folder" size={14} />
      <span>{uiFormat('学习库：{0}', [libraryFolderName(root)])}</span>
    </Button>
  );
}

function statusText({ busy, running, publishing, syncIssue, data }) {
  if (busy) return ui('正在保存…');
  if (running) return publishing ? ui('正在发布…') : ui('正在生成…');
  if (syncIssue) return isTransientStudyError({ message: syncIssue }) ? ui('连接中断，正在重试…') : ui('学习库读取失败');
  return data ? ui('已连接') : ui('待连接');
}

/** What the number on the task entry says: what is running, and what ended since the console was last opened. */
const taskTitle = ({ running, unseen, failed }) => [ui('后台任务'), running > 0 ? uiFormat('{0} 个任务正在进行', [running]) : '',
  unseen > 0 ? (failed > 0 ? uiFormat('{0} 个任务有新结果，其中 {1} 个没有完成', [unseen, failed]) : uiFormat('{0} 个任务有新结果', [unseen])) : ''].filter(Boolean).join(' · ');

/** The course every page follows (L0 of the redesign): picked here once, instead of a scope picker on each page. */
export function CourseSwitch() {
  const { data, core } = useApp();
  const guard = useContext(CourseChangeContext);
  const courses = rankCourses({ courses: data?.focus?.courses || [], current: data?.focus?.course });
  if (!courses.length) return null;
  const value = data.focus?.course ?? '*';
  return (
    <div className="top-course" data-tour="top-course">
      <PageScope courses={courses} value={value} unassigned={courses.some(course => course.name === '')} label={<span className="sh-visually-hidden">{ui('当前课程')}</span>}
        onChange={(next) => {
          if (next === value) return;
          const change = () => { void core.act('focus.set', { course: next }); };
          if (guard?.current) guard.current(change); else change();
        }} />
    </div>
  );
}

/** The top bar: where the page sits (space › page), the course every page follows, whether the host is working, the background tasks and the mailbox. */
export default function AppTopbar({ title }) {
  const { data, core, nav, connection, settingsEntry } = useApp();
  const { busy } = core;
  const { binding, running, publishing, syncIssue } = connection;
  const idle = !busy && !running && !syncIssue && data;
  const space = spaceOf(nav.navPage);
  // A view says its own name (题库, 待巩固); the space's only view says nothing more than the space.
  const view = viewLabelOf(nav.navPage), crumb = view ? ui(view) : title;
  const tasks = useTaskBadge({ root: data?.root, data, viewing: nav.navPage === 'tasks' });
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label={ui('位置')}>
        {space ? <span className="crumb">{ui(space.label)}</span> : <span className="crumb">{ui('StudyHub')}</span>}
        {crumb && (space ? ui(space.label) !== crumb : true) && <>
          <span className="breadcrumb" aria-hidden="true"><Icon name="arrow-right" size={12} /></span>
          <span className="crumb" aria-current="page">{crumb}</span>
        </>}
      </nav>
      {data && <CourseSwitch />}
      <div className="top-right">
        <LibraryChip root={binding.root} onOpen={() => { settingsEntry.setSettingsFocus('settings-model'); nav.navigate('settings', { animate: true, keepTrail: false }); }} />
        <span className={'top-status' + (idle ? ' idle' : '')} role="status" title={syncIssue || undefined}>
          <i className={`dot ${busy || running ? 'busy' : data && !syncIssue ? 'is-online' : ''}`} aria-hidden="true" />
          <span className="top-status-label">{statusText({ busy, running, publishing, syncIssue, data })}</span>
        </span>
        {data && (
          <Button variant="quiet" size="sm" className={'top-tasks' + (tasks.failed > 0 ? ' is-failed' : tasks.total > 0 ? ' is-live' : '')} data-tour="nav-tasks" data-usage="nav.tasks"
            aria-current={nav.navPage === 'tasks' ? 'page' : undefined} title={taskTitle(tasks)} aria-label={taskTitle(tasks)}
            onClick={() => nav.navigate('tasks', { animate: true, keepTrail: false, enter: 'user' })}>
            <Icon name="activity" size={16} />
            {tasks.total > 0 && <span className="top-tasks__count">{tasks.total}</span>}
          </Button>
        )}
      </div>
    </header>
  );
}
