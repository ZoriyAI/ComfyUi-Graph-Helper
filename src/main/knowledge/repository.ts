import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  BaseModelFamily,
  CatalogCounts,
  Evidence,
  Explanation,
  ExplanationInput,
  ListExplanationsRequest,
  ModelDetail,
  ModelKind,
  ModelSummary,
  NodeClassDetail,
  NodeClassSummary,
  SearchModelsRequest,
  SearchNodesRequest,
} from '../../shared/contracts/knowledge';
import { objectKey, type ObjectRef } from '../../shared/contracts/objects';
import {
  BASE_MODEL_FAMILIES,
  explanationInputSchema,
  listExplanationsSchema,
  MODEL_KINDS,
  SEARCH_LIMIT_DEFAULT,
  SEARCH_LIMIT_MAX,
  searchModelsSchema,
  searchNodesSchema,
} from '../../shared/knowledge/schemas';
import { rankMatch } from '../../shared/knowledge/search';
import { catalogTotals } from '../catalog/repository';

export { checkGraph } from './check';

/**
 * Knowledge repository: reads the catalog tables and the explanations table (migration v9).
 * Other main-process modules (agent tools, IPC) call only these functions. Inputs are validated here too,
 * because the agent calls these without passing through IPC.
 */

const DEFAULT_LIMIT = SEARCH_LIMIT_DEFAULT;
const MAX_LIMIT = SEARCH_LIMIT_MAX;

function limitOf(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

type NodeRow = {
  class_type: string;
  display_name: string;
  category: string;
  pack: string;
  pack_name: string;
  inputs_json: string;
  outputs_json: string;
  widget_order_json: string;
  description: string;
  output_node: number;
  synced_at: number | null;
};

const NODE_COLUMNS = `class_type, display_name, category, pack, pack_name, inputs_json, outputs_json, widget_order_json,
  description, output_node, synced_at`;

function packOf(row: NodeRow): string {
  return row.pack_name || row.pack || '';
}

function summaryOf(row: NodeRow): NodeClassSummary {
  return {
    classType: row.class_type,
    displayName: row.display_name || row.class_type,
    category: row.category ?? '',
    pack: packOf(row),
    detailed: parseArray(row.inputs_json).length > 0 || parseArray(row.outputs_json).length > 0,
  };
}

/** Lower-case words of a query. "flux lora" is two words, each of which must match. */
function queryTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter((token) => token !== '');
}

/** Sum over tokens of the best rank any field gives it; Infinity when a token matches no field. */
function rankTokens(fields: Array<string | null | undefined>, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    const best = Math.min(...fields.map((field) => rankMatch(field ?? '', token)));
    if (best === Infinity) return Infinity;
    total += best;
  }
  return total;
}

/**
 * Case-insensitive search over class type, display name, category, and pack.
 * Rank: prefix, then whole word, then substring; each word of the query must match some field and
 * the best field per word is summed. A category filter also matches subcategories.
 */
export function searchNodeClasses(db: Database.Database, request: SearchNodesRequest): NodeClassSummary[] {
  const parsed = searchNodesSchema.parse(request);
  const tokens = queryTokens(parsed.query);
  const rows = db.prepare(`SELECT ${NODE_COLUMNS} FROM node_catalog`).all() as NodeRow[];
  const category = parsed.category?.trim().toLowerCase();
  const scored: Array<{ row: NodeRow; score: number }> = [];
  for (const row of rows) {
    const rowCategory = (row.category ?? '').toLowerCase();
    if (category && rowCategory !== category && !rowCategory.startsWith(`${category}/`)) continue;
    const fields = [row.class_type, row.display_name, row.category, packOf(row)];
    const score = rankTokens(fields, tokens);
    if (score === Infinity) continue;
    scored.push({ row, score });
  }
  scored.sort((left, right) => left.score - right.score
    || left.row.class_type.length - right.row.class_type.length
    || left.row.class_type.localeCompare(right.row.class_type));
  return scored.slice(0, limitOf(parsed.limit)).map((item) => summaryOf(item.row));
}

