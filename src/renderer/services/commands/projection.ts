import { create } from 'zustand';
import { acceptsProjection } from '../../../shared/commands/reconcile';
import type { Projection } from '../../../shared/commands/types';
import type { ComponentRecord } from '../../../shared/components/model';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import type { WorkflowDocumentState } from '../../../shared/workflow/codec';
import type { GroupRecord, SubgraphDefinition } from '../../../shared/graph/subgraphs';
import { useGraphStore } from '../../state/graphState';
import { useRevisionStore } from '../../state/revisionState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import type { GraphEdge, GraphNode } from '../../types/graph';

interface DisplayedProjection {
  projectId: string;
  revSeq: number;
  currentRevisionId: string;
  activeRun: Projection['activeRun'];
  /** The graph on screen (Projection.graphKey); '' until the first projection. */
  graphKey: string;
  apply: (incoming: Projection) => boolean;
}

export const useProjectionStore = create<DisplayedProjection>((set, get) => ({
  projectId: DESKTOP_PROJECT_ID,
  revSeq: 0,
  currentRevisionId: '',
  activeRun: null,
  graphKey: '',
  apply: (incoming) => {
    const displayed = get();
    const known = displayed.revSeq === 0 ? null : { projectId: displayed.projectId, revSeq: displayed.revSeq };
    if (!acceptsProjection(known, incoming)) return false;
    const nodes = keepUnchangedNodes(useGraphStore.getState().nodes, incoming.snapshot.nodes as GraphNode[]);
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
    const graphKey = incoming.graphKey ?? '';
    set({
      projectId: incoming.projectId,
      revSeq: incoming.revSeq,
      currentRevisionId: incoming.currentRevisionId,
      activeRun: incoming.activeRun,
      graphKey,
    });
    // Another graph is on screen (new, open, import, or undo and redo across one): its objects have their own
    // explanations, so what the panels and cards hold is read again.
    if (displayed.graphKey !== '' && graphKey !== displayed.graphKey) graphReplaced();
    return true;
  },
}));

/**
 * What each node looked like in the last projection: its serialized form and the data object made from it.
 * Each change brings the whole graph from main; a node whose content did not change keeps the very object on
 * screen (with the size the canvas measured), so the canvas redraws only what changed. With 1000 nodes an undo
 * otherwise redrew and measured every node again (several seconds).
 */
const lastNodes = new Map<string, { text: string; data: unknown }>();

export function keepUnchangedNodes(shown: GraphNode[], incoming: GraphNode[]): GraphNode[] {
  const byId = new Map(shown.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const result = incoming.map((node) => {
    const text = JSON.stringify(node);
    const selected = byId.get(node.id)?.selected === true;
    const before = lastNodes.get(node.id);
    const current = byId.get(node.id);
    seen.add(node.id);
    if (
      before && current && before.text === text && current.data === before.data
      && current.position?.x === node.position?.x && current.position?.y === node.position?.y
    ) {
      return current;
    }
    const made = { ...node, selected };
    lastNodes.set(node.id, { text, data: made.data });
    return made;
  });
  for (const id of [...lastNodes.keys()]) if (!seen.has(id)) lastNodes.delete(id);
  return result;
}

function graphReplaced(): void {
  if (typeof window === 'undefined' || !window.electronAPI?.listExplanations) return;
  void useKnowledgeStore.getState().graphChanged().catch(() => undefined);
}

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
