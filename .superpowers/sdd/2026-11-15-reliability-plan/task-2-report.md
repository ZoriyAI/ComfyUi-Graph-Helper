# Task 2 implementation report

Status: implemented and locally verified, awaiting independent review/integration.

Base: `c1295e0c7b326c6884d4dfbf0a68b10eddf823c5`.
Implementation commit: `2d19048` (`fix(catalog): publish source-aware snapshots and cancel obsolete reads`).
Branch: `codex/reliability-learning-20261115`. No push, merge, rebase, Electron run or live ComfyUI/model call was performed.

## Result and boundaries

- `upsertModelFiles` compares known size and normalized known root before updating. A changed observed identity resets enrichment time, SHA-256, family/evidence, triggers, description/source URL, header/sidecar notes, sidecar-read state, web facts/family and preview facts. Present newly listed sidecar/preview fields are applied after reset. Unknown size/root does not erase known identity; Windows path case/slash/trailing-separator spelling is equivalent. Root writes use the existing path normalizer.
- Current source keys are SHA-256 digests of canonical tuples, never raw endpoint strings. MCP source identity includes normalized full endpoint (path/query retained, fragment dropped), the captured normalized Comfy origin when bound to a mixed read, and a reported installation id. A missing id retains the previously reported id for the same connection. Keys live in main-only `sync_state`; no endpoint source key is exposed to renderer.
- A changed source clears only `model_catalog`, `node_catalog`, `node_packs` and the obsolete server-derived provenance/backoff fields, then reseeds placeholder nodes. A legacy catalog with no tracked source is conservatively rebuilt on its first identified publication. Projects, revisions, chats and user explanations are untouched. Explicit regression covers projects/revisions/explanations.
- Same-source failed model folders preserve their prior facts. Different-source failed folders cannot inherit old facts. New `object_info` may independently supply fresh model-name placeholders even when that folder listing failed. Their old size/root/header facts do not survive. Missing whole model sections preserve same-source rows. Manager-unavailable module fallback remains a normal successful fallback. Oversized direct inventories and checkpoint lists are not treated as complete truncated inventories.
- A size/root/fingerprint-stable replacement is not reliably detected. Supported headers with an available metadata tool become due again after 24 hours, at the next sync. Recent unchanged rows stay cached. This refreshes available header facts, does not hash huge files and does not prove byte identity. The capability state prevents endless refresh work when a metadata tool is unavailable. The interval/limitations are documented in `docs/DEVELOPMENT.md`.

## APIs and publication

`comfy/direct.ts` now exports:

- `collectComfyDirect(address, fetchImpl, options): Promise<DirectCollectedResult>`: network/parser work only; no SQLite writes.
- `DirectCatalogSnapshot`: existing read result plus parsed object info, pack rows and model file rows.
- `publishComfyDirect(db, snapshot, now, options): DirectReadSuccess`: one synchronous existing better-sqlite3 immediate transaction for source transition, node/pack/model publication, stale deletion, name inference, revision and optional synchronous provenance callback.
- `readComfyDirect(...)`: compatibility collect/check/publish wrapper.

`DirectReadOptions` adds optional `signal`, `sourceKey`, and a synchronous, non-emitting `publishState(result)` callback. SyncService uses that callback to commit captured source provenance, roots, server identity, listing timestamp and warnings with the catalog, before first enrichment I/O. A callback exception rolls back every catalog table, source and revision. Status emits after commit. A later metadata failure may update last error/duration without erasing the accepted listing.

`upsertModelFiles(db, files, syncedAt, { sourceKey? })` keeps its existing first three arguments. Repository exports the small source/revision helpers; it never reads Settings implicitly. No schema migration or generic transaction framework was added.

MCP scope was also made concrete rather than leaving early writes behind: `readCatalogWithSession` collects existing parsed sections as synchronous write operations, then applies those operations and its optional `CatalogReadContext.publishState(detail)` in one immediate transaction. Profiles return collected files/complete-folder scope rather than writing directly. The native object-info fallback has an optional collection callback, so mixed reads are also deferred until publication. MCP sessions are checked before/after every awaited catalog page; a closed fake session that resolves later still cannot publish. Endpoint context is passed by both real entry points (`SyncService` and `readCatalogViaMcp`). Source-less unit callers remain supported but cannot establish a new source identity.

This implements and tests atomic catalog-table/listing-provenance publication for the exercised direct and MCP catalog paths. It is not a claim that every effect of an MCP run is one transaction: connection auth outcome is remembered separately, and pack details, metadata batches, backoff and web outcomes are later accepted updates. No SQLite transaction spans network awaits.

## Cancellation and preview identity

`RunTicket` now owns an AbortController and monotonic generation. Address change/stop invalidate the generation, abort HTTP reads and close the current MCP session. The first enrichment batch and later batches share ticket validity. Metadata, sidecar, preview-marker, pack-info and failure-map writes check validity after awaited work. Preview discovery returns a fact first; only an accepted enrichment transaction writes the marker and metadata. Obsolete finally blocks cannot replace the current source's backoff state. Web outcomes are generation-guarded too.

Review found that resetting preview fields alone could still reuse old disk bytes: previous MCP preview keys omitted source, and direct keys omitted root/size. `PreviewReader` now namespaces model previews by the opaque catalog source and observed file identity, closes its old session when it observes a source change, and uses its own generation to discard obsolete queued/opening/read results before caching. Existing cache size limits remain. Cached public web samples retain their URL-based keys.

