# Reliability and teaching improvements

## Goal and authorization

Implement the defects found during the 15 November 2026 source audit, use existing maintained packages for general-purpose work, verify the result, merge it into main and publish the next release, v0.9.0. The user explicitly authorized implementation, the final merge and release publication. Legal adult 18+ technical education must not be blocked merely because the topic is NSFW; keep educational material factual, with consent and lawful use guidance for adult subjects.

## Baseline

- Main: `0bf6c06219b5395d88a5dcd283e1deb254471b49` (package version 0.8.0).
- Editor foundation: PR #22, `c6b60ae8b17dead47f069b7841b2beb632cde0ea`. This branch starts from that commit, preserving its history. Review its changes together with this work before merging.
- Main CI observed: 1,371 tests passed, two skipped. This is historical evidence, not a test run of these changes.
- Last earlier full run, on `5c1ed2b`, failed two Electron tests (single instance and Escape closing the subgraph Add Node dialog). Reproduce and resolve relevant failures before delivery.

## Global constraints

- Linux x64, Node 22, existing Electron/React/React Flow architecture and SQLite command transactions.
- ComfyUI remains read-only: do not queue generations, install models/nodes, or mutate an external ComfyUI.
- Reuse Zod, Vercel AI SDK, the MCP SDK, better-sqlite3, React Flow, Radix, i18next and existing test seams. PR22 already uses graphlib; do not add another homemade cycle algorithm.
- For any new generic algorithm or parser, first evaluate an existing package and its official API, license, Node/Electron compatibility and bundle impact. Domain decisions still belong in small project adapters. No speculative framework migration or bulk dependency upgrades.
- Preserve native unknown fields, subgraphs/groups, model metadata provenance, existing projects and settings. No rewrite of shared history or force push.
- The app must not inject topic-based prohibitions into its local assistant prompt. Give a general technical tutoring instruction; the person's subject is their choice. Adult educational material stays factual and non-graphic, with lawful/consensual 18+ guidance rather than a blanket app refusal. No instructions to override a provider/model's own rules. Do not remove user-controlled preview preferences.
- Each implementation task has focused regression tests, a scoped independent review, and one or more commits. Final whole-branch review and full verification precede the authorized merge.

## Findings that bind the implementation

1. Privacy: `sendFieldValues=false` omits graph parameters but `recentActionsText` still includes set-parameter values in the next model data block (`agent/turn.ts:200`, `agent/prompt.ts:325`, `shared/agent/recentActions.ts:81`). Synthetic private text must be absent from the actual outgoing context. Review tool-result sanitization at the same boundary.
2. Catalog: `upsertModelFiles` keeps previous enriched facts when file identity/source changes; enrichment only reads headers when enriched_at is null (`catalog/repository.ts:92`, `mcp/sync.ts:1083`). Filename alone is not identity.
3. Sync: direct reads write live tables before the outer cancellation check (`comfy/direct.ts:303`, `mcp/sync.ts:891`). An obsolete/cancelled sync must not publish a catalog belonging to another address.
4. Lessons: chosen means nonempty, and differs auto-fix picks the first other file, irrespective of purpose (`lessons/engine.ts:223,563`). Wrapper triggers are missing from UI facts; the global filename cache survives metadata/server changes (`lessons/lessonModel.ts:120`).
5. Editor: PR22 addresses format-1 new projects, selection clipboard/atomic edits, validation of cycles/links/widgets/subgraphs, replacement guards and proposal revision retention. Preserve and review these improvements.
6. Teaching/docs: the registry contains 45 lessons (20 base, ten image-family, 15 additional video lessons); README still says twenty and MCP only. Lesson path metadata exists but navigation is flat. Checker success is a static catalog result, not an execution guarantee.
7. Adult subject rules are inconsistent: lesson text allows adult real people with consent, while the assistant prompt and README exclude all real people. Align technical education, documentation and preferences around lawful consensual adult use.
8. AI-run undo can revert interleaved manual changes. Make the operation's grouping preserve later manual work or explicitly surface the interval before reverting; prefer ordinary contiguous undo semantics if compatible with the existing revision model.

## Review focus

