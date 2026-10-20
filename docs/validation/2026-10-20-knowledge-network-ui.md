# Knowledge network UI — 2026-10-20

The user requested an Obsidian-inspired, more fluid knowledge graph after the earlier readability refinement. The approved direction is an open, canvas-led relation network: loose real-data clusters, faint links, degree-based hubs and quiet isolated nodes. StudyHub keeps its existing theme, fonts, control components and evidence-reading panel.

## Implementation

- Replaced rectangular concept tiles with a deterministic, bounded force layout for the existing 300-node display limit. Connected components gather naturally; isolated nodes remain on the periphery. No semantic relation or source record is created by the layout.
- Added node dragging with neighbor response and gradual settling, inertial canvas panning, cursor-anchored wheel zoom, animated selection framing and local-neighborhood focus. Reduced-motion preferences skip the animation and inertia. Coordinates remain transient view state.
- Single click opens evidence while retaining the global context. Double click requests local relations. Single selection is briefly deferred so its camera/panel movement cannot displace the second click. Keyboard selection remains immediate; the full concept/relation list remains available.
- Labels retain a constant screen reading size. Screen-space collision checks choose important labels instead of crowding every name into the overview. Cross-course scope is a measured second line, retaining the scope signal without overflowing long names.
- Mobile controls are compact; the repeated page heading, duplicate reset action and desktop mouse hint were removed. Evidence follows a 260px local graph rather than competing with it. On desktop, evidence remains beside the graph. Repeated per-evidence assertion status remains because individual evidence records can have different grounding types.

This UI refinement changes no extraction, model routing, publication, persistent graph schema, source offsets or query limit. No additional dependencies or decorative assets were added.

## Independent review

One fresh code reviewer checked the working changes against the preceding readability commit. It identified a cross-course label sizing defect; scope was moved into the measured two-line layout, with a focused regression test. Its final review found no unresolved concrete defect and independently passed 13 physics/view/UI checks.

One fresh visual reviewer used Oil UI's existing-interface refinement protocol, without code access or a score. Its findings were addressed by reducing mobile toolbar/header/hint occupancy, shortening the local canvas and distinguishing real connected groups from quieter isolated nodes. It recommended retaining the open canvas, fine links and cinnabar selected relation leading into evidence. The reviewer inspected static and motion-sequence evidence; primary browser interaction checks establish the functional result.

## Verification

- Final project ESLint: passed, `output/local-dev/knowledge-network-lint.log`.
- Knowledge graph and CSS checks: **68 passed, zero failures**, `output/local-dev/knowledge-network-tests.log`. This includes deterministic convergence, neighbor movement, input immutability, bounded labels, cross-course scope, navigation and ordered paths.
- Final browser journey: **three consecutive passes**, `output/local-dev/knowledge-network-interaction-1.log` through `-3.log`. Covers real pointer dragging, settling, double-click local-query requests, wheel zoom, global-context retention, 1440/645/390px layouts, a 720×450 logical viewport for desktop 200% reflow, folded filters, delayed answers, retained conversations, ordered paths, unavailable evidence and exact repeated-quote highlighting.
- Current screenshots: `output/qa/knowledge-network/delivery-screens/`. Global/focused states at 1440×900, 645×900 and 390×844, with 1×/2× pixel captures and masked variants. Reports contain no console errors, horizontal overflow, missing images or readability lint. Pixel density images are distinct from the logical viewport reflow check.
- Final motion evidence: `output/qa/knowledge-network/delivery-motion/`. Drag and focus recordings capture the actual graph interactions. Earlier evidence directories remain for comparison and are not the final artifacts.
- Development UI bundles were generated and the package refreshed only in the private QA DSH home at `output/qa/dsh-home-knowledge-materials`, port **3198**. No official release or real DSH installation was updated.
- The primary agent reopened StudyHub in that native host, verified the 300/807 global result, searched for the pressure-receptor concept, double-clicked it and observed the **two-node / one-relation** neighborhood plus its actual source-evidence panel.
- Read-only acceptance-library check still reports **807 concepts, 630 relations, 2,505 evidence records and 41 source pages**. Decks, drafts and attempts remain zero. The 14-PDF extraction/model acceptance is recorded in the earlier material knowledge graph report; no model call was needed for this UI change.

The global overview intentionally retains the existing 300-node cap. Search, local focus and neighborhood expansion expose the relevant part of the stored graph. Sparse data produces sparse groups; the design never invents edges to match the reference image's density.
