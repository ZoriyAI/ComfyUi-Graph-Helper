/**
 * The build tools of a turn (addNode, connectNodes, setParameter, ...): each call becomes one graph command
 * committed as the assistant's own action, so it shows on the canvas at once and the person can undo it.
 * agent/turn.ts creates them from the specs the renderer sends; ipc/agentIpc.ts uses only the RunContext type.
 * Explicit assistant turns can edit existing work; proposal-only callers retain ownership.ts restrictions.
 * A paused run holds its next step.
 */
import type Database from 'better-sqlite3';
import { turnLog } from '../trace/modelTrace';
import { randomUUID } from 'crypto';
import { jsonSchema } from 'ai';
import { commitCommand } from '../commands/commit';
import { validateNodeClass } from '../knowledge/nodeClassGuard';
import { createProposal } from '../proposals/repository';
import { draftKindFor, runOwned } from './ownership';
import { escapeDataTagsDeep } from './prompt';
import { readProjection } from '../commands/commit';
import { STORAGE_FAILED, STORAGE_FULL, storageErrorCode } from '../settings/databaseSafety';
import { mutationFromTool, type ToolContext } from '../../shared/commands/tools';
import { WHY_MAX } from '../../shared/commands/toolSpecs';
import { carriesSecret } from '../../shared/config/draft';
import type { CommandResponse, GraphMutation, Projection } from '../../shared/commands/types';
import { BUILD_STEP_TOOLS, type AgentBuildStep, type AgentRunContext, type BuildStepTool, type Explanation, type ExplanationInput, type ObjectRef } from '../../shared/contracts';

/** A build tool as the renderer describes it: name, description and JSON schema of its arguments. */
export interface RendererToolSpec {
  name: string;
  description?: string;
  parameters?: unknown;
}

/** The run a build belongs to: project, run id and the revision it expects to build on. */
export type RunContext = AgentRunContext;

/** How long a paused run's next step waits between looks at the run (ms). */
export const PAUSE_POLL_MS = 150;

type RunRow = { status: string; expected_revision_id: string } | undefined;

/** The run's status and expected revision as stored, or undefined when the row cannot be read. */
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
    // No row (a test without runs, or a read error): the step goes on against the revision it already has.
    if (!row) return { state: 'running', expectedRevisionId: null };
    if (row.status === 'running') return { state: 'running', expectedRevisionId: row.expected_revision_id };
    if (row.status !== 'paused') return { state: 'ended' };
    await sleep(PAUSE_POLL_MS);
  }
}

/** Ids a command result may carry; copied onto the tool result so the model can refer to them next. */
const RESULT_IDS = ['nodeId', 'nodeType', 'edgeId', 'linkId', 'definitionId', 'subgraphId', 'groupId', 'key'] as const;

/** The English line the model reads after a successful step of these tools. */
const BUILD_MESSAGES: Record<string, string> = {
  clearCanvas: 'Cleared the canvas; the previous graph is in revision history',
  createGraphSet: 'Created graph containers; populate their inner graphs next',
  connectNodes: 'Connected the nodes',
  setParameter: 'Set the parameter',
  removeNode: 'Removed the node',
  createSubgraph: 'Created the subgraph',
  configureSubgraph: 'Configured the subgraph',
  insertSubgraph: 'Inserted the subgraph',
  insertBlueprint: 'Created an editable blueprint copy',
};

/** One port of a node: the handle connectNodes takes, its name and its data type. */
export interface PortHandle { handle: string; name: string; type: string }

/** The ports of a node's data, with in-N / out-N handles for ports that have no id of their own. */
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

/** Names of the nodes a draft is about, so its sentence in the chat reads the way the canvas names them. */
function titlesFor(name: string, args: Record<string, unknown> | undefined, projection: Projection | null): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, id: unknown) => {
    const title = nodeTitleAt(projection, id);
    if (title) out[key] = title;
  };
  if (name === 'connectNodes') {
    put('sourceTitle', args?.sourceNodeId ?? args?.source);
    put('targetTitle', args?.targetNodeId ?? args?.target);
  } else if (name === 'setComponentDocumentation') {
    put('nodeTitle', args?.ownerId);
  } else {
    put('nodeTitle', args?.nodeId);
  }
  return out;
}

/**
 * The tool result the model reads for a committed command: success with the new ids, ports and titles, or the
 * engine's refusal. The extra fields also feed the chat's step lines.
 */
