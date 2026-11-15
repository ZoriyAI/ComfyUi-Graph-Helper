import type Database from 'better-sqlite3';
import { readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import type { CatalogView } from '../../shared/catalog/types';
import type { BaseModelFamily, GraphCheckReport } from '../../shared/contracts/knowledge';
import { canvasModelRefs, missingOnGraph, type GraphNodeLike } from '../../shared/graph/compatibility';
import { portsCompatible } from '../../shared/graph/linkTypes';
import { graphCycles } from '../../shared/graph/cycles';
import { nodeRunMode } from '../../shared/graph/layout';
import { endpointPort, validEdgeEndpoints } from '../../shared/graph/structure';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID, type SubgraphDefinition } from '../../shared/graph/subgraphs';
import { familiesCompatible } from '../../shared/knowledge/baseModel';
import { documentDefinitionIds, documentGroupNodeNames, exportedWidgets, isLocalNodeType, numericSlot } from '../../shared/workflow/codec';
import { catalogFileIndex, loadedModelFiles } from './loadedModels';
import { promptNotes } from './promptCheck';

/**
 * Frontend-only node types. They never appear in object_info because the ComfyUI frontend implements them,
 * so reporting them as missing would send a person looking for a pack that does not exist.
 */
const FRONTEND_NODE_TYPES = new Set(['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode']);

/** Core link types. A COMBO socket is only a mismatch against these; custom packs feed combos with their own list types. */
const CORE_TYPES = new Set([
  'MODEL', 'CLIP', 'VAE', 'CONDITIONING', 'LATENT', 'IMAGE', 'MASK', 'CONTROL_NET', 'CLIP_VISION', 'CLIP_VISION_OUTPUT',
  'STYLE_MODEL', 'UPSCALE_MODEL', 'GLIGEN', 'NOISE', 'GUIDER', 'SAMPLER', 'SIGMAS', 'AUDIO', 'VIDEO',
  'INT', 'FLOAT', 'BOOLEAN', 'STRING',
]);

const BASE_DIRECTORIES = new Set(['checkpoints', 'diffusion_models', 'unet']);

interface Port { id?: unknown; name?: unknown; dataType?: unknown }
interface CanvasNode extends GraphNodeLike {
  id?: unknown;
  data?: GraphNodeLike['data'] & { inputs?: unknown; outputs?: unknown };
}
interface CanvasEdge { id?: unknown; source?: unknown; target?: unknown; sourceHandle?: unknown; targetHandle?: unknown; data?: { dataType?: unknown } }

interface SpecInput {
  name: string;
  type: string;
  widget: boolean;
  required: boolean | undefined;
  widgetType?: string;
  options?: string[];
  min?: number;
  max?: number;
  multiSelect?: boolean;
  mediaUpload?: boolean;
}
interface Spec {
  inputs: SpecInput[];
  outputs: Array<{ name: string; type: string }>;
  outputNode: boolean;
  detailed: boolean;
  widgetOrder: string[];
  widgetOrderReliable: boolean;
}

