/** Per-node expansion of the native V3 input declarations. No extension JavaScript is executed. */
import type { CatalogInput, CatalogLayout, CatalogNode, DynamicInput } from './types';
import { slotDefault } from './objectInfo';

export interface DynamicValues {
  parameters?: Record<string, unknown>;
  widgets?: unknown;
  namedWidgets?: unknown;
  inputNames?: string[];
  autogrowCounts?: Record<string, number>;
}

export interface ResolvedInputs extends CatalogLayout {
  widgetOrderReliable: boolean;
  values: Record<string, unknown>;
  portOrder: string[];
  nativeWidgetOrder: string[];
  autogrow: Array<{ name: string; input: CatalogInput; definition: Extract<DynamicInput, { kind: 'autogrow' }>; names: string[] }>;
}

export function hasDynamicInputs(layout: CatalogLayout): boolean {
  return layout.inputs.some((input) => input.dynamic !== undefined || input.matchType !== undefined);
}

export function autogrowName(name: string, definition: Extract<DynamicInput, { kind: 'autogrow' }>, ordinal: number): string {
  return `${name}.${definition.names?.[ordinal] ?? `${definition.prefix}${ordinal}`}`;
}

/** Positional values are consumed while walking the chosen branches, never against the default branch. */
export function resolveInputs(layout: CatalogLayout, source: DynamicValues = {}): ResolvedInputs {
  const inputs: CatalogInput[] = [];
  const widgetOrder: string[] = [];
  const nativeWidgetOrder: string[] = [];
  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const autogrow: ResolvedInputs['autogrow'] = [];
  const positional = Array.isArray(source.widgets) ? source.widgets : undefined;
  const named = source.widgets && typeof source.widgets === 'object' && !positional ? source.widgets as Record<string, unknown> : {};
  const nativeNamed = source.namedWidgets && typeof source.namedWidgets === 'object' && !Array.isArray(source.namedWidgets) ? source.namedWidgets as Record<string, unknown> : {};
  let reliable = layout.widgetOrderReliable !== false;
  let cursor = 0;
  const consume = (name: string, fallback: unknown, nativeName = name) => {
    const saved = Object.hasOwn(nativeNamed, nativeName) ? nativeNamed[nativeName] : positional ? positional[cursor] : named[name];
    cursor++;
    const value = Object.hasOwn(source.parameters ?? {}, name) ? source.parameters![name] : saved !== undefined ? saved : fallback;
    widgetOrder.push(name);
    nativeWidgetOrder.push(nativeName);
    values[name] = value;
    return value;
  };
  const walk = (part: CatalogLayout, prefix: string, depth: number, inheritedList = false, rowFields = false, displayPrefix = ''): string[] => {
    if (depth > 8 || inputs.length > 5000) { reliable = false; return []; }
    if (part.widgetOrderReliable === false) reliable = false;
    const socketChunks: string[][] = [];
    const widgetChunks: string[][] = [];
    for (const original of part.inputs) {
      const name = prefix + original.name;
      const input: CatalogInput = { ...original, name, ...(prefix ? { displayName: displayPrefix + (original.displayName ?? original.name) } : {}), ...(inheritedList ? { isList: true } : {}) };
      const definition = input.dynamic;
      const ports: string[] = [];
      if (definition?.kind === 'autogrow') {
        const all = Array.from({ length: definition.max }, (_, index) => autogrowName(name, definition, index));
        const lastSaved = all.reduce((last, key, index) => source.inputNames?.includes(key) ? index + 1 : last, 0);
        const count = Math.min(definition.max, Math.max(definition.min, source.autogrowCounts?.[name] ?? Math.max(definition.min + 1, lastSaved)));
        const names = all.slice(0, count);
        for (const [index, childName] of names.entries()) {
          inputs.push({ ...definition.layout.inputs[0], name: childName, required: original.required !== false && definition.layout.inputs[0].required !== false && index < definition.min,
            ...(input.isList ? { isList: true } : {}) });
        }
        ports.push(...names);
        autogrow.push({ name, input, definition, names });
      } else {
        // A DynamicGroup controller stores a row count, but has no socket in ComfyUI.
        inputs.push(input);
        if (definition?.kind !== 'group') ports.push(name);
        if (definition?.kind === 'combo') {
          const value = consume(name, input.default);
          const option = definition.options.find((item) => item.key === value);
          if (!option) reliable = false;
          else ports.push(...walk(option.layout, `${name}.`, depth + 1, input.isList, rowFields, displayPrefix));
        } else if (definition?.kind === 'group') {
          const count = consume(name, definition.min);
          if (typeof count !== 'number' || !Number.isInteger(count) || count < definition.min || count > 100) reliable = false;
          else for (let index = 0; index < count; index++) ports.push(...walk(definition.layout, `${name}.${index}.`, depth + 1, input.isList, true, `${input.displayName ?? original.name} ${index + 1}: `));
        } else if (input.widget) {
          const slots = part.widgetOrder.filter((key) => key === original.name || key.startsWith(`${original.name}::`));
          let auxiliary = 0;
          for (const slot of slots) {
            const fallback = slotDefault(part as CatalogNode, slot);
            const suffix = slot.slice(original.name.length + 2);
            const nativeName = slot === original.name ? name : rowFields ? `${name}.${auxiliary++}` : original.auxiliaryNames?.[suffix] ?? (suffix === 'media_upload' ? 'upload' : suffix);
            consume(prefix + slot, fallback.known ? fallback.value : undefined, nativeName);
          }
        }
      }
      (original.widget ? widgetChunks : socketChunks).push(ports);
    }
    return [...socketChunks.flat(), ...widgetChunks.flat()];
  };
  const portOrder = walk(layout, '', 0);
  if (positional && cursor !== positional.length) reliable = false;
  return { inputs, widgetOrder, widgetOrderReliable: reliable, values, portOrder, nativeWidgetOrder, autogrow };
}

/** Resolve a class without losing its informational properties. */
export function resolvedNode(node: CatalogNode, values: DynamicValues = {}): CatalogNode & ResolvedInputs {
  return { ...node, ...resolveInputs(node, values) };
}
