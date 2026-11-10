import { commitManual } from '../graph/commit';

/**
 * A field edit, from the node or from Properties: the same set-parameter command the Inspector always used, so undo,
 * redo, revisions and the replay lock see it like any other edit.
 */
export function commitField(nodeId: string, key: string, value: unknown): Promise<unknown> {
  return commitManual({ type: 'set-parameter', nodeId, key, value }, 'parameter');
}
