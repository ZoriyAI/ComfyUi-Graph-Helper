/**
 * An older set of assistant graph tools (zod schemas plus execute functions) over the legacy action executor.
 *
 * Who uses it: nothing in the app imports it today; the assistant's tools are described in
 * shared/commands/toolSpecs.ts and run in main. Each tool snapshots the graph first, so the executor can tell
 * whether the person changed it before the action ran.
 */
import { z } from 'zod';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
import { GraphAction } from '../../types/revisions';

/** The legacy tools by name. */
export const graphTools = {
  getCurrentGraph: {
    description: 'Get current workflow graph',
    parameters: z.object({}),
    execute: async () => ({
      success: true,
      graph: getGraphService().getCurrentGraphState(),
      timestamp: Date.now(),
    }),
  },

  addNode: {
    description: 'Add node to graph',
    parameters: z.object({
      nodeType: z.string(),
      title: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async (args: {
      nodeType: string;
      title?: string;
      x?: number;
      y?: number;
      parameters?: Record<string, unknown>;
    }) => {
      const baseRev = getGraphService().createRevision('system', 'Before AI add');
      const action: GraphAction = {
        id: `a-${Date.now()}`,
        type: 'add-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRev.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };
      await getActionExecutor().queueAction(action);
      return action.status === 'conflict'
        ? { success: false, conflict: true, message: action.error || 'Conflict' }
        : action.status === 'failed'
        ? { success: false, error: action.error || 'Failed' }
        : { success: true, message: `Added ${args.nodeType}`, nodeType: args.nodeType };
    },
  },

  connectNodes: {
    description: 'Connect two nodes',
    parameters: z.object({
      sourceNodeId: z.string(),
      sourceOutputIndex: z.number(),
      targetNodeId: z.string(),
      targetInputIndex: z.number(),
    }),
    execute: async (args: {
      sourceNodeId: string;
      sourceOutputIndex: number;
      targetNodeId: string;
      targetInputIndex: number;
    }) => {
      const baseRev = getGraphService().createRevision('system', 'Before AI connect');
      const action: GraphAction = {
        id: `a-${Date.now()}`,
        type: 'add-edge',
        timestamp: Date.now(),
        beforeRevisionId: baseRev.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };
      await getActionExecutor().queueAction(action);
      return action.status === 'applied'
        ? { success: true, message: `Connected ${args.sourceNodeId} to ${args.targetNodeId}` }
        : { success: false, error: action.error || 'Failed' };
    },
  },

  updateNode: {
    description: 'Update node parameters',
    parameters: z.object({
      nodeId: z.string(),
      parameters: z.record(z.string(), z.unknown()),
    }),
    execute: async (args: { nodeId: string; parameters: Record<string, unknown> }) => {
      const baseRev = getGraphService().createRevision('system', 'Before AI update');
      const action: GraphAction = {
        id: `a-${Date.now()}`,
        type: 'update-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRev.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };
      await getActionExecutor().queueAction(action);
      return action.status === 'applied'
        ? { success: true, message: `Updated ${args.nodeId}` }
        : { success: false, error: action.error || 'Failed' };
    },
  },

  annotateNode: {
    description: 'Add annotation to node',
    parameters: z.object({
      nodeId: z.string(),
      annotation: z.string(),
    }),
    execute: async (args: { nodeId: string; annotation: string }) => {
      const baseRev = getGraphService().createRevision('system', 'Before AI annotate');
      const action: GraphAction = {
        id: `a-${Date.now()}`,
        type: 'annotate-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRev.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };
      await getActionExecutor().queueAction(action);
      return action.status === 'applied'
        ? { success: true, message: `Annotated ${args.nodeId}` }
        : { success: false, error: action.error || 'Failed' };
    },
  },

  removeNode: {
    description: 'Remove node',
    parameters: z.object({ nodeId: z.string() }),
    execute: async (args: { nodeId: string }) => {
      const baseRev = getGraphService().createRevision('system', 'Before AI remove');
      const action: GraphAction = {
        id: `a-${Date.now()}`,
        type: 'remove-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRev.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };
      await getActionExecutor().queueAction(action);
      return action.status === 'applied'
        ? { success: true, message: `Removed ${args.nodeId}` }
        : { success: false, error: action.error || 'Failed' };
    },
  },
};
