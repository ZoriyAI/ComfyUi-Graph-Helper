import type Database from 'better-sqlite3';
import { turnLog } from '../trace/modelTrace';
import { randomUUID } from 'crypto';
import { jsonSchema } from 'ai';
import { commitCommand } from '../commands/commit';
import { validateNodeClass } from '../knowledge/nodeClassGuard';
import { STORAGE_FAILED, STORAGE_FULL, storageErrorCode } from '../settings/databaseSafety';
import { mutationFromTool, type ToolContext } from '../../shared/commands/tools';
import { WHY_MAX } from '../../shared/commands/toolSpecs';
import { carriesSecret } from '../../shared/config/draft';
import type { CommandResponse, Projection } from '../../shared/commands/types';
import { BUILD_STEP_TOOLS, type AgentBuildStep, type AgentRunContext, type BuildStepTool, type Explanation, type ExplanationInput, type ObjectRef } from '../../shared/contracts';

export interface RendererToolSpec {
  name: string;
  description?: string;
  parameters?: unknown;
}

export type RunContext = AgentRunContext;

/** How long a paused run's next step waits between looks at the run (ms). */
export const PAUSE_POLL_MS = 150;

type RunRow = { status: string; expected_revision_id: string } | undefined;

function readRun(db: Database.Database, run: RunContext): RunRow {
  try {
    return db.prepare('SELECT status, expected_revision_id FROM runs WHERE project_id = ? AND run_id = ?').get(run.projectId, run.runId) as RunRow;
  } catch {
    return undefined;
  }
}

/**
 * A step the model asked for while the person paused the run waits here: it is committed when the run runs
 * again (Continue), from the revision the run continues from, so a pause never turns into a failed step.
 * Resolves 'running' when the step may go on, 'ended' when the run was stopped, closed or the turn aborted.
 */
export async function waitWhilePaused(
  db: Database.Database,
  run: RunContext,
  options: { signal?: AbortSignal; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ state: 'running'; expectedRevisionId: string | null } | { state: 'ended' }> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (;;) {
    if (options.signal?.aborted) return { state: 'ended' };
    const row = readRun(db, run);
    if (!row) return { state: 'running', expectedRevisionId: null };
    if (row.status === 'running') return { state: 'running', expectedRevisionId: row.expected_revision_id };
    if (row.status !== 'paused') return { state: 'ended' };
    await sleep(PAUSE_POLL_MS);
  }
}

/** Ids a command result may carry; copied onto the tool result so the model can refer to them next. */
const RESULT_IDS = ['nodeId', 'nodeType', 'edgeId', 'linkId', 'definitionId', 'subgraphId', 'groupId', 'key'] as const;

const BUILD_MESSAGES: Record<string, string> = {
  connectNodes: 'Connected the nodes',
  setParameter: 'Set the parameter',
  removeNode: 'Removed the node',
  createSubgraph: 'Created the subgraph',
  insertSubgraph: 'Inserted the subgraph',
};

export interface PortHandle { handle: string; name: string; type: string }

function portHandles(value: unknown, prefix: 'in' | 'out'): PortHandle[] {
  if (!Array.isArray(value)) return [];
  return value.map((port, index) => {
    const item = (port && typeof port === 'object' ? port : {}) as { id?: unknown; name?: unknown; dataType?: unknown; type?: unknown };
    return {
      handle: typeof item.id === 'string' && item.id !== '' ? item.id : `${prefix}-${index}`,
      name: typeof item.name === 'string' ? item.name : '',
      type: typeof item.dataType === 'string' ? item.dataType : typeof item.type === 'string' ? item.type : '',
    };
  });
}

