import { tool } from 'ai';
import { z } from 'zod';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
import { GraphAction } from '../../types/revisions';

/**
 * Tool definitions for LLM to manipulate graph
 * All tools properly typed for AI SDK v7
 */

export const graphTools = {
  getCurrentGraph: tool({
    description: 'Get the current workflow graph state including all nodes and connections',
    parameters: z.object({}),
    execute: async () => {
      const graphService = getGraphService();
      return {
        success: true,
        graph: graphService.getCurrentGraphState(),
        timestamp: Date.now(),
      };
    },
  }),

  addNode: tool({
    description: 'Add a new node to the ComfyUI workflow graph',
    parameters: z.object({
      nodeType: z.string().describe('ComfyUI node class type (e.g., "KSampler", "LoadImage")'),
      title: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      parameters: z.record(z.unknown()).optional(),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI add-node');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'add-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      await getActionExecutor().queueAction(action);

      if (action.status === 'conflict') {
        return {
          success: false as const,
          conflict: true as const,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false as const,
          error: action.error || 'Unknown error',
        };
      }

      return {
        success: true as const,
        message: `Added ${args.nodeType} node`,
        nodeType: args.nodeType,
      };
    },
  }),

  connectNodes: tool({
    description: 'Connect two nodes by creating an edge',
    parameters: z.object({
      sourceNodeId: z.string(),
      sourceOutputIndex: z.number(),
      targetNodeId: z.string(),
      targetInputIndex: z.number(),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI connect');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'add-edge',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      await getActionExecutor().queueAction(action);

      if (action.status === 'conflict') {
        return { success: false as const, conflict: true as const, message: action.error || 'Conflict' };
      }

      return action.status === 'applied'
        ? { success: true as const, message: `Connected ${args.sourceNodeId} to ${args.targetNodeId}` }
        : { success: false as const, error: action.error || 'Failed' };
    },
  }),

  updateNode: tool({
    description: 'Update parameters of an existing node',
    parameters: z.object({
      nodeId: z.string(),
      parameters: z.record(z.unknown()),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI update');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'update-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      await getActionExecutor().queueAction(action);

      return action.status === 'applied'
        ? { success: true as const, message: `Updated node ${args.nodeId}` }
        : action.status === 'conflict'
        ? { success: false as const, conflict: true as const, message: action.error || 'Conflict' }
        : { success: false as const, error: action.error || 'Failed' };
    },
  }),

  annotateNode: tool({
    description: 'Add an explanation to a node (visible to user)',
    parameters: z.object({
      nodeId: z.string(),
      annotation: z.string(),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI annotate');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'annotate-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      await getActionExecutor().queueAction(action);

      return action.status === 'applied'
        ? { success: true as const, message: `Annotated node ${args.nodeId}` }
        : { success: false as const, error: action.error || 'Failed' };
    },
  }),

  removeNode: tool({
    description: 'Remove a node from the workflow',
    parameters: z.object({
      nodeId: z.string(),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI remove');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'remove-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      await getActionExecutor().queueAction(action);

      return action.status === 'applied'
        ? { success: true as const, message: `Removed node ${args.nodeId}` }
        : { success: false as const, error: action.error || 'Failed' };
    },
  }),
};
