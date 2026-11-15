/**
 * The canvas camera: every move the app makes on its own (a fit, "Fit view", zoom buttons, centring on a node for
 * the tour, the live build, "Show me where", a check finding, a draft, a replayed version) goes through moveCamera,
 * so they all travel the same way. Callers live in components/graph (GraphWorkspace, CanvasFlow, the layers,
 * lib/autoFit.ts, lib/glide.ts, importLook.ts, GraphContextMenu); useCameraStore is read by the description layer.
 *
 * Why: the camera used to have three behaviours (fits in a fixed 200 ms, centring in 600 ms with a fly-out curve,
 * the glide with its own curve). A short hop took as long as a trip across the graph, and a big zoom-out snapped.
 * Here the duration grows with how far the view travels (screens moved plus doublings of zoom) between
 * --motion-camera-min and --motion-camera, on one in-out curve. Short hops travel straight; only a long trip that
 * also changes zoom a lot takes the "fly" path (zoom out, travel, zoom in), as a map does.
 * With motion reduced or off the camera cuts: it arrives at once.
 *
 * The person's own pans and zooms never go through here; React Flow handles them directly.
 */
import { getViewportForBounds, type ReactFlowInstance, type Rect, type Viewport } from '@xyflow/react';
import { create } from 'zustand';
import { EASE_IN_OUT, motionLevel, tokenMs, type MotionLevel } from './policy';

/** The size of the canvas on screen, in pixels. */
export interface Pane {
  width: number;
  height: number;
}

/** How long a camera move takes and which path React Flow uses ('smooth' zooms out and in on the way). */
export interface CameraPlan {
  duration: number;
  interpolate: 'smooth' | 'linear';
}

/** How far a camera move travels, in screens: the shift of the view's centre plus half a screen per zoom doubling. */
export function travel(from: Viewport, to: Viewport, pane: Pane): number {
  const centre = (view: Viewport) => ({ x: (pane.width / 2 - view.x) / view.zoom, y: (pane.height / 2 - view.y) / view.zoom });
  const a = centre(from);
  const b = centre(to);
  // Distance in screen pixels at the smaller of the two zooms: what the eye sees pass by.
  const scale = Math.min(from.zoom, to.zoom);
  const screens = Math.hypot((b.x - a.x) * scale, (b.y - a.y) * scale) / Math.max(1, Math.hypot(pane.width, pane.height));
  const doublings = Math.abs(Math.log2(to.zoom / from.zoom));
  return screens + doublings * 0.5;
}

/** Duration and path of one camera move. Pure, so the rule is tested without a canvas. */
export function cameraPlan(from: Viewport, to: Viewport, pane: Pane, level: MotionLevel, limits = { min: 240, max: 640 }): CameraPlan {
  const distance = travel(from, to, pane);
  // A move of a few pixels at most is a cut, as is any move with motion not full.
  if (level !== 'full' || distance < 0.002) return { duration: 0, interpolate: 'linear' };
  // One screen or one doubling of zoom reaches the longest move; anything shorter is proportionally quicker.
  const share = Math.min(1, distance);
  const duration = Math.round(limits.min + (limits.max - limits.min) * Math.sqrt(share));
  const zoomChange = Math.abs(Math.log2(to.zoom / from.zoom));
  // The fly path only for a trip of more than one screen that also changes zoom by more than about half a doubling.
  const screens = distance - zoomChange * 0.5;
  return { duration, interpolate: screens > 1 && zoomChange > 0.6 ? 'smooth' : 'linear' };
}

/** The in-out curve as a function of time, for React Flow's `ease` (the same curve as --motion-ease-in-out). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (a1: number, a2: number, t: number) => ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Solve x(u) = t by bisection; thirty steps are far below a pixel.
    let low = 0;
    let high = 1;
    let u = t;
    for (let step = 0; step < 30; step += 1) {
      u = (low + high) / 2;
      const x = sample(x1, x2, u);
      if (Math.abs(x - t) < 1e-9) break;
      if (x < t) low = u;
      else high = u;
    }
    return sample(y1, y2, u);
  };
}

/** The camera's easing; lib/glide.ts uses it too, so nodes and the view travel alike. */
export const cameraEase = cubicBezier(...EASE_IN_OUT);

