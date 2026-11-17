/** Native V3 edits are one revision: fields, slots and their links move together. */
import { autogrowName, hasDynamicInputs, resolvedNode } from '../../shared/catalog/dynamicInputs';
import type { ResolvedInputs } from '../../shared/catalog/dynamicInputs';
import type { CatalogNode, CatalogView } from '../../shared/catalog/types';
import { portsFromCatalog, type PortDefinition } from '../../shared/graph/ports';
import { portsCompatible } from '../../shared/graph/linkTypes';
import type { GraphSnapshot } from '../../shared/workflow/codec';

type Node = GraphSnapshot['nodes'][number];
type Edge = GraphSnapshot['edges'][number];
type Layout = CatalogNode & ResolvedInputs;
export class DynamicInputError extends Error {}

const ports = (node: Node): PortDefinition[] => node.data?.inputs ?? [];
const read = (node: Node, spec: CatalogNode): Layout => resolvedNode(spec, {
  parameters: node.data?.parameters, widgets: node.data?.comfy?.widgets_values, namedWidgets: node.data?.comfy?.widgets_values_named, inputNames: ports(node).map((port) => port.name),
});

/** Rebuild by native input NAME; slot numbers are only the resulting layout, never the identity of a value. */
function rebuild(node: Node, layout: Layout, edges: Edge[], rename = new Map<string, string>(), previousNames: string[] = layout.nativeWidgetOrder): Edge[] {
  const previous = ports(node);
  const byName = new Map(previous.map((port) => [rename.get(port.name) ?? port.name, port]));
  const dynamicPrefixes = layout.inputs.filter((input) => input.dynamic).map((input) => `${input.name}.`);
  dynamicPrefixes.push(...layout.autogrow.map((group) => `${group.name}.`));
  const declared = portsFromCatalog(layout, layout.portOrder).inputs;
  // Preserve imported socketless static widgets. Native dynamic branches do create new sockets.
  const imported = Array.isArray(node.data?.importedLinks);
  const retained = previous.filter((port) => !declared.some((input) => input.name === port.name) && !dynamicPrefixes.some((prefix) => port.name.startsWith(prefix)));
  const next = declared.filter((port) => !imported || byName.has(port.name) || dynamicPrefixes.some((prefix) => port.name.startsWith(prefix)))
    .concat(retained).map((port, index) => ({ ...port, id: `in-${index}` }));
  const nextByName = new Map(next.map((port) => [port.name, port]));
  const oldSlots: Array<Record<string, unknown>> = Array.isArray(node.data?.comfy?.inputs) ? node.data.comfy.inputs : [];
  const slotByName = new Map(oldSlots.map((slot) => [rename.get(String(slot.name)) ?? String(slot.name), slot]));
  const fields = new Set(layout.inputs.filter((input) => input.widget).map((input) => input.name));
  const nativeInputs = next.map((port, index) => {
    const saved = slotByName.get(port.name);
    const slot: Record<string, unknown> = { ...saved, name: port.name, type: port.dataType, link: null };
    if (saved?.slot_index !== undefined) slot.slot_index = index;
    if (fields.has(port.name)) slot.widget = { ...(saved?.widget && typeof saved.widget === 'object' ? saved.widget : {}), name: port.name };
    return slot;
  });
  const kept = edges.flatMap((edge) => {
    if (String(edge.target) !== String(node.id)) return [edge];
    const oldPort = previous.find((port) => port.id === edge.targetHandle);
    const nextPort = oldPort && nextByName.get(rename.get(oldPort.name) ?? oldPort.name);
    if (!nextPort || !portsCompatible(String(edge.data?.dataType ?? oldPort?.dataType ?? '*'), nextPort.dataType)) return [];
    const index = next.indexOf(nextPort);
    const data = { ...edge.data };
    const link = data.comfyLink;
    if (Array.isArray(link)) { data.comfyLink = [...link]; data.comfyLink[4] = index; }
    else if (link && typeof link === 'object') data.comfyLink = { ...link, target_slot: index };
    nativeInputs[index].link = data.linkId ?? (Array.isArray(link) ? link[0] : link?.id) ?? null;
    return [{ ...edge, targetHandle: nextPort.id, data }];
  });
  const oldNamed = node.data?.comfy?.widgets_values_named;
  const named = oldNamed && typeof oldNamed === 'object' && !Array.isArray(oldNamed) ? { widgets_values_named: Object.fromEntries([...Object.entries(oldNamed).filter(([key]) => !previousNames.includes(key)), ...layout.nativeWidgetOrder.map((name, index) => [name, layout.values[layout.widgetOrder[index]] ?? null])]) } : {};
  node.data = { ...node.data, inputs: next, parameters: { ...layout.values },
    comfy: { ...node.data?.comfy, ...named, inputs: nativeInputs, widgets_values: layout.widgetOrder.map((key) => layout.values[key] ?? null) } };
  return kept;
}