/** Raw catalog rows: readCatalog drops the required flag and some widget metadata this check needs. */
function specIndex(db: Database.Database): Map<string, Spec> {
  const rows = db.prepare('SELECT class_type, inputs_json, outputs_json, widget_order_json, output_node FROM node_catalog').all() as Array<{
    class_type: string; inputs_json: string; outputs_json: string; widget_order_json: string; output_node: number | null;
  }>;
  const index = new Map<string, Spec>();
  for (const row of rows) {
    const inputs = arrayOf(row.inputs_json).flatMap((item): SpecInput[] => {
      if (typeof item?.name !== 'string' || typeof item?.type !== 'string') return [];
      return [{
        name: item.name,
        type: item.type,
        widget: item.widget === true,
        required: typeof item.required === 'boolean' ? item.required : undefined,
        ...(typeof item.widgetType === 'string' ? { widgetType: item.widgetType } : {}),
        ...(Array.isArray(item.options) ? { options: item.options.filter((option): option is string => typeof option === 'string') } : {}),
        ...(typeof item.min === 'number' && Number.isFinite(item.min) ? { min: item.min } : {}),
        ...(typeof item.max === 'number' && Number.isFinite(item.max) ? { max: item.max } : {}),
        ...(item.multiSelect === true ? { multiSelect: true } : {}),
        ...(item.mediaUpload === true ? { mediaUpload: true } : {}),
      }];
    });
    const outputs = arrayOf(row.outputs_json).flatMap((item) => (
      typeof item?.name === 'string' && typeof item?.type === 'string' ? [{ name: item.name, type: item.type }] : []
    ));
    let widgetOrder: string[] = [];
    let widgetOrderReliable = true;
    try {
      const parsed = JSON.parse(row.widget_order_json) as unknown;
      if (Array.isArray(parsed)) widgetOrder = parsed.filter((item): item is string => typeof item === 'string');
      else if (parsed && typeof parsed === 'object' && (parsed as { reliable?: unknown }).reliable === false) widgetOrderReliable = false;
    } catch {
      // An older row has no reliable widget order to validate against.
    }
    index.set(row.class_type, { inputs, outputs, widgetOrder, widgetOrderReliable, outputNode: row.output_node === 1, detailed: inputs.length > 0 || outputs.length > 0 });
  }
  return index;
}

function arrayOf(text: string): Array<Record<string, unknown> | null> {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.map((item) => (item && typeof item === 'object' ? item as Record<string, unknown> : null)) : [];
  } catch {
    return [];
  }
}

function classOf(node: CanvasNode): string {
  const type = node.data?.comfyType;
  return typeof type === 'string' ? type : '';
}

function ports(node: CanvasNode | undefined, kind: 'inputs' | 'outputs'): Port[] {
  const list = node?.data?.[kind];
  return Array.isArray(list) ? (list as Port[]) : [];
}

function portName(node: CanvasNode | undefined, kind: 'inputs' | 'outputs', handle: unknown): string | null {
  const port = ports(node, kind).find((item) => item.id === handle);
  return port && typeof port.name === 'string' ? port.name : null;
}

function portType(node: CanvasNode | undefined, kind: 'inputs' | 'outputs', handle: unknown): string {
  const port = ports(node, kind).find((item) => item.id === handle);
  return port && typeof port.dataType === 'string' ? port.dataType : '';
}

/** Catalog output type by slot; the canvas port type only when the catalog has no detail. */
function sourceType(node: CanvasNode | undefined, handle: unknown, specs: Map<string, Spec>): string {
  const spec = node ? specs.get(classOf(node)) : undefined;
  const slot = numericSlot(handle);
  if (spec && spec.outputs.length > 0 && slot !== null && spec.outputs[slot]) return spec.outputs[slot].type;
  return portType(node, 'outputs', handle);
}

function targetType(node: CanvasNode | undefined, handle: unknown, specs: Map<string, Spec>): string {
  const spec = node ? specs.get(classOf(node)) : undefined;
  const name = portName(node, 'inputs', handle);
  const input = name ? spec?.inputs.find((item) => item.name === name) : undefined;
  return input ? input.type : portType(node, 'inputs', handle);
}

function isUnknownType(type: string): boolean {
  return type === '' || type === '*' || type.toLowerCase() === 'unknown';
}

/** Wildcards and unknown types never count; COMBO only clashes with a core type. */
function typesClash(source: string, target: string): boolean {
  if (isUnknownType(source) || isUnknownType(target)) return false;
  const a = source.toUpperCase();
  const b = target.toUpperCase();
  if (a === 'COMBO' || b === 'COMBO') {
    const other = a === 'COMBO' ? b : a;
    return other !== 'COMBO' && CORE_TYPES.has(other);
  }
  return !portsCompatible(source, target);
}

