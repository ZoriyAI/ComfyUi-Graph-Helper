import type { CatalogView } from '../catalog/types';
import { missingDeps, type MissingReport } from '../workflow/codec';

interface GraphNodeLike {
  data?: { comfyType?: unknown };
}

/** Compare the canvas and the stored workflow document with the local catalog. Does not contact ComfyUI. */
export function missingOnGraph(nodes: GraphNodeLike[], catalog: CatalogView, document: unknown): MissingReport {
  const fromDocument = document ? missingDeps(document, catalog) : { missingNodes: [], missingModels: [] };
  const missing = new Set(fromDocument.missingNodes);
  const known = new Set(catalog.nodeTypes);
  for (const node of nodes) {
    const type = node.data?.comfyType;
    if (typeof type === 'string' && type !== '' && !known.has(type)) missing.add(type);
  }
  return {
    missingNodes: [...missing].sort(),
    missingModels: fromDocument.missingModels,
  };
}
