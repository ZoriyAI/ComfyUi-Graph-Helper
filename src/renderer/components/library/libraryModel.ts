/**
 * Pure helpers of the library rail: grouping and windowing of node rows, keyboard movement, model filters, kind
 * groups, sorting, which LoRAs fit which base model, plain text of model descriptions, sizes. Used by
 * NodeLibrary.tsx, ModelLibrary.tsx, ModelCard.tsx, NodeCard.tsx, VirtualList.tsx, SubgraphLibrary.tsx,
 * fields/ModelList.tsx and settings PreviewCacheRow.tsx; tests/unit/modelLibrary.test.ts and others cover them.
 */
import type { BaseModelFamily, ModelKind, ModelSummary, NodeClassSummary, SubgraphDefinition } from '../../../shared/contracts';
import { queryWords, rankFields } from '../../../shared/knowledge/searchWords';
import { familiesCompatible } from '../../../shared/knowledge/baseModel';
import { formatByteSize } from '../../../shared/i18n/format';

/**
 * dataTransfer types the canvas accepts from the library, declared once in graph/lib/modelLoaders.ts (the drop side)
 * so the drag and the drop can never disagree.
 */
export { MODEL_DRAG_TYPE, NODE_DRAG_TYPE } from '../graph/lib/modelLoaders';

/** Node classes of one top-level category. */
export interface NodeGroup {
  category: string;
  items: NodeClassSummary[];
}

/** One row of the node list: a category header or a node class. */
export type LibraryRow =
  | { kind: 'header'; key: string; category: string; count: number; collapsed: boolean }
  | { kind: 'node'; key: string; node: NodeClassSummary };

/**
 * Groups node classes by their top-level category. With a query the server rank decides the group order
 * (first hit first); without one, groups and items are alphabetical.
 */
export function groupByCategory(nodes: NodeClassSummary[], options: { ranked: boolean; uncategorized: string }): NodeGroup[] {
  const groups = new Map<string, NodeClassSummary[]>();
  for (const node of nodes) {
    const top = (node.category || '').split('/')[0].trim() || options.uncategorized;
    const list = groups.get(top);
    if (list) list.push(node);
    else groups.set(top, [node]);
  }
  const result = [...groups.entries()].map(([category, items]) => ({ category, items }));
  if (options.ranked) return result;
  const byName = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: 'base' });
  for (const group of result) group.items.sort((left, right) => byName(left.displayName || left.classType, right.displayName || right.classType));
  return result.sort((left, right) => (
    left.category === options.uncategorized ? 1 : right.category === options.uncategorized ? -1 : byName(left.category, right.category)
  ));
}

/** Flattens groups into the rows a windowed list renders; collapsed groups keep only their header. */
export function flattenGroups(groups: NodeGroup[], collapsed: ReadonlySet<string>): LibraryRow[] {
  const rows: LibraryRow[] = [];
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.category);
    rows.push({ kind: 'header', key: `h:${group.category}`, category: group.category, count: group.items.length, collapsed: isCollapsed });
    if (isCollapsed) continue;
    for (const node of group.items) rows.push({ kind: 'node', key: `n:${node.classType}`, node });
  }
  return rows;
}

/** The slice of rows a windowed list renders, and where it sits. */
export interface WindowRange {
  /** First rendered row index. */
  start: number;
  /** One past the last rendered row index. */
  end: number;
  /** translateY of the first rendered row. */
  offset: number;
  /** Full scroll height. */
  total: number;
}

/** Fixed-height windowing: which rows to render for a scroll position, with overscan on both sides. */
export function windowRange(scrollTop: number, viewportHeight: number, rowHeight: number, count: number, overscan = 6): WindowRange {
  const total = count * rowHeight;
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0, offset: 0, total };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;
  const start = Math.max(0, Math.min(count - 1, first - overscan));
  const end = Math.min(count, first + visible + overscan);
  return { start, end, offset: start * rowHeight, total };
}

