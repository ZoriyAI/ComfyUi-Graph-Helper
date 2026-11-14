import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  BackgroundVariant,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  useStore,
  useViewport,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { moveAnnouncement, type Translator } from '../../../shared/i18n';
import { portsCompatible } from '../../../shared/graph/linkTypes';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID } from '../../../shared/graph/subgraphs';
import { pruneSubgraphPath, useGraphStore } from '../../state/graphState';
import { useUiStore } from '../../state/uiState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { fitDurationMs } from '../../motion/policy';
import type { BoundaryNode, GraphEdge, GraphNode, PortDefinition } from '../../types/graph';
import ComfyNode from './nodes/ComfyNode';
import BoundaryNodeView from './nodes/BoundaryNode';
import TypedEdge from './edges/TypedEdge';
import GroupLayer from './layers/GroupLayer';
import GhostLayer from './layers/GhostLayer';
import ConnectAssistLayer from './layers/ConnectAssistLayer';
import TourLayer from './layers/TourLayer';
import DescriptionLayer from './layers/DescriptionLayer';
import BuildLayer from './layers/BuildLayer';
import LiveBuildStrip from './layers/LiveBuildStrip';
import ImportLookLayer from './layers/ImportLookLayer';
import GraphContextMenu from './GraphContextMenu';
import { CanvasViewContext, type CanvasView } from './CanvasContext';
import { useCanvasStore } from './canvasStore';
import { usePreferencesStore } from '../../state/preferencesState';
import { commitManual } from './commit';
import { queueEdit, queueNudge } from './lib/editBatch';
import CanvasToolbar, { FIT_PADDING } from './CanvasToolbar';
import { connectCandidates, type AssistNode } from './lib/connectAssist';
import { flowingEdges } from './lib/flow';
import { definitionView, NEW_INPUT_SLOT, NEW_OUTPUT_SLOT } from './lib/subgraphView';
import { setInnerView } from './lib/level';
import { sameRefs, selectionRefs } from './lib/selection';
import { stepIndexOf } from './tour/buildTour';
import { typeColor } from './lib/typeColors';
import { glideMs, useGlide } from './lib/glide';
import { nextOverview, rememberSizes, setOverviewLevel, titleScale } from './lib/nodeSizes';
import { autoFit } from './lib/autoFit';
import { useProjectionStore } from '../../services/commands/projection';
import { Pin } from 'lucide-react';
import Button from '../../ui/Button';
import { showToast } from '../../ui/toastStore';
import { canvasHandle } from '../../commands/canvasHandle';
import styles from './GraphWorkspace.module.css';
import overviewStyles from './Overview.module.css';

const nodeTypes: NodeTypes = { comfy: ComfyNode, boundary: BoundaryNodeView };
/** Automatic fits (first nodes, a new level) never zoom past 100 %: one node must not fill the canvas. */
const AUTO_FIT_MAX_ZOOM = 1;
/** A zoom change this soon after a wheel, pinch or press on the canvas is the person's own. */
const GESTURE_MS = 400;
const edgeTypes: EdgeTypes = { default: TypedEdge };
const DELETE_KEYS = ['Backspace', 'Delete'];

type LevelNode = GraphNode | BoundaryNode;

/** Reports the camera: zoom to the graph store, and the whole viewport (with the canvas size) for the agent's turn context. */
function ZoomReporter() {
  const { x, y, zoom } = useViewport();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const setZoom = useGraphStore((state) => state.setZoom);
  const setViewport = useCanvasStore((state) => state.setViewport);
  useEffect(() => {
    setZoom(zoom);
  }, [setZoom, zoom]);
  useEffect(() => {
    setViewport({ x: Math.round(x), y: Math.round(y), zoom: Math.round(zoom * 1000) / 1000, width: Math.round(width), height: Math.round(height) });
  }, [setViewport, x, y, zoom, width, height]);
  return null;
}

