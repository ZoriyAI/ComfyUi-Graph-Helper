import type Database from 'better-sqlite3';
import { readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import type { CatalogView } from '../../shared/catalog/types';
import type { BaseModelFamily, GraphCheckReport } from '../../shared/contracts/knowledge';
import { canvasModelRefs, missingOnGraph, type GraphNodeLike } from '../../shared/graph/compatibility';
import { portsCompatible } from '../../shared/graph/linkTypes';
import { graphCycles } from '../../shared/graph/cycles';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID } from '../../shared/graph/subgraphs';
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
  widgetOrder: string[];
  widgetOrderReliable: boolean;
}

/** Raw catalog rows: readCatalog drops the required flag and some widget metadata this check needs. */
function specIndex(db: Database.Database): Map<string, Spec> {
  const rows = db.prepare('SELECT class_type, inputs_json, outputs_json, widget_order_json FROM node_catalog').all() as Array<{
    class_type: string; inputs_json: string; outputs_json: string; widget_order_json: string;
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
    index.set(row.class_type, { inputs, outputs, widgetOrder, widgetOrderReliable });
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

function typeMismatches(nodes: CanvasNode[], edges: CanvasEdge[], specs: Map<string, Spec>): GraphCheckReport['typeMismatches'] {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  return edges.flatMap((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    const from = sourceType(byId.get(source), edge.sourceHandle, specs);
    const to = targetType(byId.get(target), edge.targetHandle, specs);
    if (!typesClash(from, to)) return [];
    return [{ edgeId: String(edge.id), source, target, sourceType: from, targetType: to }];
  });
}

interface GraphLevel { nodes: CanvasNode[]; edges: CanvasEdge[] }

function graphLevels(snapshot: {
  nodes: unknown[];
  edges: unknown[];
  subgraphs?: Array<{ nodes: unknown[]; edges: unknown[] }>;
}): GraphLevel[] {
  return [
    { nodes: snapshot.nodes as CanvasNode[], edges: snapshot.edges as CanvasEdge[] },
    ...(snapshot.subgraphs ?? []).map((definition) => ({ nodes: definition.nodes as CanvasNode[], edges: definition.edges as CanvasEdge[] })),
  ];
}

function brokenEdges(level: GraphLevel): NonNullable<GraphCheckReport['brokenEdges']> {
  const ids = new Set(level.nodes.map((node) => String(node.id)));
  const boundary = new Set([SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID]);
  return level.edges.flatMap((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if ((ids.has(source) || boundary.has(source)) && (ids.has(target) || boundary.has(target))) return [];
    return [{ edgeId: String(edge.id), source, target }];
  });
}

function cycles(level: GraphLevel): NonNullable<GraphCheckReport['cycles']> {
  return graphCycles(level.nodes.map((node) => String(node.id)), level.edges.map((edge) => ({ source: String(edge.source), target: String(edge.target) })))
    .map((nodeIds) => ({ nodeIds }));
}

function shortValue(value: unknown): string {
  let text = '';
  try {
    text = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value) ?? '';
  } catch {
    text = String(value);
  }
  return text.slice(0, 80);
}

function parametersOf(node: CanvasNode, spec: Spec): Record<string, unknown> {
  const parameters = node.data?.parameters && typeof node.data.parameters === 'object' && !Array.isArray(node.data.parameters)
    ? { ...node.data.parameters } as Record<string, unknown>
    : {};
  const widgets = node.data?.comfy?.widgets_values;
  if (Array.isArray(widgets) && spec.widgetOrderReliable) {
    spec.widgetOrder.forEach((name, index) => {
      if (parameters[name] === undefined) parameters[name] = widgets[index];
    });
  } else if (widgets && typeof widgets === 'object' && !Array.isArray(widgets)) {
    Object.assign(parameters, widgets);
  }
  return parameters;
}

function invalidParameters(level: GraphLevel, specs: Map<string, Spec>): NonNullable<GraphCheckReport['invalidParameters']> {
  const found: NonNullable<GraphCheckReport['invalidParameters']> = [];
  for (const node of level.nodes) {
    const classType = classOf(node);
    const spec = specs.get(classType);
    if (!spec) continue;
    const parameters = parametersOf(node, spec);
    for (const input of spec.inputs) {
      if (!input.widget) continue;
      const value = parameters[input.name];
      if (value === undefined || value === null) continue;
      const constructor = (input.widgetType ?? input.type).toUpperCase();
      const nodeId = String(node.id);
      const add = (reason: 'type' | 'range' | 'choice', expected: string) => {
        found.push({ nodeId, classType, name: input.name, reason, expected, found: shortValue(value) });
      };
      if (constructor === 'INT' && (typeof value !== 'number' || !Number.isInteger(value))) add('type', 'INT');
      else if (constructor === 'FLOAT' && (typeof value !== 'number' || !Number.isFinite(value))) add('type', 'FLOAT');
      else if (constructor === 'BOOLEAN' && typeof value !== 'boolean') add('type', 'BOOLEAN');
      else if (constructor === 'STRING' && typeof value !== 'string') add('type', 'STRING');
      else if (constructor === 'COMBO' && !input.mediaUpload && input.options && input.options.length > 0) {
        if (input.multiSelect) {
          if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !input.options!.includes(item))) add('choice', 'catalog choices');
        } else if (typeof value !== 'string' || !input.options.includes(value)) add('choice', 'catalog choices');
      }
      if ((constructor === 'INT' || constructor === 'FLOAT') && typeof value === 'number' && Number.isFinite(value)) {
        if (input.min !== undefined && value < input.min) add('range', `>= ${input.min}`);
        else if (input.max !== undefined && value > input.max) add('range', `<= ${input.max}`);
      }
    }
  }
  return found;
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
  const missing = missingOnGraph(nodes, catalog, rawDocument(projection.snapshot.document));
  const known = new Set(catalog.nodeTypes);

  const missingNodes = nodes.flatMap((node) => {
    const classType = classOf(node);
    if (!classType || known.has(classType) || isLocal(classType)) return [];
    return [{ nodeId: String(node.id), classType }];
  });
  const missingModels = missing.missingModels.flatMap((model) => {
    const owners = nodes.filter((node) => canvasModelRefs(node, catalog).some((ref) => ref.directory === model.directory && ref.name === model.name));
    if (owners.length === 0) return [{ nodeId: '', directory: model.directory, name: model.name }];
    return owners.map((node) => ({ nodeId: String(node.id), directory: model.directory, name: model.name }));
  });
  const unknownNodeTypes = [...new Set([...missing.missingNodes, ...missingNodes.map((item) => item.classType)])]
    .filter((type) => !isLocal(type))
    .sort();
  const levels = graphLevels(projection.snapshot);
  const report: GraphCheckReport = {
    ok: true,
    missingNodes,
    missingModels,
    typeMismatches: levels.flatMap((level) => typeMismatches(level.nodes, level.edges, specs)),
    baseModelMismatches: levels.flatMap((level) => baseModelMismatches(db, level.nodes, level.edges, catalog)),
    unconnectedRequiredInputs: levels.flatMap((level) => unconnectedInputs(level.nodes, level.edges, specs)),
    unknownNodeTypes,
    unsetWidgets: levels.flatMap((level) => unsetWidgets(level.nodes, level.edges, catalog, ignored)),
    cycles: levels.flatMap(cycles),
    brokenEdges: levels.flatMap(brokenEdges),
    invalidParameters: levels.flatMap((level) => invalidParameters(level, specs)),
    promptNotes: promptNotes(db, nodes, edges, specs, catalog),
  };
  report.ok = report.missingNodes.length === 0 && report.missingModels.length === 0 && report.typeMismatches.length === 0
    && report.baseModelMismatches.length === 0 && report.unconnectedRequiredInputs.length === 0 && report.unknownNodeTypes.length === 0
    && (report.unsetWidgets ?? []).length === 0 && (report.cycles ?? []).length === 0 && (report.brokenEdges ?? []).length === 0
    && (report.invalidParameters ?? []).length === 0;
  return report;
}
