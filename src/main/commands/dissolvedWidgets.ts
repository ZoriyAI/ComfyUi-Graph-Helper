/** Retarget promoted controls when an instance is unpacked inside another definition. */
import type { SubgraphDefinition } from '../../shared/graph/subgraphs';
import type { GraphSnapshot } from '../../shared/workflow/codec';
import { SUBGRAPH_INPUT_NODE_ID } from '../../shared/graph/subgraphs';
import type { CatalogView } from '../../shared/catalog/types';
import { exposedWidgets, refreshExposedWidgets, setExposedWidgets } from './subgraphWidgets';
import { GraphOpError } from './graphOps';
import { definitionWidgetPairs, promotedWidgetName, promotedWidgetPairs, promotedWidgetValue } from '../../shared/workflow/promotedWidgets';

type Pair = [string, string];
type Rewrite = (pair: Pair) => Pair[];
const key = (pair: Pair) => `${pair[0]}::${pair[1]}`;
const pairOf = (value: unknown): Pair | null => Array.isArray(value) && value.length === 2 ? [String(value[0]), String(value[1])] : null;
const refuse = (): never => { throw new GraphOpError('Subgraph widget source is missing or its field layout is unknown.'); };

/** Mutates an already isolated snapshot. Every instance retains its own values, including native-only controls. */
export function retargetDissolvedWidgets(
  snapshot: GraphSnapshot, holderId: string, instance: Record<string, any>, removed: SubgraphDefinition,
  idMap: Record<string, string>,
): void {
  const nativeProxies = promotedWidgetPairs(instance.data);
  const proxies: Pair[] = (Array.isArray(nativeProxies) ? nativeProxies : []).flatMap((value: unknown) => {
    const pair = pairOf(value); return pair ? [pair] : [];
  });
  const resolve = (name: string): Pair[] => {
    const exact = proxies.filter((pair) => key(pair) === name);
    const matches = exact.length ? exact : proxies.filter((pair) => pair[1] === name);
    if (matches.length !== 1) return refuse();
    const source = matches[0];
    if (source[0] !== '-1') return idMap[source[0]] ? [[idMap[source[0]], source[1]]] : refuse();
    const slot = removed.inputs.findIndex((input) => input.name === source[1]);
    const targets = removed.edges.filter((edge) => String(edge.source) === SUBGRAPH_INPUT_NODE_ID && edge.sourceHandle === `out-${slot}`);
    if (slot < 0 || !targets.length) return refuse();
    return targets.map((edge): Pair => {
      const node = removed.nodes.find((item) => String(item.id) === String(edge.target));
      const port = node?.data?.inputs?.find((input: { id: string }) => input.id === edge.targetHandle);
      const id = idMap[String(edge.target)];
      return id && typeof port?.name === 'string' ? [id, port.name] : refuse();
    });
  };
  rewritePromotedControls(snapshot, holderId, (pair) => pair[0] === String(instance.id) ? resolve(pair[1]) : [pair]);
}

/** Preserve an enclosing node's controls when their sources are wrapped into a new nested definition. */
export function retargetWrappedWidgets(snapshot: GraphSnapshot, holderId: string, createdId: string, instanceId: string, catalog: CatalogView): void {
  const definitions = snapshot.subgraphs ?? [];
  const holder = definitions.find((item) => item.id === holderId) ?? refuse();
  const created = definitions.find((item) => item.id === createdId) ?? refuse();
  const instance = holder.nodes.find((node) => String(node.id) === instanceId) ?? refuse();
  const moved = new Set(created.nodes.map((node) => String(node.id)));
  const required = new Map<string, Pair>();
  const retain = (pair: Pair) => { if (moved.has(pair[0])) required.set(key(pair), pair); };
  for (const field of exposedWidgets(holder)) retain([field.nodeId, field.name]);
  const natives = [holder.instanceDefaults, ...snapshot.nodes.filter((node) => node.data?.comfyType === holderId).map((node) => node.data.comfy),
    ...definitions.flatMap((definition) => definition.nodes.filter((node) => node.data?.comfyType === holderId).map((node) => node.data.comfy))];
  for (const native of natives) {
    const list = native?.properties?.proxyWidgets;
    if (Array.isArray(list)) for (const value of list) { const pair = pairOf(value); if (pair) retain(pair); }
  }
  if (!required.size) return;
  const previous = exposedWidgets(created);
  const fields = new Map(previous.map((field) => [key([field.nodeId, field.name]), field]));
  for (const [id, name] of required.values()) fields.set(key([id, name]), { nodeId: id, name });
  try { setExposedWidgets(created, [...fields.values()], catalog); } catch { refuse(); }
  refreshExposedWidgets(instance, created, catalog, previous);
  rewritePromotedControls(snapshot, holderId, (pair) => moved.has(pair[0]) ? [[instanceId, key(pair)]] : [pair]);
}

