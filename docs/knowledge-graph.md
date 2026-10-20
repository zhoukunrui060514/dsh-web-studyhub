# Material knowledge graph

The **Knowledge graph** page extracts concepts, relationships and exact quotations from user materials in the current library. The optional knowledge plugin works without a question bank and creates no decks, drafts or practice attempts. The existing deck structure view remains available.

## Build and update

Choose **Build / update**, select current materials and submit. Supported inputs include imported documents, manual text and audio transcripts. Generated inventories, system content and question-bank derivatives are excluded from automatic builds. Course assignment changes update filters without another extraction call.

Automatic builds are off by default. Enabling them covers new imports and subsequent content changes. Explicitly use **Backfill existing materials** for older inputs. Disabling automatic builds cancels unaccepted automatic intent. Accepted jobs can be cancelled in Tasks; manual requests remain independent.

Extraction uses the unified DSH background executor. Waiting for model configuration or a DSH executor means durable intent without an accepted job. Opening the library later in a capable DSH session resumes unaccepted intent. The standalone preview has no native executor. Accepted work interrupted by a host restart requires explicit retry.

Each material publishes atomically. Cancellation, failure or changed/archived input cannot publish a partial or obsolete material. Retrying a partially completed job skips completed inputs at the same version.

Adding readable pages to the same PDF updates the extraction input fingerprint while retaining the original document revision for citations. Retries share the library admission limit with new jobs and cannot take another attempt's material claim.

Extraction receives a catalog of exact source passages and chooses their citation IDs. The server binds those IDs to the original UTF-16 positions and rejects unknown IDs or mismatched quotations. Invalid structured output gets one metered correction attempt; continued invalid output fails without publishing that material.

## Explore evidence

Filter by courses and materials, search concepts, select a node for its neighborhood and expand or return. Global display is capped at 300 nodes and 600 relations, with displayed and total counts. Use canvas pan/zoom or the keyboard-accessible concept and relation list.

Details preserve real direction, conditions, separate source contributions and asserted versus inferred evidence. Equal labels alone do not merge concepts. Ambiguous equivalents require manual acceptance or rejection. Manual corrections survive later extraction.

Source navigation checks source ID and revision and uses exact UTF-16 offsets. Old, archived or missing citations explain why exact navigation is unavailable; matching filenames never substitute for the actual source.

## Ask about a concept, relation or path

Ask from details or select an ordered connected path of up to 12 relations. Reverse traversal does not reverse facts. Connected relations do not establish transitive causality or a net effect.

Questions use current evidence under the selected filter, at most six successful history rounds and a 24000-character quotation budget. Only supplied evidence IDs become verified citations. Unsupported explanations are marked as supplemental. Model interpretation can still be wrong; inspect the original quotations.

Threads persist by library, target and filter. Reopening restores history. Source changes retain old answers with old-version or unavailable citation indicators. A failed question remains available for retry. Asking never builds the graph.

## Isolated acceptance

Run `npm run qa:knowledge -- --lang zh --port 3198 --model-port 4198`. It uses private DSH_HOME and documents directories with a knowledge suffix under `output/qa`, and writes screenshots and a machine-readable report to `output/qa/knowledge-dsh`. A deterministic model validates integration, not real extraction quality.

For the configured `gemini-3.8-flash-high` model, provide runtime environment variables `STUDYHUB_KNOWLEDGE_KEY` and `STUDYHUB_KNOWLEDGE_URL` and add `--real-model`. Never commit credentials. Real model acceptance uses the same isolated library boundary.

Add `--materials-only --materials-dir "directory containing PDFs"` to deploy into a dedicated isolated instance and test a full PDF set. The journey imports and extracts each file, checks exact evidence positions and verifies that original SHA256 hashes remain unchanged. Per-file results go to `materials-progress.json`; material files never enter Git.

After restoring an unavailable model endpoint, add `--reuse-home` to refresh the private test plugin and continue with the same acceptance library. Completed material versions are retained. Every PDF must complete before the real-model acceptance is reported as successful.
