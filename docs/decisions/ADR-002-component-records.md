# ADR-002: App component records and a native project file

## Status

Accepted for the desktop branch on 2026-11-08.

## Sources checked before the contract

- ComfyUI workflow JSON, version 1 and legacy 0.4: https://docs.comfy.org/specs/workflow_json (fetched 2026-11-08). Required workflow fields include `version`, `state`, and `nodes`. `extra` allows `ds`, `info` (including `description` and `modified`), `linkExtensions`, and `reroutes`, and additional properties. Node `properties` is an open object. This page does not enumerate subgraph definitions.
- ComfyUI subgraph product behavior: https://docs.comfy.org/interface/features/subgraph (fetched 2026-11-08). Native subgraphs need frontend >= 1.24.3. They are nested graphs, not groups. This build does not open a subgraph canvas.
- ComfyUI frontend schema at commit `8854fbde1900b4f2aaf97c9005f5e386bfb2ce8d`, `src/platform/workflow/validation/schemas/workflowSchema.ts`. Subgraph definitions live at `definitions.subgraphs` and may nest another `definitions.subgraphs`. A definition has `id` (UUID), `revision`, `version: 1`, `name`, nodes, links, `inputNode`, and `outputNode`. `description` is an optional Comfy tooltip. The same file allows additional properties on nodes, groups, and `extra`.

No remote translation service and no second database are involved.

## Decision

Each canvas node and each subgraph definition with a string id has one app component record: stable id, owner kind (`node` or `subgraph`), owner id, purpose, and usage. Empty text is a real empty record. Records are reconciled on read and on every command. A deleted node or subgraph drops its record. A missing owner in a native file is reported as an orphan and is not kept. Duplicate owners in one native file are rejected. Two subgraph definitions with the same id keep the first identity and report the duplicate. A subgraph object without an id is counted and is not given a generated id, so export does not invent Comfy data.

Records and process metadata (`title`, `notes`) are stored on the existing `graph_revisions` rows. Schema version 7 adds `components` and `process_meta`, both defaulting empty. Version 8 and above is rejected. The settings table is unchanged.

The native project file is `comfy-graph-helper-project` version 1. It holds the internal graph (nodes, edges, and the preserved Comfy document), the component records, and process metadata. Version 0 of that same format, which may omit records and process metadata, upgrades to version 1 in memory. Any other version is rejected. A Comfy workflow file is not a native project.

Save project and Open project are separate actions from Import and Export. Comfy export still projects the preserved workflow, then deletes only these app-owned keys at every depth: `graphHelper`, `componentRecords`, `appComponents`, `comfyGraphHelper`, and `processMeta`. Supported Comfy fields, including subgraph `description`, node `properties`, and unknown Comfy fields, stay. Component text is never copied into those fields. `extra.graphHelper` was written by an earlier build and is now omitted.

`setComponentDocumentation` is a normal command tool. The purpose and usage strings are stored and audited. They are not executed. User-authored text is not translated when the interface language changes.

## Boundary

This build lists nested subgraph definitions and edits their component records. It does not convert groups into subgraphs, unpack subgraphs, or edit the inside of a subgraph on the canvas.
