# Initial ComfyUI format verification

Date: 2026-11-07 (Europe/Berlin)

Status: blocked before source verification. Research only; no implementation performed.

The required parallel-web-search skill was read. Its search command failed with exit code 127: parallel-cli: command not found. The skill explicitly requires stopping and requesting /parallel-setup; no alternative search provider was used.

No official sources were opened or verified. Consequently, no claims about UI workflow JSON versus API prompt JSON, native subgraph serialization/export compatibility, node metadata, validation, or execution endpoints are confirmed by this run.

Intended source scope: https://docs.comfy.org/ and official ComfyUI source repositories. These are research targets, not verified citations.

Next step: run /parallel-setup, then repeat the narrow documentation verification. No repository, user workflows, or user ComfyUI instance was accessed.

---

## Resumed verification — 2026-11-07 (Europe/Berlin)

Original blocked-run history above is retained. Completed one narrow Parallel CLI search (status ok, warnings empty), followed by official documentation/source reads. Search payload: `/tmp/comfyui-formats-verified.json`. No user ComfyUI instance accessed, workflow executed, media generated, implementation written, or architecture selected.

### Confirmed

1. UI workflow JSON persists editing state: nodes, links, positions/sizes, groups and version (documented v1.0 and legacy v0.4). API prompt JSON is a mapping of node execution IDs to `class_type` and `inputs`; connections use `[source_id, output_index]`. It omits layout, not necessarily all metadata (`_meta.title` is shown). Export: File → Export Workflow (API). Sources: https://docs.comfy.org/specs/workflow_json ; https://docs.comfy.org/development/api-development/workflow-api-format . Caveat: the latter page's simplified “node keys” table is not a literal UI schema; the schema has a nodes array.
2. Native subgraphs are reusable nested LGraphs with UUIDs. Exported subgraph JSON uses the workflow JSON format (not a distinct API prompt format). Official blueprint procedure: select nodes, convert to subgraph, export JSON; custom-node `subgraphs/*.json` are exposed via `/global_subgraphs`. Sources: https://docs.comfy.org/custom-nodes/subgraph_blueprints ; https://docs.comfy.org/custom-nodes/js/subgraphs .
3. Version constraints: native subgraphs require frontend >=1.24.3; publishing blueprints to the node library requires >=1.27.7. Widget promotion remains evolving. Node IDs are graph-local; execution IDs can be colon-separated paths such as `1:2:3`, so API IDs cannot universally be assumed numeric. Sources: https://docs.comfy.org/interface/features/subgraph ; https://docs.comfy.org/custom-nodes/js/subgraphs . Official frontend graphToPrompt serializes UI workflow separately and enumerates inner executable nodes into API output: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/utils/executionUtil.ts (lines 59–124 in retrieved snapshot).
4. Local server GET `/object_info` and GET `/object_info/{node_class}` expose registered node metadata, including inputs/outputs and presentation/category flags. Source: https://github.com/Comfy-Org/ComfyUI/blob/master/server.py (node_info and routes around lines 832–911). Cloud uses `/api/object_info`: https://docs.comfy.org/api-reference/cloud/node/get-all-node-information . Do not conflate Cloud and local contracts.
5. Local POST `/prompt`, body containing `prompt`, calls execution.validate_prompt; if valid it enqueues execution and returns prompt_id, number, node_errors; invalid prompt returns HTTP 400 with error and node_errors. It is NOT a safe validation-only dry run. GET `/queue`, GET `/history/{prompt_id}` expose queue/history. Source: https://github.com/Comfy-Org/ComfyUI/blob/master/server.py (lines 1137–1246). No separate validation-only HTTP endpoint confirmed by this narrow check.

### Unknown / not established

- No specific installed backend/frontend versions, custom nodes, model availability or user workflows supplied; their compatibility is untested.
- No universal forward/backward compatibility guarantee, lossless API-to-UI reconstruction, or complete versioned schema for every native-subgraph field established. Public workflow schema alone does not enumerate a complete native-subgraph representation.
- No promise of compatibility with third-party group-node implementations established.
- Source URLs track master/main and may change; source snapshots saved under `research/sources/server-2026-11-07.py` and `research/sources/executionUtil-2026-11-07.ts`. GitHub source page fetch returned no source body; public raw.githubusercontent.com versions were read as fallback.

Research stopped here; no implementation started.
