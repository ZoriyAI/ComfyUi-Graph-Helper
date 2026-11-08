import { create } from 'zustand';
import { acceptsProjection } from '../../../shared/commands/reconcile';
import type { Projection } from '../../../shared/commands/types';
import type { ComponentRecord } from '../../../shared/components/model';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import type { WorkflowDocumentState } from '../../../shared/workflow/codec';
import type { GroupRecord, SubgraphDefinition } from '../../../shared/graph/subgraphs';
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
    const selectedIds = new Set(useGraphStore.getState().nodes.filter((node) => node.selected).map((node) => node.id));
    const nodes = (incoming.snapshot.nodes as GraphNode[]).map((node) => ({
      ...node,
      selected: selectedIds.has(node.id),
    }));
    const edges = incoming.snapshot.edges as GraphEdge[];
    const components = Array.isArray(incoming.snapshot.components) ? incoming.snapshot.components as ComponentRecord[] : [];
    const process = incoming.snapshot.process && typeof incoming.snapshot.process === 'object'
      ? incoming.snapshot.process as { title?: unknown; notes?: unknown }
      : { title: '', notes: '' };
    useGraphStore.setState({
      nodes,
      edges,
      components,
      process: {
        title: typeof process.title === 'string' ? process.title : '',
        notes: typeof process.notes === 'string' ? process.notes : '',
      },
      document: (incoming.snapshot.document ?? null) as WorkflowDocumentState | null,
      subgraphs: Array.isArray(incoming.snapshot.subgraphs) ? incoming.snapshot.subgraphs as SubgraphDefinition[] : [],
      groups: Array.isArray(incoming.snapshot.groups) ? incoming.snapshot.groups as GroupRecord[] : [],
    });
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

let manualQueue: Promise<unknown> = Promise.resolve();

export function submitManual(actionId: string, payload: unknown) {
  const run = manualQueue.then(async () => {
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
  });
  manualQueue = run.then(() => undefined, () => undefined);
  return run;
}