/** A dynamic mode can remove a field. Remove its exposed references up through enclosing definitions too. */
export function removePromotedReferences(snapshot: GraphSnapshot, holderId: string, removed: Set<string>): void {
  if (removed.size) rewritePromotedControls(snapshot, holderId, pair => removed.has(key(pair)) ? [] : [pair]);
}

function rewritePromotedControls(snapshot: GraphSnapshot, holderId: string, rewrite: Rewrite): void {
  const definitions = snapshot.subgraphs ?? [];
  const queue: Array<{ id: string; rewrite: Rewrite }> = [{ id: holderId, rewrite }];
  let visits = 0;
  while (queue.length) {
    if (++visits > Math.max(1, definitions.length) * Math.max(1, definitions.length) + 1) refuse();
    const { id, rewrite } = queue.shift()!;
    const definition = definitions.find((item) => !item.opaque && item.id === id) ?? refuse();
    const changes = new Map<string, { from: Pair; to: Pair[] }>();
    const previousFields = definitionWidgetPairs(definition.raw);
    const map = (pair: Pair): Pair[] => {
      const next = rewrite(pair);
      if (JSON.stringify(next) !== JSON.stringify([pair])) changes.set(key(pair), { from: pair, to: next });
      return next;
    };
    if (Array.isArray(definition.raw.widgets)) {
      definition.raw.widgets = definition.raw.widgets.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || entry.id == null || typeof entry.name !== 'string') return [entry];
        return map([String(entry.id), entry.name]).map(([target, name]) => ({ ...entry, id: target, name }));
      });
    }
    const updateData = (data: Record<string, any>) => {
      const native = data.comfy;
      if (!native) return;
      const sources = promotedWidgetPairs(data);
      const oldNames = sources.map((_, index) => promotedWidgetName(data, index));
      const pairs: unknown[] = []; const values: unknown[] = [];
      let changed = false;
      sources.forEach((value: unknown, index: number) => {
        const pair = pairOf(value);
        const next = pair ? map(pair) : [value];
        const differs = JSON.stringify(next) !== JSON.stringify([value]);
        if (differs && (!Array.isArray(native.widgets_values) || index >= native.widgets_values.length)) refuse();
        changed ||= differs;
        for (const target of next) { pairs.push(target); values.push(promotedWidgetValue(data, index).value); }
      });
      if (changed) {
        if (Array.isArray(native.properties?.proxyWidgets)) native.properties = { ...native.properties, proxyWidgets: pairs };
        else data.promotedWidgets = pairs;
        native.widgets_values = values;
        const names = pairs.map(value => { const pair = pairOf(value); return pair ? pairs.filter(other => pairOf(other)?.[1] === pair[1]).length === 1 ? pair[1] : key(pair) : ''; });
        data.promotedWidgetNames = names;
        if (native.widgets_values_named && typeof native.widgets_values_named === 'object') native.widgets_values_named = Object.fromEntries([
          ...Object.entries(native.widgets_values_named).filter(([name]) => !oldNames.includes(name)),
          ...names.map((name, index) => [name, values[index]]),
        ]);
      }
    };
    updateData({ comfy: definition.instanceDefaults, promotedWidgets: previousFields });
    for (const node of snapshot.nodes) if (node.data?.comfyType === id) updateData(node.data);
    for (const parent of definitions) for (const node of parent.nodes) if (node.data?.comfyType === id) updateData(node.data);
    if (!changes.size) continue;
    // A promoted control may itself be promoted by a parent. Follow those references up to the root.
    for (const parent of definitions) {
      const instances = new Set(parent.nodes.filter((node) => node.data?.comfyType === id).map((node) => String(node.id)));
      if (!instances.size) continue;
      queue.push({ id: parent.id, rewrite: (pair) => {
        if (!instances.has(pair[0])) return [pair];
        const exact = changes.get(pair[1]);
        const aliases = exact ? [exact] : [...changes.values()].filter((change) => change.from[1] === pair[1]);
        if (!aliases.length) return [pair];
        if (aliases.length !== 1) return refuse();
        return aliases[0].to.map((target) => [pair[0], key(target)]);
      } });
    }
  }
}