function subgraphIds(document: unknown): Set<string> {
  const raw = document && typeof document === 'object' ? (document as { raw?: unknown }).raw : undefined;
  const definitions = raw && typeof raw === 'object' ? (raw as { definitions?: { subgraphs?: unknown } }).definitions : undefined;
  const list = Array.isArray(definitions?.subgraphs) ? definitions.subgraphs : [];
  return new Set(list.flatMap((item) => (item && typeof (item as { id?: unknown }).id === 'string' ? [(item as { id: string }).id] : [])));
}

function rawDocument(document: unknown): unknown {
  if (!document || typeof document !== 'object') return null;
  return (document as { raw?: unknown }).raw ?? null;
}

function familyOf(db: Database.Database, directory: string, name: string): BaseModelFamily {
  const row = db.prepare('SELECT base_model FROM model_catalog WHERE directory = ? AND name = ?').get(directory, name) as { base_model: string } | undefined;
  return (row?.base_model as BaseModelFamily | undefined) ?? 'unknown';
}

/** Every node reachable by walking edges backwards from start (its inputs, their inputs, and so on). */
function upstreamOf(start: string, edges: CanvasEdge[]): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (String(edge.target) !== current) continue;
      const source = String(edge.source);
      if (seen.has(source) || source === start) continue;
      seen.add(source);
      queue.push(source);
    }
  }
  return seen;
}

function baseModelMismatches(db: Database.Database, nodes: CanvasNode[], edges: CanvasEdge[], catalog: CatalogView): GraphCheckReport['baseModelMismatches'] {
  // Any loader counts, custom packs included (loadedModels.ts): a field holding a catalog file loads that file.
  const files = catalogFileIndex(catalog);
  const loaded = new Map(nodes.map((node) => [String(node.id), loadedModelFiles(node, catalog, files)]));
  const found: GraphCheckReport['baseModelMismatches'] = [];
  for (const node of nodes) {
    const nodeId = String(node.id);
    const loras = (loaded.get(nodeId) ?? []).filter((ref) => ref.directory === 'loras');
    if (loras.length === 0) continue;
    // A base loader feeds the LoRA node (core chain: checkpoint → LoRA) or is fed by it (wrapper packs:
    // LoRA select → model loader); either way the LoRA ends up on that base model.
    const related = new Set([...upstreamOf(nodeId, edges), ...downstreamOf(nodeId, edges)]);
    const bases = [...related].flatMap((id) => (loaded.get(id) ?? [])
      .filter((ref) => BASE_DIRECTORIES.has(ref.directory))
      .map((ref) => ({ id, ref })));
    for (const lora of loras) {
      const loraBase = familyOf(db, lora.directory, lora.name);
      for (const base of bases) {
        const otherBase = familyOf(db, base.ref.directory, base.ref.name);
        if (familiesCompatible(loraBase, otherBase, { left: lora.name, right: base.ref.name })) continue;
        // One file name in two base folders (checkpoints and diffusion_models) is one finding, not two.
        if (found.some((item) => item.nodeId === nodeId && item.model === lora.name && item.otherNodeId === base.id && item.otherModel === base.ref.name)) continue;
        found.push({ nodeId, model: lora.name, modelBase: loraBase, otherNodeId: base.id, otherModel: base.ref.name, otherBase });
      }
    }
  }
  return found;
}

/** Every node reachable by walking edges forwards from start (what it feeds, and what that feeds). */
function downstreamOf(start: string, edges: CanvasEdge[]): Set<string> {
  return upstreamOf(start, edges.map((edge) => ({ ...edge, source: edge.target, target: edge.source })));
}

