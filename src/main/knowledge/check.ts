import type Database from 'better-sqlite3';
import { readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import type { CatalogView } from '../../shared/catalog/types';
import type { BaseModelFamily, GraphCheckReport } from '../../shared/contracts/knowledge';
import { canvasModelRefs, missingOnGraph, type GraphNodeLike } from '../../shared/graph/compatibility';
import { portsCompatible } from '../../shared/graph/linkTypes';
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

interface SpecInput { name: string; type: string; widget: boolean; required: boolean | undefined }
interface Spec { inputs: SpecInput[]; outputs: Array<{ name: string; type: string }> }

/** Raw catalog rows: readCatalog drops the required flag, which this check needs. */
function specIndex(db: Database.Database): Map<string, Spec> {
  const rows = db.prepare('SELECT class_type, inputs_json, outputs_json FROM node_catalog').all() as Array<{
    class_type: string; inputs_json: string; outputs_json: string;
  }>;
  const index = new Map<string, Spec>();
  for (const row of rows) {
    const inputs = arrayOf(row.inputs_json).flatMap((item): SpecInput[] => {
      if (typeof item?.name !== 'string' || typeof item?.type !== 'string') return [];
      return [{ name: item.name, type: item.type, widget: item.widget === true, required: typeof item.required === 'boolean' ? item.required : undefined }];
    });
    const outputs = arrayOf(row.outputs_json).flatMap((item) => (
      typeof item?.name === 'string' && typeof item?.type === 'string' ? [{ name: item.name, type: item.type }] : []
    ));
    index.set(row.class_type, { inputs, outputs });
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
  const report: GraphCheckReport = {
    ok: true,
    missingNodes,
    missingModels,
    typeMismatches: typeMismatches(nodes, edges, specs),
    baseModelMismatches: baseModelMismatches(db, nodes, edges, catalog),
    unconnectedRequiredInputs: unconnectedInputs(nodes, edges, specs),
    unknownNodeTypes,
    unsetWidgets: unsetWidgets(nodes, edges, catalog, ignored),
    promptNotes: promptNotes(db, nodes, edges, specs, catalog),
  };
  report.ok = report.missingNodes.length === 0 && report.missingModels.length === 0 && report.typeMismatches.length === 0
    && report.baseModelMismatches.length === 0 && report.unconnectedRequiredInputs.length === 0 && report.unknownNodeTypes.length === 0
    && (report.unsetWidgets ?? []).length === 0;
  return report;
}