interface CameraState {
  zooming: boolean;
  /** Whether the canvas shows its overview level (the map of blocks); CanvasFlow's OverviewLevel sets it. */
  overview: boolean;
  setOverview: (overview: boolean) => void;
  /** The zoom when the camera last came to rest. */
  settledZoom: number;
  setZooming: (zooming: boolean) => void;
  settle: (zoom: number) => void;
}

/**
 * Whether the camera is moving now, and whether that move changes the zoom. Layers that are costly to redraw at a
 * new zoom (the description cards) rest while the zoom changes and come back when it settles.
 * CanvasFlow feeds it from React Flow's move events, so the person's own wheel and pinch count too.
 */
export const useCameraStore = create<CameraState>((set) => ({
  zooming: false,
  overview: false,
  setOverview: (overview) => set((state) => (state.overview === overview ? state : { overview })),
  settledZoom: 1,
  setZooming: (zooming) => set((state) => (state.zooming === zooming ? state : { zooming })),
  settle: (zoom) => set((state) => (state.settledZoom === zoom && !state.zooming ? state : { zooming: false, settledZoom: zoom })),
}));

/** The canvas element's size, or a stand-in before it is laid out. */
export function paneSize(): Pane {
  const pane = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.react-flow') : null;
  // 1200 x 800 is a typical canvas size, so plans made before layout (or in tests) stay reasonable.
  return { width: pane?.clientWidth || 1200, height: pane?.clientHeight || 800 };
}

/** The shortest and longest camera move for the current motion level, from the stylesheet. */
function limits(): { min: number; max: number } {
  return { min: tokenMs('--motion-camera-min'), max: tokenMs('--motion-camera') };
}

/** Moves the camera to `to` by the camera rule. Resolves when it arrives. */
export function moveCamera(flow: ReactFlowInstance, to: Viewport): Promise<boolean> {
  const from = flow.getViewport();
  const plan = cameraPlan(from, to, paneSize(), motionLevel(), limits());
  return flow.setViewport(to, { duration: plan.duration, ease: cameraEase, interpolate: plan.interpolate });
}

/** How long the move to `to` will take now (0 when the camera cuts). */
export function cameraDuration(flow: ReactFlowInstance, to: Viewport): number {
  return cameraPlan(flow.getViewport(), to, paneSize(), motionLevel(), limits()).duration;
}

/** React Flow's padding for a fit: a share of the canvas, or pixels per side. */
export type FitPadding = Parameters<typeof getViewportForBounds>[5];

/** The view that shows `bounds` with `padding` between `minZoom` and `maxZoom`. */
export function viewForBounds(bounds: Rect, options: { padding?: FitPadding; minZoom?: number; maxZoom?: number } = {}): Viewport {
  const pane = paneSize();
  return getViewportForBounds(bounds, pane.width, pane.height, options.minZoom ?? 0.1, options.maxZoom ?? 2, options.padding ?? 0.1);
}

/** Centres flow point (x, y) at `zoom` (the current zoom when left out). */
export function centerCamera(flow: ReactFlowInstance, x: number, y: number, zoom?: number): Promise<boolean> {
  const pane = paneSize();
  const z = zoom ?? flow.getZoom();
  return moveCamera(flow, { x: pane.width / 2 - x * z, y: pane.height / 2 - y * z, zoom: z });
}

/** Zooms about the canvas centre by `factor`, within React Flow's limits. */
export function zoomCamera(flow: ReactFlowInstance, factor: number, limitsOf = { min: 0.1, max: 2 }): Promise<boolean> {
  const view = flow.getViewport();
  const pane = paneSize();
  const zoom = Math.min(limitsOf.max, Math.max(limitsOf.min, view.zoom * factor));
  const cx = (pane.width / 2 - view.x) / view.zoom;
  const cy = (pane.height / 2 - view.y) / view.zoom;
  return moveCamera(flow, { x: pane.width / 2 - cx * zoom, y: pane.height / 2 - cy * zoom, zoom });
}

/** Zooms to an exact level about the canvas centre. */
export function zoomCameraTo(flow: ReactFlowInstance, zoom: number): Promise<boolean> {
  return zoomCamera(flow, zoom / flow.getZoom());
}
