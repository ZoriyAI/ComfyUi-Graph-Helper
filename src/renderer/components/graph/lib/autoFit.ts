import { getViewportForBounds, type Node, type ReactFlowInstance, type Rect, type Viewport } from '@xyflow/react';
import { moveCamera, paneSize, viewForBounds, type FitPadding, type Pane } from '../../../motion/camera';
import { OVERVIEW_EXIT } from './nodeSizes';

/**
 * Fits the app makes on its own: a workflow or project opened, a build ended, a level (subgraph, replay) came on
 * screen. Who calls it: CanvasFlow and BuildLayer. The explicit «Показать всё» / "Fit view" (toolbar, Shift+1, the
 * View menu) is not one of these: it always shows the whole graph.
 *
 * Why these rules: a person should land on something readable.
 * - The whole graph fits as cards (zoom at least OVERVIEW_EXIT): show it all.
 * - It almost fits (down to NEAR_CARDS): show its middle at OVERVIEW_EXIT, as cards. A seven-node build that needed
 *   47 % used to end on the map of coloured blocks the person had not seen being built.
 * - A small graph spread far apart: centre the node the person last touched at OVERVIEW_EXIT.
 * - A large graph: the overview map of the whole graph, but never below AUTO_FIT_MIN_ZOOM (a 199-node workflow
 *   opened at 10 %, five-pixel blocks); below that the node the person last touched is centred at the floor and
 *   the rest is a pan away.
 */
export const AUTO_FIT_MIN_ZOOM = 0.3;
/** A graph this small is never shown as the overview map after a fit: whole cards fit at OVERVIEW_EXIT. */
export const SMALL_GRAPH_NODES = 6;
/** Below OVERVIEW_EXIT but at least this: the graph is shown as cards around its middle instead of as a map. */
export const NEAR_CARDS = 0.4;

export function autoFitFloor(nodeCount: number): number {
  return nodeCount <= SMALL_GRAPH_NODES ? OVERVIEW_EXIT : AUTO_FIT_MIN_ZOOM;
}

/** The node an automatic fit keeps in view when the whole graph would be too small: selected, else the newest. */
export function focusNode<T extends Pick<Node, 'id' | 'type' | 'selected'>>(nodes: T[]): T | undefined {
  return nodes.find((node) => node.selected) ?? [...nodes].reverse().find((node) => node.type !== 'boundary') ?? nodes[nodes.length - 1];
}

export interface FitOptions {
  /** A share of the canvas, or per-side pixels (the toolbar and the minimap keep their room). */
  padding?: FitPadding;
  maxZoom?: number;
}

/** Where an automatic fit puts the camera. Pure: the bounds of all nodes, the focus node's box, the canvas size. */
export function autoFitView(input: { bounds: Rect; focus: Rect | null; count: number; pane: Pane; options: FitOptions }): Viewport {
  const { bounds, focus, count, pane, options } = input;
  const maxZoom = options.maxZoom ?? 2;
  const whole = getViewportForBounds(bounds, pane.width, pane.height, 0.1, maxZoom, options.padding ?? 0.1);
  const centreAt = (box: Rect, zoom: number): Viewport => ({
    x: pane.width / 2 - (box.x + box.width / 2) * zoom,
    y: pane.height / 2 - (box.y + box.height / 2) * zoom,
    zoom,
  });
  const cards = Math.min(OVERVIEW_EXIT, maxZoom);
  if (whole.zoom >= cards) return whole;
  if (whole.zoom >= NEAR_CARDS) return centreAt(bounds, cards);
  const floor = Math.min(autoFitFloor(count), maxZoom);
  if (whole.zoom >= floor) return whole;
  return centreAt(focus ?? bounds, floor);
}

/** Runs an automatic fit on the canvas now, by the camera rule (motion/camera.ts). */
export function autoFit(flow: ReactFlowInstance, options: FitOptions): void {
  const nodes = flow.getNodes().filter((node) => !node.hidden);
  if (nodes.length === 0) return;
  const pane = paneSize();
  const focus = focusNode(nodes);
  const focusBox = focus ? {
    x: focus.position.x,
    y: focus.position.y,
    width: focus.measured?.width ?? focus.width ?? 240,
    height: focus.measured?.height ?? focus.height ?? 120,
  } : null;
  void moveCamera(flow, autoFitView({ bounds: flow.getNodesBounds(nodes), focus: focusBox, count: nodes.length, pane, options }));
}

/** The explicit fit: the whole graph, whatever its size. */
export function fitWhole(flow: ReactFlowInstance, options: FitOptions & { nodes?: Node[] } = {}): void {
  const nodes = (options.nodes ?? flow.getNodes()).filter((node) => !node.hidden);
  if (nodes.length === 0) return;
  void moveCamera(flow, viewForBounds(flow.getNodesBounds(nodes), { padding: options.padding, maxZoom: options.maxZoom }));
}
