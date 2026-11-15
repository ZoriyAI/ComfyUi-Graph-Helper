[Русский](Reading-ComfyUI.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Reading ComfyUI

How the app learns which nodes and models a ComfyUI has, without ever changing it.

<!-- verify: connection chapter. The connection is being rebuilt; check this page against the connection notes. -->

## Two ways in

| Way | Code | What it reads |
| --- | --- | --- |
| An MCP server next to ComfyUI (Streamable HTTP) | `src/main/mcp/` | Node types, node packs, model folders and files, files next to a model, a model file's fingerprint, the Ollama servers it runs. |
| ComfyUI itself | `src/main/comfy/read.ts` | `GET /object_info` (every node type with its inputs, outputs and allowed values) and `GET /system_stats`. Only at the saved address or one on this computer. |
| A file | File ▸ Load node list from file… | An `object_info` answer saved as JSON. |

## The read-only gate

Every MCP call goes through `readOnlySession` (`src/main/mcp/readOnly.ts`):

- `READ_ONLY_SCHEMAS` lists the tools the app may call and the exact shape of their arguments, each `.strict()` so an
  extra field is refused, not passed on.
- A tool that can also write (`workspace_files`) is allowed only its `read` action, only for a side file of a model
  or the `pyproject.toml` / `README.md` of a pack, and its `hash` action only for a model file.
- Anything else throws `McpRefusedError` before it leaves the app and is logged.
- A gateway that prefixes tool names (`gateway_comfy-models`) is detected (`detectToolPrefix`) and the prefix is
  stripped before the check.

Tests: `tests/unit/mcpCatalogSafety.test.ts` and the sync tests try every other tool and argument shape.

## The sync

`src/main/mcp/sync.ts`:

1. At start-up (when a sign-in or token is held and auto-sync is on) and then on the interval, or when the person
   chooses Sync ▸ Sync now.
2. Reads the node types and packs, then every model folder; a folder that fails keeps its previous list.
3. Stores them in `node_catalog`, `node_packs` and `model_catalog`; the catalog view is cached
   (`cachedCatalog` in `src/main/commands/commit.ts`).
4. Reads model metadata in the background in batches with pauses (Settings ▸ Sync), stops after repeated failures
   and backs off.
5. Writes the outcome to `sync_state` as fixed English sentences, which the window translates.

The sync status and its errors reach the window through the knowledge IPC (`src/main/ipc/knowledgeIpc.ts`).

## The catalog

`src/main/catalog/repository.ts` and `src/main/knowledge/repository.ts` answer the rest of the app: node types with
their fields (`src/shared/catalog/fieldSpec.ts`), models with their family and kind
(`src/shared/knowledge/baseModel.ts`, `modelKind.ts`), which loader reads which folder
(`src/shared/catalog/modelFolders.ts`), and search (`src/shared/knowledge/search.ts`).

## See also

- [For developers](README.md)
- [ComfyUI is only read](../trust/Read-Only.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
