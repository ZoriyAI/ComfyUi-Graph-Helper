import { create } from 'zustand';
import { acceptsProjection } from '../../../shared/commands/reconcile';
import type { Projection } from '../../../shared/commands/types';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import { useGraphStore } from '../../state/graphState';
import { useRevisionStore } from '../../state/revisionState';
import type { GraphEdge, GraphNode } from '../../types/graph';

interface DisplayedProjection {
  projectId: string;
  revSeq: number;
  currentRevisionId: string;
  activeRun: Projection['activeRun'];
  apply: (incoming: Projection) => boolean;
}

export const useProjectionStore = create<DisplayedProjection>((set, get) => ({
  projectId: DESKTOP_PROJECT_ID,
  revSeq: 0,
  currentRevisionId: '',
  activeRun: null,
  apply: (incoming) => {
    const displayed = get();
    const known = displayed.revSeq === 0 ? null : { projectId: displayed.projectId, revSeq: displayed.revSeq };
    if (!acceptsProjection(known, incoming)) return false;
    const nodes = incoming.snapshot.nodes as GraphNode[];
    const edges = incoming.snapshot.edges as GraphEdge[];
    useGraphStore.setState({ nodes, edges });
    useRevisionStore.getState().setCurrentRevision(incoming.currentRevisionId);
    set({
      projectId: incoming.projectId,
      revSeq: incoming.revSeq,
      currentRevisionId: incoming.currentRevisionId,
      activeRun: incoming.activeRun,
    });
    return true;
  },
}));

export function applyProjection(incoming: Projection | null | undefined): boolean {
  if (!incoming) return false;
  return useProjectionStore.getState().apply(incoming);
}

export async function submitManual(actionId: string, payload: unknown) {
  const displayed = useProjectionStore.getState();
  const result = await window.electronAPI.commitCommand({
    projectId: displayed.projectId,
    actionId,
    expectedRevisionId: displayed.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
  applyProjection(result.projection);
  return result;
}
