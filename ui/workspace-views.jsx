import { deferredView } from './deferred-view.jsx';

// A view owns its loading boundary, so unrelated study surfaces stay visible.
export const BlogNotes = deferredView(() => import("./BlogNotes.jsx"));
export const Skeleton = deferredView(() => import("./Skeleton.jsx"));
export const Workflows = deferredView(() => import("./Workflows.jsx"));
export const Graph = deferredView(() => import("./Graph.jsx"));
export const Knowledge = deferredView(() => import('./knowledge/KnowledgePage.jsx'));
export const TaskConsole = deferredView(() => import("./tasks/TaskConsole.jsx"));
export const DocumentViewer = deferredView(() => import("./document-preview/DocumentViewer.jsx"));
