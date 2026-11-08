import type { CatalogView } from '../catalog/types';
import { modelDirectoryFor } from '../catalog/modelFolders';
import { missingDeps, type MissingReport } from '../workflow/codec';

interface GraphNodeLike {
  data?: {
    comfyType?: unknown;
    parameters?: unknown;
    comfy?: { widgets_values?: unknown };
  };
}

function stringMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Model filenames the canvas node actually stores, including ones the agent set as parameters. */
function canvasModelRefs(node: GraphNodeLike, catalog: CatalogView): Array<{ directory: string; name: string }> {
  const type = node.data?.comfyType;
  if (typeof type !== 'string' || type === '') return [];
  const values = { ...stringMap(node.data?.parameters) };
  const widgets = node.data?.comfy?.widgets_values;
  if (Array.isArray(widgets)) {
    const spec = catalog.nodes.find((item) => item.classType === type);
    if (spec && spec.widgetOrderReliable !== false) {
      spec.widgetOrder.forEach((name, index) => {
        if (values[name] === undefined) values[name] = widgets[index];
      });
    }
  } else {
    Object.assign(values, stringMap(widgets));
  }
  const found: Array<{ directory: string; name: string }> = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const directory = modelDirectoryFor(type, key);
    if (!directory) continue;
    found.push({ directory, name: value.trim() });
  }
  return found;
}

/** Compare the canvas and the stored workflow document with the local catalog. Does not contact ComfyUI. */
export function missingOnGraph(nodes: GraphNodeLike[], catalog: CatalogView, document: unknown): MissingReport {
  const fromDocument = document ? missingDeps(document, catalog) : { missingNodes: [], missingModels: [] };
  const missing = new Set(fromDocument.missingNodes);
  const known = new Set(catalog.nodeTypes);
  const knownModels = new Set(catalog.models.map((model) => `${model.directory}/${model.name}`));
  const models = new Map<string, { directory: string; name: string }>();
  for (const model of fromDocument.missingModels) models.set(`${model.directory}/${model.name}`, model);
  for (const node of nodes) {
    const type = node.data?.comfyType;
    if (typeof type === 'string' && type !== '' && !known.has(type)) missing.add(type);
    for (const model of canvasModelRefs(node, catalog)) {
      const key = `${model.directory}/${model.name}`;
      if (!knownModels.has(key)) models.set(key, model);
    }
  }
  return {
    missingNodes: [...missing].sort(),
    missingModels: [...models.values()].sort((left, right) => `${left.directory}/${left.name}`.localeCompare(`${right.directory}/${right.name}`)),
  };
}
