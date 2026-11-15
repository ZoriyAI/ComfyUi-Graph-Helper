/**
 * Knowledge repository: reads the catalog tables, and reads and writes the explanations table (migration v9).
 * Other main-process modules (agent tools, IPC) call only these functions. Inputs are validated here too,
 * because the agent calls these without passing through IPC.
 * Callers: knowledge/handlers.ts (the knowledge IPC), agent/tools.ts and agent/turn.ts (the assistant), and the
 * other knowledge modules (fieldModels, nodeClassGuard, seedCore, modelWeb). checkGraph (check.ts) is re-exported here.
 */
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
  NodeClassInput,
  NodeClassSummary,
  PackInfo,
  SearchModelsRequest,
  SearchNodesRequest,
} from '../../shared/contracts/knowledge';
import { inSubgraph, levelKey, objectScope, type ObjectRef } from '../../shared/contracts/objects';
import { currentGraphKey, isGraphOwner } from './projectExplanations';
import {
  BASE_MODEL_FAMILIES,
  explanationInputSchema,
  listExplanationsSchema,
  objectRefSchema,
  MODEL_KINDS,
  SEARCH_LIMIT_DEFAULT,
  SEARCH_LIMIT_MAX,
  searchModelsSchema,
  searchNodesSchema,
} from '../../shared/knowledge/schemas';
import { queryWords, rankFields } from '../../shared/knowledge/searchWords';
import { knowledgeLine, knowledgeTexts, parseNodeQuery, scoreClass, shortDescription } from './nodeSearch';
import { NODE_MARKS, type NodeMark } from '../../shared/contracts/knowledge';
import { EDITOR_NODE_TYPES, editorNodeDisplayName, editorNodePorts, editorNodeWords, isEditorNodeType, type EditorNodeType } from '../../shared/graph/editorNodes';
import { packInfoOf, webUrl } from '../../shared/knowledge/packInfo';
import { notesFromJson, previewKind, type ModelNotes } from '../../shared/knowledge/sidecar';
import { WEB_ERRORS, webFoundFromJson, type WebError, type WebFound } from '../../shared/knowledge/webLookup';
import { catalogInputsFromJson, catalogTotals } from '../catalog/repository';
import { fieldSpecOf, modelDirectoryOf, modelKey } from '../../shared/catalog/fieldSpec';
import { modelDirectoryFor } from '../../shared/catalog/modelFolders';

export { checkGraph } from './check';

const DEFAULT_LIMIT = SEARCH_LIMIT_DEFAULT;
const MAX_LIMIT = SEARCH_LIMIT_MAX;

/** A result count within 1..SEARCH_LIMIT_MAX; the default when none is given. */
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
  /** Marks from object_info (migration 18): 'api', 'deprecated', 'experimental'. */
  flags: string;
  python_module: string;
};

const NODE_COLUMNS = `class_type, display_name, category, pack, pack_name, inputs_json, outputs_json, widget_order_json,
  description, output_node, synced_at, flags, python_module`;

/** The pack's folder name when known, else the raw pack column (the module, or 'core'). */
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
    // Editing package: paid, deprecated and experimental marks for the search, the library and the canvas.
    ...(marksOf(row).length > 0 ? { marks: marksOf(row) } : {}),
  };
}

/** Lower-case words of a query. "flux lora" is two words, each of which must match. */
const queryTokens = queryWords;

/**
 * Sum over tokens of the best rank any field gives it; Infinity when a token matches no field. Russian words count
 * for the English words of ComfyUI, and one slip in a word of 5+ letters is forgiven (shared/knowledge/searchWords.ts).
 */
const rankTokens = rankFields;

/**
 * The node search of the canvas, the library and the assistant: names first (class, display name, category, pack:
 * exact, prefix, whole word, substring, a Russian word for it, one slip), then the description and the built-in
 * explanation, with type filters and editor nodes; see nodeSearch.ts. A category filter also matches subcategories.
 */
