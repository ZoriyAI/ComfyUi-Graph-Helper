/** Native exposed-widget definitions and the independent values held by each subgraph instance. */
import { definitionWidgetPairs, promotedWidgetName, promotedWidgetPairs, promotedWidgetValue } from '../../shared/workflow/promotedWidgets';
import { hasDynamicInputs, resolvedNode } from '../../shared/catalog/dynamicInputs';
import type { CatalogView } from '../../shared/catalog/types';
import type { SubgraphDefinition } from '../../shared/graph/subgraphs';
import { widgetOrderMatches } from '../../shared/workflow/widgetValues';

type Node = Record<string, any>;
export type ExposedWidget = { nodeId: string; name: string };

export function exposedWidgets(definition: SubgraphDefinition): ExposedWidget[] {
  return definitionWidgetPairs(definition.raw).map(([nodeId, name]) => ({ nodeId, name }));
}

function sourceValue(definition: SubgraphDefinition, field: ExposedWidget, catalog?: CatalogView): { found: boolean; value?: unknown } {
  const node = definition.nodes.find((item) => String(item.id) === field.nodeId);
  if (!node) return { found: false };
  const data = node.data ?? {};
  const nativeProxies = promotedWidgetPairs(data);
  const nativeValues = data.comfy?.widgets_values;
  if (Array.isArray(nativeProxies) && Array.isArray(nativeValues)) {
    const exact = nativeProxies.flatMap((pair: unknown, index: number) => Array.isArray(pair) && field.name === `${pair[0]}::${pair[1]}` ? [index] : []);
    const slots = exact.length ? exact : nativeProxies.flatMap((pair: unknown, index: number) => Array.isArray(pair) && field.name === String(pair[1]) ? [index] : []);
    if (slots.length === 1 && slots[0] < nativeValues.length) return { found: true, value: promotedWidgetValue(data, slots[0]).value };
  }
  const declared = catalog?.nodes.find((item) => item.classType === data.comfyType);
  const spec = declared && hasDynamicInputs(declared) ? resolvedNode(declared, { parameters: data.parameters, widgets: data.comfy?.widgets_values, namedWidgets: data.comfy?.widgets_values_named }) : declared;
  const input = spec?.inputs.find((item) => item.name === field.name && item.widget);
  // Arbitrary names (including synthetic positional labels) are never turned into ComfyUI widget names.
  if (!input && !Object.prototype.hasOwnProperty.call(data.parameters ?? {}, field.name)) return { found: false };
  if (field.name.includes('::')) return { found: false };
  if (Object.prototype.hasOwnProperty.call(data.parameters ?? {}, field.name)) return { found: true, value: data.parameters[field.name] };
  const named = data.comfy?.widgets_values_named;
  if (named && typeof named === 'object' && Object.hasOwn(named, field.name)) return { found: true, value: named[field.name] };
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
  const previousPairs = promotedWidgetPairs(data);
  const oldNames = previousPairs.map((_, index) => promotedWidgetName(data, index));
  const old = new Map<string, unknown>();
  previousPairs.forEach((source, index) => {
    if (Array.isArray(source)) old.set(JSON.stringify(source.map(String)), promotedWidgetValue(data, index).value);
  });
  const managed = new Set((previousFields ?? fields).map((field) => JSON.stringify([field.nodeId, field.name])));
  const retained = previousPairs.filter((pair): pair is string[] => Array.isArray(pair) && pair.length === 2 && !managed.has(JSON.stringify(pair.map(String)))).map(pair => pair.map(String));
  const retainedKeys = new Set(retained.map(pair => JSON.stringify(pair)));
  const pairs = [...retained, ...fields.filter(field => !retainedKeys.has(JSON.stringify([field.nodeId, field.name]))).map(field => [field.nodeId, field.name])];
  const names = pairs.map(pair => pairs.filter(other => other[1] === pair[1]).length === 1 ? pair[1] : `${pair[0]}::${pair[1]}`);
  const modern = Array.isArray(data.promotedWidgets) && !Array.isArray(properties.proxyWidgets);
  if (!modern) properties.proxyWidgets = pairs;
  comfy.properties = properties;
  comfy.widgets_values = pairs.map(pair => {
    const key = JSON.stringify(pair);
    return old.has(key) ? old.get(key) : sourceValue(definition, { nodeId: pair[0], name: pair[1] }, catalog).value ?? null;
  });
  if (comfy.widgets_values_named && typeof comfy.widgets_values_named === 'object') {
    comfy.widgets_values_named = Object.fromEntries([
      ...Object.entries(comfy.widgets_values_named).filter(([name]) => !oldNames.includes(name)),
      ...names.map((name, index) => [name, comfy.widgets_values[index]]),
    ]);
  }
  node.data = { ...data, comfy, ...(modern ? { promotedWidgets: pairs } : {}), promotedWidgetNames: names };
}
