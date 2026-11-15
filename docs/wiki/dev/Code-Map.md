[Русский](Code-Map.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Code map

Each folder of `src/` and what lives there. How the parts work together: [Architecture](Architecture.md).

## `src/main`: the main process

| Folder or file | What lives there |
| --- | --- |
| `index.ts` | Start-up: single instance, profile folder, log, database, window, Chromium switches. |
| `ipc.ts`, `ipc/` | IPC handlers, grouped: `engineIpc`, `agentIpc`, `knowledgeIpc`, `diagnosticsIpc`, `aboutIpc`; `guard.ts` checks every sender. |
| `commands/` | The command engine: `commit.ts` (commit, runs, projection), `graphOps.ts`, `innerEdits.ts` (edits inside a subgraph), `placement.ts`, `history.ts` (pruning). |
| `agent/` | One turn of the assistant (`turn.ts`), its prompt, read tools (`tools.ts`), build tools (`buildTools.ts`), web search and page reading (`web.ts`), chat history. |
| `llmService.ts`, `llm/` | Calls to the model through the AI SDK; local servers: model lists, discovery, the loaded context window. |
| `mcp/` | The MCP client, the sync (`sync.ts`), the read-only gate (`readOnly.ts`), OAuth sign-in, the token file. |
| `comfy/` | Reading `/object_info` and `/system_stats` straight from ComfyUI. |
| `catalog/`, `knowledge/` | The catalog in the database; explanations, the graph check, model metadata, web lookup of models, previews. |
| `proposals/` | The assistant's drafts (ghost nodes and links) and when they go stale. |
| `settings/` | Migrations, database safety copies, keys (`keyFile.ts`, secret probes), the password store choice, forget all. |
| `trace/` | The conversation log with the model. |
| `files/` | Atomic file writes. |
| `log.ts`, `crash.ts`, `diagnostics.ts` | The log with redaction, error handling, copied diagnostics. |
| `identity.ts` | The app's names, the project address and the user agent. |
| `cli.ts` | `--version` and `--help`. |

## `src/preload`

`index.ts`: the `window.electronAPI` object and its type, `ElectronAPI`. It carries its own copy of the channel names,
because a sandboxed preload cannot import from other files.

## `src/renderer`: the window

| Folder | What lives there |
| --- | --- |
| `components/graph/` | The canvas: nodes, ports, links, layers (descriptions, build, tour), context menu, add-node search, inspector. |
| `components/chat/` | The assistant panel and its build card. |
| `components/library/` | The library of nodes, models and subgraphs, node and model cards. |
| `components/lessons/` | The lesson panel. |
| `components/explain/`, `components/check/` | The explanations and check tabs. |
| `components/settings/` | The settings window, one file per section. |
| `components/shell/` | Menu bar, toolbar, status bar, dialogs, About, the Help reader. |
| `components/sync/`, `components/log/`, `components/fields/` | The sync indicator, the conversation log window, field controls. |
| `commands/` | The command registry (`appCommands.ts`), shortcuts, actions. |
| `services/` | Talking to main: commands and projection, chat, help, diagnostics. |
| `state/` | Zustand stores: graph, chat, UI, preferences, lessons, proposals, undo. |
| `ui/` | The design system: buttons, dialogs, fields, toasts (see `src/renderer/ui/README.md`). |
| `theme/`, `motion/` | Colour tokens, the contrast table, motion policy. |

## `src/shared`: used by both

| Folder | What lives there |
| --- | --- |
| `commands/` | Command and payload schemas, tool specs shared with the renderer. |
| `workflow/codec.ts` | Reading and writing ComfyUI workflows without losing anything. |
| `graph/` | Ports, link types, compatibility, layout, subgraphs. |
| `catalog/` | `object_info` parsing, field specs, which loader reads which model folder. |
| `knowledge/` | Built-in knowledge (`coreKnowledge.*.ts`), model families and kinds, search. |
| `lessons/` | The lessons and their texts. |
| `agent/` | What the assistant sees: graph summaries, recent actions, limits, redaction, error kinds. |
| `config/` | Settings and preferences schemas, key policies, the password store flag. |
| `contracts/` | Types of IPC calls shared by main, preload and renderer. |
| `i18n/` | The catalog of texts in English and Russian. |
| `help/` | Context help ids. |
| `ipc-channels.ts` | The channel names. |

## Around `src`

| Path | What lives there |
| --- | --- |
| `tests/unit`, `tests/integration`, `tests/e2e`, `tests/corpus` | The tests: [Testing](Testing.md). |
| `scripts/` | Build assets, changelog, smoke checks of the package, icons, screenshots, the public copy. |
| `resources/` | Icons and the desktop entry template. |
| `docs/wiki/` | This wiki; bundled into the app's Help. |
| `docs/releases/` | Release notes, one file per version and language. |
| `forge.config.js` | Packaging: the `.deb` maker and the Electron fuses. |

## See also

- [For developers](README.md)
- [Architecture](Architecture.md)
- [Code words and screen words](Code-Words.md)