function unconnectedInputs(nodes: CanvasNode[], edges: CanvasEdge[], specs: Map<string, Spec>): GraphCheckReport['unconnectedRequiredInputs'] {
  const found: GraphCheckReport['unconnectedRequiredInputs'] = [];
  for (const node of nodes) {
    const spec = specs.get(classOf(node));
    if (!spec) continue;
    const incoming = edges.filter((edge) => String(edge.target) === String(node.id));
    const connected = new Set(incoming.map((edge) => portName(node, 'inputs', edge.targetHandle)).filter((name): name is string => name !== null));
    // Rows stored before the required flag existed are skipped: a false alarm teaches the wrong thing.
    for (const input of spec.inputs) {
      if (input.widget || input.required !== true || connected.has(input.name)) continue;
      found.push({ nodeId: String(node.id), input: input.name, type: input.type });
    }
  }
  return found;
}

/**
 * Widgets export would leave null: no value on the node and no default in the catalog. A widget fed by a link
 * takes its value from the socket, so it is not reported.
 */
function unsetWidgets(nodes: CanvasNode[], edges: CanvasEdge[], catalog: CatalogView, ignored: Set<string>): NonNullable<GraphCheckReport['unsetWidgets']> {
  const found: NonNullable<GraphCheckReport['unsetWidgets']> = [];
  for (const node of nodes) {
    const classType = classOf(node);
    if (!classType || ignored.has(classType)) continue;
    const placed = exportedWidgets(node as Record<string, any>, catalog);
    if (!placed.ok || placed.unset.length === 0) continue;
    const linked = new Set(edges
      .filter((edge) => String(edge.target) === String(node.id))
      .map((edge) => portName(node, 'inputs', edge.targetHandle))
      .filter((name): name is string => name !== null));
    for (const slot of placed.unset) {
      if (linked.has(slot.split('::')[0])) continue;
      found.push({ nodeId: String(node.id), classType, name: slot });
    }
  }
  return found;
}

function typeMismatches(nodes: CanvasNode[], edges: CanvasEdge[], specs: Map<string, Spec>, definition?: SubgraphDefinition): GraphCheckReport['typeMismatches'] {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  return edges.flatMap((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    const from = sourceType(byId.get(source), edge.sourceHandle, specs) || String(endpointPort(nodes, source, 'outputs', edge.sourceHandle, definition)?.dataType ?? '');
    const to = targetType(byId.get(target), edge.targetHandle, specs) || String(endpointPort(nodes, target, 'inputs', edge.targetHandle, definition)?.dataType ?? '');
    if (!typesClash(from, to)) return [];
    return [{ edgeId: String(edge.id), source, target, sourceType: from, targetType: to }];
  });
}

interface GraphLevel { nodes: CanvasNode[]; edges: CanvasEdge[]; subgraphId?: string; definition?: SubgraphDefinition }
function graphLevels(snapshot: { nodes: unknown[]; edges: unknown[]; subgraphs?: SubgraphDefinition[] }): GraphLevel[] {
  return [
    { nodes: snapshot.nodes as CanvasNode[], edges: snapshot.edges as CanvasEdge[] },
    ...(snapshot.subgraphs ?? []).filter((definition) => !definition.opaque).map((definition) => ({ nodes: definition.nodes as CanvasNode[], edges: definition.edges as CanvasEdge[], subgraphId: definition.id, definition })),
  ];
}
function scoped<T extends object>(level: GraphLevel, findings: T[]): Array<T & { subgraphId?: string }> {
  return findings.map((item) => level.subgraphId ? { ...item, subgraphId: level.subgraphId } : item);
}
function brokenEdges(level: GraphLevel): NonNullable<GraphCheckReport['brokenEdges']> {
  return level.edges.flatMap((edge) => validEdgeEndpoints(level.nodes, edge, level.definition) ? [] : [{ edgeId: String(edge.id), source: String(edge.source), target: String(edge.target) }]);
}
function cycles(level: GraphLevel): NonNullable<GraphCheckReport['cycles']> {
  return graphCycles(level.nodes.map((node) => String(node.id)), level.edges.map((edge) => ({ source: String(edge.source), target: String(edge.target) })))
    .map((nodeIds) => ({ nodeIds }));
}

