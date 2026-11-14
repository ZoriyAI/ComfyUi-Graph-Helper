import { z } from 'zod';
import type { GroupRecord, SubgraphDefinition } from '../graph/subgraphs';

export const subgraphIOSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  nodeId: z.string().min(1),
  handle: z.string().min(1),
});

// ── Layout: one commit moves many nodes, so an arrangement is one undo step. ─────────────────────────
export const MOVE_NODES_MAX = 5000;
export const moveNodesMutation = z.object({
  type: z.literal('move-nodes'),
  moves: z.array(z.object({
    nodeId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
  })).min(1).max(MOVE_NODES_MAX),
});
// ── end layout ────────────────────────────────────────────────────────────────────────────────────────

/** The name a node shows on the canvas (its native `title`). The class stays what it is. */
export const renameNodeMutation = z.object({
  type: z.literal('rename-node'),
  nodeId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
});

// ── Import look (IMPORT+NODES) ─────────────────────────────────────────────────────────────────────
/** Collapse nodes to their title row, or open them again: the native `flags.collapsed`, as ComfyUI saves it. */
export const collapseNodeMutation = z.object({
  type: z.literal('collapse-node'),
  nodeIds: z.array(z.string().min(1)).min(1).max(MOVE_NODES_MAX),
  collapsed: z.boolean(),
});
// ── end import look ────────────────────────────────────────────────────────────────────────────────

export const mutationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add-node'),
    nodeType: z.string().min(1),
    title: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('annotate-node'),
    nodeId: z.string().min(1),
    annotation: z.string(),
  }),
  z.object({
    type: z.literal('remove-node'),
    nodeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('move-node'),
    nodeId: z.string().min(1),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal('connect'),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  }),
  z.object({
    type: z.literal('remove-edge'),
    edgeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('import-workflow'),
    document: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('set-parameter'),
    nodeId: z.string().min(1),
    key: z.string().min(1),
    value: z.unknown(),
    widgetIndex: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('retarget-edge'),
    edgeId: z.string().min(1),
    target: z.string().min(1),
    targetHandle: z.string().min(1),
  }),
  z.object({
    type: z.literal('set-component'),
    ownerKind: z.enum(['node', 'subgraph']),
    ownerId: z.string().min(1).max(200),
    purpose: z.string().max(20000),
    usage: z.string().max(20000),
  }),
  z.object({
    type: z.literal('set-process'),
    title: z.string().max(500),
    notes: z.string().max(20000),
  }),
  z.object({
    type: z.literal('open-native'),
    project: z.any(),
  }),
  z.object({
    type: z.literal('create-subgraph'),
    name: z.string().min(1).max(200),
    nodeIds: z.array(z.string().min(1)).min(1),
    inputs: z.array(subgraphIOSchema).default([]),
    outputs: z.array(subgraphIOSchema).default([]),
  }),
  z.object({
    type: z.literal('insert-subgraph'),
    definitionId: z.string().min(1),
    x: z.number(),
    y: z.number(),
    title: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('add-subgraph-io'),
    definitionId: z.string().min(1),
    direction: z.enum(['input', 'output']),
    name: z.string().min(1).max(200),
    /** The slot data type. Named dataType because `type` is the mutation discriminator. */
    dataType: z.string().min(1).max(200),
    nodeId: z.string().min(1),
    handle: z.string().min(1),
  }),
  z.object({
    type: z.literal('remove-subgraph-io'),
    definitionId: z.string().min(1),
    direction: z.enum(['input', 'output']),
    slotId: z.string().min(1),
  }),
  z.object({
    /** The name a slot shows on every instance and inside (written as the slot's `label`, as ComfyUI does). */
    type: z.literal('rename-subgraph-io'),
    definitionId: z.string().min(1),
    direction: z.enum(['input', 'output']),
    slotId: z.string().min(1),
    name: z.string().trim().min(1).max(200),
  }),
  z.object({
    type: z.literal('rename-subgraph'),
    definitionId: z.string().min(1),
    name: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal('dissolve-subgraph'),
    nodeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('add-group'),
    title: z.string().max(500),
    nodeIds: z.array(z.string().min(1)).min(1),
    color: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal('remove-group'),
    groupId: z.string().min(1),
  }),
  // --- group rename (begin) ---
  z.object({
    /** A group's title, as typed on the canvas. Empty is allowed: ComfyUI keeps untitled groups too. */
    type: z.literal('rename-group'),
    groupId: z.string().min(1),
    title: z.string().max(500),
  }),
  // --- group rename (end) ---
  // --- edits inside a subgraph definition (begin) ---
  z.object({
    /**
     * One canvas edit applied to the inner graph of a definition instead of the root: inner node ids are their
     * own id space (ComfyUI numbers a definition's nodes from 1), so the edit names the definition it targets.
     */
    type: z.literal('edit-in-subgraph'),
    definitionId: z.string().min(1),
    edit: z.discriminatedUnion('type', [
      z.object({ type: z.literal('move-node'), nodeId: z.string().min(1), x: z.number(), y: z.number() }),
      z.object({
        type: z.literal('set-parameter'),
        nodeId: z.string().min(1),
        key: z.string().min(1),
        value: z.unknown(),
        widgetIndex: z.number().int().nonnegative().optional(),
      }),
      z.object({
        type: z.literal('connect'),
        source: z.string().min(1),
        target: z.string().min(1),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
      }),
      z.object({ type: z.literal('remove-edge'), edgeId: z.string().min(1) }),
      // Inner editing (1.0): everything the root canvas does to a node works inside a definition too.
      z.object({
        type: z.literal('add-node'),
        nodeType: z.string().min(1),
        title: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
      }),
      z.object({ type: z.literal('remove-node'), nodeId: z.string().min(1) }),
      moveNodesMutation,
      renameNodeMutation,
      collapseNodeMutation,
      z.object({
        type: z.literal('retarget-edge'),
        edgeId: z.string().min(1),
        target: z.string().min(1),
        targetHandle: z.string().min(1),
      }),
      /** An instance of another definition placed inside this one; refused when a definition would hold itself. */
      z.object({
        type: z.literal('insert-subgraph'),
        definitionId: z.string().min(1),
        x: z.number(),
        y: z.number(),
        title: z.string().max(500).optional(),
      }),
    ]),
  }),
  // --- edits inside a subgraph definition (end) ---
  z.object({
    /** Undo/redo: copies an earlier revision's snapshot into a new revision. History never rewinds. */
    type: z.literal('restore-revision'),
    revisionId: z.string().min(1).max(400),
  }),
  // Layout
  moveNodesMutation,
  renameNodeMutation,
  collapseNodeMutation,
]);