export function toolOutcome(name: string, args: Record<string, unknown> | undefined, outcome: CommandResponse) {
  // Inner ids are a separate namespace. Never report ports/titles from a root node with the same number.
  if (args?.inSubgraph && outcome.projection) {
    const definitions = outcome.projection.snapshot.subgraphs as Array<{ id: string; nodes: unknown[]; edges: unknown[] }> | undefined;
    const definition = definitions?.find((item) => item.id === args.inSubgraph);
    if (definition) outcome = { ...outcome, projection: { ...outcome.projection, snapshot: { ...outcome.projection.snapshot, nodes: definition.nodes, edges: definition.edges } } };
  }
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
      const nodeTitle = args?.ownerKind === 'node' ? nodeTitleAt(outcome.projection, args?.ownerId) : undefined;
      return {
        success: true,
        message: 'Stored component documentation',
        ownerKind: args?.ownerKind,
        ownerId: args?.ownerId,
        ...(nodeTitle ? { nodeTitle } : {}),
      };
    }
    if (name === 'setProcess') {
      return { success: true, message: 'Stored the process', title: args?.title };
    }
    if (name in BUILD_MESSAGES) {
      const ids: Record<string, unknown> = {};
      if (name === 'createGraphSet' && Array.isArray(result?.results)) {
        ids.graphs = result.results.filter((item: any) => item && typeof item.definitionId === 'string').map((item: any) => ({ nodeId: item.nodeId ?? item.instanceId, definitionId: item.definitionId }));
      }
      for (const key of RESULT_IDS) {
        const value = result?.[key];
        if (typeof value === 'string' || typeof value === 'number') ids[key] = value;
      }
      if (name === 'insertBlueprint' && Array.isArray(result?.definitionIds)) ids.definitionIds = result.definitionIds.filter((id) => typeof id === 'string');
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
    // What is left of the build tools is annotateNode.
    const annotated = nodeTitleAt(outcome.projection, result?.nodeId ?? args?.nodeId);
    return { success: true, message: `Annotated node ${result?.nodeId || ''}`, ...(annotated ? { nodeTitle: annotated } : {}) };
  }
  const detail = outcome.result as { error?: unknown } | null;
  const reason = typeof detail?.error === 'string' ? detail.error : outcome.status;
  return { success: false, conflict: outcome.status === 'conflict', error: reason };
}

/** Saves a build step's `why`; the knowledge repository's saveExplanation in the app. */
export type SaveWhy = (db: Database.Database, input: ExplanationInput) => Explanation;

/** Whether a tool's applied call is shown on the canvas as a build step with its `why`. */
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

