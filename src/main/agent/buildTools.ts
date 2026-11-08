import type Database from 'better-sqlite3';
import { jsonSchema } from 'ai';
import { commitCommand } from '../commands/commit';
import { mutationFromTool } from '../../shared/commands/tools';
import type { CommandResponse, Projection } from '../../shared/commands/types';
import type { AgentRunContext } from '../../shared/contracts';

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

export function toolOutcome(name: string, args: Record<string, unknown> | undefined, outcome: CommandResponse) {
  if (outcome.status === 'applied' || outcome.status === 'historical') {
    const result = outcome.result as Record<string, unknown> | null;
    if (name === 'addNode') {
      return {
        success: true,
        message: `Added ${result?.nodeType || args?.nodeType || 'node'} node`,
        nodeType: result?.nodeType || args?.nodeType,
        nodeId: result?.nodeId,
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

/**
 * Build tools from renderer specs. Each call commits through commitCommand as actor 'ai' and
 * moves the expected revision forward so the next call in the same run does not conflict.
 */
export function createBuildTools(
  specs: RendererToolSpec[],
  options: {
    db: Database.Database;
    run: RunContext;
    onProjection?: (projection: Projection) => void;
    onRevision?: (revisionId: string) => void;
  },
): Record<string, { description?: string; inputSchema: ReturnType<typeof jsonSchema>; execute: (args: any, call?: { toolCallId?: string }) => Promise<unknown> }> {
  const tools: Record<string, any> = {};
  let expectedRevisionId = options.run.expectedRevisionId;
  for (const spec of specs) {
    if (!spec || typeof spec.name !== 'string') continue;
    const schema = spec.parameters && typeof spec.parameters === 'object'
      ? spec.parameters
      : { type: 'object', properties: {} };
    tools[spec.name] = {
      description: spec.description,
      inputSchema: jsonSchema(schema as any),
      execute: async (args: any, call?: { toolCallId?: string }) => {
        const toolCallId = call?.toolCallId || `${spec.name}-missing-id`;
        const payload = mutationFromTool(spec.name, args);
        console.log(`[Agent] Tool ${spec.name} commit ${toolCallId}`);
        if (!payload) {
          return { success: false, error: `Unknown tool: ${spec.name}` };
        }
        const outcome = commitCommand(options.db, {
          projectId: options.run.projectId,
          runId: options.run.runId,
          actionId: toolCallId,
          expectedRevisionId,
          actor: 'ai',
          payload,
        });
        if (outcome.status === 'applied' && outcome.projection?.activeRun) {
          expectedRevisionId = outcome.projection.activeRun.expectedRevisionId;
          options.onRevision?.(expectedRevisionId);
        }
        if (outcome.projection) options.onProjection?.(outcome.projection);
        return toolOutcome(spec.name, args, outcome);
      },
    };
  }
  return tools;
}
