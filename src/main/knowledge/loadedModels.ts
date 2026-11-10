import type { CatalogView } from '../../shared/catalog/types';
import { canvasModelRefs, type GraphNodeLike } from '../../shared/graph/compatibility';

/**
 * Which model files a node on the canvas loads, for any loader class: the core loader fields
 * (shared/catalog/modelFolders.ts) plus every plain field value that is the name of a file in the synced catalog.
 * The second part covers custom loaders (a pack's own "lora_name" or "lora"), whose folder is not on the core
 * list: a value that names a catalog file of a folder is what makes the node a load of that file.
 */

export interface LoadedModelRef {
  directory: string;
  name: string;
}

interface NodeWithWidgets extends GraphNodeLike {
  data?: GraphNodeLike['data'];
}

/**
 * Field names that say which folder a file comes from. Only used to choose between folders when one file name
 * exists in several (a "model.safetensors" in checkpoints and in loras); a value naming one file needs no hint.
 */
const FOLDER_HINTS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/lora|lycoris|locon/i, ['loras']],
  [/ckpt|checkpoint/i, ['checkpoints']],
  [/unet|diffusion|transformer/i, ['diffusion_models', 'unet']],
  [/vae/i, ['vae']],
  [/control/i, ['controlnet']],
];

/** Windows-style separators in a saved workflow name the same file as forward slashes. */
function normalName(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

/** Catalog files by normalised name: the folders each name exists in, and the name as the catalog spells it. */
export type CatalogFileIndex = Map<string, Array<{ directory: string; name: string }>>;

export function catalogFileIndex(catalog: CatalogView): CatalogFileIndex {
  const index: CatalogFileIndex = new Map();
  for (const model of catalog.models) {
    const key = normalName(model.name);
    if (key === '') continue;
    const list = index.get(key) ?? [];
    if (!list.some((item) => item.directory === model.directory)) list.push({ directory: model.directory, name: model.name });
    index.set(key, list);
  }
  return index;
}

/** Plain string field values of a node, with the field name when it is known. */
function fieldValues(node: NodeWithWidgets, catalog: CatalogView): Array<{ field: string | null; value: string }> {
  const out: Array<{ field: string | null; value: string }> = [];
  const named = new Set<string>();
  const parameters = node.data?.parameters;
  if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
    for (const [field, value] of Object.entries(parameters as Record<string, unknown>)) {
      named.add(field);
      if (typeof value === 'string') out.push({ field, value });
    }
  }
  const widgets = node.data?.comfy?.widgets_values;
  if (Array.isArray(widgets)) {
    // Without a reliable widget order (or for a class the catalog does not know) the slot names are unknown,
    // but a file name is still a file name.
    const type = node.data?.comfyType;
    const spec = typeof type === 'string' ? catalog.nodes.find((item) => item.classType === type) : undefined;
    const order = spec && spec.widgetOrderReliable !== false ? spec.widgetOrder : [];
    widgets.forEach((value, index) => {
      const field = order[index] ?? null;
      if (typeof value === 'string' && !(field && named.has(field))) out.push({ field, value });
    });
  } else if (widgets && typeof widgets === 'object') {
    for (const [field, value] of Object.entries(widgets as Record<string, unknown>)) {
      if (typeof value === 'string' && !named.has(field)) out.push({ field, value });
    }
  }
  return out;
}

export function loadedModelFiles(node: NodeWithWidgets, catalog: CatalogView, files: CatalogFileIndex): LoadedModelRef[] {
  const found = new Map<string, LoadedModelRef>();
  const add = (directory: string, name: string) => found.set(`${directory}/${name}`, { directory, name });
  for (const ref of canvasModelRefs(node, catalog)) add(ref.directory, ref.name);
  for (const { field, value } of fieldValues(node, catalog)) {
    const matches = files.get(normalName(value));
    if (!matches || matches.length === 0) continue;
    const hinted = field ? FOLDER_HINTS.find(([pattern]) => pattern.test(field))?.[1] : undefined;
    const narrowed = hinted ? matches.filter((match) => hinted.includes(match.directory)) : [];
    for (const match of narrowed.length > 0 ? narrowed : matches) add(match.directory, match.name);
  }
  return [...found.values()];
}
