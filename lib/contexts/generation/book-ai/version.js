import { createHash } from 'node:crypto';
import { genFile, mineFile, recordOf } from '../../../course-book-files.js';
import { aiBlocks, anchorIn, withoutAiBlocks } from '../../../course-book-ai-text.js';
import { buildOutlineIndex } from '../../../course-outline-index.js';
import { documentIndex, leafSegments } from '../../../course-book-inputs.js';

export const contentDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const blockRevision = block => contentDigest([block.id, block.at, block.about, block.body, block.mode, block.ask]);
const fail = () => { throw Object.assign(new Error('资料或目标内容已变化，请重新打开这一节'), { code: 'course-book-target-stale' }); };
const leaves = nodes => (nodes || []).flatMap(n => n.leaf ? [n] : leaves(n.children));
export function sourceRevision(state, course, leaf) {
  return contentDigest(leafSegments(new Map(state.sources.map(s => [s.id, s])), documentIndex(buildOutlineIndex(state, { course }).allDocuments), leaf.anchors || []));
}
export function captureBookTarget(state, plan) {
  const doc = recordOf(state, plan.course).bookDoc, parentId = plan.replace || plan.after;
  const parent = parentId ? aiBlocks(doc.files[mineFile(plan.leaf.id)]?.text).find(b => b.id === parentId) : null;
  if (parentId && !parent) fail();
  let targetAnchor = null;
  if (plan.mode !== 'here' && !parent) {
    const matches = [genFile(plan.leaf.id), mineFile(plan.leaf.id)].flatMap(file => {
      const text = withoutAiBlocks(doc.files[file]?.text || ''), match = anchorIn(text, plan.words);
      if (!match || text.indexOf(plan.words, match.end) >= 0) return [];
      return [{ file, words: plan.words, hash: match.hash }];
    });
    if (matches.length !== 1) fail(); targetAnchor = matches[0];
  }
  return { sourceRevision: sourceRevision(state, plan.course, plan.leaf), targetAnchor,
    parentId: parentId || null, expectedBlockRevision: parent ? blockRevision(parent) : null };
}
export function validateBookTarget(state, args) {
  if (!args.guard) return;
  const doc = recordOf(state, args.course)?.bookDoc, leaf = leaves(doc?.manifest.nodes).find(n => n.id === args.leafId), guard = args.guard;
  if (!leaf || sourceRevision(state, args.course, leaf) !== guard.sourceRevision) fail();
  if (guard.targetAnchor) {
    const { file, words, hash } = guard.targetAnchor, text = withoutAiBlocks(doc.files[file]?.text || ''), match = anchorIn(text, words);
    if (!match || match.hash !== hash || text.indexOf(words, match.end) >= 0) fail();
  }
  if (guard.parentId) {
    const parent = aiBlocks(doc.files[mineFile(args.leafId)]?.text).find(b => b.id === guard.parentId);
    if (!parent || blockRevision(parent) !== guard.expectedBlockRevision) fail();
  }
}