/** Names of the node's inputs that a link feeds: their value comes from the socket, not from the field. */
function linkedInputs(node: CanvasNode, edges: CanvasEdge[]): Set<string> {
  return new Set(edges
    .filter((edge) => String(edge.target) === String(node.id))
    .map((edge) => portName(node, 'inputs', edge.targetHandle))
    .filter((name): name is string => name !== null));
}

function parametersOf(node: CanvasNode): Record<string, unknown> {
  const parameters = (node.data as { parameters?: unknown } | undefined)?.parameters;
  return parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters as Record<string, unknown> : {};
}

/**
 * The value a field holds, read as the canvas reads it (renderer fields/fieldModel.ts fieldValue): the parameters a
 * command set, else the stored widgets_values of an imported node by the catalog widget order. Undefined: not read.
 */
function fieldValueOf(node: CanvasNode, name: string, spec: CatalogView['nodes'][number]): unknown {
  const parameters = parametersOf(node);
  if (Object.prototype.hasOwnProperty.call(parameters, name) && parameters[name] !== null && parameters[name] !== undefined) return parameters[name];
  const comfy = (node.data as { comfy?: { widgets_values?: unknown } } | undefined)?.comfy;
  const widgets = comfy?.widgets_values;
  if (Array.isArray(widgets)) {
    if (spec.widgetOrderReliable === false) return undefined;
    const index = spec.widgetOrder.indexOf(name);
    return index >= 0 && index < widgets.length ? widgets[index] : undefined;
  }
  if (widgets && typeof widgets === 'object') return (widgets as Record<string, unknown>)[name];
  return undefined;
}

function slashes(text: string): string {
  return text.replace(/\\/g, '/');
}

/**
 * Number fields outside the catalog range and list fields holding a value the list does not have. Only classes
 * the catalog describes are read; a field a link feeds, a list of model files (missingModels says that), an upload
 * list (the person may upload the file in ComfyUI) and a multi-choice list are left alone.
 */
function fieldValues(nodes: CanvasNode[], edges: CanvasEdge[], catalog: CatalogView): {
  valuesOutOfRange: NonNullable<GraphCheckReport['valuesOutOfRange']>;
  valuesNotInList: NonNullable<GraphCheckReport['valuesNotInList']>;
  invalidParameters: NonNullable<GraphCheckReport['invalidParameters']>;
} {
  const byClass = new Map(catalog.nodes.map((node) => [node.classType, node]));
  const modelNames = new Set(catalog.models.map((model) => slashes(model.name)));
  const valuesOutOfRange: NonNullable<GraphCheckReport['valuesOutOfRange']> = [];
  const valuesNotInList: NonNullable<GraphCheckReport['valuesNotInList']> = [];
  const invalidParameters: NonNullable<GraphCheckReport['invalidParameters']> = [];
  for (const node of nodes) {
    const classType = classOf(node);
    const spec = byClass.get(classType);
    if (!spec || spec.inputs.length === 0) continue;
    const linked = linkedInputs(node, edges);
    for (const input of spec.inputs) {
      if (!input.widget || linked.has(input.name)) continue;
      const value = fieldValueOf(node, input.name, spec);
      if (value === undefined || value === null) continue;
      const kind = (input.widgetType ?? input.type).toUpperCase();
      if ((kind === 'INT' && (typeof value !== 'number' || !Number.isInteger(value)))
        || (kind === 'FLOAT' && (typeof value !== 'number' || !Number.isFinite(value)))
        || (kind === 'BOOLEAN' && typeof value !== 'boolean') || (kind === 'STRING' && typeof value !== 'string')) {
        invalidParameters.push({ nodeId: String(node.id), classType, name: input.name, reason: 'type', expected: kind, found: String(value).slice(0, 80) });
        continue;
      }
      if ((kind === 'INT' || kind === 'FLOAT') && typeof value === 'number' && Number.isFinite(value)) {
        const below = input.min !== undefined && value < input.min;
        const above = input.max !== undefined && value > input.max;
        if (below || above) {
          valuesOutOfRange.push({
            nodeId: String(node.id), classType, input: input.name, value,
            ...(input.min !== undefined ? { min: input.min } : {}),
            ...(input.max !== undefined ? { max: input.max } : {}),
          });
        }
        continue;
      }
      const options = input.options ?? [];
      if (options.length === 0 || typeof value !== 'string' || value === '' || input.multiSelect) continue;
      if (spec.widgetOrder.includes(`${input.name}::media_upload`)) continue;
      const listed = new Set(options.map(slashes));
      if (listed.has(slashes(value))) continue;
      if (modelNames.has(slashes(value)) || options.some((option) => modelNames.has(slashes(option)))) continue;
      valuesNotInList.push({ nodeId: String(node.id), classType, input: input.name, value });
    }
  }
  return { valuesOutOfRange, valuesNotInList, invalidParameters };
}

