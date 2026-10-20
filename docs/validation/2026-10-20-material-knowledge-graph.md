# Material knowledge graph validation — 2026-10-20

## Scope and delivery state

Development starts at upstream StudyHub 3.5.6 (`bd9faae7bf5736fb20c6b4b8eef53b950074ceba`) on `codex/material-knowledge-graph`. The approved 12-task design was implemented inline and independently reviewed once. Existing handoff, design and implementation-plan documents remain untouched and untracked. No real DSH installation or actual learning library was modified.

The feature includes independent knowledge collections, source/version-aware extraction and atomic publication, native DSH background jobs, explicit/manual/automatic builds, course/material filtering, graph navigation, evidence details, manual merge/correction, and persistent source-cited node/relation/path conversations. Graph display limits remain 300 nodes and 600 relations; extraction/QA preserve exact UTF-16 source positions.

## Verification evidence

- Final ESLint: passed (`output/local-dev/knowledge-final-lint.log`).
- Complete regression: **8,570 tests; 8,555 passed, 15 skipped, 0 failed**, exit 0 (`output/local-dev/knowledge-full-final.log`). Earlier interrupted or failing runs are not completion evidence.
- Final isolated native knowledge journey: **10/10 passed**, including genuine `dsh-jobs` executor receipts, cancellation without publication, changed/archived projection, exact citations, restart and saved conversation. Final bank counts: decks=0, drafts=0, attempts=0. Report: `output/qa/knowledge-dsh-final/summary.json`.
- Existing native DSH journey: **11/11 passed**, including warm/cold child behavior (`output/qa/dsh-e2e/summary.json`).
- Navigation browser checks: **14/14 passed**, including narrow/short windows and 100/150/200 percent scaling (`output/local-dev/knowledge-nav-final.log`).
- Knowledge UI preview: passed at 1440/390 pixels with 300/301 nodes, ordered path selection and expansion, delayed question responses, unavailable citations and actual repeated-quote CSS Highlight (`output/local-dev/knowledge-native-components-preview-final.log`).
- Release pack/check: **8 archives and 2 setup pages passed** after all production fixes (`output/local-dev/knowledge-release-check-final.log`). The native knowledge journey was repeated with the final package.

Three old browser failures were also reproduced in a pristine, ignored archive of the approved 3.5.6 base. The science/estimate fixtures now explicitly open the default-collapsed draft section. The follow-session geometry assertion now compares layout offset rather than viewport coordinates: measured app scrollTop changed by 14 pixels when browser focus revealed the trigger, while its layout position stayed fixed. Pointer interaction finishes before the keyboard-tooltip check. A genuine estimate jump was fixed by preventing the draft section's generic `small` margins from affecting the loading label. Its browser test was observed failing; the final estimate/browser and Chinese/English summary checks passed 14/14. An unnecessary ready-state ghost was removed after static-text checks detected duplicate amounts. The independent sidebar fixture passed 12/12 after one local fetch failure during a concurrent run; no production retry was added for that isolated failure.

## Independent review

A fresh read-only reviewer reported seven Important findings and no Critical findings. Each accepted fix received a reproducing RED→GREEN regression:

1. Native retry/material claims are now atomically scoped to the actual job attempt; a foreign active owner cannot be overwritten.
2. Adding readable pages changes the extraction revision even when original PDF bytes/document revision stay the same; stale in-flight publication is rejected.
3. The evidence reader resolves exact prefix/suffix context and the original document revision; repeated quotations open the selected occurrence.
4. Explicit backfill works with future automatic builds disabled and without an explicit material selection.
5. Accepted semantic merges retain redirected concept signatures and reuse the canonical node in later extraction.
6. Focused truncation always retains the focus and orders its neighborhood by stable distance.
7. Cross-course concepts are visibly marked in the canvas/list/details with evidence course names.

Additional integration fixes keep filtered/manual path semantics in QA, preserve selected paths through neighborhood expansion, show meaningful path/merge names and definitions, omit graph summary from compact library payloads, preserve prior capture/teach token contracts, and register the native extraction/instant question boundaries in architecture inventories.

Deferred minor: manual correction UI edits definition/conditions; the public API additionally supports label/aliases/note. No second review was commissioned; the original findings were verified through tests.

## Requested real-model PDF acceptance — passed

Input: the user-selected local PDF folder. It contains 14 PDFs, 41 readable pages and 86,341 extracted characters. Imports and test results remain in ignored private QA directories; source PDF bytes and extracted medical text are not committed.

Configured route: `http://127.0.0.1:8317/v1`, `gemini-3.8-flash-high`, credential supplied only through a runtime environment variable. No alternative model was used.

After the user restored the local endpoint, **14/14 PDFs completed** with **807 concepts, 630 relations and 2,505 exact-position evidence records**. Every evidence quote equals its original source slice, and every input PDF retained its original SHA256. The real-model relation question completed with verified source citations. The graph query displayed 300 nodes and 87 connecting relations within its limits; the complete graph remained stored. Bank counts stayed decks=0, drafts=0, attempts=0, with one saved knowledge conversation. Final report: `output/qa/knowledge-user-materials/summary.json`, `ok: true`, finished `2026-10-20T00:52:04.359Z`.