## Notification API for Task 3

`SyncStatus.catalogRevision?: number` is optional for backward compatibility. Main reads it from `sync_state.catalog_revision`, defaulting to 0. No new IPC channel or renderer source-key field was introduced.

The counter advances inside accepted catalog publication, accepted model-fact/preview transactions, pack-info updates, web outcomes, and offline `object_info` import. Model enrichment increments per accepted row; events occur through the existing progress/status subscription after writes, so callers must treat it as a monotonic change token rather than expect increments of exactly one per entire sync. Progress, failed collection and cancelled obsolete work do not advance it. Offline import now bumps revision with its catalog write and invokes `syncService.notify(db)` after commit.

Existing route: `SyncService.onStatus` -> knowledge IPC broadcast `sync:event` -> preload `onSyncEvent` -> renderer knowledge-store `sync`. Task 3 can key/clear node and trigger caches by this revision and ignore in-flight lookup responses from an older revision. Filename/counts/Settings are insufficient cache identities. `catalog_source_key`, connection digest and installation record remain main-only.

## Tests and evidence

All commands used Node 22 by prepending `/workspace/scratch/d427e7b3fb7a/toolchain/node_modules/node/bin` to PATH. Tests used deterministic fetch/session doubles or labelled local fake HTTP/MCP fixtures; no production services were contacted.

Red evidence:

1. Before implementation, `npx vitest run tests/unit/catalogReliability.test.ts` had **4 failed / 1 passed**: known size and root replacements retained old enriched/web/hash facts; delayed manager/final-folder reads had already changed live catalog tables.
2. The completed public rollback and first-preview cancellation regressions were replayed in a detached temporary checkout at the exact base SHA with the same dependencies: `npx vitest run tests/unit/catalogReliability.test.ts -t 'publication callback failure rolls back the public|a cancelled first preview preserves'` had **2 failed / 26 skipped**. Baseline ignored the publication callback; cancelled first preview wrote preview bytes' signature, header facts and `enrich_failures` into the published database.
3. The preview byte-cache regression ran red before the cache change: source changed but returned old cached byte 1 instead of new byte 2.

Green checks (final passing invocations; earlier intermediate failures were corrected):

| Command / scope | Result |
| --- | --- |
| `npx vitest run tests/unit/catalogReliability.test.ts tests/unit/mcpSync.test.ts tests/unit/mcpCatalogSafety.test.ts tests/integration/comfyDirect.test.ts tests/integration/syncAddress.test.ts tests/integration/fakeMcpSync.test.ts` | 6 files / 85 tests passed (new regression file contained 28 cases at that point) |
| `npx vitest run tests/unit/catalogReliability.test.ts tests/integration/mcpProfiles.test.ts tests/integration/modelWebSync.test.ts tests/unit/comfyGate.test.ts tests/unit/modelLibrary.test.ts` | 5 files / 56 tests passed (29 regression cases at that point) |
| After preview change: `npx vitest run tests/unit/catalogReliability.test.ts tests/unit/previewCacheLimit.test.ts tests/integration/fakeMcpSync.test.ts tests/integration/comfyDirect.test.ts` | 4 files / 50 tests passed (31 regression cases at that point) |
| Final `npx vitest run tests/unit/catalogReliability.test.ts` | **32 / 32 passed**, no unhandled errors |
| Final `npm run type-check` | Passed: main and renderer TypeScript |
| `git diff --check` / staged diff check | Passed |

The 32 new regressions include known/unknown/Windows identity, same-name direct and both simple MCP profiles, installation omission/change, endpoint query/fragment normalization and secret-free source keys, same-source/different-source failed folders, models-unavailable and manager fallback, oversized inventory, direct and MCP rollback, delayed manager/folder-folder-file cancellation with DB/provenance/revision snapshots and HTTP abort observation, first metadata/preview cancellation, delayed background metadata, delayed pack-info, daily refresh, revision notification, preview byte-cache identity and obsolete preview session/cache writes, and user data preservation.

Two existing integration assertions were updated for intended behavior: a different-source failed folder must have no inherited file identity (fresh object_info placeholders are allowed); `libraryUrl` now changes at listing commit, so completion polling also waits for state idle rather than assuming provenance appears only after metadata completes.

## Limits / integration notes

- The full repository test suite, Electron/UI tests, production network, real ComfyUI filesystem, GPU and real model reads were not run. Focused fake integrations were available and passed in this environment despite the initial concern about sandbox sockets.
- Same-size/root replacements without a fingerprint remain inherently ambiguous. Daily header refresh does not verify cached file hashes or redownload a preview whose observed identity and signature are unchanged.
- Catalog revision notifies consumers but Task 3 still needs renderer cache invalidation and stale-response handling. Existing user-initiated model lookup services outside SyncService were not refactored here.
- No per-row source migration was added; one catalog represents one published source binding. Switching sources intentionally rebuilds server-derived rows.
- Incoming main was reported as `c4c1552c9813fd757f892b5ba295f3a590f0f0ed`; this implementation stayed on the requested branch/base. `src/main/ipc.ts` and `src/shared/contracts/knowledge.ts` overlap that incoming editor/file-save change and need careful integration. The IPC import change is confined to `importCatalogFile` plus its repository import; the contract change is only the optional SyncStatus field.
- The pre-existing concurrent edit in `docs/research/2026-11-15-reliability-plan.md` was deliberately left unstaged and uncommitted.