/** Only instantiated definitions contribute to the executable graph's output nodes. */
function definitionClasses(document: unknown, nodes: CanvasNode[]): string[] {
  const raw = rawDocument(document) as { definitions?: { subgraphs?: Array<{ id: string; nodes?: Array<{ type?: string }> }> } } | null;
  const definitions = new Map((raw?.definitions?.subgraphs ?? []).map((item) => [item.id, item]));
  const seen = new Set<string>();
  const classes: string[] = [];
  const visit = (type: string) => {
    if (seen.has(type)) return;
    seen.add(type);
    for (const node of definitions.get(type)?.nodes ?? []) {
      if (typeof node.type !== 'string') continue;
      classes.push(node.type);
      visit(node.type);
    }
  };
  nodes.forEach((node) => visit(classOf(node)));
  return classes;
}

/**
 * A graph with no node that saves or shows a result. Said only when the catalog knows every class in the graph
 * (an unknown class may well be an output node) and knows output nodes at all. Points at the end of the chain.
 */
function noOutputNode(nodes: CanvasNode[], edges: CanvasEdge[], specs: Map<string, Spec>, document: unknown): GraphCheckReport['noOutputNode'] {
  if (nodes.length === 0) return null;
  if (![...specs.values()].some((spec) => spec.outputNode)) return null;
  const subgraphs = subgraphIds(document);
  const classes = [...nodes.map(classOf).filter((type) => !subgraphs.has(type)), ...definitionClasses(document, nodes)]
    .filter((type) => type !== '' && !FRONTEND_NODE_TYPES.has(type) && !subgraphs.has(type));
  if (classes.length === 0) return null;
  for (const type of classes) {
    const spec = specs.get(type);
    if (!spec || !spec.detailed || spec.outputNode) return null;
  }
  const feeding = new Set(edges.map((edge) => String(edge.source)));
  const ends = nodes.filter((node) => !FRONTEND_NODE_TYPES.has(classOf(node)) && !feeding.has(String(node.id)) && ports(node, 'outputs').length > 0);
  // The end most of the graph flows into, so "Show" lands where the output node belongs.
  const best = ends
    .map((node) => ({ node, depth: upstreamOf(String(node.id), edges).size }))
    .sort((a, b) => b.depth - a.depth)[0]?.node ?? nodes[nodes.length - 1];
  return { nodeId: String(best.id) };
}

/**
 * Checks the current projection of a project against the local catalog. Reads only SQLite; never contacts
 * ComfyUI and never queues anything.
 */
