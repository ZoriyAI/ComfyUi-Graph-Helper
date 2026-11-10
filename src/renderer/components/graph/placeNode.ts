import { useGraphStore } from '../../state/graphState';
import { useCanvasStore } from './canvasStore';
import { freeSpotFor, viewCentreSpot } from './lib/geometry';

/**
 * The one place a manually added node gets its position: the drop point (or a spot the caller chose), else the
 * centre of the view, moved to the nearest spot where it covers no node. The nodes are the graph store's, so
 * React Flow's measured sizes count.
 */
export function placeNewNode(at: { x: number; y: number } | null): { x: number; y: number } {
  const nodes = useGraphStore.getState().nodes;
  const preferred = at ?? viewCentreSpot(useCanvasStore.getState().viewport) ?? { x: 0, y: 0 };
  return freeSpotFor(nodes, preferred);
}
