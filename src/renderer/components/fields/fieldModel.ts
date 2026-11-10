import type { FieldKind, FieldSpec, NodeClassDetail } from '../../../shared/contracts/knowledge';
import type { ComfyNodeData, PortDefinition } from '../../types/graph';

/**
 * Pure helpers behind FieldControl and the node body: which inputs are fields, what kind of control each gets,
 * the value it shows, clamping and seeds. No React here so the rules are unit-tested.
 */

/** 'json': a value with no spec that is neither a number, a string nor a boolean; edited as text, as before. */
export type ControlKind = FieldKind | 'json';

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);

/** A combo with more options than this gets a filter box: nobody scrolls 300 LoRAs. */
export const SEARCH_THRESHOLD = 8;

/** A value nothing has set: export would fall back to the catalog default, or write null. */
export function isUnset(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * The control a field gets. The spec decides when the catalog has one; rows stored before field metadata existed
 * fall back to the JS type of the value (a number edits as a number, a string as text).
 */
export function controlKind(spec: FieldSpec | undefined, value: unknown): ControlKind {
  if (spec) return spec.kind;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'float';
  if (typeof value === 'string' || isUnset(value)) return 'string';
  return 'json';
}

/** A seed-like integer: the "random" button makes sense there. Named seed/noise_seed, or a randomizing INT. */
export function isSeedField(name: string, spec: FieldSpec | undefined): boolean {
  if (/(^|_)seed$/i.test(name) || /^seed(_|$)/i.test(name)) return true;
  return spec?.kind === 'int' && spec.control === 'randomize';
}

/** The largest integer a JS number holds exactly; seeds above it would be rounded on the way to ComfyUI. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/**
 * A typed or stepped number brought into the field's range: integers are rounded, the range is applied, and the
 * step grid starts at min (ComfyUI's own rule). A non-number yields null, so the caller keeps the old value.
 */
export function clampToSpec(raw: number, spec: FieldSpec | undefined, kind: ControlKind): number | null {
  if (!Number.isFinite(raw)) return null;
  let value = raw;
  const min = spec?.min;
  const max = spec?.max;
  const step = spec?.step;
  if (kind === 'int') value = Math.round(value);
  if (step && step > 0 && kind === 'float' && min !== undefined) {
    value = Math.round((value - min) / step) * step + min;
  }
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  if (kind === 'int') value = Math.max(-MAX_SAFE, Math.min(MAX_SAFE, Math.round(value)));
  // Strip float noise from the step grid (0.1 + 0.2), keeping as many decimals as the step has.
  if (kind !== 'int') value = Number(value.toFixed(decimalsOf(step) + 4));
  return Object.is(value, -0) ? 0 : value;
}

function decimalsOf(step: number | undefined): number {
  if (!step) return 2;
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** One step up or down from the current value (an unset value steps from the default, then from min, then 0). */
export function stepValue(current: unknown, direction: 1 | -1, spec: FieldSpec | undefined, kind: ControlKind): number | null {
  const base = typeof current === 'number' ? current
    : typeof spec?.default === 'number' ? spec.default
      : spec?.min ?? 0;
  const step = spec?.step && spec.step > 0 ? spec.step : 1;
  return clampToSpec(base + direction * step, spec, kind);
}

/** A random seed inside the field's range (whole numbers, at most the largest exact JS integer). */
export function randomSeed(spec: FieldSpec | undefined, random: () => number = Math.random): number {
  const min = Math.max(0, Math.ceil(spec?.min ?? 0));
  const max = Math.min(MAX_SAFE, Math.floor(spec?.max ?? 0xffffffffffff));
  if (max <= min) return min;
  return min + Math.floor(random() * (max - min + 1));
}

/** Options that contain every word of the query, in their own order; case and folder separators ignored. */
export function filterOptions(options: string[], query: string): string[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const text = option.toLowerCase().replace(/\\/g, '/');
    return words.every((word) => text.includes(word));
  });
}

/** "1.2 ГБ" / "340 МБ": sizes a person reads, with the unit words from the caller's language. */
export function formatSize(bytes: number | null | undefined, units: { gb: string; mb: string; kb: string }, locale?: string): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  const format = (value: number, digits: number) => value.toLocaleString(locale, { maximumFractionDigits: digits });
  if (bytes >= 1e9) return `${format(bytes / 1e9, 1)} ${units.gb}`;
  if (bytes >= 1e6) return `${format(bytes / 1e6, 0)} ${units.mb}`;
  return `${format(Math.max(1, bytes / 1e3), 0)} ${units.kb}`;
}

