import { courseOutline } from "./course-outline.js";
import { courseOutlineQa } from "./course-outline-qa.js";
import { bookRevision, openCourseBook, courseOf as bookCourseOf } from "./course-book-files.js";
import { saveBookFile, bookSuggestion, revertBookFile } from "./course-book-edit.js";
import { addBookQa, removeBookQa, bookQaList } from "./course-book-qa.js";
import { bookQueue as sharedBookQueue } from "./course-book-writer.js";
import { aiBlockAction } from "./course-book-ai.js";
import { bookToc, bookRead, bookCoverage } from "./book-agent-read.js";
import { sourcePages } from "./book-pages.js";
import { readReading, recordReads, pointKey, rememberDropped } from "./book-reading.js";
import { writeBookPoint, writeResult } from "./book-agent-write.js";
import { courseBookExport } from "./course-book-export-op.js";
import { withBookAssetExport } from './book-assets-export.js';
import { bookCrunch, crunchCourses, markCrunch, mockPlan } from "./course-book-crunch.js";
import { readHistory, pushHistory, dropHistory, lastOf, historyCounts } from "./course-book-history.js";

/** Shared legacy and curriculum book implementation; state ownership stays in materials. */
export function createCourseContentOperations(storagePort) {
const bookQueue = task => sharedBookQueue(storagePort.root, task);
const withBookHistory = async view => (view.status === 'ok' ? { ...view, history: historyCounts(await readHistory(storagePort.root, view.course)) } : view);
/** A write of the book: joins the queue at once; in its turn `prepare(view)` reads what the write needs (the course, a base text), then one transaction
    (`write(state, prepared)` -> { done?, view }), then what it replaced into the history. */
const bookWrite = (prepare, write) => bookQueue(async () => {
  const prepared = await prepare(await storagePort.view());
  const { done, view } = await storagePort.update(state => write(state, prepared));
  await pushHistory(storagePort.root, view.course, [done?.before, ...(view.replaced || [])]);
  return withBookHistory({ ...view, ...(done ? { write: done.status } : {}) });
});
return { handlers: {
"course.outline": async function (a) { return courseOutline(await storagePort.view(), a, { root: storagePort.root }); },
// 复习全书 「本节问答」 (lib/course-outline-qa.js): the 追问, 批注 and 问答卡 of some rows of the 总纲, read on demand by the book page.
// 复习全书 (lib/course-book-files.js): the book's Markdown files of a course, made from the outline and its notes when there are none, the generated ones kept
// current. Looked at on the shared view first: the library is written only when the files change, so an unchanged open leaves its revision alone.
"course.book.open": async function (a) {
      const looked = openCourseBook(await storagePort.view(), a, { write: false });
      if (!looked.changed) return withBookHistory(looked);
      return bookWrite(() => null, state => ({ view: openCourseBook(state, a) }));
    },
// The book's revision alone (read only): the book page asks it when it comes back into view, and reads the whole book again only when it moved.
"course.book.revision": async function (a) { return bookRevision(await storagePort.view(), a); },
// 复习全书 M2 (lib/course-book-edit.js): a save of one file (compare-and-set on its version), 采用/忽略 of a suggestion, 回退到上一版 of one file. One writer
// queue, one store transaction each; what a write replaced goes to the version history (lib/course-book-history.js), outside the sources.
"course.book.save": async function (a) {
      return bookWrite(async view => {
        const course = bookCourseOf(view, a);
        // The file as it was at the editor's version, from the history: what was added to it since (a Q&A block) is carried into the learner's text.
        return { base: Number.isInteger(a.version) ? (await readHistory(storagePort.root, course)).find(entry => entry.file === a.file && entry.version === a.version) ?? null : null };
      }, (state, { base }) => { const done = saveBookFile(state, { ...a, ...(base ? { baseText: base.text } : {}) }); return { done, view: openCourseBook(state, a) }; });
    },
// 「加入复习全书」 (lib/course-book-qa.js): a follow-up kept on a card into the course's book (the point's Q&A file), or out again; only on the learner's
// request (the button, or the practice page's 自动加入 calling this same op). The card's follow-ups stay as they are.
"book.qa.add": async function (a) {
      return bookWrite(view => {
        const deck = (view.decks || []).find(item => (a.deckId ? item.id === a.deckId : (item.cards || []).some(card => card?.id === a.cardId)));
        return { course: a.course !== undefined ? a.course : deck ? deck.course ?? deck.folder ?? bookCourseOf(view, {}) : bookCourseOf(view, {}) };
      }, (state, { course }) => { const done = addBookQa(state, { ...a, course }); return { done, view: openCourseBook(state, { course }) }; });
    },
"book.qa.remove": async function (a) {
      return bookWrite(view => ({ course: bookCourseOf(view, a) }), (state, { course }) => {
        const removed = removeBookQa(state, { ...a, course });
        return { done: { status: removed.status, before: removed.removed[0]?.before ?? null }, view: openCourseBook(state, { course }) };
      });
    },
"book.qa.list": async function (a) { return bookQaList(await storagePort.view(), a); },
// 弄懂 / 加一段 (lib/course-book-ai.js): 保留 or 删除 of an AI block of a point's own file, on the learner's request.
"course.book.block": async function (a) {
      return bookWrite(() => null, state => { const done = aiBlockAction(state, a); return { done, view: openCourseBook(state, a) }; });
    },
"course.book.suggestion": async function (a) {
      return bookWrite(() => null, state => { const done = bookSuggestion(state, a); return { done, view: openCourseBook(state, a) }; });
    },
"course.book.revert": async function (a) {
      return bookQueue(async () => {
        const course = bookCourseOf(await storagePort.view(), a);
        const entry = lastOf(await readHistory(storagePort.root, course), a.file);
        if (!entry) throw Object.assign(new Error('没有更早的版本 / There is no earlier version'), { code: 'course-book-no-version' });
        // `version` (the page's 撤销): checked inside the transaction, against the file and the history entry, so a write that came first refuses it.
        const { done, view } = await storagePort.update(state => { const result = revertBookFile(state, { ...a, text: entry.text, textVersion: entry.version }); return { done: result, view: openCourseBook(state, a) }; });
        // The version taken back leaves the history (the book was written first: a failure here keeps one version too many, never loses the book).
        await dropHistory(storagePort.root, course, entry);
        await pushHistory(storagePort.root, course, view.replaced);
        return withBookHistory({ ...view, write: done.status });
      });
    },
// 复习全书 M6 (lib/course-book-export-op.js): the book as the learner's printable CP (查找页 first, question links as numbered questions, the 答案册 on
// request), one Markdown file or a folder with its manifest; read only, deterministic.
"course.book.export": async function (a) { const state = await storagePort.view(); return withBookAssetExport(storagePort.root, state, courseBookExport(state, a)); },
// The main chat's book tools (docs/review-book-agent.md, lib/book-agent-read.js): small reads of one point at a time. book.toc brings the book up to date
// first, as course.book.open does (creates it, maps it to a rebuilt outline), then answers only the table of contents.
"book.toc": async function (a) {
      const looked = openCourseBook(await storagePort.view(), a, { write: false });
      if (looked.status !== 'ok') return { status: 'empty', course: looked.course ?? null, reason: looked.reason };
      if (looked.changed) await bookWrite(() => null, state => ({ view: openCourseBook(state, a) }));
      return bookToc(await storagePort.view(), a, await readReading(storagePort.root));
    },
"book.read": async function (a) { return bookRead(await storagePort.view(), a, await readReading(storagePort.root)); },
"book.coverage": async function (a) { return bookCoverage(await storagePort.view(), a, await readReading(storagePort.root)); },
// A material by page number (lib/book-pages.js); what it showed is recorded beside the book history (lib/book-reading.js), so book.coverage is real reading.
"source.pages": async function (a) {
      const view = await storagePort.view(), { result, reads } = sourcePages(view, a);
      await recordReads(storagePort.root, reads, typeof a.hid === 'string' && a.hid ? pointKey(bookCourseOf(view, a), a.hid) : null);
      return result;
    },
// book.write (lib/book-agent-write.js): one point's file, one section or a few edits from the main chat, in the book's writer queue and one transaction
// (the book brought up to date first, as every book write does); the version replaced goes to the history; the answer is small.
"book.write": async function (a) {
      return bookQueue(async () => {
        const course = bookCourseOf(await storagePort.view(), a), history = await readHistory(storagePort.root, course), reading = await readReading(storagePort.root);
        const { done, replaced } = await storagePort.update(state => {
          const opened = openCourseBook(state, a);
          if (opened.status !== 'ok') throw Object.assign(new Error('这门课还没有复习全书（先要有总纲） / This course has no review book (it needs an outline first)'), { code: 'course-book-missing' });
          return { done: writeBookPoint(state, { ...a, course }, { history, reading }), replaced: opened.replaced || [] };
        });
        await pushHistory(storagePort.root, course, [done.before, ...replaced]);
        const again = await rememberDropped(storagePort.root, pointKey(course, done.hid), done.dropped.filter(item => item.quote).map(item => item.quote));
        return writeResult(done, again);
      });
    },
// 期末一周 (M7, lib/course-book-crunch.js): the plan of the course's last days before its exam over the book's points (read only, no model call); with
// `all` the courses whose exam is near (the home's card). The 读完了 / 已看 marks are kept in the book's record, in the book's writer queue.
"book.crunch": async function (a) { const state = await storagePort.view(), options = { root: storagePort.root }; return a.all === true ? crunchCourses(state, a, options) : bookCrunch(state, a, options); },
"book.crunch.mark": async function (a) {
      const done = await bookQueue(() => storagePort.update(state => markCrunch(state, a)));
      return { ...bookCrunch(await storagePort.view(), { ...a, course: done.course }, { root: storagePort.root }), write: done.status };
    },
// The mock paper of some points (book.mock starts it, below): which questions, and what the exam mode leaves out (open, cloze, flashcards).
"book.mock.plan": async function (a) { const { scope: _scope, ...plan } = mockPlan(await storagePort.view(), a, { root: storagePort.root }); return plan; },
"course.outline.qa": async function (a) { return courseOutlineQa(await storagePort.view(), a, { root: storagePort.root }); },
}, bookWrite };
}