export function searchNodeClasses(db: Database.Database, request: SearchNodesRequest): NodeClassSummary[] {
  const parsed = searchNodesSchema.parse(request);
  const query = parseNodeQuery(parsed.query);
  if (parsed.inputType) query.inputType = parsed.inputType;
  if (parsed.outputType) query.outputType = parsed.outputType;
  const language = parsed.language ?? 'en';
  const rows = db.prepare(`SELECT ${NODE_COLUMNS} FROM node_catalog`).all() as NodeRow[];
  const category = parsed.category?.trim().toLowerCase();
  const inCategory = (value: string) => {
    const rowCategory = value.toLowerCase();
    return !category || rowCategory === category || rowCategory.startsWith(`${category}/`);
  };
  const scored: Array<{ summary: NodeClassSummary; score: number; missing: number }> = [];
  for (const row of rows) {
    if (!inCategory(row.category ?? '')) continue;
    const { score, missing } = scoreClass({
      names: [row.class_type, row.display_name, row.category, packOf(row)],
      texts: [row.description, ...knowledgeTexts(row.class_type)],
      inputTypes: typesOf(row.inputs_json),
      outputTypes: typesOf(row.outputs_json),
    }, query);
    if (score === Infinity) continue;
    const summary = summaryOf(row);
    const description = knowledgeLine(row.class_type, language) || shortDescription(row.description);
    if (description) summary.description = description;
    if (row.output_node === 1) summary.outputNode = true;
    // An outdated node comes after its current neighbours.
    scored.push({ summary, score: score + (summary.marks?.includes('deprecated') ? 2 : 0), missing });
  }
  const known = new Set(rows.map((row) => row.class_type));
  for (const classType of EDITOR_NODE_TYPES) {
    if (known.has(classType) || !inCategory(EDITOR_CATEGORY)) continue;
    const ports = editorNodePorts(classType);
    const { score, missing } = scoreClass({
      names: [classType, editorNodeDisplayName(classType), EDITOR_CATEGORY, ...editorNodeWords(classType)],
      texts: knowledgeTexts(classType),
      inputTypes: ports.inputs.map((port) => port.dataType),
      outputTypes: ports.outputs.map((port) => port.dataType),
    }, query);
    if (score === Infinity) continue;
    const description = knowledgeLine(classType, language);
    scored.push({
      summary: { classType, displayName: editorNodeDisplayName(classType), category: EDITOR_CATEGORY, pack: 'core', detailed: true, editor: true, ...(description ? { description } : {}) },
      score,
      missing,
    });
  }
  // A class that misses a word counts only when no class matches every word.
  const complete = scored.some((item) => item.missing === 0);
  const kept = complete ? scored.filter((item) => item.missing === 0) : scored;
  kept.sort((left, right) => left.score - right.score
    || left.summary.classType.length - right.summary.classType.length
    || left.summary.classType.localeCompare(right.summary.classType));
  return kept.slice(0, limitOf(parsed.limit)).map((item) => item.summary);
}

/** The card of an editor node: ComfyUI's object_info never lists it, so its ports come from editorNodes.ts. */
function editorNodeDetail(classType: EditorNodeType): NodeClassDetail {
  const ports = editorNodePorts(classType);
  return {
    classType,
    displayName: editorNodeDisplayName(classType),
    category: EDITOR_CATEGORY,
    pack: 'core',
    detailed: true,
    editor: true,
    description: knowledgeLine(classType, 'en'),
    inputs: ports.inputs.map((port) => ({ name: port.name, type: port.dataType, widget: false, required: true })),
    outputs: ports.outputs.map((port) => ({ name: port.name, type: port.dataType })),
    widgetOrder: [],
    widgetOrderReliable: true,
    outputNode: false,
    syncedAt: null,
  };
}

/**
 * A node's marks: 'api' for a paid node that runs on an outside service (object_info api_node, or a class of
 * ComfyUI's comfy_api_nodes package when the flag was never read), 'deprecated', 'experimental'.
 */
export function marksOf(row: { flags?: string | null; pack?: string; python_module?: string }): NodeMark[] {
  const words = new Set((row.flags ?? '').split(/\s+/).filter(Boolean));
  if ((row.python_module ?? '').startsWith('comfy_api_nodes')) words.add('api');
  return NODE_MARKS.filter((mark) => words.has(mark));
}

/** The category ComfyUI files its editor nodes under. */
const EDITOR_CATEGORY = 'utils';

/** The link types of a stored inputs_json or outputs_json list. */
function typesOf(json: string): string[] {
  return parseArray(json).flatMap((item) => {
    const port = record(item);
    return port && typeof port.type === 'string' ? [port.type] : [];
  });
}

/**
 * What a pack's own files said (sync reads them, see main/mcp/sync.ts readPackInfo), or null when they were never
 * read or said nothing. The pack is looked up by the folder name the class's module gives; case is forgiven.
 */
