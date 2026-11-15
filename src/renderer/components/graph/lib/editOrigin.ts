/**
 * Guards for edits that wait between the gesture and the commit (a search, a catalog read, a placement). The origin
 * is captured at the gesture and the edit is refused if the person has since switched project, graph or subgraph,
 * because node ids repeat between graphs. Used by AddNodeSearch, reveal.ts, the node library (NodeLibrary.tsx) and
 * library/placeModel.ts.
 */
import type { GraphMutation } from '../../../../shared/commands/types';
import { useProjectionStore } from '../../../services/commands/projection';
import { useGraphStore } from '../../../state/graphState';
import { commitManual, reportRefusal } from '../commit';

/**
 * The project, graph and open subgraph definition an edit was started in. Capture at the user gesture, before any
 * search, validation, metadata or placement wait.
 */
export interface EditOrigin { projectId: string; graphKey: string; definitionId: string | null }
/** Where the person is editing right now. */
export function captureEditOrigin(): EditOrigin {
  const { projectId, graphKey } = useProjectionStore.getState();
  return { projectId, graphKey, definitionId: useGraphStore.getState().activeSubgraphId };
}
/** Whether the person is still in the same project, graph and level as at `origin`. */
export function originIsCurrent(origin: EditOrigin): boolean {
  const current = captureEditOrigin();
  return current.projectId === origin.projectId && current.graphKey === origin.graphKey && current.definitionId === origin.definitionId;
}
/** A delayed gesture is cancelled visibly rather than applied to an identically numbered object elsewhere. */
export function requireEditOrigin(origin: EditOrigin): boolean {
  if (originIsCurrent(origin)) return true;
  reportRefusal({ status: 'conflict' });
  return false;
}
/** Commits `payload` only if the person is still where the gesture started; else a conflict toast and null. */
export function commitAtOrigin(origin: EditOrigin, payload: GraphMutation, prefix = 'manual'): Promise<unknown> {
  if (!requireEditOrigin(origin)) return Promise.resolve(null);
  return commitManual(payload, prefix, { context: { ...origin, isCurrent: () => originIsCurrent(origin) } });
}
