import { Position, type InternalNode } from '@xyflow/react';

/** Flow-coordinate centre of a handle, from React Flow's measured handle bounds. Null until measured. */
export function handlePoint(
  lookup: Map<string, InternalNode>,
  nodeId: string,
  handleId: string | null | undefined,
  type: 'source' | 'target',
): { x: number; y: number; position: Position } | null {
  const node = lookup.get(nodeId);
  if (!node) return null;
  const bounds = node.internals.handleBounds?.[type] ?? [];
  const handle = bounds.find((item) => item.id === handleId) ?? (handleId ? undefined : bounds[0]);
  const origin = node.internals.positionAbsolute;
  if (!handle) {
    // Not measured yet: the node's side midpoint is a fair stand-in.
    const width = node.measured?.width ?? 240;
    const height = node.measured?.height ?? 120;
    return { x: origin.x + (type === 'source' ? width : 0), y: origin.y + height / 2, position: type === 'source' ? Position.Right : Position.Left };
  }
  return { x: origin.x + handle.x + handle.width / 2, y: origin.y + handle.y + handle.height / 2, position: handle.position };
}
