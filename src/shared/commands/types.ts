/**
 * The graph commands and their schemas: every change to a graph, by hand or by the helper, is one of these
 * mutations sent as a CommandRequest and applied by main as one revision (main/commands/commit.ts). The renderer,
 * the agent tools (commands/tools.ts), proposals and the revision history all speak this language. Main checks every
 * request against these schemas, because the renderer and the model are not trusted.
 */
import { z } from 'zod';
import type { GroupRecord, SubgraphDefinition } from '../graph/subgraphs';

/** One boundary slot of a new subgraph: its name and type, and the inner node port it connects to. */
export const subgraphIOSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  nodeId: z.string().min(1),
  handle: z.string().min(1),
});

// ── Layout: one commit moves many nodes, so an arrangement is one undo step. ─────────────────────────
/** Most nodes one command may touch; also the cap of a selection, a paste and most node lists below. */
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

/** One selection removed as one revision, including every edge attached to a removed node. */
export const removeSelectionMutation = z.object({
  type: z.literal('remove-selection'),
  nodeIds: z.array(z.string().min(1)).max(MOVE_NODES_MAX).default([]),
  edgeIds: z.array(z.string().min(1)).max(MOVE_NODES_MAX).default([]),
}).refine((value) => value.nodeIds.length > 0 || value.edgeIds.length > 0, {
  message: 'The selection is empty.',
});

/** Raw canvas nodes and their internal edges. The engine remaps every id and never trusts clipboard handles. */
export const pasteSelectionMutation = z.object({
  type: z.literal('paste-selection'),
  nodes: z.array(z.record(z.string(), z.unknown())).min(1).max(MOVE_NODES_MAX),
  edges: z.array(z.record(z.string(), z.unknown())).max(MOVE_NODES_MAX),
  offsetX: z.number().finite().default(32),
  offsetY: z.number().finite().default(32),
  /** Set only by edit-in-subgraph scoping; lets the engine reject recursive subgraph instances. */
  destinationDefinitionId: z.string().min(1).optional(),
});

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

/**
 * Several edits as one revision (one undo step): a multi-node delete, paste, duplicate, cut, a nudge of several nodes.
 * `edits` are other mutations, checked one by one when applied (no nested batch, no restore, no import). A string
 * "@k" in source, target or nodeId stands for the node the k-th edit added (pasted nodes and their links).
 */
export const BATCH_LABELS = ['delete', 'paste', 'duplicate', 'cut', 'move', 'add-linked'] as const;
/** Most edits in one batch. */
export const BATCH_MAX = 2000;
export const batchMutation = z.object({
  type: z.literal('batch'),
  label: z.enum(BATCH_LABELS),
  edits: z.array(z.record(z.string(), z.unknown())).min(1).max(BATCH_MAX),
});

// --- editing commands (begin) ---
// Canvas edits a person makes by hand from the node, link and group menus (main/commands/editOps.ts applies them).
// Each is one commit, so one undo step, however many nodes it touches.

/** How ComfyUI runs the nodes: always (mode 0), bypassed (mode 4, inputs pass through), muted (mode 2, never runs). */
export const NODE_RUN_MODES = ['always', 'bypass', 'mute'] as const;
export const setNodeModeMutation = z.object({
  type: z.literal('set-node-mode'),
  nodeIds: z.array(z.string().min(1)).min(1).max(5000),
  mode: z.enum(NODE_RUN_MODES),
});

/** The text of a Note or Markdown Note (its widgets_values[0] in the workflow). */
export const setNoteTextMutation = z.object({
  type: z.literal('set-note-text'),
  nodeId: z.string().min(1),
  text: z.string().max(100000),
});

/** A new node placed on a link: the link's source feeds the new node, the new node feeds the link's target. */
export const insertNodeOnEdgeMutation = z.object({
  type: z.literal('insert-node-on-edge'),
  edgeId: z.string().min(1),
  nodeType: z.string().min(1),
  title: z.string().max(500).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
});

/** Another class in a node's place: same id and position, links and field values kept where names and types fit. */
export const replaceNodeMutation = z.object({
  type: z.literal('replace-node'),
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  title: z.string().max(500).optional(),
});

/** ComfyUI's node colour palette; null takes the colour off. */
export const NODE_COLORS = ['red', 'brown', 'green', 'blue', 'pale_blue', 'cyan', 'purple', 'yellow', 'black'] as const;
export const setNodeColorMutation = z.object({
  type: z.literal('set-node-color'),
  nodeIds: z.array(z.string().min(1)).min(1).max(5000),
  color: z.enum(NODE_COLORS).nullable(),
});

/** Nodes go into a group or out of it; the group's frame follows its members, so this is how its size changes. */
export const setGroupMembersMutation = z.object({
  type: z.literal('set-group-members'),
  groupId: z.string().min(1),
  add: z.array(z.string().min(1)).max(5000).default([]),
  remove: z.array(z.string().min(1)).max(5000).default([]),
});

/** A group's frame colour from the same palette; null takes it off. */
export const setGroupColorMutation = z.object({
  type: z.literal('set-group-color'),
  groupId: z.string().min(1),
  color: z.enum(NODE_COLORS).nullable(),
});
// --- editing commands (end) ---

/** Every graph command, told apart by `type`. */
export const mutationSchema = z.discriminatedUnion('type', [
  batchMutation,
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
  removeSelectionMutation,
  pasteSelectionMutation,
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
      removeSelectionMutation,
      pasteSelectionMutation,
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
      // Editing commands work inside a subgraph as on the main canvas.
      setNodeModeMutation,
      setNoteTextMutation,
      insertNodeOnEdgeMutation,
      replaceNodeMutation,
      setNodeColorMutation,
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
  // Editing commands
  setNodeModeMutation,
  setNoteTextMutation,
  insertNodeOnEdgeMutation,
  replaceNodeMutation,
  setNodeColorMutation,
  setGroupColorMutation,
  setGroupMembersMutation,
]);

export type GraphMutation = z.infer<typeof mutationSchema>;

/**
 * One command as the renderer or the agent sends it. `actionId` makes a retry safe (the same id is applied once);
 * `expectedRevisionId` is the revision the sender saw, so a command made against an older graph is a conflict.
 */
export const commandRequestSchema = z.object({
  projectId: z.string().min(1),
  actionId: z.string().min(1),
  expectedRevisionId: z.string().min(1),
  actor: z.enum(['ai', 'manual']),
  runId: z.string().min(1).nullable(),
  payload: mutationSchema,
});

export type CommandRequest = z.infer<typeof commandRequestSchema>;

/** The state of an agent run that builds the graph step by step. */
export type RunStatus = 'running' | 'paused' | 'cancelled' | 'completed' | 'closed';

/** The run that currently holds the graph, if any. */
export interface ActiveRun {
  runId: string;
  status: 'running' | 'paused';
  expectedRevisionId: string;
}

/** The current graph of a project as main hands it to the renderer: the snapshot and the revision it is at. */
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

/**
 * The answer to a command: applied, historical (this action id was already applied), conflict (the graph moved on)
 * or rejected (the command is invalid). `result` carries what the command made, such as a new node id.
 */
export interface CommandResponse {
  status: 'applied' | 'historical' | 'conflict' | 'rejected';
  projection: Projection | null;
  result: unknown;
}

/** What starting an agent run returns: its id and the revision it starts from. */
export interface RunStart {
  runId: string;
  baseRevisionId: string;
  expectedRevisionId: string;
  projection: Projection;
}
