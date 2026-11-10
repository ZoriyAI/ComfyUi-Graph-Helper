import type { FieldKind, FieldSpec, ModelFit } from '../contracts/knowledge';
import type { CatalogInput } from './types';

const KIND_BY_TYPE: Record<string, FieldKind> = {
  COMBO: 'combo',
  INT: 'int',
  FLOAT: 'float',
  STRING: 'string',
  BOOLEAN: 'boolean',
};

/**
 * The control spec of one stored catalog input. Only widget inputs have one. The kind follows the frontend widget
 * constructor (`widgetType` when object_info names one, else the input type), so a socket typed STRING but drawn
 * as a combo is still a combo.
 */
export function fieldSpecOf(input: CatalogInput): FieldSpec | undefined {
  if (!input.widget) return undefined;
  const constructor = input.widgetType ?? input.type;
  const kind = KIND_BY_TYPE[constructor] ?? (Array.isArray(input.options) ? 'combo' : 'other');
  const spec: FieldSpec = { kind };
  if (input.options) spec.options = input.options;
  if (input.min !== undefined) spec.min = input.min;
  if (input.max !== undefined) spec.max = input.max;
  if (input.step !== undefined) spec.step = input.step;
  if (input.multiline) spec.multiline = true;
  if (input.multiSelect) spec.multiSelect = true;
  if (input.tooltip) spec.tooltip = input.tooltip;
  if (input.default !== undefined) spec.default = input.default;
  if (input.controlDefault !== undefined) spec.control = input.controlDefault;
  return spec;
}

/** Model file names as ComfyUI lists them, with forward slashes, so a Windows server's `sdxl\a.safetensors` matches. */
export function modelKey(name: string): string {
  return name.replace(/\\/g, '/');
}

/**
 * The catalog folder a combo's options come from, when at least half of them are files of the person's model
 * catalog; undefined otherwise. Decided by the data, not by the input name: a preprocessor's own `ckpt_name` list of
 * files the catalog does not hold stays a plain list. `preferred` (the folder known for this loader) wins a tie.
 */
export function modelDirectoryOf(
  options: string[] | undefined,
  modelsByName: Map<string, string[]>,
  preferred?: string | null,
): string | undefined {
  const named = (options ?? []).filter((option) => option !== '');
  if (named.length === 0) return undefined;
  const counts = new Map<string, number>();
  let matched = 0;
  for (const option of named) {
    const directories = modelsByName.get(modelKey(option));
    if (!directories || directories.length === 0) continue;
    matched += 1;
    for (const directory of new Set(directories)) counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }
  // Half is enough: a loader list may carry a few files the last sync has not seen yet.
  if (matched === 0 || matched * 2 < named.length) return undefined;
  let best: string | undefined;
  let bestCount = 0;
  for (const [directory, count] of counts) {
    if (count > bestCount || (count === bestCount && directory === preferred)) {
      best = directory;
      bestCount = count;
    }
  }
  return best;
}

const FIT_ORDER: Record<ModelFit, number> = { fits: 0, related: 1, unknown: 2, differs: 3 };

/** Fitting files first, then related families, unknown, and families that do not load last; by file name (natural order) inside each group. */
export function orderByFit<T extends { value: string; fit: ModelFit }>(options: T[]): T[] {
  return [...options].sort((left, right) => FIT_ORDER[left.fit] - FIT_ORDER[right.fit]
    || left.value.localeCompare(right.value, undefined, { sensitivity: 'base', numeric: true }));
}
