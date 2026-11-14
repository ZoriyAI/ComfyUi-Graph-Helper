import { getViewportForBounds, type FitViewOptions, type Node, type ReactFlowInstance } from '@xyflow/react';
import { OVERVIEW_EXIT } from './nodeSizes';

/**
 * Fits the app makes on its own (a build ended, a project or a level opened) stop at a readable zoom. A fit of a
 * large graph into a small canvas came out at 14 %: blocks with five-pixel titles. Below the floor the camera
 * centres the node the person last touched (the selected one, else the newest) at the floor instead, and the rest
 * of the graph is a pan away. The explicit «fit view» (toolbar button, Shift+1, the View menu) still shows the
 * whole graph.
 */
export const AUTO_FIT_MIN_ZOOM = 0.3;
/** A graph this small is never shown as the overview map after a fit: whole cards fit at OVERVIEW_EXIT. */
export const SMALL_GRAPH_NODES = 6;

export function autoFitFloor(nodeCount: number): number {
  return nodeCount <= SMALL_GRAPH_NODES ? OVERVIEW_EXIT : AUTO_FIT_MIN_ZOOM;
}

/** The node an automatic fit keeps in view when the whole graph would be too small: selected, else the newest. */
export function focusNode<T extends Pick<Node, 'id' | 'type' | 'selected'>>(nodes: T[]): T | undefined {
  return nodes.find((node) => node.selected) ?? [...nodes].reverse().find((node) => node.type !== 'boundary') ?? nodes[nodes.length - 1];
}

type FitOptions = Pick<FitViewOptions, 'padding' | 'duration' | 'maxZoom'>;

export function autoFit(flow: ReactFlowInstance, options: FitOptions): void {
  const nodes = flow.getNodes().filter((node) => !node.hidden);
  const pane = document.querySelector<HTMLElement>('.react-flow');
  if (nodes.length === 0 || !pane || pane.clientWidth === 0 || pane.clientHeight === 0) {
    void flow.fitView(options);
    return;
  }
  const floor = autoFitFloor(nodes.length);
  const maxZoom = options.maxZoom ?? 2;
  const whole = getViewportForBounds(flow.getNodesBounds(nodes), pane.clientWidth, pane.clientHeight, 0.05, maxZoom, options.padding ?? 0.1);
  if (whole.zoom >= floor) {
    void flow.fitView(options);
    return;
  }
  const focus = focusNode(nodes);
  if (!focus) return;
  const width = focus.measured?.width ?? focus.width ?? 240;
  const height = focus.measured?.height ?? focus.height ?? 120;
  void flow.setCenter(focus.position.x + width / 2, focus.position.y + height / 2, { zoom: Math.min(floor, maxZoom), duration: options.duration });
}