export function nodeClassDetail(db: Database.Database, classType: string): NodeClassDetail | null {
  if (typeof classType !== 'string' || classType === '') return null;
  const row = db.prepare(`SELECT ${NODE_COLUMNS} FROM node_catalog WHERE class_type = ?`).get(classType) as NodeRow | undefined;
  if (!row) return null;
  const order = widgetOrderOf(row.widget_order_json);
  return {
    ...summaryOf(row),
    description: row.description ?? '',
    inputs: parseArray(row.inputs_json).flatMap((item) => {
      const input = record(item);
      if (!input || typeof input.name !== 'string' || typeof input.type !== 'string') return [];
      // Rows stored before inputs carried the flag default to required: that is ComfyUI's common case.
      return [{ name: input.name, type: input.type, widget: input.widget === true, required: input.required !== false }];
    }),
    outputs: parseArray(row.outputs_json).flatMap((item) => {
      const output = record(item);
      if (!output || typeof output.name !== 'string' || typeof output.type !== 'string') return [];
      return [{ name: output.name, type: output.type }];
    }),
    widgetOrder: order.order,
    widgetOrderReliable: order.reliable,
    outputNode: row.output_node === 1,
    syncedAt: row.synced_at ?? null,
  };
}

type ModelRow = {
  directory: string;
  name: string;
  size_bytes: number | null;
  kind: string;
  base_model: string;
  base_model_evidence: string;
  trigger_words: string;
  description: string;
  source_url: string | null;
  metadata_json: string;
  root_path: string | null;
  sha256: string | null;
  synced_at: number | null;
  enriched_at: number | null;
};

const MODEL_COLUMNS = `directory, name, size_bytes, kind, base_model, base_model_evidence, trigger_words, description,
  source_url, metadata_json, root_path, sha256, synced_at, enriched_at`;

const EVIDENCE: readonly Evidence[] = ['metadata', 'sidecar', 'filename', 'web', 'none'];

function asFamily(value: string): BaseModelFamily {
  return (BASE_MODEL_FAMILIES as readonly string[]).includes(value) ? (value as BaseModelFamily) : 'unknown';
}

function asKind(value: string): ModelKind {
  return (MODEL_KINDS as readonly string[]).includes(value) ? (value as ModelKind) : 'other';
}

function modelSummaryOf(row: ModelRow): ModelSummary {
  return {
    directory: row.directory,
    name: row.name,
    kind: asKind(row.kind),
    baseModel: asFamily(row.base_model),
    sizeBytes: row.size_bytes ?? null,
    enriched: row.enriched_at != null,
  };
}

