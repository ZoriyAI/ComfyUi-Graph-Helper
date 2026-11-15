/**
 * Camera hooks of the canvas (CanvasFlow mounts them).
 *
 * - useCameraSignals: React Flow's move events feed the camera store, so layers that are costly at a new zoom (the
 *   description cards) can rest while the zoom changes, whoever moves the camera (the person's wheel or pinch, or
 *   the app's own camera).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { OnMove, OnMoveEnd, OnMoveStart, ReactFlowInstance, Viewport } from '@xyflow/react';
import { useCameraStore } from '../../../motion/camera';

/** How long the zoom must stay still before the camera counts as settled. */
const SETTLE_MS = 140;

/**
 * While the zoom changes, the browser scales the canvas as one picture instead of painting every node again at each
 * new size (a big graph took seconds per frame). It is a little soft during the move and sharp again once the
 * camera rests and the hint is removed.
 */
function holdRaster(on: boolean): void {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (viewport) viewport.style.willChange = on ? 'transform' : '';
}

/** The onMoveStart / onMove / onMoveEnd handlers CanvasFlow passes to React Flow. */
export function useCameraSignals(): { onMoveStart: OnMoveStart; onMove: OnMove; onMoveEnd: OnMoveEnd } {
  const startZoom = useRef(1);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const onMoveStart = useCallback<OnMoveStart>((_event, view: Viewport) => {
    clear();
    // A new gesture during an unsettled zoom keeps the first start zoom, so the zoom counts as still changing.
    startZoom.current = useCameraStore.getState().zooming ? startZoom.current : view.zoom;
  }, []);
  const onMove = useCallback<OnMove>((_event, view: Viewport) => {
    // Only a change of zoom rests the costly layers; a pan keeps them.
    if (Math.abs(view.zoom - startZoom.current) > 0.001 && !useCameraStore.getState().zooming) {
      useCameraStore.getState().setZooming(true);
      holdRaster(true);
    }
  }, []);
  const onMoveEnd = useCallback<OnMoveEnd>((_event, view: Viewport) => {
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      holdRaster(false);
      useCameraStore.getState().settle(view.zoom);
    }, SETTLE_MS);
  }, []);
  return { onMoveStart, onMove, onMoveEnd };
}
