import type { Explanation } from '../../../../shared/contracts/knowledge';
import type { TourStep } from '../../../state/uiState';
import { topologicalOrder, type TopoEdge } from '../lib/topology';

export interface TourNode {
  id: string;
  position: { x: number; y: number };
  data: {
    comfyType: string;
    title?: string;
    inputs?: Array<{ name: string; dataType: string }>;
    outputs?: Array<{ name: string; dataType: string }>;
  };
}

/** What the tour may say about each node, gathered beforehand (see tourTexts.ts). */
export interface TourTexts {
  /** First explanation written for the node itself, by node id. */
  byNode: Record<string, string | undefined>;
  /** First explanation written for the class, by class type. */
  byClass: Record<string, string | undefined>;
  /** Catalog description and display name, by class type. */
  catalog: Record<string, { description?: string; displayName?: string } | undefined>;
}

/** Explanations are listed newest last; the tour prefers what a node is ("what"), then any aspect. */
export function firstExplanation(list: Explanation[] | undefined): string | undefined {
  if (!list || list.length === 0) return undefined;
  // The newest "what" wins, as on the description card: an AI or user line beats the built-in seed (created at 0).
  const filled = list.filter((item) => item.text.trim() !== '');
  const newest = (items: Explanation[]) => items.reduce<Explanation | undefined>((best, item) => (!best || item.createdAt >= best.createdAt ? item : best), undefined);
  return (newest(filled.filter((item) => item.aspect === 'what')) ?? newest(filled))?.text.trim();
}

/**
 * One step per node, from loaders to outputs. Title: the node's title, else the catalog display name, else the
 * class. Text: the node's explanation, else the class explanation, else the catalog description, else `neutral`.
 * Deterministic: the same graph and texts give the same steps.
 */
export function buildTour(nodes: TourNode[], edges: TopoEdge[], texts: TourTexts, neutral: (node: TourNode) => string): TourStep[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return topologicalOrder(nodes, edges).map((id) => {
    const node = byId.get(id)!;
    const classType = node.data.comfyType;
    const catalog = texts.catalog[classType];
    const description = catalog?.description?.trim();
    const own = node.data.title?.trim() && node.data.title !== classType ? node.data.title.trim() : '';
    const title = own || catalog?.displayName?.trim() || classType;
    const text = texts.byNode[id] || texts.byClass[classType] || (description ? description : '') || neutral(node);
    return { ref: { kind: 'node', id, classType }, title, text };
  });
}

/** Which tour step a node is, so a click on a node can continue the tour from there. */
export function stepIndexOf(steps: TourStep[], nodeId: string): number {
  return steps.findIndex((step) => step.ref.kind === 'node' && step.ref.id === nodeId);
}