export function packInfo(db: Database.Database, name: string): PackInfo | null {
  if (!name || name === 'core') return null;
  let row: { description: string | null; repository_url: string | null; readme_summary: string | null } | undefined;
  try {
    const query = 'SELECT description, repository_url, readme_summary FROM node_packs WHERE info_read_at IS NOT NULL AND ';
    row = (db.prepare(`${query}name = ?`).get(name) ?? db.prepare(`${query}name = ? COLLATE NOCASE ORDER BY name LIMIT 1`).get(name)) as typeof row;
  } catch {
    // A database from before migration v13 has no such columns.
    return null;
  }
  if (!row) return null;
  // A README opening stored by an earlier version is shown by today's rule: only without a description, only its
  // first real paragraph (shared/knowledge/packInfo.ts packInfoOf).
  const description = row.description ?? '';
  const readme = packInfoOf({ description, repositoryUrl: null, displayName: '' }, row.readme_summary ?? '').readmeSummary;
  const info: PackInfo = { description, repositoryUrl: webUrl(row.repository_url), readmeSummary: readme };
  return info.description || info.repositoryUrl || info.readmeSummary ? info : null;
}

/** Everything the app knows of one class: ports with field specs, pack, explanation; editor nodes from their template. */
export function nodeClassDetail(db: Database.Database, classType: string): NodeClassDetail | null {
  if (typeof classType !== 'string' || classType === '') return null;
  const row = db.prepare(`SELECT ${NODE_COLUMNS} FROM node_catalog WHERE class_type = ?`).get(classType) as NodeRow | undefined;
  if (!row && isEditorNodeType(classType)) return editorNodeDetail(classType);
  if (!row) return null;
  const order = widgetOrderOf(row.widget_order_json);
  const pack = packInfo(db, packOf(row));
  return {
    ...(pack ? { packInfo: pack } : {}),
    ...summaryOf(row),
    description: row.description ?? '',
    inputs: detailInputs(db, row),
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

/**
 * Inputs with their field spec . The stored rows go through the catalog reader so the spec sees exactly
 * what readCatalog sees; a combo whose options are the person's model files carries the folder they live in.
 * Rows stored before inputs carried the required flag default to required: that is ComfyUI's common case.
 */
function detailInputs(db: Database.Database, row: NodeRow): NodeClassInput[] {
  const raw = parseArray(row.inputs_json);
  const parsed = catalogInputsFromJson(row.inputs_json);
  const hasCombo = parsed.some((input) => input.widget && Array.isArray(input.options) && input.options.length > 0);
  const modelsByName = hasCombo ? modelNameIndex(db) : new Map<string, string[]>();
  return parsed.map((input) => {
    const stored = record(raw.find((item) => record(item)?.name === input.name));
    const out: NodeClassInput = { name: input.name, type: input.type, widget: input.widget, required: stored?.required !== false };
    if (input.tooltip) out.tooltip = input.tooltip;
    const spec = fieldSpecOf(input);
    if (spec) {
      if (spec.kind === 'combo') {
        const directory = modelDirectoryOf(spec.options, modelsByName, modelDirectoryFor(row.class_type, input.name));
        if (directory) spec.modelDirectory = directory;
      }
      out.spec = spec;
    }
    return out;
  });
}

/** Model file name (forward slashes) to the catalog folders that hold a file of that name. */
function modelNameIndex(db: Database.Database): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const rows = db.prepare('SELECT directory, name FROM model_catalog').all() as Array<{ directory: string; name: string }>;
  for (const model of rows) {
    const key = modelKey(model.name);
    const list = index.get(key);
    if (list) list.push(model.directory);
    else index.set(key, [model.directory]);
  }
  return index;
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
  preview_file: string | null;
  notes_json: string | null;
  web_status: string | null;
  web_checked_at: number | null;
  web_error: string | null;
  web_notes_json: string | null;
};

const MODEL_COLUMNS = `directory, name, size_bytes, kind, base_model, base_model_evidence, trigger_words, description,
  source_url, metadata_json, root_path, sha256, synced_at, enriched_at, preview_file, notes_json,
  web_status, web_checked_at, web_error, web_notes_json`;

/** What the internet said about a file, when it was found; null when it was not asked or found nothing. */
function webFoundOf(row: ModelRow): WebFound | null {
  return row.web_status === 'found' ? webFoundFromJson(row.web_notes_json) : null;
}

/** Where a family may have come from; any other stored value reads as 'none'. */
const EVIDENCE: readonly Evidence[] = ['metadata', 'sidecar', 'filename', 'web', 'none'];

/** A stored family, or 'unknown'. */
function asFamily(value: string): BaseModelFamily {
  return (BASE_MODEL_FAMILIES as readonly string[]).includes(value) ? (value as BaseModelFamily) : 'unknown';
}

/** A stored kind, or 'other'. */
function asKind(value: string): ModelKind {
  return (MODEL_KINDS as readonly string[]).includes(value) ? (value as ModelKind) : 'other';
}

/** A model as a list entry shows it. */
function modelSummaryOf(row: ModelRow, notes: ModelNotes = notesFromJson(row.notes_json)): ModelSummary {
  // A sample from the internet stands in only where nothing lies next to the file; it is closed like one.
  const web = row.preview_file ? null : webFoundOf(row);
  const webPreview = web?.preview ?? null;
  return {
    directory: row.directory,
    name: row.name,
    kind: asKind(row.kind),
    baseModel: asFamily(row.base_model),
    sizeBytes: row.size_bytes ?? null,
    enriched: row.enriched_at != null,
    title: notes.title,
    preview: row.preview_file ? previewKind(row.preview_file) : webPreview?.kind ?? null,
    mature: notes.mature || (webPreview !== null && web!.notes.mature),
  };
}

/** The model search of the library and the assistant: folder, family and kind filters, then ranked by the query words. */
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
  // The file name ranks first; folder, kind, and base family let "flux lora" find a Flux file in loras/. The name
  // and tags its author gave it find a file whose own name says nothing ("20251206.safetensors").
  const ranked = rows
    .map((row) => {
      const notes = notesFromJson(row.notes_json);
      // Also what the list shows and the card names: the author's base-model words and the trigger words.
      const triggers = parseArray(row.trigger_words).filter((item): item is string => typeof item === 'string').join(' ');
      return {
        row,
        notes,
        score: rankTokens([row.name, row.directory, row.kind, row.base_model, notes.title, notes.tags.join(' '), notes.baseModelLabel, triggers], tokens),
      };
    })
    .filter((item) => item.score !== Infinity);
  ranked.sort((left, right) => left.score - right.score
    || left.row.directory.localeCompare(right.row.directory)
    || left.row.name.localeCompare(right.row.name));
  return ranked.slice(0, limitOf(parsed.limit)).map((item) => modelSummaryOf(item.row, item.notes));
}

