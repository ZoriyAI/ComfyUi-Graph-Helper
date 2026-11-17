/**
 * The projection on screen: the graph main last sent (its revision, its run), and the path every manual edit
 * takes to main.
 *
 * Who uses it: nearly every part that changes or watches the graph: components/graph (commit.ts, CanvasFlow,
 * canvasStore, the layers, clipboard, editBatch, ReplayPlayer), the library, the shell (Toolbar, StatusBar), App.tsx,
 * services (chatService, drawWatch, portsNotice, catalogWatch, projectFile), state/proposalsState.ts and commands.
 * Why: main owns the graph; the window shows the newest projection it accepted and sends edits one at a time.
 */
import { validInstanceDepth } from '../../components/graph/lib/instanceContext';
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
import { trackCommit } from './pending';

/** What the window knows of the projection on screen, and the function that accepts a new one. */
interface DisplayedProjection {
  projectId: string;
  revSeq: number;
  currentRevisionId: string;
  activeRun: Projection['activeRun'];
  /** The graph on screen (Projection.graphKey); '' until the first projection. */
  graphKey: string;
  apply: (incoming: Projection) => boolean;
}

/** The projection on screen. `apply` refuses an older or foreign projection (shared/commands/reconcile.ts). */
export const useProjectionStore = create<DisplayedProjection>((set, get) => ({
  projectId: DESKTOP_PROJECT_ID,
  revSeq: 0,
  currentRevisionId: '',
  activeRun: null,
  graphKey: '',
  apply: (incoming) => {
    const displayed = get();
    // revSeq 0 means nothing is shown yet, so any projection is accepted.
    const known = displayed.revSeq === 0 ? null : { projectId: displayed.projectId, revSeq: displayed.revSeq };
    if (!acceptsProjection(known, incoming)) return false;
    const nodes = keepUnchangedNodes(useGraphStore.getState().nodes, incoming.snapshot.nodes as GraphNode[]);
    const edges = incoming.snapshot.edges as GraphEdge[];
    const components = Array.isArray(incoming.snapshot.components) ? incoming.snapshot.components as ComponentRecord[] : [];
    const process = incoming.snapshot.process && typeof incoming.snapshot.process === 'object'
      ? incoming.snapshot.process as { title?: unknown; notes?: unknown }
      : { title: '', notes: '' };
    const graph = useGraphStore.getState();
    const subgraphs = Array.isArray(incoming.snapshot.subgraphs) ? incoming.snapshot.subgraphs as SubgraphDefinition[] : [];
    const depth = validInstanceDepth({ ...graph, nodes, subgraphs });
    useGraphStore.setState({
      subgraphPath: graph.subgraphPath.slice(0, depth),
      subgraphInstancePath: graph.subgraphInstancePath.slice(0, depth),
      activeSubgraphId: graph.subgraphPath[depth - 1] ?? null,
      ...(displayed.graphKey !== (incoming.graphKey ?? '') || displayed.projectId !== incoming.projectId
        ? { subgraphPath: [], subgraphInstancePath: [], activeSubgraphId: null, selectedNodeIds: [], selectedEdgeIds: [] } : {}),
      nodes,
      edges,
      components,
      process: {
        title: typeof process.title === 'string' ? process.title : '',
        notes: typeof process.notes === 'string' ? process.notes : '',
      },
      document: (incoming.snapshot.document ?? null) as WorkflowDocumentState | null,
      subgraphs,
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

/** The incoming nodes, reusing the object on screen for each node whose content did not change. */
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

/** Another graph came onto the canvas: the knowledge store re-reads its explanations (when main offers them). */
function graphReplaced(): void {
  if (typeof window === 'undefined' || !window.electronAPI?.listExplanations) return;
  void useKnowledgeStore.getState().graphChanged().catch(() => undefined);
}

/** Shows a projection main sent, if it is newer than the one on screen; true when it was taken. */
export function applyProjection(incoming: Projection | null | undefined): boolean {
  if (!incoming) return false;
  return useProjectionStore.getState().apply(incoming);
}

/** Manual commits run one after another, each on the head the previous one made. */
let manualQueue: Promise<unknown> = Promise.resolve();

/**
 * Says whether a manual change may land now. commands/replayGate.ts installs it: while History replay shows an old
 * version the real graph is read-only, so a change from any panel (library, lessons, a model card) is refused there.
 */
let manualGate: (() => boolean) | null = null;

/** Installs (or with null removes) the manual gate. */
export function setManualGate(gate: (() => boolean) | null): void {
  manualGate = gate;
}

/** True when the gate refuses manual changes now (and it has said so to the person). */
export function manualChangesBlocked(): boolean {
  return manualGate ? !manualGate() : false;
}

/**
 * Sends one manual edit to main. Refused at once while the gate is closed; otherwise tracked as pending (for undo)
 * and queued. `context` names the graph the edit was made for; when another graph is on screen by the time it runs,
 * it ends as a conflict and nothing is sent.
 */
export function submitManual(actionId: string, payload: unknown, context?: { projectId: string; graphKey: string; isCurrent?: () => boolean }) {
  if (manualChangesBlocked()) {
    const displayed = useProjectionStore.getState();
    return Promise.resolve({ status: 'rejected' as const, projection: null, result: { error: 'History replay is open.' }, projectId: displayed.projectId });
  }
  return trackCommit(() => submitNow(actionId, payload, context));
}

/** The queued part of submitManual: checks the graph is still the same, then commits on the current head. */
function submitNow(actionId: string, payload: unknown, context?: { projectId: string; graphKey: string; isCurrent?: () => boolean }) {
  const original = context ?? useProjectionStore.getState();
  const run = manualQueue.then(async () => {
    const displayed = useProjectionStore.getState();
    if (manualChangesBlocked() || displayed.projectId !== original.projectId || displayed.graphKey !== original.graphKey || context?.isCurrent?.() === false) return { status: 'conflict' as const, projection: null, result: null };
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
