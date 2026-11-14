import type { GraphMutation } from '../../../../shared/commands/types';
import { useProjectionStore } from '../../../services/commands/projection';
import { useGraphStore } from '../../../state/graphState';
import { commitManual, reportRefusal } from '../commit';

/** Capture at the user gesture, before any search, validation, metadata or placement wait. */
export interface EditOrigin { projectId: string; graphKey: string; definitionId: string | null }
export function captureEditOrigin(): EditOrigin {
  const { projectId, graphKey } = useProjectionStore.getState();
  return { projectId, graphKey, definitionId: useGraphStore.getState().activeSubgraphId };
}
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
export function commitAtOrigin(origin: EditOrigin, payload: GraphMutation, prefix = 'manual'): Promise<unknown> {
  if (!requireEditOrigin(origin)) return Promise.resolve(null);
  return commitManual(payload, prefix, { context: { ...origin, isCurrent: () => originIsCurrent(origin) } });
}