/** The new node's ports with the handles connectNodes takes, read from the projection the commit returned. */
export function nodePorts(projection: Projection | null | undefined, nodeId: unknown): { inputs: PortHandle[]; outputs: PortHandle[] } | null {
  if (!projection || (typeof nodeId !== 'string' && typeof nodeId !== 'number')) return null;
  const node = (projection.snapshot.nodes as Array<{ id?: unknown; data?: { inputs?: unknown; outputs?: unknown } }>)
    .find((item) => String(item.id) === String(nodeId));
  if (!node) return null;
  return { inputs: portHandles(node.data?.inputs, 'in'), outputs: portHandles(node.data?.outputs, 'out') };
}

/**
 * The ends of a new link by port name and type, read from the projection, so the chat can say
 * "Load Checkpoint · MODEL → KSampler · model" without guessing from handles.
 */
export function linkEnds(projection: Projection | null | undefined, edgeId: unknown): Record<string, string> {
  if (!projection || (typeof edgeId !== 'string' && typeof edgeId !== 'number')) return {};
  const edge = (projection.snapshot.edges as Array<{ id?: unknown; source?: unknown; target?: unknown; sourceHandle?: unknown; targetHandle?: unknown; data?: { dataType?: unknown } }>)
    .find((item) => String(item.id) === String(edgeId));
  if (!edge) return {};
  const ends: Record<string, string> = {};
  const source = idOf(edge.source);
  const target = idOf(edge.target);
  if (source) ends.sourceNodeId = source;
  if (target) ends.targetNodeId = target;
  const sourcePort = nodePorts(projection, source)?.outputs.find((port) => port.handle === edge.sourceHandle);
  const targetPort = nodePorts(projection, target)?.inputs.find((port) => port.handle === edge.targetHandle);
  if (sourcePort?.name) ends.sourcePort = sourcePort.name;
  if (targetPort?.name) ends.targetPort = targetPort.name;
  const dataType = typeof edge.data?.dataType === 'string' && edge.data.dataType ? edge.data.dataType : sourcePort?.type;
  if (dataType) ends.dataType = dataType;
  return ends;
}

/** What a node was before a removal took it away: its class and title, so the chat can still name it. */
export function removedNode(context: ToolContext | undefined, nodeId: unknown): Record<string, string> {
  const id = idOf(nodeId);
  const node = id ? context?.snapshot?.nodes.find((item) => String(item?.id) === id) : undefined;
  const data = node && typeof node.data === 'object' && node.data ? node.data as { title?: unknown; comfyType?: unknown } : {};
  const found: Record<string, string> = {};
  if (typeof data.comfyType === 'string' && data.comfyType) found.removedType = data.comfyType;
  if (typeof data.title === 'string' && data.title) found.removedTitle = data.title;
  return found;
}

/**
 * The name a node had on the canvas when a step touched it (its title, else its class). Kept on the step's result
 * so the chat's sentence about the step never renames itself after a restart or a new project.
 */
export function nodeTitleAt(projection: Projection | null | undefined, nodeId: unknown): string | undefined {
  const id = idOf(nodeId);
  if (!projection || !id) return undefined;
  const node = (projection.snapshot.nodes as Array<{ id?: unknown; data?: { title?: unknown; comfyType?: unknown } }>).find((item) => String(item.id) === id);
  const title = typeof node?.data?.title === 'string' && node.data.title.trim() ? node.data.title.trim() : typeof node?.data?.comfyType === 'string' ? node.data.comfyType : '';
  return title ? title.slice(0, 120) : undefined;
}