/** scrollTop that brings `index` fully into view, or null when it already is. */
export function scrollIntoRow(index: number, scrollTop: number, viewportHeight: number, rowHeight: number): number | null {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}

/** Next selectable row index for keyboard movement (headers are skipped by ArrowUp/Down but can be focused by Home/End). */
export function moveActive(rows: Array<{ kind: string }>, current: number, key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp', page = 10): number {
  if (rows.length === 0) return -1;
  const last = rows.length - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key === 'PageDown') return clamp(current + page);
  if (key === 'PageUp') return clamp(current - page);
  const step = key === 'ArrowDown' ? 1 : -1;
  return clamp(current < 0 ? (step > 0 ? 0 : last) : current + step);
}

/** The model list's filters; an empty string means "any". */
export interface ModelFilters {
  directory: string;
  baseModel: BaseModelFamily | '';
  kind: ModelKind | '';
}

/** One value of a filter and how many files have it. */
export interface Facet<T extends string> {
  value: T;
  count: number;
}

/** Directories, families and kinds present in the catalog, with counts, for the filter selects. */
export function modelFacets(models: ModelSummary[]): { directories: Facet<string>[]; families: Facet<BaseModelFamily>[]; kinds: Facet<ModelKind>[] } {
  const count = <T extends string>(values: T[]): Facet<T>[] => {
    const map = new Map<T, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].map(([value, total]) => ({ value, count: total })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  };
  return {
    directories: count(models.map((model) => model.directory)),
    families: count(models.map((model) => model.baseModel)),
    kinds: count(models.map((model) => model.kind)),
  };
}

/** Client-side equivalent of the searchModels filter, used for tests and for narrowing the fitting-LoRA list. */
export function filterModels(models: ModelSummary[], query: string, filters: ModelFilters): ModelSummary[] {
  const needle = query.trim().toLowerCase();
  return models.filter((model) => (
    (!filters.directory || model.directory === filters.directory)
    && (!filters.baseModel || model.baseModel === filters.baseModel)
    && (!filters.kind || model.kind === filters.kind)
    // What the list shows: the author's title and the family, not only the file name (same rules as main's search).
    && (!needle || rankFields([model.name, model.title, model.baseModel, model.kind, model.directory], queryWords(needle)) !== Infinity)
  ));
}

/**
 * The kind chips above the model list. A newcomer thinks in "base model, LoRA, VAE, ControlNet, the rest", so
 * diffusion models (a checkpoint split into parts) sit with checkpoints and every other kind under "other".
 */
export const KIND_GROUPS = ['all', 'checkpoint', 'lora', 'vae', 'controlnet', 'other'] as const;
/** One of the kind chips. */
export type KindGroup = typeof KIND_GROUPS[number];

/** Kinds that are a base model a LoRA goes on. */
const BASE_KINDS: ReadonlySet<ModelKind> = new Set<ModelKind>(['checkpoint', 'unet']);

/** The chip a model kind falls under. */
export function kindGroupOf(kind: ModelKind): Exclude<KindGroup, 'all'> {
  if (BASE_KINDS.has(kind)) return 'checkpoint';
  if (kind === 'lora' || kind === 'vae' || kind === 'controlnet') return kind;
  return 'other';
}

/** True when the model shows under the chip ('all' shows every model). */
export function inKindGroup(model: Pick<ModelSummary, 'kind'>, group: KindGroup): boolean {
  return group === 'all' || kindGroupOf(model.kind) === group;
}

/** How many models each chip would show. */
export function kindGroupCounts(models: Array<Pick<ModelSummary, 'kind'>>): Record<KindGroup, number> {
  const counts: Record<KindGroup, number> = { all: models.length, checkpoint: 0, lora: 0, vae: 0, controlnet: 0, other: 0 };
  for (const model of models) counts[kindGroupOf(model.kind)] += 1;
  return counts;
}

