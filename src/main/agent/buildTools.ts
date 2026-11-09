import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { jsonSchema } from 'ai';
import { commitCommand } from '../commands/commit';
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
  return value.slice(0, 60).map((port, index) => {
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

export function toolOutcome(name: string, args: Record<string, unknown> | undefined, outcome: CommandResponse) {
  if (outcome.status === 'applied' || outcome.status === 'historical') {
    const result = outcome.result as Record<string, unknown> | null;
    if (name === 'addNode') {
      const ports = nodePorts(outcome.projection, result?.nodeId);
      return {
        success: true,
        message: `Added ${result?.nodeType || args?.nodeType || 'node'} node`,
        nodeType: result?.nodeType || args?.nodeType,
        nodeId: result?.nodeId,
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
      return { success: true, message: BUILD_MESSAGES[name], ...ids };
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
        // A provider reuses call ids across turns (and the TEST fixture always does): scope them to the run.
        const actionId = `${options.run.runId}:${toolCallId}`;
        let context: ToolContext | undefined;
        try {
          context = options.toolContext?.();
        } catch {
          context = undefined;
        }
        const payload = mutationFromTool(spec.name, args, context);
        console.log(`[Agent] Tool ${spec.name} commit ${toolCallId}`);
        if (!payload) {
          return { success: false, error: `Unknown tool: ${spec.name}` };
        }
        const outcome = commitCommand(options.db, {
          projectId: options.run.projectId,
          runId: options.run.runId,
          actionId,
          expectedRevisionId,
          actor: 'ai',
          payload,
        });
        if (outcome.status === 'applied' && outcome.projection?.activeRun) {
          expectedRevisionId = outcome.projection.activeRun.expectedRevisionId;
          options.onRevision?.(expectedRevisionId);
        }
        const step = outcome.status === 'applied' && isStepTool(spec.name)
          ? buildStep(spec.name, toolCallId, args, outcome, options)
          : null;
        if (outcome.projection) options.onProjection?.(outcome.projection);
        if (step) options.onBuildStep?.(step);
        const result = toolOutcome(spec.name, args, outcome);
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