export function toolOutcome(name: string, args: Record<string, unknown> | undefined, outcome: CommandResponse) {
  if (outcome.status === 'applied' || outcome.status === 'historical') {
    const result = outcome.result as Record<string, unknown> | null;
    if (name === 'addNode') {
      const ports = nodePorts(outcome.projection, result?.nodeId);
      const nodeTitle = nodeTitleAt(outcome.projection, result?.nodeId);
      return {
        success: true,
        message: `Added ${result?.nodeType || args?.nodeType || 'node'} node`,
        nodeType: result?.nodeType || args?.nodeType,
        nodeId: result?.nodeId,
        ...(nodeTitle ? { nodeTitle } : {}),
        ...(ports ?? {}),
      };
    }
    if (name === 'setComponentDocumentation') {
      return {
        success: true,
        message: 'Stored component documentation',
        ownerKind: args?.ownerKind,
        ownerId: args?.ownerId,
      };
    }
    if (name === 'setProcess') {
      return { success: true, message: 'Stored the process', title: args?.title };
    }
    if (name in BUILD_MESSAGES) {
      const ids: Record<string, unknown> = {};
      for (const key of RESULT_IDS) {
        const value = result?.[key];
        if (typeof value === 'string' || typeof value === 'number') ids[key] = value;
      }
      // Structured ends for the chat's step line; the English `message` stays what the model reads.
      const ends: Record<string, string> = name === 'connectNodes' ? linkEnds(outcome.projection, ids.edgeId ?? ids.linkId) : {};
      const titles: Record<string, string> = {};
      if (name === 'connectNodes') {
        const source = nodeTitleAt(outcome.projection, ends.sourceNodeId);
        const target = nodeTitleAt(outcome.projection, ends.targetNodeId);
        if (source) titles.sourceTitle = source;
        if (target) titles.targetTitle = target;
      } else if (name === 'setParameter') {
        const title = nodeTitleAt(outcome.projection, args?.nodeId);
        if (title) titles.nodeTitle = title;
      }
      return { success: true, message: BUILD_MESSAGES[name], ...ids, ...ends, ...titles };
    }
    return { success: true, message: `Annotated node ${result?.nodeId || ''}` };
  }
  const detail = outcome.result as { error?: unknown } | null;
  const reason = typeof detail?.error === 'string' ? detail.error : outcome.status;
  return { success: false, conflict: outcome.status === 'conflict', error: reason };
}

/** Saves a build step's `why`; the knowledge repository's saveExplanation in the app. */
export type SaveWhy = (db: Database.Database, input: ExplanationInput) => Explanation;

function isStepTool(name: string): name is BuildStepTool {
  return (BUILD_STEP_TOOLS as readonly string[]).includes(name);
}

/** The `why` a step keeps: trimmed, clipped, and dropped when it looks like it carries a secret. */
export function stepWhy(args: unknown): string {
  const raw = args && typeof args === 'object' ? (args as { why?: unknown }).why : undefined;
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, WHY_MAX);
  return text && !carriesSecret({ why: text }) ? text : '';
}

function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function classTypeOf(projection: Projection | null, nodeId: string | undefined): string | undefined {
  if (!projection || !nodeId) return undefined;
  const node = (projection.snapshot.nodes as Array<{ id?: unknown; data?: { comfyType?: unknown } }>).find((item) => String(item.id) === nodeId);
  return typeof node?.data?.comfyType === 'string' ? node.data.comfyType : undefined;
}

/**
 * Where a step lives on the canvas and whom its explanation belongs to: the new node, the changed node, the
 * new edge, the new subgraph definition. A removal has no owner left to describe.
 */
export function stepTarget(
  name: BuildStepTool,
  args: Record<string, unknown> | undefined,
  result: Record<string, unknown> | null,
  projection: Projection | null,
): { nodeId?: string; edgeId?: string; subgraphId?: string; key?: string; owner: ObjectRef | null } {
  const nodeId = idOf(result?.nodeId) ?? idOf(args?.nodeId);
  const classType = classTypeOf(projection, nodeId);
  const nodeOwner = (id: string | undefined): ObjectRef | null => (id ? { kind: 'node', id, ...(classType ? { classType } : {}) } : null);
  switch (name) {
    case 'addNode':
    case 'insertSubgraph':
      return { nodeId, subgraphId: idOf(result?.definitionId), owner: nodeOwner(nodeId) };
    case 'setParameter':
      return { nodeId, key: idOf(args?.key), owner: nodeOwner(nodeId) };
    case 'connectNodes': {
      const edgeId = idOf(result?.edgeId);
      const target = idOf(args?.targetNodeId) ?? idOf(args?.target);
      return { nodeId: target, edgeId, owner: edgeId ? { kind: 'edge', id: edgeId } : null };
    }
    case 'createSubgraph': {
      const subgraphId = idOf(result?.definitionId);
      return { nodeId, subgraphId, owner: subgraphId ? { kind: 'subgraph', id: subgraphId } : null };
    }
    case 'removeNode':
      return { nodeId, owner: null };
  }
}

