[Русский](Reading-ComfyUI.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Reading ComfyUI

How the app learns which nodes and models a ComfyUI has, without ever changing it.

## The ways in

| Way | Code | What it reads |
| --- | --- | --- |
| ComfyUI itself, at the saved address (the main way) | `src/main/comfy/direct.ts`, through `src/main/comfy/gate.ts` | `/object_info` (node types, stale ones removed), `/system_stats` (its command line is never stored), model folders and files with sizes from `/experiment/models` (or `/models`), `.safetensors` headers through `/view_metadata` in background batches (a 404 means "no metadata"), a model's preview, and packs from ComfyUI-Manager's `/customnode/installed` when it answers, otherwise from each node's `python_module`. |
| An MCP server (optional, Streamable HTTP) | `src/main/mcp/`, recognised by `src/main/mcp/profiles.ts` | By its kind: `catalog` (everything, plus side files, pack files and fingerprints), `modelList` (only `list_local_models {action:'list'}`), `checkpointList` (only `list_models {}`); nodes for the last two come from ComfyUI. An unknown server is not called. |
| A file | File ▸ Load node list from file… | An `object_info` answer saved as JSON. |

Windows paths in a server's or ComfyUI's listings (drive letters, backslashes) are accepted
(`src/shared/mcp/serverPaths.ts`).

## The ComfyUI gate

`src/main/comfy/gate.ts`: `GET` only, `redirect: 'manual'`, a byte cap and a time limit per route. Routes come only
from the `COMFY_ROUTES` constructors, and a second list of patterns checks every request; folder and file names are
checked and encoded. Every request to a ComfyUI goes through it, the port probes of Find on this computer included.
`tests/unit/comfyGate.test.ts` proves that `/prompt`, `/queue`, `/interrupt`, `/free`, `/history`, `/upload/*`,
`/userdata`, `/settings` and Manager's install and reboot routes are refused, that a forged route never reaches
`fetch`, and that no module in `src/main/comfy` calls `fetch` itself.

What was not yet tried on a real install is listed in [Releasing](Releasing.md).

## The MCP gate

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

1. At start-up when auto-sync is on (with either address), then on the interval, or when the person
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
