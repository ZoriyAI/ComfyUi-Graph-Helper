import { useStore, type ReactFlowState } from '@xyflow/react';

/**
 * A string that changes whenever a node moves, resizes or gets its handles measured. Layers that draw in
 * flow coordinates (ghosts, groups, suggestion paths) re-render on it and then read `nodeLookup`.
 */
function layoutKey(state: ReactFlowState): string {
  let key = '';
  for (const node of state.nodeLookup.values()) {
    const at = node.internals.positionAbsolute;
    key += `${node.id}@${Math.round(at.x)},${Math.round(at.y)}:${node.measured?.width ?? 0}x${node.measured?.height ?? 0}${node.internals.handleBounds ? '+' : ''};`;
  }
  return key;
}

export function useLayoutKey(): string {
  return useStore(layoutKey);
}