/**
 * Build tools from renderer specs. Each call commits through commitCommand as actor 'ai' and
 * moves the expected revision forward so the next call in the same run does not conflict.
 * A step tool's `why` is saved as an inference explanation of what the step made (aspect why), returned on the
 * tool result, and announced with onBuildStep right after onProjection, so the canvas can show it as the node appears.
 */
export function createBuildTools(
  specs: RendererToolSpec[],
  options: {
    db: Database.Database;
    run: RunContext;
    onProjection?: (projection: Projection) => void;
    onRevision?: (revisionId: string) => void;
    onBuildStep?: (step: AgentBuildStep) => void;
    saveWhy?: SaveWhy;
    /** Current snapshot and catalog, so a port name or slot index resolves to the handle the canvas uses. */
    toolContext?: () => ToolContext | undefined;
    /** The turn's abort signal: a step held by a pause stops waiting when the turn is cancelled. */
    signal?: AbortSignal;
    /** Test seam for the pause wait. */
    sleep?: (ms: number) => Promise<void>;
    /** A step could not be stored (disk full, file not writable): the turn stops the build with this sentence. */
    onStorageFailure?: (error: string) => void;
    /** The run was stopped from outside (another graph took the canvas, the person pressed Stop): the turn ends. */
    onRunEnded?: () => void;
  },
): Record<string, { description?: string; inputSchema: ReturnType<typeof jsonSchema>; execute: (args: Record<string, unknown>, call?: { toolCallId?: string }) => Promise<unknown> }> {
  const tools: Record<string, { description?: string; inputSchema: ReturnType<typeof jsonSchema>; execute: (args: Record<string, unknown>, call?: { toolCallId?: string }) => Promise<unknown> }> = {};
  let expectedRevisionId = options.run.expectedRevisionId;
  for (const spec of specs) {
    if (!spec || typeof spec.name !== 'string') continue;
    const schema = spec.parameters && typeof spec.parameters === 'object'
      ? spec.parameters
      : { type: 'object', properties: {} };
    tools[spec.name] = {
      description: spec.description,
      inputSchema: jsonSchema(schema as Parameters<typeof jsonSchema>[0]),
      execute: async (args: Record<string, unknown>, call?: { toolCallId?: string }) => {
        const toolCallId = call?.toolCallId || randomUUID();
        // The person paused the run: this step waits for Continue instead of failing as a conflict.
        const held = await waitWhilePaused(options.db, options.run, { signal: options.signal, sleep: options.sleep });
        if (held.state === 'ended') {
          options.onRunEnded?.();
          return { success: false, stopped: true, error: 'The build was stopped; nothing more is added.' };
        }
        if (held.expectedRevisionId && held.expectedRevisionId !== expectedRevisionId) {
          // Continue (or a manual edit during the pause) moved the run on: build on from there.
          expectedRevisionId = held.expectedRevisionId;
          options.onRevision?.(expectedRevisionId);
        }
        // A provider reuses call ids across turns (and the TEST fixture always does): scope them to the run.
        const actionId = `${options.run.runId}:${toolCallId}`;
        let context: ToolContext | undefined;
        try {
          context = options.toolContext?.();
        } catch {
          context = undefined;
        }
        const payload = mutationFromTool(spec.name, args, context);
        turnLog(`[Agent] Tool ${spec.name} commit ${toolCallId}`);
        if (!payload) {
          return { success: false, error: `Unknown tool: ${spec.name}` };
        }
        // An unknown class is refused once the catalog is synced, with the nearest installed names.
        const guard = payload.type === 'add-node' ? validateNodeClass(options.db, payload.nodeType) : null;
        if (guard && !guard.ok) return { success: false, error: guard.error, suggestions: guard.suggestions };
        // Read before the commit: once removed, the node can no longer be named.
        const removed = spec.name === 'removeNode' ? removedNode(context, args?.nodeId) : {};
        let outcome: CommandResponse;
        try {
          outcome = commitCommand(options.db, {
            projectId: options.run.projectId,
            runId: options.run.runId,
            actionId,
            expectedRevisionId,
            actor: 'ai',
            payload,
          });
        } catch (error) {
          // A write that failed before the engine could turn it into a refusal (the catalog cache, for one).
          const storage = storageErrorCode(error);
          if (!storage) throw error;
          outcome = { status: 'rejected', projection: null, result: { error: storage } };
        }
        const refusal = outcome.status === 'rejected' ? (outcome.result as { error?: unknown } | null)?.error : undefined;
        if (refusal === STORAGE_FULL || refusal === STORAGE_FAILED) {
          // Nothing more can be stored: the build stops here instead of trying step after step.
          options.onStorageFailure?.(refusal);
          if (outcome.projection) options.onProjection?.(outcome.projection);
          return { success: false, stopped: true, error: refusal };
        }
        if (outcome.status === 'conflict' && readRun(options.db, options.run)?.status !== 'running') {
          // The run ended while this step was on its way (a new project, an import): the step is not applied.
          options.onRunEnded?.();
          return { success: false, stopped: true, error: 'The build was stopped; nothing more is added.' };
        }
        if (outcome.status === 'applied' && outcome.projection?.activeRun) {
          expectedRevisionId = outcome.projection.activeRun.expectedRevisionId;
          options.onRevision?.(expectedRevisionId);
        }
        const step = outcome.status === 'applied' && isStepTool(spec.name)
          ? buildStep(spec.name, toolCallId, args, outcome, options)
          : null;
        if (outcome.projection) options.onProjection?.(outcome.projection);
        if (step) options.onBuildStep?.(step);
        const settled = toolOutcome(spec.name, args, outcome);
        const outcomeResult = settled.success ? { ...settled, ...removed } : settled;
        const result = guard?.ok && guard.warning && outcomeResult.success ? { ...outcomeResult, warning: guard.warning } : outcomeResult;
        return step && step.why ? { ...result, why: step.why, explanationId: step.explanationId } : result;
      },
    };
  }
  return tools;
}

function buildStep(
  name: BuildStepTool,
  toolCallId: string,
  args: Record<string, unknown> | undefined,
  outcome: CommandResponse,
  options: { db: Database.Database; run: RunContext; saveWhy?: SaveWhy },
): AgentBuildStep {
  const why = stepWhy(args);
  const projection = outcome.projection;
  const revisionId = projection?.currentRevisionId ?? '';
  const target = stepTarget(name, args, outcome.result as Record<string, unknown> | null, projection);
  let explanation: Explanation | null = null;
  if (why && target.owner && options.saveWhy) {
    try {
      explanation = options.saveWhy(options.db, {
        projectId: options.run.projectId,
        owner: target.owner,
        aspect: 'why',
        text: why,
        provenance: 'inference',
        sourceUrl: null,
        revisionId: revisionId || null,
        createdBy: 'ai',
      });
    } catch (error) {
      // The commit stands; only its description is missing.
      console.warn(`[Agent] ${name} why was not saved:`, error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
    }
  }
  const { owner: _owner, ...where } = target;
  return { toolName: name, toolCallId, ...where, why, explanationId: explanation?.id ?? null, explanation, revisionId };
}
