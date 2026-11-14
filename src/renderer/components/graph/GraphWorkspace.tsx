import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../state/graphState';
import { startProposalsSubscription } from '../../state/proposalsState';
import { useCanvasStore } from './canvasStore';
import CanvasFlow from './CanvasFlow';
import Onboarding from './Onboarding';
import SubgraphBreadcrumb from './SubgraphBreadcrumb';
import { commitManual } from './commit';
import { addedNodeId, revealNewNode } from './lib/reveal';
import { placeNewNode } from './placeNode';
import { dropToAddNode, MODEL_DRAG_TYPE, modelFromDrop, NODE_DRAG_TYPE } from './lib/modelLoaders';
import { addModelLoader } from '../library/placeModel';
import { useMotionLevel } from './lib/motion';
import { FIT_PADDING } from './CanvasToolbar';
import { replayStepText } from './lib/replay';
import { fitDurationMs } from '../../motion/policy';
import { setCanvasHandle } from '../../commands/canvasHandle';
import styles from './GraphWorkspace.module.css';

function acceptsDrag(event: React.DragEvent): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes(NODE_DRAG_TYPE) || types.includes(MODEL_DRAG_TYPE);
}

function ReplayBanner() {
  const { t } = useTranslation();
  const replay = useCanvasStore((state) => state.replay);
  if (!replay || replay.revisions.length === 0) return null;
  const row = replay.revisions[replay.index];
  // The same sentences as the undo tooltip ("add KSampler"), never the command name.
  const step = replayStepText(row);
  return (
    <p className={styles.replayBanner} role="status">
      {t('canvas.replayBannerVersion', { seq: row?.revSeq ?? 0, count: replay.revisions[replay.revisions.length - 1]?.revSeq ?? replay.revisions.length, what: String(t(step.key, step.values)) })}
    </p>
  );
}

function Workspace({ onImportWorkflow }: GraphWorkspaceProps) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const empty = useGraphStore((state) => state.nodes.length === 0 && state.activeSubgraphId === null);
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  // The welcome card lies over the canvas, so it steps aside while the node search is open under the toolbar.
  const searching = useCanvasStore((state) => state.addSearch.open);
  // Inside a subgraph the canvas wears a violet frame and glow, so it never looks like the whole graph.
  const inside = useGraphStore((state) => state.activeSubgraphId !== null);
  const [dragging, setDragging] = useState(false);
  // React Flow fit duration under the motion policy (motion/policy.ts fitDurationMs); e2e reads it.
  const fitDuration = useMotionLevel() === 'full' ? 200 : 0;

  useEffect(() => {
    startProposalsSubscription();
  }, []);

  // The camera, for View ▸ Fit / Zoom in the menu bar and their shortcuts.
  useEffect(() => {
    setCanvasHandle({
      fit: () => void flow.fitView({ padding: FIT_PADDING, duration: fitDurationMs() }),
      zoomIn: () => void flow.zoomIn({ duration: fitDurationMs() }),
      zoomOut: () => void flow.zoomOut({ duration: fitDurationMs() }),
      zoomReset: () => void flow.zoomTo(1, { duration: fitDurationMs() }),
      reveal: (rect) => {
        const box = document.querySelector('.react-flow')?.getBoundingClientRect();
        if (!box) return;
        const { x, y, zoom } = flow.getViewport();
        // The visible part of the canvas in flow coordinates, less a margin so the node is not glued to an edge.
        const margin = 48 / zoom;
        const left = -x / zoom + margin;
        const top = -y / zoom + margin;
        const right = (box.width - x) / zoom - margin;
        const bottom = (box.height - y) / zoom - margin;
        if (rect.x >= left && rect.y >= top && rect.x + rect.width <= right && rect.y + rect.height <= bottom) return;
        void flow.setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, { zoom, duration: fitDurationMs() });
      },
      panBy: (dx, dy) => {
        const { x, y, zoom } = flow.getViewport();
        void flow.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: Math.min(120, fitDurationMs()) });
      },
    });
    return () => setCanvasHandle(null);
  }, [flow]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!acceptsDrag(event) || replaying) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, [replaying]);

  const onDrop = useCallback((event: React.DragEvent) => {
    setDragging(false);
    // A drop lands on the level on screen: the root graph, or the open subgraph.
    if (!acceptsDrag(event) || replaying) return;
    event.preventDefault();
    const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    // What was dropped is read now: the drag's data is gone once this handler returns.
    // A model file becomes its loader with the file chosen; the new node is selected and a toast says so.
    const model = modelFromDrop((type) => event.dataTransfer.getData(type));
    if (model) {
      void addModelLoader(model, point);
      return;
    }
    const add = dropToAddNode((type) => event.dataTransfer.getData(type));
    if (!add) return;
    void (async () => {
      // The drop point, moved to the nearest spot where the new node covers nothing.
      const at = await placeNewNode(point, { classType: add.nodeType, parameters: add.parameters });
      const result = await commitManual({
        type: 'add-node',
        nodeType: add.nodeType,
        ...(add.title ? { title: add.title } : {}),
        x: Math.round(at.x),
        y: Math.round(at.y),
        ...(Object.keys(add.parameters).length > 0 ? { parameters: add.parameters } : {}),
      });
      revealNewNode(addedNodeId(result));
    })();
  }, [flow, replaying]);

  return (
    <div
      className={`graph-canvas ${styles.root}${inside ? ` ${styles.inside}` : ''}${replaying ? ` ${styles.replaying}` : ''}${dragging ? ` ${styles.dropping}` : ''}`}
      data-fit-duration={fitDuration}
      data-inside-subgraph={inside ? 'true' : undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <AnimatePresence>{empty && !replaying && !searching ? <Onboarding key="onboarding" onImport={onImportWorkflow} /> : null}</AnimatePresence>
      <CanvasFlow />
      <SubgraphBreadcrumb />
      <ReplayBanner />
      {dragging ? <p className={styles.dropHint} aria-hidden="true">{t('canvas.dropHere')}</p> : null}
    </div>
  );
}

/**
 * The whole graph area. Wraps React Flow with the floating toolbar, subgraph breadcrumb,
 * ghost layer, flow pulses, tour callouts, context menu and library drop handling.
 * The shell renders it once and passes nothing; state flows through the stores
 * (graphState, proposalsState, uiState) and questions go out through services/ask.ts.
 */
export interface GraphWorkspaceProps {
  /** Opens the workflow import (the empty-canvas onboarding offers it). */
  onImportWorkflow?: () => void;
}

export default function GraphWorkspace({ onImportWorkflow }: GraphWorkspaceProps = {}) {
  return (
    <ReactFlowProvider>
      <Workspace onImportWorkflow={onImportWorkflow} />
    </ReactFlowProvider>
  );
}