/**
 * Sets `data-zoom="overview"` and the title scale on the canvas root straight on the element, so a zoom gesture
 * does not re-render the canvas on every frame.
 */
function OverviewLevel({ host }: { host: React.RefObject<HTMLDivElement> }) {
  const zoom = useStore((state) => state.transform[2]);
  const level = useRef(false);
  // When the person last zoomed by wheel, pinch or a press on the canvas (not on its toolbar): only then the band.
  const lastGesture = useRef(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const note = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.react-flow__panel')) return;
      lastGesture.current = performance.now();
    };
    const options = { capture: true, passive: true } as const;
    for (const type of ['wheel', 'pointerdown', 'touchstart']) element.addEventListener(type, note, options);
    return () => {
      for (const type of ['wheel', 'pointerdown', 'touchstart']) element.removeEventListener(type, note, options);
    };
  }, [host]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const overview = nextOverview(level.current, zoom, performance.now() - lastGesture.current < GESTURE_MS);
    level.current = overview;
    setOverviewLevel(overview);
    if (overview) element.dataset.zoom = 'overview';
    else delete element.dataset.zoom;
    element.style.setProperty('--canvas-title-scale', String(titleScale(zoom)));
  }, [zoom, host]);
  return null;
}

/** A build ended (run closed, every step shown): after the tidy glides into place, fit the view to what was built. */
function useFitAfterBuild(fit: () => void) {
  const activeRun = useProjectionStore((state) => state.activeRun);
  const queued = useCanvasStore((state) => state.queue.length);
  const runId = useCanvasStore((state) => state.live.runId);
  const shown = useCanvasStore((state) => state.live.shown);
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (activeRun || queued > 0 || !runId || shown === 0 || fitted.current === runId) return;
    fitted.current = runId;
    window.setTimeout(() => window.requestAnimationFrame(fit), glideMs() + 40);
  }, [activeRun, queued, runId, shown, fit]);
}

function portsOf(node: LevelNode | undefined, side: 'inputs' | 'outputs'): PortDefinition[] {
  if (!node) return [];
  if (node.type === 'boundary') {
    const data = (node as BoundaryNode).data;
    // The input boundary only has outputs, the output boundary only has inputs.
    if (data.direction === 'input') return side === 'outputs' ? data.ports : [];
    return side === 'inputs' ? data.ports : [];
  }
  return (node as GraphNode).data[side] ?? [];
}

/**
 * The React Flow canvas for the level on screen: the root graph, an open subgraph definition (with boundary
 * nodes), or a replayed revision (read-only). Every edit commits through commitManual, which scopes it to the
 * open definition when one is shown: inside a subgraph, nodes are added, removed, moved, wired and edited as on
 * the root canvas. A link to a slot on a boundary node wires that slot; a link to the empty slot at the end of a
 * boundary node adds a slot. Double-clicking empty canvas opens the add-node search there. A replay commits nothing.
 */
