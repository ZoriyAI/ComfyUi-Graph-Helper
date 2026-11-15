import React, { useEffect, useRef } from 'react';
import { ViewportPortal, useNodes, useNodesInitialized, useReactFlow, type Node } from '@xyflow/react';
import { editorKind, partnersOf, savedView } from '../../../../shared/workflow/comfyLook';
import { useGraphStore } from '../../../state/graphState';
import { useProjectionStore } from '../../../services/commands/projection';
import { moveCamera } from '../../../motion/camera';
import { FIT_PADDING } from '../CanvasToolbar';
import { autoFit, autoFitFloor } from '../lib/autoFit';
import { setLookFlow, spreadCoveredNodes, useImportLookStore } from '../importLook';
import { useNodeInfoStore } from '../nodeInfo';
import styles from '../nodes/Node.module.css';

/** The file's view is used up to this zoom; closer than that one node would fill the canvas. */
const SAVED_VIEW_MAX_ZOOM = 2;

/**
 * Waits until the drawn sizes stop changing: a node grows once its class is read from the catalog (its fields
 * appear a moment after it is first drawn), and covered nodes must be judged at their final size.
 */
async function settledNodes(flow: ReturnType<typeof useReactFlow>): Promise<Node[]> {
  let last = '';
  for (let round = 0; round < 40; round += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const nodes = flow.getNodes();
    // Every class on the canvas answered (known or not): until then a card may still grow by its fields.
    const details = useNodeInfoStore.getState().details;
    const waiting = nodes.some((node) => {
      const data = node.data as { comfyType?: unknown; kind?: unknown };
      return data.kind !== 'subgraph-instance' && typeof data.comfyType === 'string' && !editorKind(data.comfyType) && !(data.comfyType in details);
    });
    if (waiting && round < 30) continue;
    const signature = nodes.map((node) => `${node.id}:${Math.round(node.measured?.width ?? 0)}x${Math.round(node.measured?.height ?? 0)}`).join('|');
    if (signature === last) return nodes;
    last = signature;
  }
  return flow.getNodes();
}

function rectOf(node: Node): { x: number; y: number; width: number; height: number } {
  return { x: node.position.x, y: node.position.y, width: node.measured?.width ?? 240, height: node.measured?.height ?? 120 };
}

/**
 * The first view of a graph that replaced another: the view the workflow was saved with (extra.ds), when it shows
 * any node at a readable zoom; otherwise the whole graph, as the app's own fits do.
 */
function useFirstView(mode: 'root' | 'definition' | 'replay') {
  const flow = useReactFlow();
  const graphKey = useProjectionStore((state) => state.graphKey);
  const initialized = useNodesInitialized();
  const spreadPending = useImportLookStore((state) => state.spreadPending);
  const seen = useRef<string | null>(null);
  const running = useRef(false);
  useEffect(() => {
    if (mode !== 'root' || !graphKey || !initialized || running.current) return;
    const nodes = flow.getNodes();
    if (nodes.length === 0) return;
    const spread = useImportLookStore.getState().spreadPending;
    if (seen.current === graphKey && !spread) return;
    seen.current = graphKey;
    running.current = true;
    void (async () => {
      try {
        if (spread) {
          useImportLookStore.getState().done('spread');
          await spreadCoveredNodes(await settledNodes(flow));
        }
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const pane = document.querySelector<HTMLElement>('.react-flow');
        const view = savedView(useGraphStore.getState().document?.raw);
        const shown = flow.getNodes();
        if (view && pane && view.zoom >= autoFitFloor(shown.length) && view.zoom <= SAVED_VIEW_MAX_ZOOM) {
          const visible = { x: -view.x / view.zoom, y: -view.y / view.zoom, width: pane.clientWidth / view.zoom, height: pane.clientHeight / view.zoom };
          const any = shown.some((node) => {
            const rect = rectOf(node);
            return rect.x < visible.x + visible.width && rect.x + rect.width > visible.x && rect.y < visible.y + visible.height && rect.y + rect.height > visible.y;
          });
          if (any) {
            void moveCamera(flow, view);
            return;
          }
        }
        autoFit(flow, { padding: FIT_PADDING, maxZoom: 1 });
      } finally {
        useImportLookStore.getState().done('view');
        running.current = false;
      }
    })();
  }, [mode, graphKey, initialized, flow, spreadPending]);
}

/** A dashed frame around each partner of the selected Set or Get, and a dashed line to it. */
function SetGetLinks() {
  const nodes = useNodes();
  const selected = nodes.filter((node) => node.selected);
  if (selected.length !== 1) return null;
  const from = selected[0];
  const level = nodes.map((node) => ({ id: node.id, data: node.data as { comfyType?: unknown; comfy?: unknown } }));
  const partners = partnersOf(from.id, level).map((id) => nodes.find((node) => node.id === id)).filter((node): node is Node => Boolean(node));
  if (partners.length === 0) return null;
  const a = rectOf(from);
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  return (
    <ViewportPortal>
      <svg className={styles.setGetLayer} data-set-get-partners={partners.map((node) => node.id).join(' ')} aria-hidden="true">
        {partners.map((node) => {
          const rect = rectOf(node);
          const end = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          return (
            <g key={node.id}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={styles.setGetLine} />
              <rect x={rect.x - 6} y={rect.y - 6} width={rect.width + 12} height={rect.height + 12} rx={12} className={styles.setGetFrame} />
            </g>
          );
        })}
      </svg>
    </ViewportPortal>
  );
}

/** Mounted inside React Flow by CanvasFlow: the camera for importLook.ts, the first view, Set / Get partners. */
export default function ImportLookLayer({ mode }: { mode: 'root' | 'definition' | 'replay' }) {
  const flow = useReactFlow();
  useEffect(() => {
    setLookFlow(flow);
    return () => setLookFlow(null);
  }, [flow]);
  useFirstView(mode);
  return <SetGetLinks />;
}