export function searchModels(db: Database.Database, request: SearchModelsRequest): ModelSummary[] {
  const parsed = searchModelsSchema.parse(request);
  const where: string[] = [];
  const args: unknown[] = [];
  if (parsed.directory) {
    where.push('directory = ?');
    args.push(parsed.directory);
  }
  if (parsed.baseModel) {
    where.push('base_model = ?');
    args.push(parsed.baseModel);
  }
  if (parsed.kind) {
    where.push('kind = ?');
    args.push(parsed.kind);
  }
  const tokens = queryTokens(parsed.query);
  const sql = `SELECT ${MODEL_COLUMNS} FROM model_catalog${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const rows = db.prepare(sql).all(...args) as ModelRow[];
  // The file name ranks first; folder, kind, and base family let "flux lora" find a Flux file in loras/.
  const ranked = rows
    .map((row) => ({ row, score: rankTokens([row.name, row.directory, row.kind, row.base_model], tokens) }))
    .filter((item) => item.score !== Infinity);
  ranked.sort((left, right) => left.score - right.score
    || left.row.directory.localeCompare(right.row.directory)
    || left.row.name.localeCompare(right.row.name));
  return ranked.slice(0, limitOf(parsed.limit)).map((item) => modelSummaryOf(item.row));
}

export function modelDetail(db: Database.Database, directory: string, name: string): ModelDetail | null {
  if (typeof directory !== 'string' || typeof name !== 'string' || !directory || !name) return null;
  const row = db.prepare(`SELECT ${MODEL_COLUMNS} FROM model_catalog WHERE directory = ? AND name = ?`).get(directory, name) as ModelRow | undefined;
  if (!row) return null;
  return {
    ...modelSummaryOf(row),
    baseModelEvidence: EVIDENCE.includes(row.base_model_evidence as Evidence) ? (row.base_model_evidence as Evidence) : 'none',
    triggerWords: parseArray(row.trigger_words).filter((item): item is string => typeof item === 'string'),
    description: row.description ?? '',
    sourceUrl: row.source_url ?? null,
    metadata: stringRecord(row.metadata_json),
    rootPath: row.root_path ?? null,
    sha256: row.sha256 ?? null,
    syncedAt: row.synced_at ?? null,
    enrichedAt: row.enriched_at ?? null,
  };
}

/**
 * Totals plus model counts per kind and per kind and base family, largest first.
 * An empty query with a large limit in the search functions lists the rows behind these numbers.
 */
export function catalogCounts(db: Database.Database): CatalogCounts {
  const byKind = (db.prepare('SELECT kind, COUNT(*) AS count FROM model_catalog GROUP BY kind ORDER BY count DESC, kind').all() as Array<{ kind: string; count: number }>)
    .map((row) => ({ kind: asKind(row.kind), count: row.count }));
  const byFamily = (db.prepare(
    'SELECT kind, base_model, COUNT(*) AS count FROM model_catalog GROUP BY kind, base_model ORDER BY count DESC, kind, base_model',
  ).all() as Array<{ kind: string; base_model: string; count: number }>)
    .map((row) => ({ kind: asKind(row.kind), baseModel: asFamily(row.base_model), count: row.count }));
  return { ...catalogTotals(db), byKind, byFamily };
}

/** owner_kind and owner_id split objectKey at its first colon, so a port keeps nodeId, direction, and name. */
export function ownerColumns(owner: ObjectRef): { kind: string; id: string } {
  const key = objectKey(owner);
  return { kind: owner.kind, id: key.slice(owner.kind.length + 1) };
}

type ExplanationRow = {
  id: string;
  project_id: string | null;
  owner_json: string;
  owner_kind: string;
  owner_id: string;
  aspect: string;
  text: string;
  provenance: string;
  source_url: string | null;
  revision_id: string | null;
  created_by: string;
  created_at: number;
};

function explanationOf(row: ExplanationRow): Explanation {
  const stored = record(safeJson(row.owner_json));
  const owner = (stored && typeof stored.kind === 'string' && typeof stored.id === 'string'
    ? stored
    : { kind: row.owner_kind, id: row.owner_id }) as unknown as ObjectRef;
  return {
    id: row.id,
    projectId: row.project_id,
    owner,
    aspect: row.aspect as Explanation['aspect'],
    text: row.text,
    provenance: row.provenance as Explanation['provenance'],
    sourceUrl: row.source_url,
    revisionId: row.revision_id,
    createdBy: row.created_by as Explanation['createdBy'],
    createdAt: row.created_at,
  };
}

/**
 * projectId string: that project's explanations plus global knowledge (project_id NULL).
 * projectId null: global knowledge only. Omitted: every project.
 */
export function listExplanations(db: Database.Database, request: ListExplanationsRequest): Explanation[] {
  const parsed = listExplanationsSchema.parse(request ?? {});
  const where: string[] = [];
  const args: unknown[] = [];
  if (parsed.projectId === null) where.push('project_id IS NULL');
  else if (parsed.projectId !== undefined) {
    where.push('(project_id = ? OR project_id IS NULL)');
    args.push(parsed.projectId);
  }
  if (parsed.owner) {
    const owner = ownerColumns(parsed.owner as ObjectRef);
    where.push('owner_kind = ? AND owner_id = ?');
    args.push(owner.kind, owner.id);
  }
  const sql = `SELECT * FROM explanations${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at, rowid`;
  return (db.prepare(sql).all(...args) as ExplanationRow[]).map(explanationOf);
}

export function saveExplanation(db: Database.Database, input: ExplanationInput): Explanation {
  const parsed = explanationInputSchema.parse(input);
  const owner = parsed.owner as ObjectRef;
  const columns = ownerColumns(owner);
  const row: ExplanationRow = {
    id: randomUUID(),
    project_id: parsed.projectId,
    owner_json: JSON.stringify(owner),
    owner_kind: columns.kind,
    owner_id: columns.id,
    aspect: parsed.aspect,
    text: parsed.text,
    provenance: parsed.provenance,
    source_url: parsed.sourceUrl,
    revision_id: parsed.revisionId,
    created_by: parsed.createdBy,
    created_at: Date.now(),
  };
  db.prepare(`
    INSERT INTO explanations (id, project_id, owner_kind, owner_id, owner_json, aspect, text, provenance, source_url,
      revision_id, created_by, created_at)
    VALUES (@id, @project_id, @owner_kind, @owner_id, @owner_json, @aspect, @text, @provenance, @source_url,
      @revision_id, @created_by, @created_at)
  `).run(row);
  return explanationOf(row);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseArray(text: string): unknown[] {
  const value = safeJson(text);
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringRecord(text: string): Record<string, string> {
  const value = record(safeJson(text)) ?? {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === 'string') out[key] = item;
  return out;
}

function widgetOrderOf(text: string): { order: string[]; reliable: boolean } {
  const value = safeJson(text);
  if (Array.isArray(value)) return { order: value.filter((item): item is string => typeof item === 'string'), reliable: true };
  if (record(value)?.reliable === false) return { order: [], reliable: false };
  return { order: [], reliable: true };
}
