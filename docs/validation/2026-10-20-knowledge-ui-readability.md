# Knowledge graph readability — 2026-10-20

The user approved a bounded Oil UI refinement: keep StudyHub's existing visual identity and knowledge features, while making concepts, relationships and original evidence readable. The design north star is a reading workspace: the graph supports exploration without squeezing every label into one screen.

## Result

- Graph world space grows with the node count, with 220 × 110 unit cells. The initial camera uses one screen pixel per graph unit; a separate fit-graph overview remains available. Short concept names wrap into two lines, and relations use translated labels and visible arrowheads. Selected relations use the existing cinnabar emphasis.
- Course/material filters and automatic-build settings share a collapsed panel. Search and build remain immediately accessible. Current graph counts, return, global view and neighborhood expansion remain available.
- Desktop evidence stays beside the graph. Narrow layouts put a compact focused graph above the definition/evidence panel; the full node/relationship list moves below evidence. Small focused graphs stack vertically when the canvas is narrower than 450 pixels.
- Definitions and evidence use the existing 17px reading token; controls and node labels use the 15px token. Original source IDs, revision and offsets remain accessible under citation location. Quotations keep their exact characters; presentation collapses horizontal extraction spacing and avoids breaking a short selected concept term across lines.
- Existing button press/focus feedback is retained. Canvas/detail entrance and node selection use the existing motion tokens; narrow concept selection scrolls to the workspace. Reduced-motion settings disable entrances and smooth scrolling.

No backend extraction, publication, model routing, graph limit, citation, thread or stored-library format was changed. Assets are the real graph and source evidence; no decorative images, new font stack or design system was introduced.

## Independent visual review

One fresh reviewer used Oil UI's existing-interface refinement protocol, without reading implementation code and without a score. It compared the old real-PDF screenshot with current desktop, 645px and 390px screenshots and a 2× detail image. No blocking overlap, clipped control or graph-obscuring evidence panel was found.

Both suggested improvements were addressed: compact focused graphs bring evidence closer on narrow screens, and quote presentation preserves the source while reducing extracted table whitespace and keeping short concept terms intact. The suggested redundant canvas instructions were shortened to “拖动浏览，选择概念查看证据”. Large readable concept tiles, selected relationship emphasis and the separate desktop evidence column were retained. The reviewer assessed static screenshots; final motion and interaction checks were performed by the primary agent afterward.

## Verification

- Final ESLint: passed, `output/local-dev/knowledge-readable-final-lint.log`.
- Knowledge/CSS checks: **47/47 passed**, including large-graph cell spacing, search-result relayout, equally sized filter replacements and exact quotation preservation, `output/local-dev/knowledge-readable-final-tests.log`.
- Final browser interaction journey: **three consecutive passes**, `output/local-dev/knowledge-readable-final-interaction-1.log` through `-3.log`. Covers 1440/645/390px widths and a 720×450 logical viewport equivalent to desktop 200% zoom, readable on-screen labels, folded filter access, delayed answers, retained history, ordered paths, source availability and the actual repeated-quote highlight. Narrow evidence panels are checked not to cover the canvas.
- Current Oil UI screenshots: `output/qa/knowledge-readable/delivery-screens/`. Global and focused views at 1440×900, 645×900 and 390×844, each with 1×/2× pixel captures and masked variants. No console errors, horizontal overflow, missing images or readability lint findings. A 2× pixel capture is a detail image, distinct from the logical viewport zoom check above.
- Final native DSH preview refreshed only in `output/qa/dsh-home-knowledge-materials`, served at port 3198. The primary agent reopened StudyHub, searched the real library and selected the pressure-receptor concept, verifying its two-node relation and source-evidence panel in the native host.
- Final narrow-focus recording: `output/qa/knowledge-readable/delivery-motion/record-focus.mp4`. No capture warnings or loading errors. Earlier interim evidence directories are retained for comparison; `delivery-screens` and `delivery-motion` are the final artifacts.
- The real acceptance library still contains **807 concepts, 630 relations, 2,505 evidence records and 41 source pages**. Decks, drafts and attempts remain zero. The original DSH installation and actual learning library were not modified.

The earlier full feature regression remains recorded in the separate material-knowledge-graph validation report. This visual change used focused validation rather than rerunning the full suite. Development UI bundles were generated to verify the standalone preview and refresh the isolated host package; no new official release was published.

## Remaining scope

Global mode intentionally loads up to the existing 300-node limit. At reading size it shows the visible part of a larger world; pan, search or use the fit-graph overview to explore it. The overview suppresses labels when zoomed out rather than rendering unreadably small text. Existing manual-correction field coverage remains as documented in the feature delivery.
