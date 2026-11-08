import { z } from 'zod';
import type { GroupRecord, SubgraphDefinition } from '../graph/subgraphs';

export const subgraphIOSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  nodeId: z.string().min(1),
  handle: z.string().min(1),
});

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
