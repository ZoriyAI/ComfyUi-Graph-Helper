import type { BaseModelFamily, ModelKind, ModelSummary, NodeClassSummary, SubgraphDefinition } from '../../../shared/contracts';
import { familiesCompatible } from '../../../shared/knowledge/baseModel';

/** dataTransfer types the canvas accepts from the library (see ui-direction §7). */
export const NODE_DRAG_TYPE = 'application/x-helper-node';
export const MODEL_DRAG_TYPE = 'application/x-helper-model';

export interface NodeGroup {
  category: string;
  items: NodeClassSummary[];
}

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

export interface ModelFilters {
  directory: string;
  baseModel: BaseModelFamily | '';
  kind: ModelKind | '';
}

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

/** Client-side equivalent of the searchModels filter, used for tests and for narrowing a cached list. */
export function filterModels(models: ModelSummary[], query: string, filters: ModelFilters): ModelSummary[] {
  const needle = query.trim().toLowerCase();
  return models.filter((model) => (
    (!filters.directory || model.directory === filters.directory)
    && (!filters.baseModel || model.baseModel === filters.baseModel)
    && (!filters.kind || model.kind === filters.kind)
    && (!needle || model.name.toLowerCase().includes(needle))
  ));
}

/**
 * The kind chips above the model list. A newcomer thinks in "base model, LoRA, VAE, ControlNet, the rest", so
 * diffusion models (a checkpoint split into parts) sit with checkpoints and every other kind under "other".
 */
export const KIND_GROUPS = ['all', 'checkpoint', 'lora', 'vae', 'controlnet', 'other'] as const;
export type KindGroup = typeof KIND_GROUPS[number];

/** Kinds that are a base model a LoRA goes on. */
const BASE_KINDS: ReadonlySet<ModelKind> = new Set<ModelKind>(['checkpoint', 'unet']);

export function kindGroupOf(kind: ModelKind): Exclude<KindGroup, 'all'> {
  if (BASE_KINDS.has(kind)) return 'checkpoint';
  if (kind === 'lora' || kind === 'vae' || kind === 'controlnet') return kind;
  return 'other';
}

export function inKindGroup(model: Pick<ModelSummary, 'kind'>, group: KindGroup): boolean {
  return group === 'all' || kindGroupOf(model.kind) === group;
}

export function kindGroupCounts(models: Array<Pick<ModelSummary, 'kind'>>): Record<KindGroup, number> {
  const counts: Record<KindGroup, number> = { all: models.length, checkpoint: 0, lora: 0, vae: 0, controlnet: 0, other: 0 };
  for (const model of models) counts[kindGroupOf(model.kind)] += 1;
  return counts;
}

export type ModelSort = 'name' | 'size';

/** Name order ignores case and folders' digits read as numbers ("v2" before "v10"); size puts the largest first. */
export function sortModels<T extends Pick<ModelSummary, 'name' | 'sizeBytes'>>(models: T[], sort: ModelSort): T[] {
  const byName = (left: T, right: T) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
  const copy = [...models];
  if (sort === 'size') return copy.sort((left, right) => (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1) || byName(left, right));
  return copy.sort(byName);
}

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

export function isBaseModel(model: Pick<ModelSummary, 'kind'>): boolean {
  return BASE_KINDS.has(model.kind);
}

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

export function modelKey(model: Pick<ModelSummary, 'directory' | 'name'>): string {
  return `${model.directory}/${model.name}`;
}

export function formatBytes(bytes: number | null, language: 'en' | 'ru'): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  const units = language === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Approximate node card size, so a new node lands centred rather than with its corner at the centre. */
const NODE_W = 240;
const NODE_H = 120;

/**
 * Where a node added from the library goes: the centre of the visible canvas when the viewport is known,
 * else to the right of the existing graph, else the origin. `nth` staggers repeated adds.
 */
export function placementFor(
  nodes: Array<{ position: { x: number; y: number } }>,
  viewport: Viewport | null,
  pane: { width: number; height: number } | null,
  nth = 0,
): { x: number; y: number } {
  const stagger = (nth % 6) * 24;
  if (viewport && pane && viewport.zoom > 0 && pane.width > 0 && pane.height > 0) {
    return {
      x: Math.round((pane.width / 2 - viewport.x) / viewport.zoom - NODE_W / 2 + stagger),
      y: Math.round((pane.height / 2 - viewport.y) / viewport.zoom - NODE_H / 2 + stagger),
    };
  }
  if (nodes.length > 0) {
    const maxX = Math.max(...nodes.map((node) => node.position.x));
    const meanY = nodes.reduce((sum, node) => sum + node.position.y, 0) / nodes.length;
    return { x: Math.round(maxX + NODE_W + 80), y: Math.round(meanY + stagger) };
  }
  return { x: stagger, y: stagger };
}

/** Modelled (insertable) subgraph definitions matching a query. */
export function insertableSubgraphs(definitions: SubgraphDefinition[], query: string): SubgraphDefinition[] {
  const needle = query.trim().toLowerCase();
  return definitions
    .filter((definition) => !definition.opaque)
    .filter((definition) => !needle || definition.name.toLowerCase().includes(needle))
    .sort((left, right) => left.name.localeCompare(right.name));
}
