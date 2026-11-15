/**
 * The type of the legacy in-window revision snapshot.
 *
 * Who uses it: state/revisionState.ts (GraphRevision, for its legacy snapshot list). The app's real revisions are
 * main's (shared/contracts/revisions.ts).
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