/** An id as a string, whether the graph stored it as a string or a number; undefined for anything else. */
function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/** The ComfyUI class of a node in the projection. */
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
    case 'clearCanvas':
    case 'createGraphSet':
      return { owner: null };
    case 'addNode':
    case 'insertBlueprint':
    case 'insertSubgraph':
      return { nodeId, subgraphId: idOf(result?.definitionId), owner: nodeOwner(nodeId) };
    case 'setParameter':
      return { nodeId, key: idOf(args?.key), owner: nodeOwner(nodeId) };
    case 'connectNodes': {
      const edgeId = idOf(result?.edgeId);
      const target = idOf(args?.targetNodeId) ?? idOf(args?.target);
      return { nodeId: target, edgeId, owner: edgeId ? { kind: 'edge', id: edgeId } : null };
    }
    case 'createSubgraph':
    case 'configureSubgraph': {
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
    /** Test seam: where a grey draft goes (the proposals repository in the app). */
    createDraft?: typeof createProposal;
    /** Normal assistant/build turns may perform the requested edits on existing graph objects. */
    allowExistingEdits?: boolean;
  },
): Record<string, { description?: string; inputSchema: ReturnType<typeof jsonSchema>; execute: (args: Record<string, unknown>, call?: { toolCallId?: string }) => Promise<unknown> }> {
  const tools: Record<string, { description?: string; inputSchema: ReturnType<typeof jsonSchema>; execute: (args: Record<string, unknown>, call?: { toolCallId?: string }) => Promise<unknown> }> = {};
  let expectedRevisionId = options.run.expectedRevisionId;
  // Placement depends on the current graph. A retry must keep the original coordinates/payload.
  const graphSetPayloads = new Map<string, { args: string; payload: GraphMutation }>();
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
          // Ordinary additions can continue alongside manual work. Whole-canvas replacement cannot
          // erase work created after the model's request was prepared.
          if (spec.name === 'clearCanvas') return { success: false, conflict: true, error: 'The canvas changed while this clear was being prepared. Keep the newer work; ask again before clearing it.' };
          // Continue (or a manual edit during the pause) moved the run on: build on from there.
          expectedRevisionId = held.expectedRevisionId;
          options.onRevision?.(expectedRevisionId);
        }
        // A provider reuses call ids across turns (and the TEST fixture always does): scope them to the run.
        const actionId = `${options.run.runId}:${toolCallId}`;
        let context: ToolContext | undefined;
        try {
          context = options.toolContext?.();
          const definition = context?.snapshot?.subgraphs?.find((item) => item.id === args.inSubgraph);
          if (definition && context?.snapshot) context = { ...context, snapshot: { ...context.snapshot, nodes: definition.nodes } };
        } catch {
          context = undefined;
        }
        const priorSet = spec.name === 'createGraphSet' ? graphSetPayloads.get(actionId) : undefined;
        if (priorSet && priorSet.args !== JSON.stringify(args)) return { success: false, error: 'A repeated tool call changed its arguments.' };
        const payload = priorSet?.payload ?? mutationFromTool(spec.name, args, context);
        if (spec.name === 'createGraphSet' && payload && !priorSet) graphSetPayloads.set(actionId, { args: JSON.stringify(args), payload });
        turnLog(`[Agent] Tool ${spec.name} commit ${toolCallId}`);
        if (!payload) {
          return { success: false, error: `Unknown tool: ${spec.name}` };
        }
        // An unknown class is refused once the catalog is synced, with the nearest installed names.
        const subject = payload.type === 'edit-in-subgraph' ? payload.edit : payload;
        const guard = subject.type === 'add-node' ? validateNodeClass(options.db, subject.nodeType) : null;
        if (guard && !guard.ok) return { success: false, error: guard.error, suggestions: guard.suggestions };
        // Legacy proposal-only callers retain ownership restrictions; explicitly requested turns may edit.
        const owned = runOwned(options.db, options.run.projectId, options.run.runId);
        if (!options.allowExistingEdits && payload.type === 'insert-blueprint' && payload.destinationDefinitionId && !owned.definitions.has(payload.destinationDefinitionId)) return { success: false, error: 'This build can insert blueprints inside only the subgraphs it created.' };
        if (!options.allowExistingEdits && payload.type === 'edit-in-subgraph' && !owned.definitions.has(payload.definitionId)) {
          return { success: false, error: 'This build can edit inside only the subgraphs it created. Keep pre-existing user definitions unchanged.' };
        }
        if (!options.allowExistingEdits && payload.type === 'configure-subgraph' && !owned.definitions.has(payload.definitionId)) {
          return { success: false, error: 'This subgraph was not created by this build. Keep it unchanged; the person can configure its interface in the subgraph constructor.' };
        }
        const draftKind = options.allowExistingEdits ? null : draftKindFor(payload as GraphMutation, owned, readProjection(options.db, options.run.projectId));
        if (draftKind) {
          try {
            const proposal = (options.createDraft ?? createProposal)(options.db, {
              projectId: options.run.projectId,
              runId: options.run.runId,
              kind: draftKind,
              payload,
              note: stepWhy(args),
            });
            return {
              success: true,
              drafted: true,
              proposalId: proposal.id,
              kind: draftKind,
              ...removedNode(context, args?.nodeId),
              ...titlesFor(spec.name, args, readProjection(options.db, options.run.projectId)),
              message: 'This changes something the person made, so it is a grey draft the person accepts or rejects. It is not applied. Do not repeat it; go on with your own nodes.',
            };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'The draft could not be saved.' };
          }
        }
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
        const step = outcome.status === 'applied' && payload.type !== 'edit-in-subgraph' && isStepTool(spec.name)
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
    // Titles and names in a result came from the graph (maybe someone else's workflow): never a data tag.
    const inner = tools[spec.name].execute;
    tools[spec.name].execute = async (args, call) => escapeDataTagsDeep(await inner(args, call));
  }
  return tools;
}

/** The canvas's record of one applied step: where it landed, its `why`, and the explanation saved from it. */
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
