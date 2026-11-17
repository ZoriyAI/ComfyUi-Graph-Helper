[Русский](Architecture.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Architecture

NodeWise Studio is an Electron app: one main process, one window, and a small preload script between them. This page shows
how they divide the work and how one change travels from a click to the database and back.

## The three parts

| Part | Runs in | Does | Where |
| --- | --- | --- | --- |
| Main | Node.js | Owns the database, the files, the network and every secret. Applies commands, runs the assistant's turns, reads ComfyUI. | `src/main/` |
| Preload | the window, before the page | Gives the page one object, `window.electronAPI`, with a fixed list of calls. Nothing else of Node or Electron reaches the page. | `src/preload/index.ts` |
| Renderer | Chromium, sandboxed | Draws everything: the canvas (React Flow), the panels, the chat, settings. Holds a projection of the graph, never the truth. | `src/renderer/` |
| Shared | both | Types, schemas, the workflow codec, the catalog of texts, lessons and built-in knowledge. Pure code, no Electron. | `src/shared/` |

Rules that hold everywhere:

- **Main is the only writer.** The renderer asks; main checks, applies and answers with the new state.
- **Secrets never reach the renderer.** Keys and tokens live in main; the window learns only whether one is held and
  where. [Security](../trust/Security.md)
- **Catalog access is read-only.** ComfyUI catalog and MCP requests pass read-only gates. A separate upload path accepts only explicitly selected media, with no overwrite.
  [Catalog reads and selected-file uploads](../trust/Read-Only.md)
- **Every IPC call is checked:** the sender must be the app's own page, and the input must match its schema.
  [IPC between window and main](IPC.md)

## How a change travels

Take "the person drags a node":

1. **Renderer.** The canvas builds a command: an `actionId` (a fresh id), the `expectedRevisionId` (the version the
   window shows), `actor: 'manual'`, and a payload such as `{ type: 'move-node', … }`. Every canvas edit goes
   through `src/renderer/components/graph/commit.ts` to `submitManual` in
   `src/renderer/services/commands/projection.ts`.
2. **Preload.** `window.electronAPI.commitCommand` sends it on the `command:commit` channel.
3. **Main, the guard.** `src/main/ipc/guard.ts` refuses a sender that is not the app's page.
4. **Main, the engine.** `commitCommand` in `src/main/commands/commit.ts` checks the request against its schema and,
   in one SQLite transaction: refuses a version that is not the current one (a *conflict*), applies the payload to the
   current graph, writes a new row in `graph_revisions`, points the project at it, records the command in
   `applied_commands` (so a repeat of the same `actionId` is answered from the record, not applied twice), and updates
   explanations and open proposals.
5. **Back.** Main answers `applied`, `historical`, `conflict` or `rejected`, always with the current *projection*: the
   graph, its version and the open run.
6. **Renderer.** The stores (`src/renderer/state/`) take the projection; React redraws.

Undo is the same trip with the payload `restore-revision`. The assistant's changes take the same trip from main
itself, with `actor: 'ai'` and the id of its run. Details: [The command engine and history](Command-Engine.md).

## How an answer of the assistant travels

1. The renderer starts a run (`startRun`) and opens a stream on `llm:stream-chat`
   (`src/renderer/services/llm/chatService.ts`).
2. Main builds the prompt from the graph, the catalog and the recent actions, and calls the chosen model through the
   AI SDK (`src/main/agent/turn.ts`, `src/main/llmService.ts`).
3. Each tool call the model makes is checked and run in main: reading the catalog, searching the web, proposing a
   draft, or, in a build, committing a command as above.
4. Main streams text, steps and new projections back; the chat and the canvas draw them as they come.
5. The turn ends, pauses at the step limit, or is stopped by the person.

Details: [How the assistant works](Assistant-Internals.md).

## How ComfyUI is read

The sync (`src/main/mcp/sync.ts`) reads node types, node packs and model files through the read-only MCP tools, or
`/object_info` straight from ComfyUI, and stores them in the catalog tables. Model metadata is read in the background
in batches. Details: [Reading ComfyUI](Reading-ComfyUI.md).

## Recipes

| To add | Read |
| --- | --- |
| A tool for the assistant | [Adding a tool for the assistant](Adding-A-Tool.md) |
| A setting | [Adding a setting](Adding-A-Setting.md) |
| An IPC channel | [IPC between window and main](IPC.md) |
| A database migration | [The database and migrations](Database.md) |
| A lesson | [Writing a lesson](Writing-A-Lesson.md) |
| Built-in knowledge | [Writing built-in knowledge](Writing-Knowledge.md) |
| A language | [Texts and languages](Texts-And-Languages.md) |
| A link from the app to a wiki page | [Context help ids](Context-Help.md) |

## See also

- [For developers](README.md)
- [Code map](Code-Map.md)
- [Code words and screen words](Code-Words.md)
