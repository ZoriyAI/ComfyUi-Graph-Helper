import { z } from 'zod';
import { getGraphService } from '../graph/graphService';
import { getActionExecutor } from '../actions/actionExecutor';
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
        execute: async (args) => {
            const baseRev = getGraphService().createRevision('system', 'Before AI add');
            const action = {
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
        execute: async (args) => {
            const baseRev = getGraphService().createRevision('system', 'Before AI connect');
            const action = {
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
        execute: async (args) => {
            const baseRev = getGraphService().createRevision('system', 'Before AI update');
            const action = {
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
        execute: async (args) => {
            const baseRev = getGraphService().createRevision('system', 'Before AI annotate');
            const action = {
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
        execute: async (args) => {
            const baseRev = getGraphService().createRevision('system', 'Before AI remove');
            const action = {
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
