# Polish wave: what a person meets, and what is still wrong

Date: 2026-11-10. Lead audit of the built app (v0.2.7) by screenshots of a fresh and a populated profile
(fake MCP server with 40 node classes and 30 model files) and by reading the code behind every dead end.
The measure is the owner's brief (`2026-11-08-helper-brief.md`): a helper for a person who does not know ComfyUI.
"Человек не машина": whatever the app can read, it offers; whatever it shows, a newcomer can read.

## Findings

### F1. Node fields are not controls (the biggest gap)
- On the canvas a node lists every input as a port row, widget inputs included: `lora_name COMBO`,
  `strength_model FLOAT`, `seed INT`, `sampler_name COMBO` look like sockets. The values sit in a small read-only box
  at the bottom (first three, then "+3 ещё").
- Properties edits every field through one plain text input: `sampler_name` and `scheduler` are typed from memory,
  `lora_name` is a text field although the catalog knows every option, numbers have no range, prompts are one line.
- The catalog parser already reads combo `options` and defaults; `min`/`max`/`step`/`multiline`/`tooltip` are dropped,
  and `NodeClassDetail.inputs` exposes only `{name, type, widget, required}`.
- The owner has ~300 LoRAs: a model field must be a picker of *their* files with family and kind, and must say which
  ones fit the checkpoint upstream.

### F2. No layout: nodes land on top of each other
- The helper passes `x`/`y` with every `add-node`; nothing checks for collisions. A build on a canvas that already
  has nodes stacks new nodes under old ones (seen: CheckpointLoader under Load LoRA, KSampler over both prompts).
- There is no "arrange" command. A fit view of 6–9 nodes shows them at 43–45 % zoom where no text is readable.
- "Следить за помощником" is off by default, so a build happens off screen.

### F3. The live build is told twice and too loudly
- The strip says "Агент собирает граф" (it is "Помощник" everywhere else) and "Показать всё сразу" appears twice
  (canvas toolbar and strip).
- Every build step is a full card in the chat: a 16-step build is 16 cards, each with an English line
  ("Added CheckpointLoaderSimple node") that comes from the tool result message.
- A proposal card carries two statuses ("применено" for the tool call and "Предложено" for the proposal).
- Nothing closes the build: no summary, no "what next" (tour, check, save).

### F4. Models are a list, not a helper
- Clicking a model only selects the row. There is no card with what it is, its family, trigger words, what it fits,
  and no "put it on the canvas" action; asking the helper is the only path.
- The filter row is misaligned (the "Базовое семейство" label wraps and pushes its select down).
- LoRA compatibility is checked only for core loaders.

### F5. Shell noise
- Two "+" icons side by side on the canvas toolbar (add node, zoom in). Add, fit and descriptions are duplicated
  between the top toolbar and the canvas toolbar. Icons without labels for the primary actions.
- Top right: a status pill "Не выбран" next to a select that says "Не выбран"; neither says what is not chosen.
- Every dock tab repeats its own name as a heading right under the tab ("Помощник / Помощник").
- The send button in the composer reads as dim text.
- Check findings name nodes by id ("ноды 1", "ноды 2"); the subgraph list shows a raw UUID.
- Russian still says "узел" in 13 strings ("Удалить узел") and "Агент" in 3; the context menu has no icons and
  says "Документация компонента".
- The settings footer shows the password-store note on every section.

### F6. Correctness
- One key slot for all cloud providers: a key pasted for Anthropic shows "Ключ на эту сессию" on OpenAI and Google
  and would be sent to them after a switch. A rejected key stays held.
- Groups cannot be renamed; edits inside a subgraph definition (moves, field edits) are not saved.

## Work packages (one coder each, own worktree; the lead merges)

| WP | Scope | Owns |
|---|---|---|
| 1 Fields | F1: field metadata end to end, field controls on the node and in Properties, model picker with fit | `shared/catalog/objectInfo.ts`, `main/catalog/repository.ts`, `shared/contracts/knowledge.ts` (inputs), `renderer/components/graph/nodes/*`, `Inspector.tsx` (parameters, ports), new `renderer/components/fields/*` |
| 2 Layout | F2: free-slot placement, "Разложить граф", tidy after a build, overview zoom, follow on by default | new `shared/graph/layout.ts`, `renderer/components/graph/lib/geometry.ts`, `CanvasFlow.tsx`, `CanvasToolbar.tsx`, `renderer/commands/*`, `shared/config/preferences.ts` (defaults), canvas CSS for the overview level |
| 3 Build & chat | F3: strip, callouts, grouped build card, localized step lines, one status, build summary, composer | `renderer/components/chat/*`, `renderer/components/graph/layers/BuildLayer.tsx`, `LiveBuildStrip.tsx`, `main/agent/buildTools.ts` (result shape only) |
| 4 Models | F4: model card, add to canvas, filters, compatibility beyond core loaders | `renderer/components/library/*`, `renderer/components/graph/lib/modelLoaders.ts`, `main/knowledge/*` (check, model detail) |
| 5 Shell | F5: toolbars, top bar, dock headings, context menu, wording, findings by name, settings footer | `renderer/components/shell/*`, `GraphContextMenu.tsx`, `renderer/components/check/*`, dock container, `settings/SettingsPanel.tsx` footer, wording in `shared/i18n/catalog.ts` |
| 6 Engine | F6: per-provider keys, rejected key dropped, group rename, edits inside a subgraph saved | `main/llmService.ts`, `main/ipc.ts` (key handlers), `main/settings/*` (key records, key file), `KeyPanel.tsx`, `shared/commands/*`, `shared/graph/subgraphs.ts`, `main/commands/*` |

Shared rules: `shared/i18n/catalog.ts` is touched by everyone, add keys next to their section and keep en/ru parity
(Russian is primary and must read naturally; one word for a node: «нода»; the helper is «Помощник»). Commit after
each finished step. Keep `npm run type-check`, `npm test`, `npm run build` green; run the e2e tests that cover what
you changed, and the full suite once at the end with `--workers=1`. ComfyUI is never modified: nothing new in the MCP
allowlist that writes, queues, installs or deletes. Secrets never reach the renderer, logs, prompts or exports.
