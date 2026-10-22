# Study panel design — Clarity (2026-10-20)

## Five-space shell

The approved redesign uses Today / Materials / Knowledge / Practice / Records. A quiet sidebar identifies the space; a horizontal view row identifies the page. The top bar owns the global course picker, tasks and inbox. These shell decisions supersede older grouped-sidebar and per-page course-picker descriptions. Existing data and later-stage workflows remain available while the redesign proceeds.

The palette is cool neutral graphite in dark mode and cool grey/white in light mode, with one indigo primary action. Cards follow the selected theme; rendered PDF pages remain white. Use the existing Phosphor icons, bundled typography, semantic tones, focus styles and reduced-motion rules. The sidebar highlight glides between spaces; view selection uses a short underline transition. Preserve reading position during menu and course interactions.


## Material knowledge graph network

The material knowledge graph uses an open dot-and-link canvas, following the user's Obsidian reference. Real connected components form loose clusters; node size reflects visible relation count, while isolated concepts stay quieter and remain selectable. Do not fabricate links to imitate a denser reference. Overview labels are chosen at reading size with collision avoidance rather than scaling all names down.

Use existing text, canvas and control tokens. The accent is also the selected concept/relationship signal within this graph. Single selection preserves the surrounding graph and opens evidence; double selection or the focus action requests the local neighborhood. Dragging changes view coordinates only. Movement settles, and reduced-motion mode skips animated simulation, camera travel and pan inertia. Narrow screens hide the duplicate page heading and desktop mouse hint, keep a compact scale/zoom toolbar, and place a short local graph above evidence. This network-specific interaction supersedes the older structural-axis preference for this page only.

## Daily learning action hub

Mode: directed by the existing ink-on-desk system. Returning learners should see what to do next and their remaining daily allowance within five seconds. The primary object is the next action, not a dashboard of tasks or a negotiation form.

Thesis: a quiet daily briefing with one large action title and one accent launch control. A thin progress rule and modest time labels orient the learner; the full plan sits behind a native disclosure. An unaccepted AI proposal temporarily takes this focal position so consent stays explicit. AI feedback and regular pace are separate, on-demand editors.

Taste constraints: no equal-weight task cards, no always-visible settings form, no invented precision for remaining task time. In-progress actions come first. Completed history stays accessible for time recording. Learning pages show a compact connection to today's action without a second launch button. Keep the established fonts, colour tokens and keyboard-visible controls; introduce no animation or external assets.

Subtraction: remove the persistent feedback form, the repeated row reasons and launch controls from context strips, the nested proposal box, and the decorative top rule. Preserve explanations where they support a decision: the next action, proposal review and optional editors. The action title owns display scale; the briefing heading stays small. Keep the launch adjacent to its duration rather than across an empty row.

The whole panel follows one idea: **the card is the only physical object; everything else is type on a desk.** Every new surface should either strengthen that idea or solve a named product problem.

## Thesis

- Intent: "I know exactly what to do today" — calm, confident, generous (大气).
- Composition: one focal object per page, placed asymmetrically. Library: today's paper card stack. Review: the question as an index card. Stats: the streak numeral. Exam: the exam sheet. Skeleton: the learning axis.
- Secondary information is typographic lines under hairlines, never a grid of equal boxes.
- Type: `--font-ui` / `--font-display` start with the bundled "StudyHub Inter" for digits and Latin letters only (`ui/fonts/`: one variable woff2 with wght and opsz, OFL; `installInterFace` loads it once from a lazy chunk as a `data:` face; its `unicode-range` excludes every CJK block), then the system stack, so Chinese stays in the system face. A typed custom font comes before it and wins. Large light numerals for counts (opsz gives them the display cut); `tabular-nums` for counters; bold display headings; small muted labels. Inter's digits are wider than YaHei's: a fixed-width column that holds numbers is sized for the widest real value (`tests/inter-font.test.mjs`, `tests/wave5c-estimate.test.mjs`).
- Icons: one registry, `<Icon name>` (`ui/components/Icon.jsx`), drawn in **Phosphor Light** (MIT; fill-based, 256 grid, `currentColor`). `scripts/icons/build-icons.mjs` maps our names to Phosphor names and writes `ui/components/icon-paths.js`; a new icon is a new mapping line plus a regenerate (`tests/icon-paths.test.mjs` checks the file is in sync). Only the StudyHub mark stays hand-drawn. Light is thin: use 14px or more; `strokeWidth` above 1.6 emboldens a glyph (the heavy tick). No unicode or emoji stand-ins for icons in new work.
- Shape: every card is the one paper card, `.sh-paper-card` (`ui/paper.css`; `<Panel tone="paper">` renders it): paper stock, `--paper-radius` (= `--radius-card`, 12px), a transparent 1px border, `--shadow-card`, and the padding scale default 20/24, `--roomy` 24/32, `--snug` 16/20, `--flush` 0. Question card, flashcard faces, today card, welcome choices, case and result cards, the exam setup sheet, summary topics, the tour popover and the reading-tone paper all use it; a feature sheet never sets its own card corner, shadow or stock (`tests/paper-card.test.mjs`, `radiusCard` ratchet at 0). Only a fixed head (a head rule, ruling) may set `--paper-pad-top` / `--paper-pad-bottom`, and the reader page keeps em padding because the reading size scales it. Desk panels use `--radius`; controls use `--radius-sm`; pills only for toggles. Dialog sheets, the setup gate and provider cards in `ui/components` keep `--radius-card` as notices on the desk, not cards.
- Motion: the card is dealt in once; on each question the stem inks in and the head rule fills; pages cross-fade. Animate transform and opacity only (a size change is a scale, a move is a translate; `tests/transform-motion.test.mjs` fails on any `transition` of width, height, left, top, right or bottom except the three content-driven cases it lists). Everything honours `prefers-reduced-motion`.

## Colour roles

| Token | Role |
| --- | --- |
| `--bg-canvas` / `--bg-surface` / `--bg-raised` | Desk, flat panels, menus |
| `--paper`, `--paper-ink`, `--paper-dim`, `--paper-rule` | Card stock. Inside a card the ink tokens are re-scoped to paper values, once, in `ui/paper.css`: give an element `.sh-paper-card` (what `<Panel tone="paper">` renders; `.sh-paper` is the ink alone) and nothing else. |
| `--accent` (靛蓝 indigo) | The single primary action, the card head rule / progress, the heatmap. Nothing else. |
| `--ok` jade | Correct, mastered |
| `--warn` ochre | Learning, contrasts to watch |
| `--bad` berry | Wrong, weak — deliberately distinct from indigo |

Rules: one filled primary button per screen; a primary that cannot act turns neutral, not muddy red; new CSS references tokens, never raw colours.

Accent presets (设置 › 界面 › 强调色): indigo is the new default; vermilion, jade, ochre and graphite are opt-in swaps of the accent tokens. Existing preference keys and theme choices are retained. Every preset is contrast-checked in `tests/accent-presets.test.mjs`; semantic mastery colours retain their meaning.
