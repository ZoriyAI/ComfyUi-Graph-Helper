/** Validate explicit edits against proven widget declarations; imported opaque values stay untouched. */
import type { CatalogInput, CatalogView } from '../../shared/catalog/types';
import { resolvedNode } from '../../shared/catalog/dynamicInputs';
import { fieldSpecOf } from '../../shared/catalog/fieldSpec';
import type { SubgraphDefinition } from '../../shared/graph/subgraphs';
import { NOTE_NODE_TYPES } from '../../shared/graph/editorNodes';
import { promotedWidgetName, promotedWidgetPairs } from '../../shared/workflow/promotedWidgets';
import type { GraphSnapshot } from '../../shared/workflow/codec';

export class ParameterValueError extends Error {}

export function parameterValue(input: CatalogInput | undefined, value: unknown): unknown {
  const spec = input && fieldSpecOf(input);
  if (!input || !spec) return value;
  const fail = (reason: string): never => { throw new ParameterValueError(`${input.name}: ${reason}`); };
  if (spec.kind === 'int' || spec.kind === 'float') {
    const numeric = typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fail('Enter a finite number.');
    if (spec.kind === 'int' && !Number.isSafeInteger(numeric)) return fail('Enter a whole number within the supported precision.');
    if (spec.min !== undefined && numeric < spec.min) return fail(`The minimum is ${spec.min}.`);
    if (spec.max !== undefined && numeric > spec.max) return fail(`The maximum is ${spec.max}.`);
    return numeric;
  }
  if (spec.kind === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value !== 'boolean') return fail('Choose true or false.');
  }
  if (spec.kind === 'string' && typeof value !== 'string') return fail('Enter text.');
  return value;
}

/** Resolve exposed controls to their source declaration, including nested subgraph instances. */
export function parameterInput(
  node: GraphSnapshot['nodes'][number], key: string, catalog: CatalogView, definitions: SubgraphDefinition[], widgetIndex?: number, seen = new Set<string>(),
): CatalogInput | undefined {
  const data = node.data ?? {};
  if (NOTE_NODE_TYPES.has(data.comfyType) && (key === 'text' || key === 'widget[0]')) return { name: 'text', type: 'STRING', widget: true };
  const spec = catalog.nodes.find(item => item.classType === data.comfyType);
  if (spec) {
    const layout = resolvedNode(spec, { parameters: data.parameters, widgets: data.comfy?.widgets_values, namedWidgets: data.comfy?.widgets_values_named });
    const name = widgetIndex !== undefined && layout.widgetOrderReliable ? layout.widgetOrder[widgetIndex] : key;
    return layout.inputs.find(input => input.widget && input.name === name);
  }
  const definition = definitions.find(item => item.id === (data.subgraphId ?? data.comfyType));
  if (!definition || seen.has(definition.id)) return undefined;
  seen.add(definition.id);
  const pairs = promotedWidgetPairs(data);
  const index = widgetIndex ?? pairs.findIndex((_, i) => promotedWidgetName(data, i) === key);
  const pair = pairs[index];
  if (!Array.isArray(pair) || pair.length !== 2) return undefined;
  const source = definition.nodes.find(item => String(item.id) === String(pair[0]));
  return source ? parameterInput(source, String(pair[1]), catalog, definitions, undefined, seen) : undefined;
}
