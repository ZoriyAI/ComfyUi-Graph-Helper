/**
 * Types of the legacy in-window revision and action model.
 *
 * Who uses it: state/revisionState.ts, services/graph/graphService.ts, services/actions/actionExecutor.ts,
 * services/llm/tools.ts and the conflict tests. The app's real revisions are main's (shared/contracts/revisions.ts).
 */
import { GraphNode, GraphEdge } from './graph';

/**
 * Graph revision for tracking changes
 */
export interface GraphRevision {
  id: string;
  timestamp: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  parentRevisionId?: string;
  description?: string;
  source: 'user' | 'ai' | 'import' | 'system';
}

/**
 * Action types for graph operations
 */
export type ActionType =
  | 'add-node'
  | 'remove-node'
  | 'update-node'
  | 'add-edge'
  | 'remove-edge'
  | 'update-edge'
  | 'annotate-node';

/**
 * Graph action
 */
export interface GraphAction {
  id: string;
  type: ActionType;
  timestamp: number;
  beforeRevisionId: string;
  afterRevisionId?: string;
  payload: unknown;
  source: 'user' | 'ai';
  status: 'pending' | 'applied' | 'failed' | 'conflict' | 'cancelled';
  error?: string;
  result?: any; // What the action produced (for example the nodeId of add-node), for the tool's answer.
}
