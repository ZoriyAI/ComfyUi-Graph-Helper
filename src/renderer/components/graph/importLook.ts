import type { ReactFlowInstance } from '@xyflow/react';
import { create } from 'zustand';
import { estimateNodeSize } from '../../../shared/graph/layout';
import { classPresence, isCollapsed, overlapCount, spreadApart, type PlacedBox } from '../../../shared/workflow/comfyLook';
import { i18n } from '../../i18n';
import { showToast } from '../../ui/toastStore';
import { fitDurationMs } from '../../motion/policy';
import { commitManual } from './commit';
import { levelNodes } from './lib/level';
import { layoutRect, sizeHintsOf } from './lib/nodeSizes';
import { useNodeInfoStore } from './nodeInfo';

/**
 * How an imported workflow is shown, outside the node components: collapsing, the first view, nodes that cover
 * each other after an import, and jumping from a Get to its Set. CanvasFlow mounts ImportLookLayer, which hands
 * this module the camera and runs the steps that wait for the canvas to be drawn.
 */

let flow: ReactFlowInstance | null = null;

export function setLookFlow(instance: ReactFlowInstance | null): void {
  flow = instance;
}

interface ImportLookState {
  /** An import just replaced the graph: once it is drawn, move covered nodes apart and say so. */
  spreadPending: boolean;
  /** The graph on screen changed (a new graph, an import, undo across one): set the first view once drawn. */
  viewPending: boolean;
  /** Node ids the canvas highlights as the partners of the selected Set or Get. */
  request: () => void;
  done: (what: 'spread' | 'view') => void;
}

export const useImportLookStore = create<ImportLookState>((set) => ({
  spreadPending: false,
  viewPending: false,
  request: () => set({ spreadPending: true, viewPending: true }),
  done: (what) => set(what === 'spread' ? { spreadPending: false } : { viewPending: false }),
}));

/**
 * Call after a ComfyUI workflow replaced the graph (the File menu, a dropped file, a file from the command line):
 * once it is drawn, nodes that cover each other are moved apart and the camera takes the file's own view.
 */
export function afterWorkflowOpened(): void {
  useImportLookStore.getState().request();
}

/** Collapse or open nodes of the level on screen; one undo step. */
export function setCollapsed(nodeIds: string[], collapsed: boolean): Promise<unknown> {
  if (nodeIds.length === 0) return Promise.resolve(null);
  return commitManual({ type: 'collapse-node', nodeIds, collapsed }, 'collapse');
}

/** Alt+C, as in ComfyUI: the selected nodes collapse; when all of them already are, they open. */
export function toggleCollapseSelection(): Promise<unknown> {
  const selected = levelNodes().filter((node) => node.selected);
  if (selected.length === 0) return Promise.resolve(null);
  const collapse = selected.some((node) => !isCollapsed(node.data));
  return setCollapsed(selected.map((node) => node.id), collapse);
}

/** Centre a node of the level on screen and select it ("go to its Set"). */
export function goToNode(nodeId: string): void {
  if (!flow) return;
  const node = flow.getNode(nodeId);
  if (!node) return;
  const width = node.measured?.width ?? 240;
  const height = node.measured?.height ?? 120;
  const zoom = Math.max(flow.getZoom(), 0.75);
  void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: Math.min(zoom, 1.25), duration: fitDurationMs() });
  flow.setNodes((nodes) => nodes.map((item) => ({ ...item, selected: item.id === nodeId })));
}

/** The boxes of the nodes on screen, at their full size (the overview level draws them smaller). */
export function drawnBoxes(nodes: Array<Parameters<typeof layoutRect>[0]>): PlacedBox[] {
  const details = useNodeInfoStore.getState().details;
  return nodes.map((node) => {
    const classType = typeof node.data?.comfyType === 'string' ? node.data.comfyType : '';
    const detail = details[classType];
    const missing = classPresence(classType, detail, true, node.data?.kind === 'subgraph-instance') === 'missing';
    const hints = sizeHintsOf(detail) ?? { missing };
    // The drawn size, but never less than the size worked out from the class: a size remembered before the
    // class's fields arrived, or measured on the overview map, is smaller than the card really is.
    const rect = layoutRect(node, hints);
    const estimate = node.data ? estimateNodeSize(node.data, hints) : rect;
    return { id: node.id, ...rect, width: Math.max(rect.width, estimate.width), height: Math.max(rect.height, estimate.height) };
  });
}

/**
 * After an import: move apart the nodes that cover each other (columns and order kept), as one undoable step, and
 * say how many moved. Nothing moves when nothing covers anything.
 */
export async function spreadCoveredNodes(nodes: Array<Parameters<typeof layoutRect>[0]>): Promise<number> {
  const boxes = drawnBoxes(nodes);
  const covered = overlapCount(boxes);
  if (covered === 0) return 0;
  const moved = spreadApart(boxes);
  if (moved.size === 0) return 0;
  const moves = [...moved].map(([nodeId, at]) => ({ nodeId, x: at.x, y: at.y }));
  await commitManual({ type: 'move-nodes', moves }, 'spread');
  showToast({
    id: 'import-spread',
    tone: 'info',
    title: String(i18n.t('importLook.spreadTitle', { count: moves.length })),
    description: String(i18n.t('importLook.spreadBody')),
    duration: 12000,
  });
  return moves.length;
}