Earlier attempts encountered upstream EOF/TLS errors and a stopped local endpoint (1 complete / 13 failed). Those failures were retained and were not counted as successful acceptance. The final successful run reused the private library after restoration. This acceptance verifies extraction, provenance, persistence and cited question flow; it does not establish the medical correctness of every model-generated concept or relation.

Extraction now supplies a catalog of server-bound source passages instead of asking the model to reproduce offsets. Unknown IDs and mismatched quotations are rejected. Invalid structured output permits one metered correction attempt; a second invalid result fails without publishing the material. Regression evidence: `output/local-dev/knowledge-citation-catalog.log`.

Reproduce or resume against the same private QA library:

```powershell
# Supply STUDYHUB_KNOWLEDGE_KEY through the process environment.
npm run qa:knowledge -- --lang zh --port 3198 --model-port 4198 --out output/qa/knowledge-user-materials --real-model --materials-only --reuse-home --materials-dir "C:\Users\ZKR\Downloads\全套精炼版本"
```

The harness refreshes only the private QA plugin, retains completed versions, checks every evidence slice and the real answer citations, verifies original SHA256 hashes, and requires every PDF to complete. Reports: `output/qa/knowledge-user-materials/materials-progress.json` and `summary.json`. Private test roots: `output/qa/dsh-home-knowledge-materials` and `output/qa/dsh-documents-knowledge-materials`.

## Implementation decisions and costs

Ruling: Reuse dedicated studyhub-dev clone on feature branch, preserving handoff files — pre-existing dedicated development checkout is sufficient isolation — cost if wrong: move feature branch to linked checkout.

Ruling: Windows PowerShell/Node equivalents for Bash task scripts, same plan-owned workspace, briefs, BASE and per-task test records — Bash is only a WindowsApps launcher here — cost if wrong: bookkeeping format differences, no business behavior impact.

Task 1: Ruling: runtime snapshot reads ignored declared whole-object defaults and substituted [] — honor descriptor defaults in runtime.js — cost if wrong: changes defaults only for absent extension fields.

Task 1: corrected completion gate: earlier 16/17 was premature; actual GREEN 17/17 after whole-mode runtime transaction validation fix. Ruling: runtime must permit declared whole object collections, like Store — cost if wrong: wider values allowed only for whole collections.

Task 6: complete (RED missing job; GREEN jobs/boundaries/contract 36/36). Ruling: partial is runtime complete + result.completeness=partial, not a new runtime status; generic retry action now accepts declared retry on complete partial jobs — existing runtime could not retry partial completion — cost if wrong: other retry-capable partial jobs now expose retry.

Task 7: complete (RED missing scheduler; GREEN auto/jobs/plugin-composition/runtime-contracts 20/20 after sandbox symlink EPERM rerun). Ruling: store source import revision plus enabled store revision — commits may share one millisecond — cost if wrong: additive metadata. Internal reconcile uses private service Symbol; no public action, watcher or timer.

Task 11: complete. Shared task10 path RED/GREEN; QA/view tests 6/6 and browser pending-send, old/missing citations, close/reopen history, 1440/390px pass. Lint clean after browser globals/effect fixes. Ruling: use call for mutations requiring actual receipt, since act catches domain errors; all mutations remain through public actions.

Task 12: Ruling: Gemini emits null for absent optional conditions/note; decode null exactly as an omitted optional field, still reject non-text objects and validate every citation and endpoint. Cost if wrong: absent/null text distinction lost, neither carried semantic text. RED null-field regression -> GREEN extraction/jobs 7/7. Initial dispose race reproduced RED -> GREEN plugin/auto 6/6. Deterministic native DSH 10 steps passed including version attach, cancellation, persisted restart and zero bank writes; full run interrupted before summary, must rerun.

Final: Ruling: path and merge UUID-only presentation regraded Important — users must choose a meaningful chain and compare concepts before manual merge, so provide names and supported definitions/courses; cost if wrong: a small additive UI payload.

Final: Ruling: real model quality and real DSH deployment were declined by reviewer — real-model quality is being tested via user endpoint after reported restoration; real deployment remains outside user isolation boundary. Cost if wrong: isolated acceptance does not prove live-library deployment.

Final: Ruling: Windows test TEMP under deep repository output exceeded MinerU 80-character guard — use D:/Codex/workspaces/Study/.tmp without changing production MinerU; cost if wrong: environment-specific portability gap remains. Scoped process console 27/27 GREEN.

Final: Ruling: fork main advanced to upstream3.5.7 after approved3.5.6 baseline — deliver independent feature branch from bd9faae and preserve main; cost if wrong: later integration needs a separate merge with3.5.7.

Final: Ruling: CLI Git has no authenticated credential but GitHub connector is authorized — upload an identical canonical tree as an account-authored GitHub commit, preserve local per-task history; cost if wrong: remote squash SHA differs from local task commits.

Final: Ruling: real-model evidence uses server-bound passage IDs with one metered structured-output correction — observed Gemini offset/quote errors must fail safely without making every recoverable response unusable — cost if wrong: larger input payload and at most one extra model call per invalid chunk.

Final: Ruling: baseline browser fixtures assumed drafts were visible and viewport top was layout position — open the actual disclosure and compare offsetTop, with measured scrollTop evidence — cost if wrong: fixture could miss a viewport scrolling regression, while separate geometry/overflow checks remain.
