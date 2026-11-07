import { GraphAction } from '../../types/revisions';
import { getGraphService } from '../graph/graphService';
import { useGraphStore } from '../../state/graphState';

/**
 * Action executor with pause/resume and conflict detection
 * 
 * CRITICAL: baseRevisionId is captured BEFORE tool execution
 * and represents the state the model saw when planning the action.
 * It must NOT be updated during execution.
 */
export class ActionExecutor {
  private actionQueue: GraphAction[] = [];
  private isExecuting = false;
  private isPaused = false;
  private currentAction: GraphAction | null = null;

  /**
   * Queue an action for execution
   * The baseRevisionId is already set by the caller and represents
   * the graph state at the time the model made the decision
   */
  async queueAction(action: GraphAction): Promise<void> {
    console.log(`[ActionExecutor] Queueing action ${action.id} (base revision: ${action.beforeRevisionId})`);
    this.actionQueue.push(action);

    if (!this.isExecuting && !this.isPaused) {
      await this.processQueue();
    }
  }

  /**
   * Process queued actions with conflict detection
   */
  private async processQueue(): Promise<void> {
    this.isExecuting = true;

    while (this.actionQueue.length > 0 && !this.isPaused) {
      const action = this.actionQueue[0]; // Peek, don't pop yet
      this.currentAction = action;

      console.log(`[ActionExecutor] Processing action ${action.id}`);

      // CRITICAL: Check if graph changed since action was planned
      const graphService = getGraphService();
      const hasConflict = graphService.hasChangedSince(action.beforeRevisionId);

      console.log(
        `[ActionExecutor] Conflict check: baseRev=${action.beforeRevisionId}, changed=${hasConflict}`
      );

      if (hasConflict) {
        action.status = 'conflict';
        action.error = 'Graph state changed since this action was planned';
        console.warn(`[ActionExecutor] Conflict detected for action ${action.id}`);
        
        // Remove from queue and notify
        this.actionQueue.shift();
        this.notifyConflict(action);
        continue;
      }

      // Execute the action
      try {
        console.log(`[ActionExecutor] Executing action ${action.id} (type: ${action.type})`);
        await this.executeAction(action);
        action.status = 'applied';
        console.log(`[ActionExecutor] Action ${action.id} applied successfully, result:`, action.result);
      } catch (error) {
        action.status = 'failed';
        action.error = (error as Error).message;
        console.error(`[ActionExecutor] Action ${action.id} failed:`, error);
      }

      // Remove from queue after execution
      this.actionQueue.shift();
      this.currentAction = null;
    }

    this.isExecuting = false;
  }

  /**
   * Execute a single action (atomic operation)
   */
  private async executeAction(action: GraphAction): Promise<void> {
    const graphService = getGraphService();

    switch (action.type) {
      case 'add-node': {
        const args = action.payload as {
          nodeType: string;
          title?: string;
          x?: number;
          y?: number;
          parameters?: Record<string, unknown>;
        };
        const node = graphService.addNode({ ...args, source: action.source });
        // Store result for tool response
        action.result = { nodeId: node.id };
        console.log(`[ActionExecutor] Stored result for ${action.id}:`, action.result);
        break;
      }

      case 'remove-node': {
        const { nodeId } = action.payload as { nodeId: string };
        graphService.removeNode(nodeId, action.source);
        break;
      }

      case 'update-node': {
        const { nodeId, parameters } = action.payload as {
          nodeId: string;
          parameters: Record<string, unknown>;
        };
        graphService.updateNode(nodeId, parameters, action.source);
        break;
      }

      case 'annotate-node': {
        const { nodeId, annotation } = action.payload as {
          nodeId: string;
          annotation: string;
        };
        graphService.annotateNode(nodeId, annotation, action.source);
        break;
      }

      case 'add-edge': {
        const args = action.payload as {
          sourceNodeId: string;
          sourceOutputIndex: number;
          targetNodeId: string;
          targetInputIndex: number;
        };
        graphService.connectNodes({ ...args, source: action.source });
        break;
      }

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Notify about conflict (could trigger UI dialog)
   */
  private notifyConflict(action: GraphAction): void {
    console.warn('[ActionExecutor] CONFLICT:', {
      actionId: action.id,
      type: action.type,
      baseRevision: action.beforeRevisionId,
      error: action.error,
    });

    // TODO: Emit event or show UI notification
    // User should see: "AI action cancelled - graph was modified manually"
  }

  /**
   * Pause execution (user request)
   */
  pause(): void {
    console.log('[ActionExecutor] Pausing');
    this.isPaused = true;
  }

  /**
   * Resume execution
   */
  resume(): void {
    console.log('[ActionExecutor] Resuming');
    this.isPaused = false;

    if (!this.isExecuting && this.actionQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Cancel current action and clear queue
   */
  cancel(): void {
    console.log('[ActionExecutor] Cancelling all actions');
    
    if (this.currentAction) {
      this.currentAction.status = 'cancelled';
    }

    this.actionQueue.forEach((action) => {
      action.status = 'cancelled';
    });

    this.actionQueue = [];
    this.currentAction = null;
    this.isPaused = false;
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    isExecuting: boolean;
    isPaused: boolean;
    queueLength: number;
    currentAction: GraphAction | null;
  } {
    return {
      isExecuting: this.isExecuting,
      isPaused: this.isPaused,
      queueLength: this.actionQueue.length,
      currentAction: this.currentAction,
    };
  }
}

// Singleton
let actionExecutorInstance: ActionExecutor | null = null;

export function getActionExecutor(): ActionExecutor {
  if (!actionExecutorInstance) {
    actionExecutorInstance = new ActionExecutor();
  }
  return actionExecutorInstance;
}
