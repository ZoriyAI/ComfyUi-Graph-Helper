/**
 * An older executor for assistant graph actions, with pause, resume and conflict detection, over
 * services/graph/graphService.ts.
 *
 * Who uses it: services/llm/tools.ts (which nothing in the app imports) and the conflict tests
 * (tests/integration/aiHumanConflict.test.ts and others). The live assistant commits through main, which checks the
 * expected revision itself. Why the tests matter: an assistant step planned on a graph the person has changed since
 * must be refused, not applied over the person's change.
 */
import { GraphAction } from '../../types/revisions';
import { getGraphService } from '../graph/graphService';
import { useGraphStore } from '../../state/graphState';

/**
 * Runs queued graph actions one by one. An action's beforeRevisionId is captured before the tool runs and stands
 * for the graph the model saw when it planned the action; it must not be updated during execution.
 */
export class ActionExecutor {
  private actionQueue: GraphAction[] = [];
  private isExecuting = false;
  private isPaused = false;
  private currentAction: GraphAction | null = null;

  /**
   * Queues an action. Its beforeRevisionId is set by the caller: the graph the model saw when it decided.
   * Resolves once the queue has run, unless the queue is paused or already running, when it resolves at once and
   * the action is still pending.
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
   * Reports a conflict to the console only; nothing in the window shows it.
   */
  private notifyConflict(action: GraphAction): void {
    console.warn('[ActionExecutor] CONFLICT:', {
      actionId: action.id,
      type: action.type,
      baseRevision: action.beforeRevisionId,
      error: action.error,
    });

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

// One executor per window.
let actionExecutorInstance: ActionExecutor | null = null;

/** The window's one ActionExecutor, made on first use. */
/** The window's one ActionExecutor, made on first use. */
export function getActionExecutor(): ActionExecutor {
  if (!actionExecutorInstance) {
    actionExecutorInstance = new ActionExecutor();
  }
  return actionExecutorInstance;
}
