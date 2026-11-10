import type Database from 'better-sqlite3';
import { z } from 'zod';
import { readProjection } from '../commands/commit';
import { readCatalog } from '../catalog/repository';
import { modelKey, orderByFit } from '../../shared/catalog/fieldSpec';
import type { CatalogView } from '../../shared/catalog/types';
import type {
  BaseModelFamily,
  FieldModelOption,
  FieldModelsRequest,
  FieldModelsResult,
  ModelFit,
  ModelKind,
} from '../../shared/contracts/knowledge';
import type { GraphNodeLike } from '../../shared/graph/compatibility';
import { familiesCompatible } from '../../shared/knowledge/baseModel';
import { BASE_MODEL_FAMILIES, MODEL_KINDS } from '../../shared/knowledge/schemas';
import { nodeClassDetail } from './repository';
import { catalogFileIndex, loadedModelFiles } from './loadedModels';

/** Folders whose files are the base model of a graph (the same set the check panel compares LoRAs against). */
const BASE_DIRECTORIES = new Set(['checkpoints', 'diffusion_models', 'unet']);
const LORA_DIRECTORIES = new Set(['loras']);

interface CanvasNode extends GraphNodeLike { id?: unknown }
interface CanvasEdge { source?: unknown; target?: unknown }

/** IPC input: the project, the canvas node and the input name. */
export const fieldModelsSchema = z.object({
  projectId: z.string().min(1).max(200),
  nodeId: z.string().min(1).max(200),
  input: z.string().min(1).max(200),
}).strict();

const NOT_MODELS: FieldModelsResult = { models: false, reference: null, options: [] };

function asFamily(value: unknown): BaseModelFamily {
  return typeof value === 'string' && (BASE_MODEL_FAMILIES as readonly string[]).includes(value) ? (value as BaseModelFamily) : 'unknown';
}

function asKind(value: unknown): ModelKind {
  return typeof value === 'string' && (MODEL_KINDS as readonly string[]).includes(value) ? (value as ModelKind) : 'other';
}

/** Node ids reachable from start along the edges, nearest first: upstream (inputs) or downstream (outputs). */
function walk(start: string, edges: CanvasEdge[], direction: 'up' | 'down'): string[] {
  const seen = new Set<string>([start]);
  const order: string[] = [];
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      const from = String(direction === 'up' ? edge.target : edge.source);
      const to = String(direction === 'up' ? edge.source : edge.target);
      if (from !== current || seen.has(to)) continue;
      seen.add(to);
      order.push(to);
      queue.push(to);
    }
  }
  return order;
}

/**
 * The model a field's files are measured against. For a LoRA, VAE, ControlNet… field it is the base model upstream
 * (the checkpoint that feeds this node, however many nodes away). For a base-model field itself it is the first
 * LoRA downstream: picking a checkpoint the LoRAs below were not made for is the same mistake seen from the other end.
 */
function referenceOf(
  db: Database.Database,
  nodeId: string,
  directory: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  catalog: CatalogView,
): FieldModelsResult['reference'] {
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  const base = BASE_DIRECTORIES.has(directory);
  const wanted = base ? LORA_DIRECTORIES : BASE_DIRECTORIES;
  // Any loader counts, a custom pack's included: a field holding a catalog file loads that file (loadedModels.ts).
  const files = catalogFileIndex(catalog);
  for (const id of walk(nodeId, edges, base ? 'down' : 'up')) {
    const node = byId.get(id);
    if (!node) continue;
    const ref = loadedModelFiles(node, catalog, files).find((item) => wanted.has(item.directory));
    if (!ref) continue;
    const row = db.prepare('SELECT base_model FROM model_catalog WHERE directory = ? AND name = ?').get(ref.directory, ref.name) as { base_model: string } | undefined;
    return { nodeId: id, name: ref.name, baseModel: asFamily(row?.base_model) };
  }
  return null;
}

function fitOf(option: { value: string; baseModel: BaseModelFamily }, reference: FieldModelsResult['reference']): ModelFit {
  if (!reference || reference.baseModel === 'unknown' || option.baseModel === 'unknown') return 'unknown';
  // The same rule the check panel uses for LoRA mismatches (shared/knowledge/baseModel.ts familiesCompatible).
  if (!familiesCompatible(option.baseModel, reference.baseModel, { left: option.value, right: reference.name })) return 'differs';
  return option.baseModel === reference.baseModel ? 'fits' : 'related';
}

/**
 * The files a model field of one canvas node can take, joined with the person's model catalog (family, kind, size)
 * and marked by fit to the reference model in the current graph. Reads SQLite only; never contacts ComfyUI.
 * A field whose options are not catalog model files answers `models: false` and stays a plain list.
 */
export function fieldModels(db: Database.Database, request: FieldModelsRequest): FieldModelsResult {
  const projection = readProjection(db, request.projectId);
  if (!projection) throw new Error('Project was not found.');
  const nodes = (Array.isArray(projection.snapshot.nodes) ? projection.snapshot.nodes : []) as CanvasNode[];
  const edges = (Array.isArray(projection.snapshot.edges) ? projection.snapshot.edges : []) as CanvasEdge[];
  const node = nodes.find((item) => String(item.id) === request.nodeId);
  const classType = typeof node?.data?.comfyType === 'string' ? node.data.comfyType : '';
  if (!node || !classType) return NOT_MODELS;
  const input = nodeClassDetail(db, classType)?.inputs.find((item) => item.name === request.input);
  const directory = input?.spec?.modelDirectory;
  if (!directory) return NOT_MODELS;
  const rows = db.prepare('SELECT directory, name, kind, base_model, size_bytes FROM model_catalog').all() as Array<{
    directory: string; name: string; kind: string; base_model: string; size_bytes: number | null;
  }>;
  // The field's own folder wins when two folders hold a file of the same name.
  const byName = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = modelKey(row.name);
    const known = byName.get(key);
    if (!known || (known.directory !== directory && row.directory === directory)) byName.set(key, row);
  }
  const reference = referenceOf(db, request.nodeId, directory, nodes, edges, readCatalog(db));
  const options: FieldModelOption[] = (input.spec?.options ?? []).filter((value) => value !== '').map((value) => {
    const row = byName.get(modelKey(value));
    const baseModel = asFamily(row?.base_model);
    return {
      value,
      directory: row?.directory ?? directory,
      kind: row ? asKind(row.kind) : 'other',
      baseModel,
      sizeBytes: row?.size_bytes ?? null,
      fit: fitOf({ value, baseModel }, reference),
    };
  });
  return { models: true, reference, options: orderByFit(options) };
}
