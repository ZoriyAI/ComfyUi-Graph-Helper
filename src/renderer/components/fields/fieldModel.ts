/**
 * The rules of node fields without React: which inputs are fields, the control kind, the shown value, number
 * clamping and typing, seeds and the "after run" row. Used by FieldControl.tsx, ModelList.tsx, graph/Inspector.tsx,
 * graph/nodes (FieldRow, EditorNodes, NodeCard) and lessons/lessonModel.ts; tests/unit/fieldControl.test.ts,
 * typedNumber.test.ts and nodeMarks.test.ts cover it.
 */
import type { FieldKind, FieldSpec, NodeClassDetail } from '../../../shared/contracts/knowledge';
import type { ComfyNodeData, PortDefinition } from '../../types/graph';

/** 'json': a value with no spec that is neither a number, a string nor a boolean; edited as text, as before. */
export type ControlKind = FieldKind | 'json';

/** ComfyUI input types that are edited as fields when the catalog has no detail for the class. */
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
  // Strip float noise from the step grid (0.1 + 0.2): round to the step's decimals plus four spare ones.
  if (kind !== 'int') value = Number(value.toFixed(decimalsOf(step) + 4));
  return Object.is(value, -0) ? 0 : value;
}

/** Decimals of a step as written (0.05 has two); two when there is no step. */
function decimalsOf(step: number | undefined): number {
  if (!step) return 2;
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** A decimal number as people type it: digits, one point or comma, an optional exponent. No hex, no words. */
const NUMBER_TEXT = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i;

/**
 * What typing `raw` into a number field gives: the value to commit, or why it was refused, and a note when the
 * value had to be corrected (raised to the minimum, lowered to the maximum, rounded to a whole number or to the
 * step), so the person sees why the field shows something else than they typed.
 */
export type TypedNumber =
  | { kind: 'empty' }
  | { kind: 'refused' }
  | { kind: 'value'; value: number; note: null | { key: 'field.raisedToMin' | 'field.loweredToMax' | 'field.roundedTo'; values: Record<string, string> } };

/** Reads what the person typed into a number field; a comma counts as the decimal point. */
export function readTypedNumber(raw: string, spec: FieldSpec | undefined, kind: ControlKind): TypedNumber {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (!NUMBER_TEXT.test(trimmed)) return { kind: 'refused' };
  const typed = Number(trimmed.replace(',', '.'));
  const value = clampToSpec(typed, spec, kind);
  if (value === null) return { kind: 'refused' };
  if (value === typed) return { kind: 'value', value, note: null };
  const shown = String(value);
  if (spec?.min !== undefined && typed < spec.min) return { kind: 'value', value, note: { key: 'field.raisedToMin', values: { min: String(spec.min), value: shown } } };
  if (spec?.max !== undefined && typed > spec.max) return { kind: 'value', value, note: { key: 'field.loweredToMax', values: { max: String(spec.max), value: shown } } };
  return { kind: 'value', value, note: { key: 'field.roundedTo', values: { value: shown } } };
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

/** One field row of a node: its name, value, catalog spec, and the port when a link can feed it. */
export interface FieldEntry {
  name: string;
  /** The input port of this widget input, when the node has one (a link can feed the field). */
  port?: PortDefinition;
  spec?: FieldSpec;
  value: unknown;
  tooltip?: string;
  /** Catalog key of the text shown instead of `name` (the "after run" choice of a seed: slot `seed::control_after_generate`). */
  labelKey?: string;
  /** Catalog key of the tooltip, when the tooltip is the app's own text. */
  tooltipKey?: string;
}

/** ComfyUI's choices for what a number field does after each run (control_after_generate), in its own words. */
export const AFTER_RUN_CHOICES = ['fixed', 'increment', 'decrement', 'randomize'];

/** The slot that holds a field's "after run" choice. */
export function afterRunKey(name: string): string {
  return `${name}::control_after_generate`;
}

/** A node's inputs split into the ports that take only links and the fields set by hand. */
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
    pushAfterRun(fields, data, port.name, known, detail);
  }
  // Widget inputs the node has no port for (a node stored before its class was synced).
  for (const input of detail?.inputs ?? []) {
    if (!input.widget || seen.has(input.name) || input.spec?.kind === 'other') continue;
    if (!Object.prototype.hasOwnProperty.call(parameters, input.name) && isUnset(fieldValue(data, input.name, detail?.widgetOrder))) continue;
    seen.add(input.name);
    fields.push(entry(data, input.name, input, detail));
    pushAfterRun(fields, data, input.name, input, detail);
  }
  for (const name of Object.keys(parameters)) {
    // A name with '::' is a hidden slot of another field (the "after run" choice); pushAfterRun shows it.
    if (seen.has(name) || name.includes('::')) continue;
    seen.add(name);
    fields.push(entry(data, name, specs.get(name), detail));
  }
  return { linkInputs, fields };
}

/**
 * A seed (any number field with ComfyUI's control_after_generate slot) gets a second row that says
 * and changes what ComfyUI does to the value after each run: keep it, count up, count down, or draw a new one. Without
 * it a person cannot tell why ComfyUI gives a new picture every time, or make one result repeatable.
 */
function pushAfterRun(
  fields: FieldEntry[],
  data: ComfyNodeData,
  name: string,
  input: NodeClassDetail['inputs'][number] | undefined,
  detail: NodeClassDetail | null | undefined,
): void {
  const start = input?.spec?.control;
  if (start === undefined || !detail?.widgetOrder.includes(afterRunKey(name))) return;
  const stored = fieldValue(data, afterRunKey(name), detail.widgetOrder);
  fields.push({
    name: afterRunKey(name),
    labelKey: 'editing.afterRun',
    value: typeof stored === 'string' && stored !== '' ? stored : start,
    spec: { kind: 'combo', options: AFTER_RUN_CHOICES },
    tooltipKey: 'editing.afterRunHint',
  });
}

/** One FieldEntry with its value, spec, tooltip and port. */
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