export function checkGraph(db: Database.Database, projectId: string): GraphCheckReport {
  const projection = readProjection(db, projectId);
  if (!projection) throw new Error('Project was not found.');
  const nodes = (Array.isArray(projection.snapshot.nodes) ? projection.snapshot.nodes : []) as CanvasNode[];
  const edges = (Array.isArray(projection.snapshot.edges) ? projection.snapshot.edges : []) as CanvasEdge[];
  const catalog = readCatalog(db);
  const specs = specIndex(db);
  const ignored = new Set([...FRONTEND_NODE_TYPES, ...subgraphIds(projection.snapshot.document)]);
  const raw = rawDocument(projection.snapshot.document);
  const definitionIds = documentDefinitionIds(raw);
  const localContext = { groupNodes: documentGroupNodeNames(raw), catalog };
  const isLocal = (type: string) => ignored.has(type) || isLocalNodeType(type, definitionIds, localContext);
  const levels = graphLevels(projection.snapshot);
  const missing = missingOnGraph(nodes, catalog, rawDocument(projection.snapshot.document));
  const known = new Set(catalog.nodeTypes);

  const missingNodes = levels.flatMap((level) => scoped(level, level.nodes.flatMap((node) => {
    const classType = classOf(node);
    if (!classType || known.has(classType) || isLocal(classType)) return [];
    return [{ nodeId: String(node.id), classType }];
  })));
  // Bypassed and muted nodes do not run in ComfyUI: their empty inputs, fields and model files cannot stop a run.
  const runs = (list: CanvasNode[]) => list.filter((node) => nodeRunMode(node.data as { comfy?: unknown } | undefined) === null);
  const missingModels = levels.flatMap((level) => scoped(level, missingOnGraph(runs(level.nodes), catalog, null).missingModels.flatMap((model) => {
    const owners = runs(level.nodes).filter((node) => canvasModelRefs(node, catalog).some((ref) => ref.directory === model.directory && ref.name === model.name));
    return owners.map((node) => ({ nodeId: String(node.id), directory: model.directory, name: model.name }));
  })));
  const unknownNodeTypes = [...new Set([...missing.missingNodes, ...missingNodes.map((item) => item.classType)])]
    .filter((type) => !isLocal(type))
    .sort();
  const fields = levels.map((level) => ({ level, values: fieldValues(runs(level.nodes), level.edges, catalog) }));
  const report: GraphCheckReport = {
    ok: true,
    missingNodes,
    missingModels,
    typeMismatches: levels.flatMap((level) => scoped(level, typeMismatches(level.nodes, level.edges, specs, level.definition))),
    baseModelMismatches: levels.flatMap((level) => scoped(level, baseModelMismatches(db, level.nodes, level.edges, catalog))),
    unconnectedRequiredInputs: levels.flatMap((level) => scoped(level, unconnectedInputs(runs(level.nodes), level.edges, specs))),
    unknownNodeTypes,
    unsetWidgets: levels.flatMap((level) => scoped(level, unsetWidgets(runs(level.nodes), level.edges, catalog, ignored))),
    cycles: levels.flatMap((level) => scoped(level, cycles(level))),
    brokenEdges: levels.flatMap((level) => scoped(level, brokenEdges(level))),
    invalidParameters: fields.flatMap(({ level, values }) => scoped(level, values.invalidParameters)),
    promptNotes: promptNotes(db, nodes, edges, specs, catalog),
    noOutputNode: noOutputNode(nodes, edges, specs, projection.snapshot.document),
    valuesOutOfRange: fields.flatMap(({ level, values }) => scoped(level, values.valuesOutOfRange)),
    valuesNotInList: fields.flatMap(({ level, values }) => scoped(level, values.valuesNotInList)),
  };
  report.ok = report.missingNodes.length === 0 && report.missingModels.length === 0 && report.typeMismatches.length === 0
    && report.baseModelMismatches.length === 0 && report.unconnectedRequiredInputs.length === 0 && report.unknownNodeTypes.length === 0
    && (report.unsetWidgets ?? []).length === 0 && !report.noOutputNode && (report.valuesOutOfRange ?? []).length === 0
    && (report.valuesNotInList ?? []).length === 0 && (report.cycles ?? []).length === 0 && (report.brokenEdges ?? []).length === 0 && (report.invalidParameters ?? []).length === 0;
  return report;
}