export function setDynamicParameter(snapshot: GraphSnapshot, nodeId: string, key: string, value: unknown, catalog: CatalogView, widgetIndex?: number): GraphSnapshot | undefined {
  const original = snapshot.nodes.find((node) => String(node.id) === nodeId);
  const spec = catalog.nodes.find((item) => item.classType === original?.data?.comfyType);
  if (!original || !spec || !hasDynamicInputs(spec)) return undefined;
  const before = read(original, spec);
  const index = before.widgetOrder.indexOf(key);
  if (!before.widgetOrderReliable || index < 0 || (widgetIndex !== undefined && widgetIndex !== index)) throw new DynamicInputError('Dynamic input values do not match the installed node definition. Synchronize its catalog before editing.');
  const input = before.inputs.find((item) => item.name === key);
  const definition = input?.dynamic;
  if (definition?.kind === 'combo' && !definition.options.some((option) => option.key === value)) throw new DynamicInputError('That dynamic mode is not in the node definition.');
  if (definition?.kind === 'group' && (typeof value !== 'number' || !Number.isInteger(value) || value < definition.min || value > definition.max)) throw new DynamicInputError('The number of rows is outside the node limits.');
  const parameters: Record<string, unknown> = Object.assign(Object.create(null), before.values, { [key]: value });
  const branches: Record<string, Record<string, Record<string, unknown>>> = Object.assign(Object.create(null), structuredClone(original.data?.dynamicBranches ?? {}));
  if (definition?.kind === 'combo' && value !== before.values[key]) {
    const previous = String(before.values[key]);
    const oldValues = Object.fromEntries(Object.entries(parameters).filter(([name]) => name.startsWith(`${key}.`)));
    branches[key] = Object.fromEntries([...Object.entries(Object.hasOwn(branches, key) ? branches[key] : {}), [previous, oldValues]]);
    for (const name of Object.keys(oldValues)) delete parameters[name];
    Object.assign(parameters, branches[key][String(value)] ?? {});
  }
  const layout = resolvedNode(spec, { parameters, inputNames: ports(original).map((port) => port.name) });
  if (!layout.widgetOrderReliable) throw new DynamicInputError('This dynamic branch contains a frontend widget whose saved layout is not supported.');
  const node = { ...original, data: { ...original.data, dynamicBranches: branches } };
  const edges = rebuild(node, layout, snapshot.edges, new Map(), before.nativeWidgetOrder);
  return { ...snapshot, nodes: snapshot.nodes.map((item) => item === original ? node : item), edges };
}

/** Only nodes whose connections changed are normalized; merely opening/saving an imported graph is lossless. */
export function reconcileDynamicConnections(before: GraphSnapshot, after: GraphSnapshot, catalog: CatalogView): GraphSnapshot {
  const oldEdges = new Map(before.edges.map((edge) => [String(edge.id), edge]));
  const newEdges = new Map(after.edges.map((edge) => [String(edge.id), edge]));
  const touched = new Set<string>();
  for (const id of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
    const old = oldEdges.get(id); const next = newEdges.get(id);
    if (old?.source === next?.source && old?.target === next?.target && old?.sourceHandle === next?.sourceHandle && old?.targetHandle === next?.targetHandle) continue;
    for (const edge of [old, next]) if (edge) { touched.add(String(edge.source)); touched.add(String(edge.target)); }
  }
  if (!touched.size) return after;
  const nodes: Node[] = after.nodes.map((node) => ({ ...node, data: { ...node.data } }));
  let edges: Edge[] = after.edges.map((edge) => ({ ...edge, data: { ...edge.data } }));
  for (const node of nodes) {
    if (!touched.has(String(node.id))) continue;
    const spec = catalog.nodes.find((item) => item.classType === node.data?.comfyType);
    if (!spec || !hasDynamicInputs(spec)) continue;
    const layout = read(node, spec);
    if (!layout.widgetOrderReliable) continue;
    const rename = new Map<string, string>();
    const counts: Record<string, number> = Object.create(null);
    for (const group of layout.autogrow) {
      const connected = new Set(edges.filter((edge) => String(edge.target) === String(node.id)).map((edge) => ports(node).find((port) => port.id === edge.targetHandle)?.name));
      const disconnected = before.edges.some((edge) => String(edge.target) === String(node.id) && group.names.includes(ports(node).find((port) => port.id === edge.targetHandle)?.name ?? '') && !after.edges.some((next) => next.id === edge.id && next.target === edge.target && next.targetHandle === edge.targetHandle));
      if (!disconnected) {
        const last = group.names.reduce((last, name, index) => connected.has(name) ? index : last, -1);
        counts[group.name] = Math.min(group.definition.max, Math.max(group.names.length, last + 2));
        continue;
      }
      const protectedCount = Math.max(0, group.definition.min - 1);
      let ordinal = protectedCount;
      group.names.forEach((name, index) => {
        if (index < protectedCount || !connected.has(name)) return;
        rename.set(name, autogrowName(group.name, group.definition, ordinal++));
      });
      counts[group.name] = Math.min(group.definition.max, Math.max(group.definition.min + 1, ordinal + 1));
    }
    if (layout.autogrow.length) {
      const resolved = resolvedNode(spec, { parameters: layout.values, autogrowCounts: counts });
      edges = rebuild(node, resolved, edges, rename);
    }
  }
  resolveMatchTypes(nodes, edges, catalog, touched);
  return { ...after, nodes, edges };
}

