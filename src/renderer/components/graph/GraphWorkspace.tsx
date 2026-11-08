import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../state/graphState';
import { startProposalsSubscription } from '../../state/proposalsState';
import { useCanvasStore } from './canvasStore';
import CanvasFlow from './CanvasFlow';
import CanvasToolbar from './CanvasToolbar';
import SubgraphBreadcrumb from './SubgraphBreadcrumb';
import { commitManual } from './commit';
import { dropToAddNode, MODEL_DRAG_TYPE, NODE_DRAG_TYPE } from './lib/modelLoaders';
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
  return (
    <p className={styles.replayBanner} role="status">
      {t('canvas.replayBanner', { seq: row?.revSeq ?? 0, count: replay.revisions[replay.revisions.length - 1]?.revSeq ?? replay.revisions.length, what: row?.description ?? '' })}
    </p>
  );
}

function Workspace() {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const empty = useGraphStore((state) => state.nodes.length === 0 && state.activeSubgraphId === null);
  const replaying = useCanvasStore((state) => Boolean(state.replay));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    startProposalsSubscription();
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!acceptsDrag(event) || replaying) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, [replaying]);

  const onDrop = useCallback((event: React.DragEvent) => {
    setDragging(false);
    if (!acceptsDrag(event) || replaying || useGraphStore.getState().activeSubgraphId) return;
    event.preventDefault();
    const add = dropToAddNode((type) => event.dataTransfer.getData(type));
    if (!add) return;
    const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    void commitManual({
      type: 'add-node',
      nodeType: add.nodeType,
      x: Math.round(at.x),
      y: Math.round(at.y),
      ...(Object.keys(add.parameters).length > 0 ? { parameters: add.parameters } : {}),
    });
  }, [flow, replaying]);

  return (
    <div
      className={`graph-canvas ${styles.root}${replaying ? ` ${styles.replaying}` : ''}${dragging ? ` ${styles.dropping}` : ''}`}
      data-fit-duration={undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {empty ? <p className={`canvas-empty ${styles.empty}`}>{t('graph.empty')}</p> : null}
      <CanvasFlow />
      <CanvasToolbar />
      <SubgraphBreadcrumb />
      <ReplayBanner />
      {dragging ? <p className={styles.dropHint} aria-hidden="true">{t('canvas.dropHere')}</p> : null}
    </div>
  );
}

/**
 * Canvas workstream: the whole graph area. Wraps React Flow with the floating toolbar, subgraph breadcrumb,
 * ghost layer, flow pulses, tour callouts, context menu and library drop handling.
 * The shell renders it once and passes nothing; state flows through the stores
 * (graphState, proposalsState, uiState) and questions go out through services/ask.ts.
 */
export default function GraphWorkspace() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
