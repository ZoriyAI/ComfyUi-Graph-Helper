/**
 * The canvas's camera, reachable from outside React Flow's provider.
 *
 * Who uses it: components/graph/GraphWorkspace.tsx registers it while it is mounted; appCommands.ts (View ▸ Fit,
 * zoom), graph/arrange.ts, CanvasFlow.tsx, layers/GhostLayer.tsx, lib/replayMotion.ts and lib/reveal.ts call it.
 * Why: React Flow's camera hooks work only inside its provider; a module slot lets menus reach it, and every
 * caller does nothing when no canvas is on screen.
 */

/** What the canvas lets the rest of the window do with its camera. */
export interface CanvasHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  /** Brings a rectangle (flow coordinates) fully into view at the current zoom; nothing when it already is. */
  reveal: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Moves the view by screen pixels (keyboard panning). */
  panBy: (dx: number, dy: number) => void;
}

let current: CanvasHandle | null = null;

/** Set by the canvas when it mounts, cleared (null) when it unmounts. */
export function setCanvasHandle(handle: CanvasHandle | null): void {
  current = handle;
}

/** The camera of the canvas on screen, or null when there is none. */
export function canvasHandle(): CanvasHandle | null {
  return current;
}
