/**
 * The canvas's camera, reachable from outside React Flow's provider. GraphWorkspace registers it while it
 * is mounted; commands (View ▸ Fit, zoom) call it and do nothing when no canvas is on screen.
 */
export interface CanvasHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

let current: CanvasHandle | null = null;

export function setCanvasHandle(handle: CanvasHandle | null): void {
  current = handle;
}

export function canvasHandle(): CanvasHandle | null {
  return current;
}