/** The order of the model list. */
export type ModelSort = 'name' | 'size';

/** Name order ignores case and reads digits as numbers ("v2" before "v10"); size puts the largest first. */
export function sortModels<T extends Pick<ModelSummary, 'name' | 'sizeBytes'>>(models: T[], sort: ModelSort): T[] {
  const byName = (left: T, right: T) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  const copy = [...models];
  if (sort === 'size') return copy.sort((left, right) => (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1) || byName(left, right));
  return copy.sort(byName);
}

/** True when two families are known and compatible. */
function knownPair(left: BaseModelFamily, right: BaseModelFamily, names: { left: string; right: string }): boolean {
  // Unknown on either side means "cannot say", which must not read as "fits".
  return left !== 'unknown' && right !== 'unknown' && familiesCompatible(left, right, names);
}

/** The person's base models (checkpoints, diffusion models) a LoRA fits: same family or the same lineage. */
export function fittingBases(lora: Pick<ModelSummary, 'name' | 'baseModel'>, all: ModelSummary[]): ModelSummary[] {
  return all.filter((model) => BASE_KINDS.has(model.kind) && knownPair(lora.baseModel, model.baseModel, { left: lora.name, right: model.name }));
}

/** The person's LoRAs that fit a base model. */
export function fittingLoras(base: Pick<ModelSummary, 'name' | 'baseModel'>, all: ModelSummary[]): ModelSummary[] {
  return all.filter((model) => model.kind === 'lora' && knownPair(model.baseModel, base.baseModel, { left: model.name, right: base.name }));
}

/** True for a base model a LoRA goes on (checkpoint or diffusion model). */
export function isBaseModel(model: Pick<ModelSummary, 'kind'>): boolean {
  return BASE_KINDS.has(model.kind);
}

/** The HTML entities plainDescription decodes; any other stays as written. */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/**
 * Civitai descriptions are HTML. The card shows them as plain text: tags become line breaks or nothing,
 * common entities are decoded, and nothing from the file is ever rendered as markup.
 */
export function plainDescription(text: string): string {
  return text
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#39|[a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Only http(s) links are shown as a model's source; anything else is not a link. */
export function safeModelSource(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The unique key of a model file: `folder/name`. Rows, caches and the card all use it. */
export function modelKey(model: Pick<ModelSummary, 'directory' | 'name'>): string {
  return `${model.directory}/${model.name}`;
}

/** Letters and digits only, lower case, without a model file extension: for comparing a title with a file name. */
const lettersOnly = (text: string) => text.toLowerCase().replace(/\.(safetensors|sft|ckpt|pt|pth|bin|gguf)$/i, '').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * The name its author gave a model, when it says more than the file name does. A file `pixel-art-xl.safetensors`
 * titled "Pixel Art XL" is told nothing new by it; `20251206.safetensors` titled "Soft film look" is.
 */
export function authorTitle(model: Pick<ModelSummary, 'name' | 'title'>): string {
  const title = model.title?.trim() ?? '';
  const file = model.name.split('/').pop() ?? model.name;
  return title !== '' && lettersOnly(title) !== lettersOnly(file) ? title : '';
}

/** A number as an author wrote it: `0.8`, `1`, never `0.8000000001`. */
export function plainNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** A file size in the language's format; a dash when the size is not known. */
export function formatBytes(bytes: number | null, language: 'en' | 'ru'): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  return formatByteSize(bytes, language);
}

/** Subgraph definitions that can be inserted (not opaque), whose name holds the query, by name. */
export function insertableSubgraphs(definitions: SubgraphDefinition[], query: string): SubgraphDefinition[] {
  const needle = query.trim().toLowerCase();
  return definitions
    .filter((definition) => !definition.opaque)
    .filter((definition) => !needle || definition.name.toLowerCase().includes(needle))
    .sort((left, right) => left.name.localeCompare(right.name));
}