/** File name without folders: `sdxl/styles/pixel.safetensors` → `pixel.safetensors`. */
export function baseName(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

/** The folder part of an option, '' when there is none. */
export function folderOf(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

/** How a value reads in a compact control. */
export function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isUnset(value)) return '';
  return JSON.stringify(value) ?? '';
}

export interface FieldEntry {
  name: string;
  /** The input port of this widget input, when the node has one (a link can feed the field). */
  port?: PortDefinition;
  spec?: FieldSpec;
  value: unknown;
  tooltip?: string;
}

export interface NodeLayout {
  /** Inputs that only take a link (MODEL, CLIP, LATENT…). */
  linkInputs: PortDefinition[];
  /** Widget inputs and stored parameters: what the person sets by hand. */
  fields: FieldEntry[];
}

/**
 * The value a field shows: the node's parameters first (what the commands set), then the stored widgets_values
 * of an imported node by the catalog widget order.
 */
export function fieldValue(data: { parameters?: Record<string, unknown>; comfy?: unknown }, name: string, widgetOrder: string[] | undefined): unknown {
  const parameters = data.parameters ?? {};
  if (Object.prototype.hasOwnProperty.call(parameters, name) && !isUnset(parameters[name])) return parameters[name];
  const comfy = (data as { comfy?: { widgets_values?: unknown } }).comfy;
  const widgets = comfy?.widgets_values;
  if (Array.isArray(widgets) && widgetOrder) {
    const index = widgetOrder.indexOf(name);
    if (index >= 0 && index < widgets.length) return widgets[index];
  } else if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
    const value = (widgets as Record<string, unknown>)[name];
    if (value !== undefined) return value;
  }
  return parameters[name];
}

/**
 * Splits a node's inputs into link ports and fields. With catalog detail, an input is a field when the catalog says
 * it is a widget. Without detail (unsynced class, ghost of an unknown class) an input is a field when the node
 * stores a value under its name and its type is a widget type. Parameters with no input of their name (an import
 * that carried only values) are fields too, so no value disappears from the node.
 */
export function nodeLayout(data: ComfyNodeData, detail: NodeClassDetail | null | undefined): NodeLayout {
  const parameters = data.parameters ?? {};
  const specs = new Map((detail?.inputs ?? []).map((input) => [input.name, input]));
  const linkInputs: PortDefinition[] = [];
  const fields: FieldEntry[] = [];
  const seen = new Set<string>();
  for (const port of data.inputs) {
    const known = specs.get(port.name);
    const widget = known ? known.widget : (Object.prototype.hasOwnProperty.call(parameters, port.name) && WIDGET_TYPES.has(port.dataType.toUpperCase()));
    if (!widget) {
      linkInputs.push(port);
      continue;
    }
    seen.add(port.name);
    fields.push(entry(data, port.name, known, detail, port));
  }
  // Widget inputs the node has no port for (a node stored before its class was synced).
  for (const input of detail?.inputs ?? []) {
    if (!input.widget || seen.has(input.name) || input.spec?.kind === 'other') continue;
    if (!Object.prototype.hasOwnProperty.call(parameters, input.name) && isUnset(fieldValue(data, input.name, detail?.widgetOrder))) continue;
    seen.add(input.name);
    fields.push(entry(data, input.name, input, detail));
  }
  for (const name of Object.keys(parameters)) {
    if (seen.has(name) || name.includes('::')) continue;
    seen.add(name);
    fields.push(entry(data, name, specs.get(name), detail));
  }
  return { linkInputs, fields };
}

function entry(
  data: ComfyNodeData,
  name: string,
  input: NodeClassDetail['inputs'][number] | undefined,
  detail: NodeClassDetail | null | undefined,
  port?: PortDefinition,
): FieldEntry {
  const out: FieldEntry = { name, value: fieldValue(data, name, detail?.widgetOrder) };
  if (port) out.port = port;
  if (input?.spec) out.spec = input.spec;
  const tooltip = input?.spec?.tooltip ?? input?.tooltip;
  if (tooltip) out.tooltip = tooltip;
  return out;
}
