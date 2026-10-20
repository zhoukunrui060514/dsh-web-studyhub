# Knowledge point switching continuity — 2026-10-20

The user reported excessive flashing when switching concepts and asked for better motion. This is a bounded correction to the existing network direction, with no data or model changes.

## Reproduction and root causes

The new browser regression first failed on the shipped implementation: a normal concept click changed zoom from **57% to 125%**. Separate camera effects also fitted on resize/layout and reframed selection, producing competing resets. Changing focus recomputed the old graph before the query response, then started another layout. The details effect cleared loaded evidence on every selection. Hover could relabel the graph, change its hit rectangle and repeatedly dim/relight unrelated nodes. The loading paragraph also inserted vertical space above the canvas during a request.

## Correction

- Normal inspection keeps the current zoom. It only pans enough to keep the selected or keyboard-focused point visible. Camera changes use one interruptible 360ms trajectory starting from the current frame. Wheel input and dragging cancel camera travel.
- Query results morph shared nodes from their current coordinates to the next layout, with the same 360ms timing. Same-topology refresh keeps current coordinates, including dragged positions. The simulation starts from the current frame when dragging interrupts a morph. Layout is no longer recomputed merely because the focus request changed before a response arrived.
- Loaded evidence remains on its reading surface while the next detail request is pending. `aria-busy`, a loading notice and an `inert` wrapper prevent actions on retained old evidence. Existing request-lifetime checks discard superseded responses. Closing details remains available.
- Hover emphasizes nearby nodes without flashing the background. Dot hit areas are fixed; labels remain clickable, do not select browser text, and no longer reorder all other labels when hovered. Opacity/color transitions use existing motion tokens. Reduced-motion preferences retain immediate state changes.
- The query status sits in the floating canvas toolbar rather than pushing the graph down. Narrow-screen scrolling occurs when opening the inspector, rather than on every concept switch.
- Native-host checking exposed an extra-narrow nested pane where zoom buttons wrapped over the selected node. The existing small icon-button size and a non-wrapping tool group now keep those controls compact; selection panning reserves their vertical space.

## Verification

- New failing reproduction: `output/local-dev/knowledge-continuity-red.log`; the first assertion records the unexpected 57% → 125% zoom.
- Final project ESLint passed. Knowledge/CSS targeted tests: **68 passed, zero failures**. Logs: `output/local-dev/knowledge-continuity-lint.log` and `knowledge-continuity-tests.log`.
- **Three consecutive combined browser passes** ran the new continuity journey and the existing graph journey. Logs: `knowledge-continuity-final-1.log` through `-3.log` and `knowledge-continuity-existing-1.log` through `-3.log` under `output/local-dev/`.
- Continuity checks cover actual pointer clicks, stable hover hit area, preserved zoom, retained evidence throughout delayed loading, disabled pending controls, rapid keyboard switching with out-of-order responses, no loading-induced vertical jump, per-frame shared-node positions during local focus, and narrow reduced-motion layout. Frame samples are in `output/qa/knowledge-continuity/frames.json` and `topology-frames.json`.
- The existing journey continues to cover dragging, wheel zoom, double-click focus, screen-space label sizes, 1440/645/390px views, logical 200% desktop reflow, ordered paths, conversations and exact repeated-source quotation highlighting. Its resize label check now explicitly fits the graph, matching the new rule that viewport changes preserve zoom.
- A fresh independent code review found no unresolved important defect. Its low-impact observation that a same-topology response could prematurely mark an active morph settled was corrected. The reviewer did not claim independent browser validation; the browser results above were run by the primary agent.
- Primary visual check used current 1440px/390px screenshots and 2× detail captures. No independent visual redesign review was needed for this bounded motion correction. Evidence: `output/qa/knowledge-continuity/screens/`; no screenshot console, overflow, missing-image or readability findings.
- Actual-material switching recording: `output/qa/knowledge-continuity/delivery-final-motion/record-switch.mp4`, with before/middle/end frames; no capture warnings. This is the final recording, superseding interim failed captures.
- Development bundles/package were refreshed only in the private QA DSH home, serving the existing **3198** preview. Real DSH and the user's learning library remain untouched. No model calls, dependency changes, official release or full-suite rerun were required for this correction.
