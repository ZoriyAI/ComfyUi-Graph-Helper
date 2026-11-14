import { captureEditOrigin, originIsCurrent, type EditOrigin } from './editOrigin';
import { canvasHandle } from '../../../commands/canvasHandle';
import { NEW_NODE_SIZE } from './geometry';
import { levelNodes, selectOnLevel } from './level';

/** The id of the node an add-node (or insert-subgraph) commit created, from its result; null when none. */
export function addedNodeId(result: unknown): string | null {
  const outcome = result as { status?: unknown; result?: { nodeId?: unknown } } | null | undefined;
  if (outcome?.status !== 'applied') return null;
  const id = outcome.result?.nodeId;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

/**
 * A node the person just added: it becomes the selection (Properties shows it) and, when it is not fully in view,
 * the camera glides to it at the same zoom. Never leaves a new node off screen.
 */
export function revealNewNode(nodeId: string | null, size: { width: number; height: number } = NEW_NODE_SIZE, origin: EditOrigin = captureEditOrigin()): void {
  if (!nodeId || !originIsCurrent(origin)) return;
  selectOnLevel([nodeId]);
  // The node arrives with the projection; give the canvas a frame to draw and measure it.
  window.requestAnimationFrame(() => {
    if (!originIsCurrent(origin)) return;
    const node = levelNodes().find((item) => item.id === nodeId) as (ReturnType<typeof levelNodes>[number] & { measured?: { width?: number; height?: number } }) | undefined;
    if (!node) return;
    canvasHandle()?.reveal({
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? size.width,
      height: node.measured?.height ?? size.height,
    });
  });
}
