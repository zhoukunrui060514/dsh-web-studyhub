# 四项修复后的快速层回归失败明细

日期：2026-10-23。本附录来自实际运行的 fast-tests.log。Node 汇总为 78 项失败、1 项取消；TAP 中共 79 个 not ok 记录，包含取消记录。本轮未把这些条目全部认定为新的产品缺陷。

| 序号 | 测试与位置 | 失败名称 | 类型 |
| --- | --- | --- | --- |
| 1 | tests/s1-course-browser.test.mjs:12:1 | global course switch protects an unsaved book edit, keeps the chosen course across views and reload | testTimeoutFailure |
| 2 | tests/locale-keys-used.test.mjs:18:1 | every English translation key is used by ui/ or lib/ source | testCodeFailure |
| 3 | tests/integration.test.mjs:1023:1 | large selections generate in parts, extra generations queue, and job.wait returns a compact draft summary | testCodeFailure |
| 4 | tests/unified-runtime-architecture.test.mjs:31:1 | model-shaped legacy call sites require an exact registered inventory and phase owner | testCodeFailure |
| 5 | tests/ui-guardrails.test.mjs:24:3 | ratchet rawButton: no file gets worse (\#135) | testCodeFailure |
| 6 | tests/ui-guardrails.test.mjs:24:3 | ratchet fontSizePx: no file gets worse (\#147) | testCodeFailure |
| 7 | tests/ui-guardrails.test.mjs:24:3 | ratchet radiusPx: no file gets worse (\#148) | testCodeFailure |
| 8 | tests/ui-guardrails.test.mjs:24:3 | ratchet spacingPx: no file gets worse (\#148) | testCodeFailure |
| 9 | tests/ui-guardrails.test.mjs:24:3 | ratchet elementSelector: no file gets worse (\#137) | testCodeFailure |
| 10 | tests/ui-guardrails.test.mjs:40:1 | no raw px font size, numeric font weight, px radius or 999px pill in a stylesheet, font shorthand included (\#147 \#148) | testCodeFailure |
| 11 | tests/ui-guardrails.test.mjs:205:1 | tokens are documented in DESIGN.md | testCodeFailure |
| 12 | tests/unified-runtime-legacy-delegation.test.mjs:32:1 | nothing of the execution areas is reached by nothing: every symbol that no production code uses, under either value of any switch, is named and has a reason | testCodeFailure |
| 13 | tests/client-boundaries.test.mjs:20:1 | generated native modules resolve through classic chunk factories and share host React | testCodeFailure |
| 14 | tests/wave5b-architecture.test.mjs:83:1 | audio.settings.get and coach.status are read through the host-query store, and a write refreshes every reader (\#117) | testCodeFailure |
| 15 | tests/wave5b-architecture.test.mjs:107:1 | no page formats a date, a number or a size itself: toLocale*String and Intl formatters live in ui/format.js (\#126) | testCodeFailure |
| 16 | tests/wave5b-architecture.test.mjs:135:1 | "let live = true" unmount flags are few: effects use useLiveEffect (\#116) | testCodeFailure |
| 17 | tests/english-ui.test.mjs:92:1 | every static application UI translation has an English catalogue entry | testCodeFailure |
| 18 | tests/dead-css.test.mjs:11:1 | no stylesheet carries a rule for a class that nothing renders | testCodeFailure |
| 19 | tests/slow-tests-list.test.mjs:44:1 | the list is shaped as {browser, ffmpeg, cli}, each sorted, naming test files that exist | testCodeFailure |
| 20 | tests/slow-tests-list.test.mjs:53:1 | every test file that launches a browser, runs ffmpeg or starts another program is on the slow list | testCodeFailure |
| 21 | tests/workflow-guide.test.mjs:117:1 | background skeleton failures are recorded and can be retried; it is off unless asked | testCodeFailure |
| 22 | tests/marker-external-ui.test.mjs:244:1 | a host without audio offers external guidance and never calls unavailable converter operations | testCodeFailure |
| 23 | tests/wave2-g-settings-registry.test.mjs:47:1 | the registry gates capabilities: needs hides a category, partNeeds gates one part of it | testCodeFailure |
| 24 | tests/usage-registry.test.mjs:72:1 | CI-style: every data-usage a page marks is registered, and every registered control is marked somewhere (or hooked, or a shortcut) | testCodeFailure |
| 25 | tests/usage-registry.test.mjs:154:1 | the sidebar rows carry data-usage in the app and key identically in both languages | testCodeFailure |
| 26 | tests/page-frame-headers.test.mjs:1:1 | D:\\Codex\\workspaces\\Study\\studyhub-redesign\\tests\\page-frame-headers.test.mjs | testCodeFailure |
| 27 | tests/quote-grounding-report.test.mjs:134:1 | the job card of a partly failed generation says why in the learner's language and offers the one top-up | testCodeFailure |
| 28 | tests/exam-prep-render.test.mjs:90:1 | another course's list is not shown; the same course's is; a parent course takes in its sub-courses | testCodeFailure |
| 29 | tests/exam-prep-render.test.mjs:100:1 | with no list the page says what it is for and the three inputs, and offers 新建考点清单 | testCodeFailure |
| 30 | tests/exam-prep-render.test.mjs:137:1 | a build of another course is not shown on this course's page, not as a row and not as a failed notice; a build that names no course is shown nowhere | testCodeFailure |
| 31 | tests/effort-single-mapping.test.mjs:57:1 | only lib/model-effort.js maps a preference onto model levels | testCodeFailure |
| 32 | tests/wpm-import.test.mjs:118:1 | the hub keeps no private copy of what a shared module already says (\#120 \#121 \#127) | testCodeFailure |
| 33 | tests/wpm-import.test.mjs:127:1 | the hub still routes files by extension from the shared lists (\#120) | testCodeFailure |
| 34 | tests/wp27-usage-ui.test.mjs:221:1 | the stats section lists the features that have usage, in the order of the product, and a total | testCodeFailure |
| 35 | tests/exam-prep-form-render.test.mjs:42:1 | a learner who left the course empty still sees the progress and the failure of the build on the list page | testCodeFailure |
| 36 | tests/exam-prep-form-render.test.mjs:173:1 | the form in English: the table, the reasons, the fold, the plan and the banner have no Chinese | testCodeFailure |
| 37 | tests/wp30-shortfall-ui.test.mjs:145:1 | home: a short draft says how much of its material has questions and offers one top-up; the reasons are on the draft page, not on the card | testCodeFailure |
| 38 | tests/wp30-shortfall-ui.test.mjs:161:1 | home: while a top-up runs the button says so, the old card stops advising it and nothing says 补题中 for publishing | testCodeFailure |
| 39 | tests/wp30-shortfall-ui.test.mjs:176:1 | home: English renders without Chinese | testCodeFailure |
| 40 | tests/material-pins-ui.test.mjs:108:1 | a pin outside the course being shown is not drawn, and brings back no group by itself | testCodeFailure |
| 41 | tests/draft-to-practice.test.mjs:70:1 | with no new question to start the deck is published all the same, and the page says so | testCodeFailure |
| 42 | tests/css-layers.test.mjs:11:1 | every stylesheet sits in a study layer and, inside it, in the :is(.study-app, .study-seat) scope | testCodeFailure |
| 43 | tests/css-layers.test.mjs:26:1 | the layer statement is identical in every sheet, so any injection order gives the same layer order | testCodeFailure |
| 44 | tests/wp2f-pages.test.mjs:44:1 | only sidebar pages have a navigation label (a return from settings says 原位置) | testCodeFailure |
| 45 | tests/wp2f-pages.test.mjs:54:1 | availability reads the registry and matches the table it replaced | testCodeFailure |
| 46 | tests/wp1-i18n-fragments.test.mjs:46:1 | the shipped locale files have no conflicting translations | testCodeFailure |
| 47 | tests/wave5a-loading.test.mjs:21:1 | a reading / opening / counting message is a LoadingState (a polite status with the one spinner) | testCodeFailure |
| 48 | tests/space-half-steps.test.mjs:33:1 | ui/DESIGN.md names every half-step and says when to use which | testCodeFailure |
| 49 | tests/space-half-steps.test.mjs:38:1 | no feature stylesheet writes a half-step value as raw px in padding / margin / gap / inset | testCodeFailure |
| 50 | tests/task-keeps-wording.test.mjs:37:1 | C-2: the retry title follows what a retry keeps: completed and absent keep the wording, nothing says it starts over and is paid again | testCodeFailure |
| 51 | tests/wp25-exam-formats.test.mjs:74:1 | 模拟考试 is one page with one 考试形式 switch of three formats; the old corner links are gone | testCodeFailure |
| 52 | tests/wp25-exam-formats.test.mjs:109:1 | the limit follows the course's own 作答时间 and says so; a limit the learner chose is kept for this tab | testCodeFailure |
| 53 | tests/wp25-exam-formats.test.mjs:229:1 | English: every format's setup and the recent list are fully translated | testCodeFailure |
| 54 | tests/course-active-ui.test.mjs:184:1 | the library folds parked courses under one heading and keeps their decks out of the default list | testCodeFailure |
| 55 | tests/course-active-ui.test.mjs:192:1 | the home marks a parked current course with 未激活 and an 激活 button; the course switcher groups parked courses | testCodeFailure |
| 56 | tests/course-active-ui.test.mjs:209:1 | English: the library, the chip and the fold read in English | testCodeFailure |
| 57 | tests/wp4-library-home.test.mjs:58:1 | an empty library hides advanced blocks | testCodeFailure |
| 58 | tests/wp4-library-home.test.mjs:88:1 | tour anchors mark the hero, today's card and the catalogue | testCodeFailure |
| 59 | tests/wp4-library-home.test.mjs:95:1 | running jobs sit above the desk and pending drafts are a folded section under it, naming the deck in plain words | testCodeFailure |
| 60 | tests/home-composition.test.mjs:81:1 | every number has one plain label and a hover that says what it counts | testCodeFailure |
| 61 | tests/home-composition.test.mjs:110:1 | App no longer draws the personalised-questions card; the sidebar row and the home link remain | testCodeFailure |
| 62 | tests/book-entry.test.mjs:60:1 | where the sidebar leads: the book page once its notes are written, else the 总纲 page (no outline, no course, or an outline without notes) | testCodeFailure |
| 63 | tests/study-desk.test.mjs:94:1 | show-all lives inside an open course, and a lone course can never be stuck closed | testCodeFailure |
| 64 | tests/source-courses-ui.test.mjs:22:1 | source organization and import forms expose local course choices in English | testCodeFailure |
| 65 | tests/wave3-p-components.test.mjs:72:1 | <h1 appears only in PageHeader and the allow-listed frames (\#142) | testCodeFailure |
| 66 | tests/wave4-jsx-followups.test.mjs:58:1 | the exam header passes the course scope through PageHeader's scope slot (\#142) | testCodeFailure |
| 67 | tests/compact-job-card.test.mjs:79:1 | the audio console keeps a blocked file picked, with the skip button, and a single file already shows its stages | testCodeFailure |
| 68 | tests/wave3-p-pages.test.mjs:53:1 | StudyMap takes the snapshot and the home verbs, not 48 props (\#113) | testCodeFailure |
| 69 | tests/wave3-p-pages.test.mjs:102:1 | every migrated page header is the shared PageHeader and the scope picker sits in its slot (\#142) | testCodeFailure |
| 70 | tests/learning-scope-ui.test.mjs:23:1 | learning browsing pages expose their actual course and an all-courses escape | testCodeFailure |
| 71 | tests/learning-scope-ui.test.mjs:32:1 | exam defaults to current-course questions and an empty course never preselects other courses | testCodeFailure |
| 72 | tests/learning-scope-ui.test.mjs:42:1 | live class shows an editable raw course choice and English scope copy is complete | testCodeFailure |
| 73 | tests/wp3-app-wiring.test.mjs:50:1 | App wires the hub into the dialog and the empty state, and counts documents | testCodeFailure |
| 74 | tests/wp-b-overlays.test.mjs:196:1 | Confirmations are documented in DESIGN.md | testCodeFailure |
| 75 | tests/wp2f-inbox-read.test.mjs:74:1 | a letter opens through its registry row: PDF and translation to Sources, audio to Sources or the audio page, a note to the notes | testCodeFailure |
| 76 | tests/wp2f-library-state.test.mjs:26:1 | the initial state has one fresh value per key, and nothing outside the key list | testCodeFailure |
| 77 | tests/wp2f-library-state.test.mjs:58:1 | a reset gives every key its initial value: restore leaves nothing of the old library behind | testCodeFailure |
| 78 | tests/wp2f-library-state.test.mjs:118:1 | the reset is the only place that lists what a library owns: the reducer keys are the contract | testCodeFailure |
| 79 | tests/css-ownership.test.mjs:9:1 | a class that two stylesheets both write rules for is on the allow-list, with exactly those files | testCodeFailure |

与修复前相比，新增记录为 workflow-guide.test.mjs 中 background skeleton failures are recorded and can be retried; it is off unless asked。随后单独重跑该文件 8/8 通过；原 77 项失败及取消仍需后续按当前批准设计处理。