- Actual outgoing model context, including recent commands, nested edits and tool round trips; logger masking alone is insufficient.
- A replaced model with the same name, and identical filenames on two servers; unknown identity must remain unknown.
- Cancellation at each async boundary with a delayed fake response; late responses cannot publish obsolete facts.
- Mixed model menus `[wan_high, flux_dev, wan_low]` and Wrapper trigger facts reaching the real UI adapter.
- Imported unknown native data, nested graphs, user-entered upload names absent from old combo lists, and manual edits interleaved with AI operations.

## Task 1: Privacy boundary

Files: `src/shared/agent/recentActions.ts`, `src/main/agent/prompt.ts`, `src/main/agent/turn.ts`, relevant tools/LLM boundary only as needed; `tests/unit/agent/` and existing integration seams.

- [ ] Add a failing regression: with sendFieldValues=false and a recent manual text/number edit, build the actual turn data and assert the private values are absent while action identity remains useful. Include true preference control and nested edits.
- [ ] Thread the privacy preference through recent action serialization, retaining existing redaction for secrets and default callers.
- [ ] Check the SDK tool-result boundary with synthetic known secrets. If a concrete gap exists, use a shared recursive sanitization adapter before SDK output, preserving structured types; test the second request/tool result rather than only logs.
- [ ] Run focused tests and type-check, self-review and commit. Record exact evidence in the task report.

## Task 2: Catalog identity and cancellation

Files: `src/main/catalog/repository.ts`, `src/main/comfy/direct.ts`, `src/main/mcp/sync.ts`, source identity helpers/migrations only if genuinely needed; existing fake sync/catalog tests.

- [ ] Add failing cases for replacing an enriched model with a new size/root/source, same-name different-source metadata, and unchanged identity retaining cached facts.
- [ ] Invalidate dependent header/hash/family/trigger/web/preview facts when identity changes. Use existing source/provenance state where possible. For same-size replacements without a fingerprint, provide an explicit refresh strategy rather than claiming reliable detection.
- [ ] Add delayed direct-sync regressions at packs/folders reads and address cancellation. Prevent writes from an obsolete generation, including live catalog content and provenance; publish a collected snapshot atomically using existing better-sqlite3 transactions.
- [ ] Preserve existing partial-read warnings and safe fallbacks. Run focused tests and type-check, review and commit.

## Task 3: Lesson facts and model roles

Files: `src/shared/lessons/engine.ts`, lesson definitions/types, `src/renderer/components/lessons/lessonModel.ts`, existing metadata APIs; lesson unit/UI tests.

- [ ] Add a failing mixed-catalog test: high/low video steps cannot choose flux_dev or a second high model as low. Use existing VIDEO_FILE_KINDS/model facts rather than a new filename-only classifier.
- [ ] Make role/family requirements participate in progress and auto-fix. Unknown candidates require an explicit useful choice and are never silently declared compatible. Keep generic chosen fields compatible.
- [ ] Collect trigger facts from each lesson's declared role/class+field sources, including WanVideoLoraSelect.lora. Distinguish pending/error from a proven absence of trigger words.
- [ ] Invalidate/reload lesson facts on catalog/source/model enrichment updates, including a previously empty response.
- [ ] Run focused engine and UI-adapter tests and type-check, review and commit.

## Task 4: Adult education, undo and accurate guidance

Files: assistant prompt, RU/EN lesson texts/wiki/README, lesson navigation, undo state and tests, relevant error display code.

- [ ] Remove app-authored subject-based prohibitions from the assistant system prompt; replace them with a neutral instruction to help the person learn and solve their ComfyUI task. Align adult lessons and docs around factual, non-graphic education about lawful consensual 18+ use; present consent/legality as guidance, not a blanket app refusal. Do not instruct models to override their own rules. Test the prompt/text contract in both languages.
- [ ] Use existing LESSON_PATH/LESSON_AFTER data to group the 45 lessons and show dependencies without forcing a linear course.
- [ ] Add the interleaved AI/manual undo regression and make undo preserve manual changes by grouping only contiguous AI steps (unless code review reveals a concrete incompatible invariant). Show unexpected manual commit errors rather than swallowing rejected Promises.
- [ ] Update README and connection/install guidance to match direct ComfyUI plus optional MCP; distinguish source package support from published release assets. Remove dead STATUS/decisions links. Say what graph checks prove and what remains unknown.
- [ ] Prepare version 0.9.0 in package.json/package-lock.json and docs/releases/v0.9.0.md; regenerate CHANGELOG with the existing script. Explain actual changes, supported package formats and remaining empirical limits. Publication is a later step after merge and package checks.
- [ ] Run focused tests and type-check, review and commit.

