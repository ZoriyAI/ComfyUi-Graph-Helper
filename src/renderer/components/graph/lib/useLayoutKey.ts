/**
 * A string that changes whenever a node moves, resizes or gets its handles measured. Layers that draw in
 * flow coordinates (GhostLayer, ConnectAssistLayer) re-render on it and then read `nodeLookup`.
 */
import { useStore, type ReactFlowState } from '@xyflow/react';

/** Builds the key; positions are rounded so sub-pixel jitter does not re-render the layers. */
function layoutKey(state: ReactFlowState): string {
  let key = '';
  for (const node of state.nodeLookup.values()) {
    const at = node.internals.positionAbsolute;
    key += `${node.id}@${Math.round(at.x)},${Math.round(at.y)}:${node.measured?.width ?? 0}x${node.measured?.height ?? 0}${node.internals.handleBounds ? '+' : ''};`;
  }
  return key;
}

/** Re-renders the caller whenever the layout key changes. */
export function useLayoutKey(): string {
  return useStore(layoutKey);
}
