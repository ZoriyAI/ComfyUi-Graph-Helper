import { nodeRect, type PositionedNode, type Rect } from './geometry';

/**
 * Node sizes as measured at a readable zoom. The overview level (zoomed far out) collapses ports and fields, so
 * the sizes React Flow measures there are smaller than the nodes really are; arranging from those would pack
 * nodes that overlap once the person zooms back in. CanvasFlow records sizes only outside the overview.
 */
/**
 * Below this zoom the canvas switches to its overview level (a map of named blocks, CSS in Overview.module.css);
 * it switches back above OVERVIEW_EXIT, so a zoom resting near the line does not flicker between the two.
 */
export const OVERVIEW_ENTER = 0.55;
export const OVERVIEW_EXIT = 0.62;
/** The overview title grows as the canvas shrinks (font size / zoom), up to this factor. */
export const OVERVIEW_TITLE_CAP = 3;

export function nextOverview(current: boolean, zoom: number): boolean {
  return current ? zoom < OVERVIEW_EXIT : zoom < OVERVIEW_ENTER;
}

export function titleScale(zoom: number): number {
  return Math.min(OVERVIEW_TITLE_CAP, Math.max(1, 1 / Math.max(zoom, 0.01)));
}

const full = new Map<string, { width: number; height: number }>();
let overview = false;

export function setOverviewLevel(on: boolean): void {
  overview = on;
}

export function isOverviewLevel(): boolean {
  return overview;
}

export function rememberSizes(nodes: PositionedNode[]): void {
  if (overview) return;
  for (const node of nodes) {
    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width && height) full.set(node.id, { width, height });
  }
}

/** A node's rect for layout: its position and its last full size, else what is measured, else the default. */
export function layoutRect(node: PositionedNode): Rect {
  const rect = nodeRect(node);
  const known = full.get(node.id);
  return known ? { ...rect, width: Math.max(rect.width, known.width), height: Math.max(rect.height, known.height) } : rect;
}