export type GraphMutation = z.infer<typeof mutationSchema>;

export const commandRequestSchema = z.object({
  projectId: z.string().min(1),
  actionId: z.string().min(1),
  expectedRevisionId: z.string().min(1),
  actor: z.enum(['ai', 'manual']),
  runId: z.string().min(1).nullable(),
  payload: mutationSchema,
});

export type CommandRequest = z.infer<typeof commandRequestSchema>;

export type RunStatus = 'running' | 'paused' | 'cancelled' | 'completed' | 'closed';

export interface ActiveRun {
  runId: string;
  status: 'running' | 'paused';
  expectedRevisionId: string;
}

export interface Projection {
  projectId: string;
  snapshot: {
    nodes: unknown[];
    edges: unknown[];
    document?: unknown;
    components?: unknown;
    process?: unknown;
    /** Modelled native subgraph definitions (see shared/graph/subgraphs.ts). */
    subgraphs?: SubgraphDefinition[];
    /** Root-canvas groups. */
    groups?: GroupRecord[];
  };
  currentRevisionId: string;
  revSeq: number;
  activeRun: ActiveRun | null;
  /**
   * Which graph the current revision shows: it changes when a graph replaces another (new, open, import) and when
   * undo or redo crosses such a step. Explanations of the graph's objects are kept by it.
   */
  graphKey?: string;
}

export interface CommandResponse {
  status: 'applied' | 'historical' | 'conflict' | 'rejected';
  projection: Projection | null;
  result: unknown;
}

export interface RunStart {
  runId: string;
  baseRevisionId: string;
  expectedRevisionId: string;
  projection: Projection;
}
