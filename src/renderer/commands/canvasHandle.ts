/**
 * The canvas's camera, reachable from outside React Flow's provider. GraphWorkspace registers it while it
 * is mounted; commands (View ▸ Fit, zoom) call it and do nothing when no canvas is on screen.
 */
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

export function setCanvasHandle(handle: CanvasHandle | null): void {
  current = handle;
}

export function canvasHandle(): CanvasHandle | null {
  return current;
}
