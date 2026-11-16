/** Native exposed-widget definitions and the independent values held by each subgraph instance. */
import type { CatalogView } from '../../shared/catalog/types';
import type { SubgraphDefinition } from '../../shared/graph/subgraphs';
import { widgetOrderMatches } from '../../shared/workflow/widgetValues';

type Node = Record<string, any>;
export type ExposedWidget = { nodeId: string; name: string };

export function exposedWidgets(definition: SubgraphDefinition): ExposedWidget[] {
  const list = definition.raw.widgets;
  return Array.isArray(list) ? list.flatMap((entry) => entry && typeof entry.id === 'string' && typeof entry.name === 'string' ? [{ nodeId: entry.id, name: entry.name }] : []) : [];
}

function sourceValue(definition: SubgraphDefinition, field: ExposedWidget, catalog?: CatalogView): { found: boolean; value?: unknown } {
  const node = definition.nodes.find((item) => String(item.id) === field.nodeId);
  if (!node) return { found: false };
  const data = node.data ?? {};
  const nativeProxies = data.comfy?.properties?.proxyWidgets;
  const nativeValues = data.comfy?.widgets_values;
  if (Array.isArray(nativeProxies) && Array.isArray(nativeValues)) {
    const exact = nativeProxies.flatMap((pair: unknown, index: number) => Array.isArray(pair) && field.name === `${pair[0]}::${pair[1]}` ? [index] : []);
    const slots = exact.length ? exact : nativeProxies.flatMap((pair: unknown, index: number) => Array.isArray(pair) && field.name === String(pair[1]) ? [index] : []);
    if (slots.length === 1 && slots[0] < nativeValues.length) return { found: true, value: nativeValues[slots[0]] };
  }
  const spec = catalog?.nodes.find((item) => item.classType === data.comfyType);
  const input = spec?.inputs.find((item) => item.name === field.name && item.widget);
  // Arbitrary names (including synthetic positional labels) are never turned into ComfyUI widget names.
  if (!input && !Object.prototype.hasOwnProperty.call(data.parameters ?? {}, field.name)) return { found: false };
  if (field.name.includes('::')) return { found: false };
  if (Object.prototype.hasOwnProperty.call(data.parameters ?? {}, field.name)) return { found: true, value: data.parameters[field.name] };
  const values = data.comfy?.widgets_values;
  if (values && typeof values === 'object' && !Array.isArray(values) && field.name in values) return { found: true, value: values[field.name] };
  if (widgetOrderMatches(values, spec?.widgetOrder, spec?.widgetOrderReliable !== false)) {
    const index = spec!.widgetOrder.indexOf(field.name);
    if (index >= 0) return { found: true, value: values[index] };
  }
  return { found: false };
}

/** Validate before any revision is committed. The native definition schema is widgets: [{id, name}]. */
export function setExposedWidgets(definition: SubgraphDefinition, fields: ExposedWidget[], catalog?: CatalogView): void {
  const seen = new Set<string>();
  const previous = new Set(exposedWidgets(definition).map((field) => JSON.stringify([field.nodeId, field.name])));
  for (const field of fields) {
    const key = JSON.stringify([field.nodeId, field.name]);
    const retained = previous.has(key) && definition.nodes.some((node) => String(node.id) === field.nodeId);
    if (seen.has(key) || (!retained && !sourceValue(definition, field, catalog).found)) throw new Error('Subgraph widget source is missing or its field layout is unknown.');
    seen.add(key);
  }
  definition.raw = { ...definition.raw, widgets: fields.map((field) => ({ id: field.nodeId, name: field.name })) };
}

/** Preserve values by source identity when controls are reordered or the definition is reconfigured. */
export function refreshExposedWidgets(node: Node, definition: SubgraphDefinition, catalog?: CatalogView, previousFields?: ExposedWidget[]): void {
  const fields = exposedWidgets(definition);
  const data = node.data;
  const comfy = { ...(data.comfy ?? {}) };
  const properties = { ...(comfy.properties ?? {}) };
  const old = new Map<string, unknown>();
  if (Array.isArray(properties.proxyWidgets) && Array.isArray(comfy.widgets_values)) {
    properties.proxyWidgets.forEach((source: unknown, index: number) => {
      if (Array.isArray(source) && index < comfy.widgets_values.length) old.set(JSON.stringify(source.map(String)), comfy.widgets_values[index]);
    });
  }
  const managed = new Set((previousFields ?? fields).map((field) => JSON.stringify([field.nodeId, field.name])));
  const retained: string[][] = Array.isArray(properties.proxyWidgets) ? properties.proxyWidgets.filter((pair: unknown) => Array.isArray(pair) && pair.length === 2 && !managed.has(JSON.stringify(pair.map(String)))).map((pair: unknown[]) => pair.map(String)) : [];
  const retainedKeys = new Set(retained.map((pair) => JSON.stringify(pair)));
  properties.proxyWidgets = [...retained, ...fields.filter((field) => !retainedKeys.has(JSON.stringify([field.nodeId, field.name]))).map((field) => [field.nodeId, field.name])];
  comfy.properties = properties;
  comfy.widgets_values = properties.proxyWidgets.map((pair: string[]) => {
    const key = JSON.stringify(pair);
    return old.has(key) ? old.get(key) : sourceValue(definition, { nodeId: pair[0], name: pair[1] }, catalog).value ?? null;
  });
  node.data = { ...data, comfy };
}
