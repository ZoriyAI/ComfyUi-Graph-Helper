/**
 * Where the camera goes when the app itself moves it to a node (the live build, the tour, "Show" in the chat).
 * A callout stands above the node in screen pixels, and the canvas has its own things at the top (the floating
 * toolbar, and the build strip under it while the helper builds). Centring the node alone put the callout under
 * them for any tall node or short window, so the pair "callout + node" is placed in the room that is really free.
 * Used by BuildLayer and TourLayer.
 */

/** Fallback room for a single-row toolbar before its real height is available. */
export const TOOLBAR_ROOM_PX = 64;
/** Fallback room for the toolbar and build strip; measured controls take precedence. */
export const BUILD_ROOM_PX = 112;
/** Between a callout and its node (the tail of the bubble), and a little air above the callout. */
export const CALLOUT_GAP_PX = 30;
/** The build bubble above a node when it cannot be measured: a picture, a title, four lines, the gap. */
export const BUILD_BUBBLE_PX = 200;
/** The tour callout above a node when it cannot be measured: counter, picture, title, lines, buttons, the gap. */
export const TOUR_CALLOUT_PX = 220;
/** Kept free under the node. */
const BOTTOM_ROOM_PX = 24;

/** Keep camera moves below the controls as drawn, including wrapped toolbars and desktop text scaling. */
export function canvasControlsTop(fallback = TOOLBAR_ROOM_PX): number {
  const root = typeof document === 'undefined' ? null : document.querySelector('.graph-canvas');
  if (!root) return fallback;
  const canvas = root.getBoundingClientRect();
  const top = canvas.top;
  const bottom = Array.from(root.querySelectorAll('[data-canvas-toolbar], [data-live-build], [data-canvas-breadcrumb]'))
    .reduce((value, element) => {
      const box = element.getBoundingClientRect();
      // On a phone the breadcrumb is docked at the bottom instead.
      if (element.hasAttribute('data-canvas-breadcrumb') && box.top > top + canvas.height / 2) return value;
      return box.width > 0 && box.height > 0 ? Math.max(value, box.bottom - top + 16) : value;
    }, fallback);
  return Math.ceil(bottom);
}

/** Bottom-docked navigation on a narrow screen also needs room when fitting the graph. */
export function canvasControlsBottom(fallback: number): number {
  const root = typeof document === 'undefined' ? null : document.querySelector('.graph-canvas');
  const crumb = root?.querySelector('[data-canvas-breadcrumb]');
  if (!root || !crumb) return fallback;
  const canvas = root.getBoundingClientRect();
  const box = crumb.getBoundingClientRect();
  return box.width > 0 && box.top > canvas.top + canvas.height / 2
    ? Math.max(fallback, Math.ceil(canvas.bottom - box.top + 16)) : fallback;
}

/** A node's box in flow coordinates. */
export interface CameraNode { x: number; y: number; width: number; height: number }
/** The canvas size in screen pixels. */
export interface CameraCanvas { width: number; height: number }
/** Screen room the camera must keep free above the node. */
export interface CameraRoom {
  /** Screen pixels at the top of the canvas taken by its own controls. */
  top: number;
  /** Screen pixels the callout above the node needs (0 when there is none). */
  above: number;
}

/**
 * The flow point to centre on, at this zoom. With room to spare the callout and the node sit in the middle of the
 * free part of the canvas; without, the callout sits right under the canvas controls and the node's lower part
 * leaves the view (its title and the callout matter more than its last rows).
 */
export function cameraCenter(node: CameraNode, canvas: CameraCanvas, zoom: number, room: CameraRoom): { x: number; y: number } {
  const free = canvas.height - room.top - BOTTOM_ROOM_PX;
  const need = room.above + node.height * zoom;
  const blockTop = room.top + Math.max(0, (free - need) / 2);
  const nodeTop = blockTop + room.above;
  return { x: node.x + node.width / 2, y: node.y + (canvas.height / 2 - nodeTop) / zoom };
}

/**
 * What the helper is saying right now (the bubble of a build step, the callout of a tour step) is drawn above
 * everything else that hangs on nodes: a description card of a neighbouring node must not lie on its words.
 * Description cards are at React Flow's toolbar level (1000), raised ones at 2000.
 */
export const CALLOUT_Z = 3000;