/** Everything stored about one model file, for its card; null when the catalog has no such file. */
export function modelDetail(db: Database.Database, directory: string, name: string): ModelDetail | null {
  if (typeof directory !== 'string' || typeof name !== 'string' || !directory || !name) return null;
  const row = db.prepare(`SELECT ${MODEL_COLUMNS} FROM model_catalog WHERE directory = ? AND name = ?`).get(directory, name) as ModelRow | undefined;
  if (!row) return null;
  const notes = notesFromJson(row.notes_json);
  return {
    ...modelSummaryOf(row, notes),
    baseModelEvidence: EVIDENCE.includes(row.base_model_evidence as Evidence) ? (row.base_model_evidence as Evidence) : 'none',
    triggerWords: parseArray(row.trigger_words).filter((item): item is string => typeof item === 'string'),
    description: row.description ?? '',
    sourceUrl: row.source_url ?? null,
    metadata: stringRecord(row.metadata_json),
    notes,
    rootPath: row.root_path ?? null,
    sha256: row.sha256 ?? null,
    syncedAt: row.synced_at ?? null,
    enrichedAt: row.enriched_at ?? null,
    web: {
      status: row.web_status === 'found' || row.web_status === 'not-found' || row.web_status === 'error' ? row.web_status : null,
      checkedAt: row.web_checked_at ?? null,
      error: (WEB_ERRORS as readonly string[]).includes(row.web_error ?? '') ? (row.web_error as WebError) : null,
      found: webFoundOf(row),
    },
    civitaiKnown: /^https:\/\/civitai\.com\//.test(row.source_url ?? ''),
  };
}

/**
 * A model as the helper model is told about it. What the internet said stays in the card: the example prompts
 * found there and the address of its sample are not sent (only where it was found, and its name and words).
 */
