import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import GraphContextMenu from './GraphContextMenu';
import { CanvasViewContext, type CanvasView } from './CanvasContext';
import { useCanvasStore } from './canvasStore';
import { commitManual } from './commit';
import CanvasToolbar, { FIT_PADDING } from './CanvasToolbar';
import { connectCandidates, type AssistNode } from './lib/connectAssist';
import { flowingEdges } from './lib/flow';
import { definitionView } from './lib/subgraphView';
import { sameRefs, selectionRefs } from './lib/selection';
import { stepIndexOf } from './tour/buildTour';
import { typeColor } from './lib/typeColors';
import styles from './GraphWorkspace.module.css';

const nodeTypes: NodeTypes = { comfy: ComfyNode, boundary: BoundaryNodeView };
const edgeTypes: EdgeTypes = { default: TypedEdge };

type LevelNode = GraphNode | BoundaryNode;

function ZoomReporter() {
  const { zoom } = useViewport();
  const setZoom = useGraphStore((state) => state.setZoom);
  useEffect(() => {
    setZoom(zoom);
  }, [setZoom, zoom]);
  return null;
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
 * nodes), or a replayed revision (read-only). Root edits commit through commitManual; inside a definition
 * only boundary slots commit (drag a port to a boundary node, or use the context menu); a replay commits nothing.
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
      // Keep local positions when the same definition refreshes (a slot was added), drop them otherwise.
      if (current?.id !== definition.id) return { id: definition.id, ...view };
      const moved = new Map(current.nodes.map((node) => [node.id, node.position]));
      return { id: definition.id, nodes: view.nodes.map((node) => ({ ...node, position: moved.get(node.id) ?? node.position })), edges: view.edges };
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
  const nodes: LevelNode[] = mode === 'replay' ? replayView?.nodes ?? [] : mode === 'definition' ? inner!.nodes : rootNodes;
  const edges: GraphEdge[] = mode === 'replay' ? replayView?.edges ?? [] : mode === 'definition' ? inner!.edges : rootEdges;
  const readOnly = mode === 'replay';

  // A new level gets a fresh camera.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void flow.fitView({ padding: FIT_PADDING, duration: fitDurationMs() }));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, activeSubgraphId, flow]);

  const plan = useMemo(() => (connectFrom && !readOnly
    ? connectCandidates(connectFrom, nodes.map((node) => ({ id: node.id, position: node.position, data: { inputs: portsOf(node, 'inputs'), outputs: portsOf(node, 'outputs') } }) satisfies AssistNode), edges)
    : null), [connectFrom, nodes, edges, readOnly]);

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
    const refs = selectionRefs(nodes as Array<{ id: string; selected?: boolean; data?: { comfyType?: unknown } }>, edges, focusedPort);
    const ui = useUiStore.getState();
    if (!sameRefs(refs, ui.selection)) ui.setSelection(refs);
    if (mode === 'root') {
      useGraphStore.getState().setSelection(
        nodes.filter((node) => node.selected).map((node) => node.id),
        edges.filter((edge) => edge.selected).map((edge) => edge.id),
      );
    }
  }, [nodes, edges, focusedPort, mode]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    if (mode === 'replay') return;
    const local = changes.filter((change) => change.type !== 'remove');
    if (mode === 'definition') {
      // Inside a definition positions stay local: there is no mutation that moves an inner node.
      if (local.length > 0) setInner((current) => (current ? { ...current, nodes: applyNodeChanges(local, current.nodes as Node[]) as LevelNode[] } : current));
      return;
    }
    if (local.length > 0) setRootNodes(applyNodeChanges(local, rootNodes) as GraphNode[]);
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && change.position) {
        void commitManual({ type: 'move-node', nodeId: change.id, x: change.position.x, y: change.position.y });
      }
      if (change.type === 'remove') void commitManual({ type: 'remove-node', nodeId: change.id });
    }
  }, [mode, rootNodes, setRootNodes]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    if (mode === 'replay') return;
    const local = changes.filter((change) => change.type !== 'remove');
    if (mode === 'definition') {
      if (local.length > 0) setInner((current) => (current ? { ...current, edges: applyEdgeChanges(local, current.edges as Edge[]) as GraphEdge[] } : current));
      return;
    }
    if (local.length > 0) setRootEdges(applyEdgeChanges(local, rootEdges) as GraphEdge[]);
    for (const change of changes) {
      if (change.type === 'remove') void commitManual({ type: 'remove-edge', edgeId: change.id });
    }
  }, [mode, rootEdges, setRootEdges]);

  const findPort = useCallback((nodeId: string, side: 'inputs' | 'outputs', handle: string | null | undefined) => (
    portsOf(nodes.find((node) => node.id === nodeId), side).find((port) => port.id === handle)
  ), [nodes]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
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
    // Inside a definition: dragging an inner port onto a boundary node exposes it as a subgraph slot.
    if (connection.target === SUBGRAPH_OUTPUT_NODE_ID) {
      const port = findPort(connection.source, 'outputs', connection.sourceHandle);
      if (port) void commitManual({ type: 'add-subgraph-io', definitionId: definition.id, direction: 'output', name: port.name, dataType: port.dataType, nodeId: connection.source, handle: connection.sourceHandle });
    } else if (connection.source === SUBGRAPH_INPUT_NODE_ID) {
      const port = findPort(connection.target, 'inputs', connection.targetHandle);
      if (port) void commitManual({ type: 'add-subgraph-io', definitionId: definition.id, direction: 'input', name: port.name, dataType: port.dataType, nodeId: connection.target, handle: connection.targetHandle });
    }
  }, [mode, definition, findPort, setConnectFrom]);

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

  // Autoplay stops on any pointer interaction with the canvas; explanatory layers never fight the person.
  const onPointerDownCapture = useCallback(() => {
    const ui = useUiStore.getState();
    if (ui.tour?.playing) ui.setTourPlaying(false);
    // uiState: following the helper ends with any manual action on the canvas.
    if (ui.followAgent) ui.setFollowAgent(false);
  }, []);

  return (
    <CanvasViewContext.Provider value={view}>
      <GraphContextMenu nodes={nodes} edges={edges} readOnly={readOnly}>
        <div className={styles.flowHost} onPointerDownCapture={onPointerDownCapture} data-canvas-mode={mode}>
          <ReactFlow
            nodes={nodes as Node[]}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onBeforeDelete={() => {
              if (mode !== 'root') return Promise.resolve(false);
              const active = document.activeElement;
              const inGraph = active instanceof Element && active.closest('.react-flow') != null;
              const blocked = active instanceof Element && active.closest('[role="dialog"], [role="listbox"], [role="menu"], .select-content') != null;
              return Promise.resolve(inGraph && !blocked);
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            colorMode="dark"
            attributionPosition="bottom-left"
            fitView
            fitViewOptions={{ padding: FIT_PADDING, duration: fitDuration }}
            minZoom={0.1}
            maxZoom={2}
            multiSelectionKeyCode={['Meta', 'Control']}
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
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--canvas-dot)" />
            <Panel position="top-center" className="nopan nowheel nodrag">
              <CanvasToolbar />
            </Panel>
            {nodes.length > 0 && minimapOn ? (
              <MiniMap
                position="bottom-right"
                style={{ width: 144, height: 96 }}
                nodeStrokeWidth={0}
                nodeBorderRadius={4}
                maskColor="rgba(5, 8, 13, 0.62)"
                maskStrokeColor="rgba(101, 217, 237, 0.55)"
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
          </ReactFlow>
        </div>
      </GraphContextMenu>
    </CanvasViewContext.Provider>
  );
}