/** Intersection, rather than 'first connection wins', for multi-type native MatchType templates. */
function commonType(types: string[]): string | undefined {
  const concrete = types.filter((type) => type && type !== '*' && type !== 'unknown');
  if (!concrete.length) return '*';
  let values = concrete[0].split(',');
  for (const type of concrete.slice(1)) values = values.filter((value) => type.split(',').some((item) => item.toLowerCase() === value.toLowerCase()));
  return values.length ? values.join(',') : undefined;
}

function resolveMatchTypes(nodes: Node[], edges: Edge[], catalog: CatalogView, touched: Set<string>): void {
  const queue = [...touched];
  for (let index = 0; index < queue.length; index++) {
    for (const edge of edges) if (String(edge.source) === queue[index] && !touched.has(String(edge.target))) {
      touched.add(String(edge.target)); queue.push(String(edge.target));
    }
  }
  const active = nodes.filter((node) => touched.has(String(node.id)));
  for (const node of active) {
    const spec = catalog.nodes.find((item) => item.classType === node.data?.comfyType);
    if (!spec?.outputs.some((output) => output.matchType)) continue;
    node.data.outputs = (node.data.outputs as PortDefinition[]).map((port, index) => spec.outputs[index]?.matchType ? { ...port, dataType: '*' } : port);
  }
  // Node count bounds propagation through a DAG, including a chain of MatchType outputs.
  for (let pass = 0; pass < active.length; pass++) {
    let changed = false;
    for (const node of active) {
      const spec = catalog.nodes.find((item) => item.classType === node.data?.comfyType);
      if (!spec || !hasDynamicInputs(spec)) continue;
      const layout = read(node, spec);
      const groups = new Set(layout.inputs.flatMap((input) => input.matchType ? [input.matchType] : []));
      for (const group of groups) {
        const members = layout.inputs.filter((input) => input.matchType === group);
        const sources = new Map<string, string>();
        for (const input of members) {
          const port = ports(node).find((port) => port.name === input.name);
          const edge = edges.find((item) => String(item.target) === String(node.id) && item.targetHandle === port?.id);
          if (!edge) continue;
          const origin = nodes.find((item) => String(item.id) === String(edge.source));
          const output = (origin?.data?.outputs as PortDefinition[] | undefined)?.find((port) => port.id === edge.sourceHandle);
          const type = output?.dataType ?? edge.data?.dataType;
          if (typeof type === 'string') sources.set(input.name, type);
        }
        for (const input of members) {
          const ownType = sources.get(input.name);
          const type = commonType([input.type, ...[...sources].filter(([name]) => name !== input.name).map(([, type]) => type)]);
          if (!type || (ownType && !portsCompatible(ownType, type))) throw new DynamicInputError('Connected inputs do not agree on the native MatchType.');
          node.data.inputs = ports(node).map((port) => {
            if (port.name !== input.name || port.dataType === type) return port;
            changed = true; return { ...port, dataType: type, matchType: group };
          });
        }
        const outputType = commonType([...sources.values()]);
        if (!outputType) throw new DynamicInputError('Connected inputs do not agree on the native MatchType.');
        node.data.outputs = (node.data.outputs as PortDefinition[]).map((port, index) => {
          if (spec.outputs[index]?.matchType !== group || port.dataType === outputType) return port;
          changed = true; return { ...port, dataType: outputType, matchType: group };
        });
      }
    }
    if (!changed) break;
  }
  for (const node of active) {
    const spec = catalog.nodes.find((item) => item.classType === node.data?.comfyType);
    if (!spec?.outputs.some((output) => output.matchType)) continue;
    const inputs = ports(node); const outputs = node.data.outputs as PortDefinition[];
    const comfy = { ...node.data.comfy };
    if (Array.isArray(comfy.inputs)) comfy.inputs = comfy.inputs.map((slot: Record<string, unknown>, index: number) => ({ ...slot, type: inputs[index]?.dataType ?? slot.type }));
    if (Array.isArray(comfy.outputs)) comfy.outputs = comfy.outputs.map((slot: Record<string, unknown>, index: number) => ({ ...slot, type: outputs[index]?.dataType ?? slot.type }));
    node.data = { ...node.data, comfy };
    for (const edge of edges.filter((edge) => String(edge.source) === String(node.id))) {
      const type = outputs.find((port) => port.id === edge.sourceHandle)?.dataType ?? '*';
      const target = nodes.find((item) => String(item.id) === String(edge.target));
      const input = target && ports(target).find((port) => port.id === edge.targetHandle);
      if (input && !portsCompatible(type, input.dataType)) throw new DynamicInputError('The resolved output type does not fit an existing connection.');
      const link = edge.data?.comfyLink;
      const native = Array.isArray(link) ? [...link.slice(0, 5), type, ...link.slice(6)] : link && typeof link === 'object' ? { ...link, type } : link;
      edge.data = { ...edge.data, dataType: type, comfyLink: native };
    }
  }
}
