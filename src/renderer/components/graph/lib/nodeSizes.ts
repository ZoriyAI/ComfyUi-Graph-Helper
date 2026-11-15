/**
 * Node sizes as measured at a readable zoom, and the zoom lines of the overview level. The overview level (zoomed far
 * out) collapses ports and fields, so the sizes React Flow measures there are smaller than the nodes really are;
 * arranging from those would pack nodes that overlap once the person zooms back in. CanvasFlow records sizes only
 * outside the overview. Read by arrange.ts, placeNode.ts, importLook.ts, GhostLayer, autoFit.ts and lessonModel.ts.
 */
import type { NodeClassDetail } from '../../../../shared/contracts/knowledge';
import { estimateNodeSize, type Size, type SizeHints } from '../../../../shared/graph/layout';
import { inferInputs, inferOutputs } from '../../../../shared/graph/ports';
import { nodeRect, type PositionedNode, type Rect } from './geometry';

/**
 * Below this zoom the canvas switches to its overview level (a map of named blocks, CSS in Overview.module.css);
 * while the person zooms by wheel or pinch it switches back only above OVERVIEW_EXIT, so a zoom resting near the
 * line does not flicker between the two. A camera move of the app's own (a fit, a centre) has no such band: the
 * same zoom always shows the same level, and a fit landing at 0.53 shows whole cards.
 */
export const OVERVIEW_ENTER = 0.5;
export const OVERVIEW_EXIT = 0.56;
/**
 * The overview title grows as the canvas shrinks (font size / zoom), up to this factor. At 2.5 a ten-letter word
 * ("Checkpoint") still fits the block's inner width on one line, so a title breaks between words, never inside one.
 */
export const OVERVIEW_TITLE_CAP = 2.5;

/** The next level for a zoom: with the band while a gesture zooms, by the line alone after the app moved the camera. */
export function nextOverview(current: boolean, zoom: number, gesture = true): boolean {
  if (!gesture) return zoom < OVERVIEW_ENTER;
  return current ? zoom < OVERVIEW_EXIT : zoom < OVERVIEW_ENTER;
}

/** How much the overview title is enlarged at this zoom (1 at full size, never above OVERVIEW_TITLE_CAP). */
export function titleScale(zoom: number): number {
  return Math.min(OVERVIEW_TITLE_CAP, Math.max(1, 1 / Math.max(zoom, 0.01)));
}

/** Last size of each node measured outside the overview, by node id. */
const full = new Map<string, { width: number; height: number }>();
let overview = false;

/** CanvasFlow reports whether the overview level is on screen. */
export function setOverviewLevel(on: boolean): void {
  overview = on;
}

export function isOverviewLevel(): boolean {
  return overview;
}

/** Keeps the measured sizes of the nodes as their full sizes; ignored at the overview level. */
export function rememberSizes(nodes: PositionedNode[]): void {
  if (overview) return;
  for (const node of nodes) {
    const width = node.measured?.width;
    const height = node.measured?.height;
    if (width && height) full.set(node.id, { width, height });
  }
}

/** What the catalog says of a class's inputs, in the shape the size estimate reads. */
export function sizeHintsOf(detail: Pick<NodeClassDetail, 'inputs'> & { widgetOrder?: string[] } | null | undefined): SizeHints | null {
  if (!detail) return null;
  return {
    inputs: detail.inputs.map((input) => ({ name: input.name, widget: input.widget, multiline: Boolean(input.spec?.multiline) })),
    ...((detail as { widgetOrder?: string[] }).widgetOrder ? { widgetOrder: (detail as { widgetOrder?: string[] }).widgetOrder } : {}),
  };
}

/**
 * A node's rect for layout: its position and its last full size, else what is measured, else the size the canvas
 * will draw it at. A node first seen at the overview level was never measured whole. A node added a moment ago
 * has not been measured at all: taken at the small default size, it let the next node be placed too close to it,
 * or on it, whenever two nodes were added faster than the canvas measures one.
 */
export function layoutRect(node: PositionedNode, hints?: SizeHints | null): Rect {
  const rect = nodeRect(node);
  const sized = Boolean((node.measured?.width ?? node.width) && (node.measured?.height ?? node.height));
  const known = full.get(node.id) ?? ((overview || !sized) && node.data ? estimateNodeSize(node.data, hints) : null);
  return known ? { ...rect, width: Math.max(rect.width, known.width), height: Math.max(rect.height, known.height) } : rect;
}

/**
 * The size a node of a class will be drawn at once it is added, the way main builds the node
 * (shared/graph/ports.ts portsForClassType): a class the catalog has read gets its link inputs, then its fields;
 * a class it has not read (ComfyUI not read yet, or a class it does not have) gets the ports the app ships for
 * it, or a single output.
 */
export function newNodeSize(classType: string, detail: NodeClassDetail | null | undefined, what: { parameters?: Record<string, unknown> } = {}): Size {
  // A core class before ComfyUI is read is a row with a name and no ports.
  const read = detail && !(detail.pack === 'core' && detail.inputs.length === 0 && detail.outputs.length === 0) ? detail : null;
  if (!read) return estimateNodeSize({ inputs: inferInputs(classType), outputs: inferOutputs(classType), parameters: what.parameters ?? {} });
  const sockets = read.inputs.filter((input) => !input.widget);
  const widgets = read.inputs.filter((input) => input.widget);
  return estimateNodeSize(
    {
      inputs: [...sockets, ...widgets].map((input) => ({ name: input.name, dataType: input.type })),
      outputs: read.outputs,
      parameters: what.parameters ?? {},
    },
    sizeHintsOf(read),
  );
}

/** The size a subgraph's card is drawn at when it is added under the subgraph's own name: its ports and nothing else. */
export function subgraphCardSize(definition: { name: string; inputs: unknown[]; outputs: unknown[] }): Size {
  return estimateNodeSize(
    { inputs: definition.inputs, outputs: definition.outputs, kind: 'subgraph-instance', title: definition.name },
    { subgraphName: definition.name },
  );
}
