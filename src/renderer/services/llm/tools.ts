import { tool } from 'ai';
import { z } from 'zod';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
import { GraphAction } from '../../types/revisions';
import { useRevisionStore } from '../../state/revisionState';

/**
 * Tool definitions for LLM to manipulate graph
 * 
 * CRITICAL: Each tool captures baseRevisionId at call time
 * to detect conflicts with manual edits
 */

export const graphTools = {
  /**
   * Get current graph state for context
   */
  getCurrentGraph: tool({
    description: 'Get the current workflow graph state including all nodes, connections, and selection',
    parameters: z.object({}),
    execute: async () => {
      const graphService = getGraphService();
      const state = graphService.getCurrentGraphState();
      
      return {
        success: true,
        graph: state,
        timestamp: Date.now(),
      };
    },
  }),

  /**
   * Add a node to the graph
   */
  addNode: tool({
    description: 'Add a new node to the ComfyUI workflow graph',
    parameters: z.object({
      nodeType: z.string().describe('ComfyUI node class type (e.g., "KSampler", "LoadImage", "SaveImage")'),
      title: z.string().optional().describe('Optional display title for the node'),
      x: z.number().optional().describe('X position on canvas (defaults to center)'),
      y: z.number().optional().describe('Y position on canvas (defaults to center)'),
      parameters: z.record(z.unknown()).optional().describe('Node parameters (e.g., {"steps": 20, "cfg": 7.0})'),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      
      // Capture base revision BEFORE planning this action
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

      const executor = getActionExecutor();
      await executor.queueAction(action);

      // Check if it was applied or conflicted
      if (action.status === 'conflict') {
        return {
          success: false,
          conflict: true,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false,
          error: action.error,
        };
      }

      return {
        success: true,
        message: `Added ${args.nodeType} node`,
        nodeType: args.nodeType,
      };
    },
  }),

  /**
   * Connect two nodes
   */
  connectNodes: tool({
    description: 'Connect two nodes by creating an edge between their ports',
    parameters: z.object({
      sourceNodeId: z.string().describe('ID of the source node'),
      sourceOutputIndex: z.number().describe('Index of the output port on source node (0-based)'),
      targetNodeId: z.string().describe('ID of the target node'),
      targetInputIndex: z.number().describe('Index of the input port on target node (0-based)'),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI connect-nodes');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'add-edge',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      const executor = getActionExecutor();
      await executor.queueAction(action);

      if (action.status === 'conflict') {
        return {
          success: false,
          conflict: true,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false,
          error: action.error,
        };
      }

      return {
        success: true,
        message: `Connected ${args.sourceNodeId} to ${args.targetNodeId}`,
      };
    },
  }),

  /**
   * Update node parameters
   */
  updateNode: tool({
    description: 'Update parameters of an existing node',
    parameters: z.object({
      nodeId: z.string().describe('ID of the node to update'),
      parameters: z.record(z.unknown()).describe('Parameters to update (e.g., {"steps": 30})'),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI update-node');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'update-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      const executor = getActionExecutor();
      await executor.queueAction(action);

      if (action.status === 'conflict') {
        return {
          success: false,
          conflict: true,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false,
          error: action.error,
        };
      }

      return {
        success: true,
        message: `Updated node ${args.nodeId}`,
      };
    },
  }),

  /**
   * Annotate a node with explanation
   */
  annotateNode: tool({
    description: 'Add an explanation or annotation to a node (visible to user)',
    parameters: z.object({
      nodeId: z.string().describe('ID of the node to annotate'),
      annotation: z.string().describe('Annotation text to add'),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI annotate-node');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'annotate-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      const executor = getActionExecutor();
      await executor.queueAction(action);

      if (action.status === 'conflict') {
        return {
          success: false,
          conflict: true,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false,
          error: action.error,
        };
      }

      return {
        success: true,
        message: `Annotated node ${args.nodeId}`,
      };
    },
  }),

  /**
   * Remove a node from the graph
   */
  removeNode: tool({
    description: 'Remove a node from the workflow graph',
    parameters: z.object({
      nodeId: z.string().describe('ID of the node to remove'),
    }),
    execute: async (args) => {
      const graphService = getGraphService();
      const baseRevision = graphService.createRevision('system', 'Before AI remove-node');

      const action: GraphAction = {
        id: `action-${Date.now()}`,
        type: 'remove-node',
        timestamp: Date.now(),
        beforeRevisionId: baseRevision.id,
        payload: args,
        source: 'ai',
        status: 'pending',
      };

      const executor = getActionExecutor();
      await executor.queueAction(action);

      if (action.status === 'conflict') {
        return {
          success: false,
          conflict: true,
          message: action.error || 'Graph was modified, action cancelled',
        };
      }

      if (action.status === 'failed') {
        return {
          success: false,
          error: action.error,
        };
      }

      return {
        success: true,
        message: `Removed node ${args.nodeId}`,
      };
    },
  }),
};