## Task 5: Editor integration regressions and UI checks

Files: `src/main/commands/commit.ts`, `innerEdits.ts`, `src/main/knowledge/check.ts`, scoped report contracts/renderer check UI, replacement guard, focused unit/Electron tests, `.github/workflows/ci.yml`.

- [ ] Integrate incoming main commit c4c1552c9813fd757f892b5ba295f3a590f0f0ed with a normal history-preserving merge. Preserve its advanced canvas/file-save-in-place/pending/replay/model-placement behavior and our reviewed privacy/guidance/catalog work. Inspect semantic clean merges as well as textual conflicts; use one clipboard/batch path, one graphlib cycle implementation and one nonduplicated field evaluator. Read merge-design.md before execution. The six original PR22 findings must be reassessed against the integrated equivalent code, not reapplied blindly to old line numbers.
- [ ] Resolve all six concrete findings in the independent PR22 review: valid nested-instance paste/duplicate; unknown native edge metadata preservation; invalid endpoint handles; subgraph report identity/focus; dirty empty-root replacement guard; ignore inactive local widget values for linked inputs.
- [ ] Add targeted regressions at the appropriate existing public seams, observe failures, then fix with the existing command/codec/graphlib machinery. Keep independent node ID spaces and reject recursive definitions.
- [ ] Add a read-only GitHub Actions Ubuntu/Xvfb journey job for editor-selection, subgraph-inner-authoring, privacy-confirm and relevant changed check/lesson UI tests. The local runtime prohibits Unix sockets, so local Electron cannot provide UI evidence. Keep fork tokens read-only and do not weaken app sandbox behavior to make tests launch.
- [ ] Run focused unit/type checks, review and commit. UI failures in CI must be resolved before the merge.

## Task 6: Release from the reviewed main branch

Files: `.github/workflows/release.yml`, minimal existing-tool-based planning helper if useful, relevant release behavior tests and developer release documentation.

- [ ] Extend the existing package/release workflow so a push to main can publish a new package version after its existing full E2E, screen walk, Linux package, installed-package/upgrade, checksum and attestation stages. Use existing GitHub CLI/Actions tooling, not a new deployment framework.
- [ ] A version already published is skipped; unversioned/manual/scheduled builds retain their existing behavior. Tag/version/notes must agree. Never overwrite or move an existing release/tag. Read/network failures must not be mistaken for proof that a release is absent.
- [ ] Keep the existing release environment gate and contents/id-token/attestation permission boundaries. No secrets in fork workflows and no automatic approval bypass.
- [ ] Verify meaningful scenarios for a new main version, an already-published version, manual/tag builds, version mismatch and API failure; type/build/config checks as applicable. Commit and obtain scoped review.

## Task 7: Integration, verification and merge

- [ ] Review the full diff from main, including PR22, with an independent reviewer; resolve important findings with scoped regression coverage.
- [ ] Node 22: clean install, `npm test`, `npm run type-check`, `npm run build`, privacy/public-tree and changelog checks; relevant Playwright Electron tests and the full non-live suite when available.
- [ ] Investigate earlier Escape/single-instance failures on this branch. Never hide failures or claim the earlier main/PR run is current verification.
- [ ] Push the feature branch, open a PR, inspect the exact head CI. Fix failures and recheck only affected/new concerns.
- [ ] Merge the reviewed green feature branch into main with an expected-head guard, preserving history. User already authorized this merge; do not ask for the same permission again.
- [ ] Verify main contains the merge and inspect its checks. Report the merge SHA, PR, test evidence and remaining empirical limits.
- [ ] Run the full release/package workflow for the exact reviewed main commit, inspect UI walks, package and upgrade smoke checks, checksums and attestation. Publish v0.9.0 with the resulting Linux assets only after those checks pass. User explicitly authorized this next release; no repeat permission question is needed.

## Empirical follow-up (not a claim of defects or completed verification)

Real official-frontend import/export of native subgraphs, a provenance-recorded corpus of user workflows, 100/500/1000-node timing, large inventories, Pop!_OS/Ubuntu 22.04 and desktop/keyring/DPI checks need the appropriate environment. Existing own-fixture round trips and a green static check do not prove all these properties. Corpus suites are skipped without WORKFLOW_CORPUS. Avoid promising stable generated identities or GPU memory budgets based on graph structure alone.