export function modelDetailForHelper(detail: ModelDetail): ModelDetail {
  // The folder on disk names the person's account and says nothing the helper needs: it is never sent.
  const local = { ...detail, rootPath: null };
  const found = local.web?.found;
  if (!found) return local;
  return { ...local, web: { ...local.web, found: { ...found, notes: { ...found.notes, examples: [] }, preview: null } } };
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

/**
 * owner_kind and owner_id split levelKey at its first colon, so a port keeps nodeId, direction, and name. The
 * subgraph definition an object lives in is its own column, `scope` (see projectExplanations.ts).
 */
export function ownerColumns(owner: ObjectRef): { kind: string; id: string; scope: string } {
  const key = levelKey(owner);
  return { kind: owner.kind, id: key.slice(owner.kind.length + 1), scope: objectScope(owner) };
}

type ExplanationRow = {
  id: string;
  project_id: string | null;
  graph_key: string | null;
  scope: string;
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

/** A stored row as the Explanation the window and the agent read. */
function explanationOf(row: ExplanationRow): Explanation {
  const stored = record(safeJson(row.owner_json));
  const plain = (stored && typeof stored.kind === 'string' && typeof stored.id === 'string'
    ? stored
    : { kind: row.owner_kind, id: row.owner_id }) as unknown as ObjectRef;
  // The scope column is who the object is; owner_json of an older row has no subgraphId.
  const owner = inSubgraph(plain, row.scope || null);
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
 * projectId string: that project's explanations plus global knowledge (project_id NULL). Of the project's
 * explanations about objects of a graph, only those of the graph on screen (its graph key, see
 * projectExplanations.ts): node 4 of another graph is another node.
 * projectId null: global knowledge only. Omitted: every project and every graph.
 * owner: that object; a node, port or link inside a subgraph definition is told apart by `owner.subgraphId`.
 */
export function listExplanations(db: Database.Database, request: ListExplanationsRequest): Explanation[] {
  const parsed = listExplanationsSchema.parse(request ?? {});
  const where: string[] = [];
  const args: unknown[] = [];
  if (parsed.projectId === null) where.push('project_id IS NULL');
  else if (parsed.projectId !== undefined) {
    where.push('(project_id IS NULL OR (project_id = ? AND (graph_key IS NULL OR graph_key = ?)))');
    args.push(parsed.projectId, currentGraphKey(db, parsed.projectId));
  }
  if (parsed.owner) {
    const owner = ownerColumns(parsed.owner as ObjectRef);
    where.push('owner_kind = ? AND owner_id = ? AND scope = ?');
    args.push(owner.kind, owner.id, owner.scope);
  }
  const sql = `SELECT * FROM explanations${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at, rowid`;
  return (db.prepare(sql).all(...args) as ExplanationRow[]).map(explanationOf);
}

/** Removes one note the person wrote. Built-in knowledge and the assistant's words are not removed this way. */
export function deletePersonExplanation(db: Database.Database, id: unknown): number {
  if (typeof id !== 'string' || id === '' || id.length > 200) return 0;
  return db.prepare(`DELETE FROM explanations WHERE id = ? AND created_by = 'user'`).run(id).changes;
}

/**
 * Removes what the assistant wrote about one object (a node class, a model, a node…), in every project and in
 * global knowledge: built-in knowledge and the person's own notes stay. Returns how many went.
 */
export function deleteAssistantExplanations(db: Database.Database, ownerInput: unknown): number {
  const owner = ownerColumns(objectRefSchema.parse(ownerInput) as ObjectRef);
  return db.prepare(`DELETE FROM explanations WHERE created_by = 'ai' AND owner_kind = ? AND owner_id = ? AND scope = ?`)
    .run(owner.kind, owner.id, owner.scope).changes;
}

/**
 * An explanation about an object of the project's graph is kept for the graph on screen (its graph key); one about
 * a class, a model or a type, or one without a project, is global knowledge (graph_key NULL).
 */
export function saveExplanation(db: Database.Database, input: ExplanationInput): Explanation {
  const parsed = explanationInputSchema.parse(input);
  const owner = parsed.owner as ObjectRef;
  const columns = ownerColumns(owner);
  const graphKey = parsed.projectId !== null && isGraphOwner(owner) ? currentGraphKey(db, parsed.projectId) : null;
  const row: ExplanationRow = {
    id: randomUUID(),
    project_id: parsed.projectId,
    graph_key: graphKey,
    scope: columns.scope,
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
    INSERT INTO explanations (id, project_id, graph_key, scope, owner_kind, owner_id, owner_json, aspect, text, provenance,
      source_url, revision_id, created_by, created_at)
    VALUES (@id, @project_id, @graph_key, @scope, @owner_kind, @owner_id, @owner_json, @aspect, @text, @provenance,
      @source_url, @revision_id, @created_by, @created_at)
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

/** The stored widget order, or `reliable: false` when object_info could not prove it (catalog/repository.ts). */
function widgetOrderOf(text: string): { order: string[]; reliable: boolean } {
  const value = safeJson(text);
  if (Array.isArray(value)) return { order: value.filter((item): item is string => typeof item === 'string'), reliable: true };
  if (record(value)?.reliable === false) return { order: [], reliable: false };
  return { order: [], reliable: true };
}