export default function CanvasFlow() {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const rootNodes = useGraphStore((state) => state.nodes);
  const rootEdges = useGraphStore((state) => state.edges);
  const setRootNodes = useGraphStore((state) => state.setNodes);
  const setRootEdges = useGraphStore((state) => state.setEdges);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const subgraphPath = useGraphStore((state) => state.subgraphPath);
  const activeSubgraphId = useGraphStore((state) => state.activeSubgraphId);
  const exitSubgraph = useGraphStore((state) => state.exitSubgraph);
  const replay = useCanvasStore((state) => state.replay);
  const connectFrom = useCanvasStore((state) => state.connectFrom);
  const focusedPort = useCanvasStore((state) => state.focusedPort);
  const callout = useCanvasStore((state) => state.callout);
  const setConnectFrom = useCanvasStore((state) => state.setConnectFrom);
  const focusRef = useUiStore((state) => state.focusRef);
  const tour = useUiStore((state) => state.tour);
  const minimapOn = useCanvasStore((state) => state.minimapOn);
  const gridSize = usePreferencesStore((state) => state.preferences.canvas.gridSize);
  const check = useKnowledgeStore((state) => state.check);
  const [fitDuration, setFitDuration] = useState(() => fitDurationMs());

  useEffect(() => {
    const read = () => setFitDuration(fitDurationMs());
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', read);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
  }, []);

  // A dissolve or an import can remove a definition the breadcrumb points into.
  useEffect(() => {
    const kept = pruneSubgraphPath(subgraphPath, subgraphs);
    if (kept.length !== subgraphPath.length) exitSubgraph(kept.length);
  }, [subgraphPath, subgraphs, exitSubgraph]);

  const definition = activeSubgraphId ? subgraphs.find((item) => item.id === activeSubgraphId) : undefined;
  const [inner, setInner] = useState<{ id: string; nodes: LevelNode[]; edges: GraphEdge[] } | null>(null);
  useEffect(() => {
    if (!definition) {
      setInner(null);
      return;
    }
    const view = definitionView(definition);
    setInner((current) => {
      // Inner nodes take the saved positions (moves are saved, and undo must show the earlier place). The boundary
      // nodes' places are on screen only: keep them when the same definition refreshes, drop them otherwise.
      if (current?.id !== definition.id) return { id: definition.id, ...view };
      const moved = new Map(current.nodes.filter((node) => node.type === 'boundary').map((node) => [node.id, node.position]));
      const selected = new Set(current.nodes.filter((node) => node.selected).map((node) => node.id));
      const pending = pendingSelect.current;
      if (pending && [...pending].every((id) => view.nodes.some((node) => node.id === id))) {
        pendingSelect.current = null;
        selected.clear();
        pending.forEach((id) => selected.add(id));
      }
      return { id: definition.id, nodes: view.nodes.map((node) => ({ ...node, position: moved.get(node.id) ?? node.position, selected: selected.has(node.id) })), edges: view.edges };
    });
  }, [definition]);

  const replayView = useMemo(() => {
    const snapshot = replay?.snapshot;
    if (!snapshot) return null;
    const nodes = (Array.isArray(snapshot.nodes) ? snapshot.nodes : []) as GraphNode[];
    return {
      nodes: nodes.map((node) => ({ ...node, type: 'comfy' as const, selected: false, draggable: false, selectable: false, connectable: false, deletable: false })),
      edges: ((Array.isArray(snapshot.edges) ? snapshot.edges : []) as GraphEdge[]).map((edge) => ({ ...edge, selectable: false, deletable: false })),
    };
  }, [replay?.snapshot]);

  const mode: 'root' | 'definition' | 'replay' = replay ? 'replay' : inner && definition ? 'definition' : 'root';

  // Commands outside React Flow (select all, delete, arrange, placement, the library) read the open subgraph's
  // nodes, with their selection and measured sizes, from here; a new node selected right after its commit stays
  // selected when the definition comes back with it.
  const pendingSelect = useRef<Set<string> | null>(null);
  const select = useCallback((nodeIds: string[] | 'all') => {
    pendingSelect.current = nodeIds === 'all' ? null : new Set(nodeIds);
    setInner((current) => (current ? {
      ...current,
      nodes: current.nodes.map((node) => {
        const selected = node.type !== 'boundary' && (nodeIds === 'all' || nodeIds.includes(node.id));
        return node.selected === selected ? node : { ...node, selected };
      }),
    } : current));
  }, []);
  useEffect(() => {
    if (mode !== 'definition' || !inner) {
      setInnerView(null);
      return;
    }
    setInnerView({ definitionId: inner.id, nodes: inner.nodes, edges: inner.edges, select });
  }, [mode, inner, select]);
  useEffect(() => () => setInnerView(null), []);

  // Escape goes one level up out of an open subgraph, once nothing else that Escape closes is open (a search,
  // a menu, a dialog, a list, a field being typed in, a link being suggested, a tour).
  useEffect(() => {
    if (mode !== 'definition') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.closest('input, textarea, select, [contenteditable="true"]') || active.closest('[role="dialog"], [role="menu"], [role="listbox"]'))) return;
      if (document.querySelector('[role="dialog"], [role="menu"], .select-content')) return;
      if (useCanvasStore.getState().connectFrom || useCanvasStore.getState().addSearch.open || useUiStore.getState().tour) return;
      const graph = useGraphStore.getState();
      if (graph.subgraphPath.length === 0) return;
      event.preventDefault();
      graph.exitSubgraph(graph.subgraphPath.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);
  const nodes: LevelNode[] = mode === 'replay' ? replayView?.nodes ?? [] : mode === 'definition' ? inner!.nodes : rootNodes;
  const edges: GraphEdge[] = mode === 'replay' ? replayView?.edges ?? [] : mode === 'definition' ? inner!.edges : rootEdges;
  const readOnly = mode === 'replay';
  const { nodes: drawnNodes, skipNext: ownMove, stop: stopGlide } = useGlide(nodes, mode === 'root');
  const host = useRef<HTMLDivElement>(null);

  // Sizes at a readable zoom, for «Разложить граф» while the overview has collapsed the nodes.
  useEffect(() => {
    if (mode === 'root') rememberSizes(rootNodes);
  }, [mode, rootNodes]);

  useFitAfterBuild(useCallback(() => autoFit(flow, { padding: FIT_PADDING, duration: fitDurationMs(), maxZoom: AUTO_FIT_MAX_ZOOM }), [flow]));

  // A new level gets a fresh camera.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => autoFit(flow, { padding: FIT_PADDING, duration: fitDurationMs(), maxZoom: AUTO_FIT_MAX_ZOOM }));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, activeSubgraphId, flow]);

  // The glow on compatible ports and the dimming of the rest: for the "what connects here" assist, and while a
  // link is being dragged from a port.
  const linkDrag = useCanvasStore((state) => state.linkDrag);
  const nodesPinned = useCanvasStore((state) => state.nodesPinned);
  const glowFrom = connectFrom ?? linkDrag;
  const plan = useMemo(() => (glowFrom && !readOnly
    ? connectCandidates(glowFrom, nodes.map((node) => ({ id: node.id, position: node.position, data: { inputs: portsOf(node, 'inputs'), outputs: portsOf(node, 'outputs') } }) satisfies AssistNode), edges)
    : null), [glowFrom, nodes, edges, readOnly]);

  const tourStep = tour ? tour.steps[tour.index] : undefined;
  const stepNodeId = tourStep?.ref.kind === 'node' ? tourStep.ref.id : callout?.nodeId ?? null;
  const selectedEdges = useMemo(() => edges.filter((edge) => edge.selected).map((edge) => edge.id), [edges]);
  const flowing = useMemo(
    () => flowingEdges(edges, { focus: focusRef, selectedEdges, stepNodeId }),
    [edges, focusRef, selectedEdges, stepNodeId],
  );

  const view = useMemo<CanvasView>(() => {
    const errorNodes = new Set<string>();
    const emptyRequired = new Set<string>();
    if (check && mode === 'root') {
      for (const item of check.missingNodes) errorNodes.add(item.nodeId);
      for (const item of check.baseModelMismatches) errorNodes.add(item.nodeId);
      for (const item of check.unconnectedRequiredInputs) emptyRequired.add(`${item.nodeId}:${item.input}`);
    }
    return { edges, plan, flowing, readOnly, inDefinition: mode === 'definition', emptyRequired, errorNodes };
  }, [edges, plan, flowing, readOnly, mode, check]);

  // Selection → uiState as ObjectRefs (nodes, edges, and the focused port).
  useEffect(() => {
    if (mode === 'replay') return;
    // Inside a definition the refs name it: its node 3 is not node 3 of the main canvas.
    const refs = selectionRefs(nodes as Array<{ id: string; selected?: boolean; data?: { comfyType?: unknown } }>, edges, focusedPort, mode === 'definition' ? activeSubgraphId : null);
    const ui = useUiStore.getState();
    if (!sameRefs(refs, ui.selection)) ui.setSelection(refs);
    if (mode === 'root') {
      useGraphStore.getState().setSelection(
        nodes.filter((node) => node.selected).map((node) => node.id),
        edges.filter((edge) => edge.selected).map((edge) => edge.id),
      );
    }
  }, [nodes, edges, focusedPort, mode, activeSubgraphId]);

  // Nodes being dragged by the pointer: their final place ends a drag; any other final place is a keyboard nudge.
  const dragging = useRef<Set<string>>(new Set());
  /** A finished move: a drag ends at once (all dragged nodes in one step), a nudge when the keys rest. */
  const moved = useCallback((id: string, position: { x: number; y: number }) => {
    if (dragging.current.has(id)) {
      dragging.current.delete(id);
      queueEdit({ type: 'move-node', nodeId: id, x: position.x, y: position.y }, 'move');
    } else {
      queueNudge(id, position.x, position.y);
    }
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    if (mode === 'replay') return;
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === true) dragging.current.add(change.id);
    }
    const local = changes.filter((change) => change.type !== 'remove');
    if (mode === 'definition') {
      // A finished drag and a removal of an inner node are saved in the definition (commitManual scopes them to
      // the open definition). The boundary pseudo-nodes are not graph nodes: their place stays on screen only.
      if (local.length > 0) setInner((current) => (current ? { ...current, nodes: applyNodeChanges(local, current.nodes as Node[]) as LevelNode[] } : current));
      for (const change of changes) {
        if (change.type === 'add' || change.id === SUBGRAPH_INPUT_NODE_ID || change.id === SUBGRAPH_OUTPUT_NODE_ID) continue;
        if (change.type === 'remove') {
          queueEdit({ type: 'remove-node', nodeId: change.id }, 'delete');
          continue;
        }
        if (change.type !== 'position' || change.dragging !== false || !change.position) continue;
        moved(change.id, change.position);
      }
      return;
    }
    // The person's own move (a drag, an arrow key) is drawn at once, never glided.
    if (changes.some((change) => change.type === 'position')) ownMove();
    if (local.length > 0) setRootNodes(applyNodeChanges(local, rootNodes) as GraphNode[]);
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && change.position) moved(change.id, change.position);
      // Several nodes deleted at once are one step (one undo brings them all back with their links).
      if (change.type === 'remove') queueEdit({ type: 'remove-node', nodeId: change.id }, 'delete');
    }
  }, [mode, rootNodes, setRootNodes, ownMove, moved]);

  // Nodes the Delete key is removing right now. React Flow removes their links first; the node's own removal takes
  // them too, so the whole deletion is one revision (one undo brings the node back with its links).
  const doomed = useRef<Set<string>>(new Set());
  const removesLink = useCallback((edgeId: string) => {
    const edge = edges.find((item) => item.id === edgeId);
    return !edge || !(doomed.current.has(edge.source) || doomed.current.has(edge.target));
  }, [edges]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    if (mode === 'replay') return;
    const local = changes.filter((change) => change.type !== 'remove');
    if (mode === 'definition') {
      if (local.length > 0) setInner((current) => (current ? { ...current, edges: applyEdgeChanges(local, current.edges as Edge[]) as GraphEdge[] } : current));
      // Removing an inner link (a slot link too) is saved in the definition.
      for (const change of changes) {
        if (change.type === 'remove' && removesLink(change.id)) queueEdit({ type: 'remove-edge', edgeId: change.id }, 'delete');
      }
      return;
    }
    if (local.length > 0) setRootEdges(applyEdgeChanges(local, rootEdges) as GraphEdge[]);
    for (const change of changes) {
      if (change.type === 'remove' && removesLink(change.id)) queueEdit({ type: 'remove-edge', edgeId: change.id }, 'delete');
    }
  }, [mode, rootEdges, setRootEdges, removesLink]);

  const findPort = useCallback((nodeId: string, side: 'inputs' | 'outputs', handle: string | null | undefined) => (
    portsOf(nodes.find((node) => node.id === nodeId), side).find((port) => port.id === handle)
  ), [nodes]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    // The empty slot at the end of a boundary node takes a link of any type from an inner port: it adds a slot.
    const newInput = connection.source === SUBGRAPH_INPUT_NODE_ID && connection.sourceHandle === NEW_INPUT_SLOT;
    const newOutput = connection.target === SUBGRAPH_OUTPUT_NODE_ID && connection.targetHandle === NEW_OUTPUT_SLOT;
    if (newInput || newOutput) {
      if (newInput && newOutput) return false;
      return newInput
        ? Boolean(findPort(connection.target, 'inputs', connection.targetHandle)) && connection.target !== SUBGRAPH_OUTPUT_NODE_ID
        : Boolean(findPort(connection.source, 'outputs', connection.sourceHandle)) && connection.source !== SUBGRAPH_INPUT_NODE_ID;
    }
    const output = findPort(connection.source, 'outputs', connection.sourceHandle);
    const input = findPort(connection.target, 'inputs', connection.targetHandle);
    if (!output || !input || connection.source === connection.target) return false;
    return portsCompatible(output.dataType, input.dataType);
  }, [findPort]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;
    setConnectFrom(null);
    if (mode === 'root') {
      void commitManual({ type: 'connect', source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle });
      return;
    }
    if (mode !== 'definition' || !definition) return;
    // Inside a definition: a link to the empty slot of a boundary node adds a subgraph slot for that inner port;
    // any other link (between inner nodes, or to an existing slot) is saved in the definition.
    const addsSlot = connection.sourceHandle === NEW_INPUT_SLOT || connection.targetHandle === NEW_OUTPUT_SLOT;
    if (!addsSlot) {
      void commitManual({ type: 'connect', source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle });
      return;
    }
    if (connection.target === SUBGRAPH_OUTPUT_NODE_ID) {
      const port = findPort(connection.source, 'outputs', connection.sourceHandle);
      if (port) void commitManual({ type: 'add-subgraph-io', definitionId: definition.id, direction: 'output', name: port.name, dataType: port.dataType, nodeId: connection.source, handle: connection.sourceHandle });
    } else if (connection.source === SUBGRAPH_INPUT_NODE_ID) {
      const port = findPort(connection.target, 'inputs', connection.targetHandle);
      if (port) void commitManual({ type: 'add-subgraph-io', definitionId: definition.id, direction: 'input', name: port.name, dataType: port.dataType, nodeId: connection.target, handle: connection.targetHandle });
    }
  }, [mode, definition, findPort, setConnectFrom]);

  // A link dragged from a port: its type lights the ports that fit. A drop on empty canvas opens the node search
  // for that type (the chosen node gets connected); a drop on a port that does not fit says why.
  const onConnectStart = useCallback((_event: unknown, params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null }) => {
    if (readOnly || !params.nodeId || !params.handleId || !params.handleType) return;
    const output = params.handleType === 'source';
    const port = findPort(params.nodeId, output ? 'outputs' : 'inputs', params.handleId);
    if (!port) return;
    useCanvasStore.getState().setLinkDrag({ nodeId: params.nodeId, handle: params.handleId, direction: output ? 'output' : 'input', dataType: port.dataType });
  }, [readOnly, findPort]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: { isValid: boolean | null; toHandle?: { nodeId: string; id?: string | null; type: string } | null; toNode?: unknown }) => {
    const from = useCanvasStore.getState().linkDrag;
    useCanvasStore.getState().setLinkDrag(null);
    if (!from || state.isValid) return;
    if (state.toHandle) {
      const output = from.direction === 'output';
      const other = findPort(state.toHandle.nodeId, state.toHandle.type === 'source' ? 'outputs' : 'inputs', state.toHandle.id ?? null);
      if (!other || state.toHandle.nodeId === from.nodeId) return;
      showToast({
        id: 'link-refused',
        tone: 'warn',
        title: String(t('canvas.linkRefused', { from: output ? from.dataType : other.dataType, to: output ? other.dataType : from.dataType })),
        description: String(t('canvas.linkRefusedHint')),
        duration: 6000,
      });
      return;
    }
    if (state.toNode) return;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    if (!point) return;
    useCanvasStore.getState().openAddSearch(flow.screenToFlowPosition({ x: point.clientX, y: point.clientY }), undefined, from);
  }, [findPort, flow, t]);

  // Arrow keys move the view when no node is selected (with nodes selected they move the nodes); Shift moves
  // farther. The keys come from the canvas or from nowhere in particular (focus on the page body after a click on
  // empty canvas), never from a field, a menu, a dialog or a node.
  const hasSelection = nodes.some((node) => node.selected);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = ({ ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, number[]>)[event.key];
      if (!step || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || hasSelection) return;
      const target = event.target instanceof Element ? event.target : null;
      const onCanvas = !target || target === document.body || Boolean(host.current?.contains(target));
      if (!onCanvas || target?.closest('input, textarea, select, [contenteditable="true"], .react-flow__node, [role="menu"], [role="dialog"], [role="listbox"]')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      event.preventDefault();
      const distance = event.shiftKey ? 400 : 80;
      canvasHandle()?.panBy(step[0] * distance, step[1] * distance);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSelection]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const current = useUiStore.getState().tour;
    if (!current) return;
    // Clicking a node during a tour continues the tour from there.
    const index = stepIndexOf(current.steps, node.id);
    if (index >= 0) useUiStore.getState().setTourIndex(index);
  }, []);

  const onPaneClick = useCallback(() => {
    if (useCanvasStore.getState().connectFrom) setConnectFrom(null);
  }, [setConnectFrom]);

  // A double click on empty canvas opens the add-node search at that spot, on every level, as in ComfyUI.
  const onDoubleClick = useCallback((event: React.MouseEvent) => {
    if (readOnly || !(event.target instanceof Element) || !event.target.classList.contains('react-flow__pane')) return;
    useCanvasStore.getState().openAddSearch(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [flow, readOnly]);

  // Autoplay stops on any pointer interaction with the canvas; explanatory layers never fight the person.
  const onPointerDownCapture = useCallback(() => {
    stopGlide();
    const ui = useUiStore.getState();
    if (ui.tour?.playing) ui.setTourPlaying(false);
    // uiState: following the helper ends with any manual action on the canvas.
    if (ui.followAgent) ui.setFollowAgent(false);
  }, [stopGlide]);

  return (
    <CanvasViewContext.Provider value={view}>
      <GraphContextMenu nodes={nodes} edges={edges} readOnly={readOnly}>
        <div ref={host} className={`${styles.flowHost} ${overviewStyles.host}`} onPointerDownCapture={onPointerDownCapture} onDoubleClick={onDoubleClick} data-canvas-mode={mode} data-nodes-pinned={nodesPinned ? 'true' : undefined}>
          <ReactFlow
            nodes={drawnNodes as Node[]}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd as never}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            zoomOnDoubleClick={false}
            // Delete, as the menu says, and Backspace, as in ComfyUI, remove the selection on every level.
            deleteKeyCode={DELETE_KEYS}
            onBeforeDelete={({ nodes: removing }) => {
              if (mode === 'replay') return Promise.resolve(false);
              const active = document.activeElement;
              const inGraph = active instanceof Element && active.closest('.react-flow') != null;
              const blocked = active instanceof Element && active.closest('[role="dialog"], [role="listbox"], [role="menu"], .select-content') != null;
              // The boundary pseudo-nodes of an open subgraph are not deletable; its inner nodes are, as on the root.
              const allowed = inGraph && !blocked;
              if (allowed && removing.length > 0) {
                doomed.current = new Set(removing.map((node) => node.id));
                window.setTimeout(() => { doomed.current = new Set(); }, 0);
              }
              return Promise.resolve(allowed);
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={!readOnly && !nodesPinned}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            colorMode="dark"
            attributionPosition="bottom-left"
            fitView
            fitViewOptions={{ padding: FIT_PADDING, duration: fitDuration, maxZoom: AUTO_FIT_MAX_ZOOM }}
            minZoom={0.1}
            maxZoom={2}
            // Shift+click adds to the selection as Ctrl+click does (as in ComfyUI); Shift+drag on empty canvas draws a box.
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            ariaLabelConfig={{
              'node.a11yDescription.default': String(t('graph.nodeDefault')),
              'node.a11yDescription.keyboardDisabled': String(t('graph.nodeKeyboard')),
              'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => {
                const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
                return moveAnnouncement(translate, String(direction), x, y);
              },
              'edge.a11yDescription.default': String(t('graph.edgeDefault')),
              'controls.ariaLabel': String(t('graph.controls')),
              'controls.zoomIn.ariaLabel': String(t('graph.zoomIn')),
              'controls.zoomOut.ariaLabel': String(t('graph.zoomOut')),
              'controls.fitView.ariaLabel': String(t('graph.fitView')),
              'controls.interactive.ariaLabel': String(t('graph.interactive')),
              'minimap.ariaLabel': String(t('graph.minimap')),
              'handle.ariaLabel': String(t('graph.handle')),
            }}
          >
            <ZoomReporter />
            <OverviewLevel host={host} />
            <Background variant={BackgroundVariant.Dots} gap={gridSize} size={1} color="var(--canvas-dot)" />
            <Panel position="top-center" className="nopan nowheel nodrag">
              <CanvasToolbar />
            </Panel>
            {nodesPinned ? (
              <Panel position="bottom-left" className="nopan nowheel nodrag">
                <span className={styles.pinnedChip} role="status" data-pinned-chip="">
                  <Pin size={13} aria-hidden="true" />
                  {t('canvas.pinnedChip')}
                  <Button variant="subtle" quiet size="sm" onClick={() => useCanvasStore.getState().setNodesPinned(false)}>{t('canvas.unpin')}</Button>
                </span>
              </Panel>
            ) : null}
            {nodes.length > 0 && minimapOn ? (
              <MiniMap
                // A click or a drag on the map moves the view there; the wheel over it zooms.
                pannable
                zoomable
                onClick={(_event, position) => void flow.setCenter(position.x, position.y, { zoom: flow.getZoom(), duration: fitDurationMs() })}
                position="bottom-right"
                style={{ width: 144, height: 96 }}
                nodeStrokeWidth={0}
                nodeBorderRadius={4}
                maskColor="rgba(5, 8, 13, 0.62)"
                maskStrokeColor="var(--accent-line)"
                maskStrokeWidth={1.5}
                className="graph-minimap"
                nodeColor={(node) => {
                  const data = node.data as { outputs?: Array<{ dataType?: string }>; inputs?: Array<{ dataType?: string }> };
                  return typeColor(data.outputs?.[0]?.dataType || data.inputs?.[0]?.dataType);
                }}
              />
            ) : null}
            <GroupLayer />
            <GhostLayer />
            <ConnectAssistLayer />
            <DescriptionLayer />
            <TourLayer />
            <BuildLayer />
            <LiveBuildStrip />
            <ImportLookLayer mode={mode} />
          </ReactFlow>
        </div>
      </GraphContextMenu>
    </CanvasViewContext.Provider>
  );
}
