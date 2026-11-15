import { missingOnGraph, type GraphNodeLike } from '../../shared/graph/compatibility';
import { nodeRunMode } from '../../shared/graph/layout';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { canonicalPayload } from '../../shared/commands/canonical';
import {
  commandRequestSchema,
  mutationSchema,
  type ActiveRun,
  type CommandRequest,
  type CommandResponse,
  type GraphMutation,
  type Projection,
  type RunStart,
} from '../../shared/commands/types';
import { defaultParameters, widgetIndexFor } from '../../shared/catalog/objectInfo';
import type { CatalogView } from '../../shared/catalog/types';
import { ensureCatalog, readCatalog } from '../catalog/repository';
import { portsCompatible } from '../../shared/graph/linkTypes';
import { validEdgeEndpoints } from '../../shared/graph/structure';
import { createsCycle } from '../../shared/graph/cycles';
import { portsForClassType } from '../../shared/graph/ports';
import {
  EMPTY_PROCESS,
  listSubgraphDefinitions,
  normalizeProcess,
  parseStoredComponents,
  parseStoredProcess,
  reconcileComponents,
  type ComponentRecord,
  type ProcessMeta,
} from '../../shared/components/model';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import { withCollapsed } from '../../shared/workflow/comfyLook';
import { parseNativeProject } from '../../shared/native-project';
import { nestsItself, type GroupRecord, type SubgraphDefinition } from '../../shared/graph/subgraphs';
import { applyGraphOp, blankDocument, GraphOpError, Ids, isGraphOp } from './graphOps';
import { applyInnerEdit, keepDefinitionCounters } from './innerEdits';
import { applyMoveNodes, classHints, nodeRectOf, placeHelperNode, placeHelperSubgraph, runCreatedNodeIds, tidyMoves } from './placement';
import { boundsOfRects, findFreeSlot } from '../../shared/graph/layout';
import { EditOpError, adoptLinkedType, applyEditOp, editorNode, isEditOp, refuseEditorLink } from './editOps';
import { supersedeAllOpen, supersedeForMissingNodes } from '../proposals/supersede';
import { explanationsAfterCommit, graphKeyOf } from '../knowledge/projectExplanations';
import { EXPLANATIONS_EXTENSION } from '../../shared/knowledge/projectExplanations';
import { recentPayload, type RecentCommand } from '../../shared/agent/recentActions';
import { pruneHistoryAfterCommit } from './history';
import { storageErrorCode } from '../settings/databaseSafety';
import { graphLimitError } from '../../shared/workflow/graphLimits';
import type { RevisionSummary } from '../../shared/contracts/revisions';
import {
  liftSubgraphsAndGroups,
  mirrorDocument,
  missingDeps,
  shownDifferently,
  nextLinkId,
  nextNodeId,
  numericSlot,
  patchWidgets,
  projectWorkflow,
  rememberLinkId,
  rememberNodeId,
  widgetsFromParameters,
  type GraphSnapshot,
  type WorkflowDocumentState,
} from '../../shared/workflow/codec';

class CommandSignal extends Error {
  constructor(
    readonly status: 'conflict' | 'rejected',
    readonly detail: unknown = null,
  ) {
    super(status);
  }
}

interface Snapshot {
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  document: WorkflowDocumentState | null;
  components?: ComponentRecord[];
  process?: ProcessMeta;
  subgraphs?: SubgraphDefinition[];
  groups?: GroupRecord[];
  /**
   * What an opened project file carried that this version does not use: other extensions and unknown top-level
   * fields. Kept with the graph (in the document column) so saving the project writes them back. A mutation
   * that leaves the key out keeps the current one; opening or importing another graph sets it.
   */
  projectExtras?: ProjectExtras;
}

export interface ProjectExtras {
  extensions: Record<string, unknown>;
  fields: Record<string, unknown>;
}

interface RevisionRow {
  id: string;
  rev_seq: number;
  nodes: string;
  edges: string;
  document: string | null;
  components: string | null;
  process_meta: string | null;
}

function readCurrent(db: Database.Database, projectId: string): { revisionId: string; revSeq: number; snapshot: Snapshot } | null {
  const project = db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as
    | { current_revision_id: string | null }
    | undefined;
  if (!project?.current_revision_id) return null;
  const revision = db.prepare('SELECT id, rev_seq, nodes, edges, document, components, process_meta FROM graph_revisions WHERE id = ?').get(project.current_revision_id) as
    | RevisionRow
    | undefined;
  if (!revision) return null;
  return {
    revisionId: revision.id,
    revSeq: revision.rev_seq,
    snapshot: snapshotFromRow(revision),
  };
}

function snapshotFromRow(revision: Pick<RevisionRow, 'nodes' | 'edges' | 'document' | 'components' | 'process_meta'>): Snapshot {
  const nodes = JSON.parse(revision.nodes) as Array<Record<string, any>>;
  const stored = decodeDocumentColumn(revision.document, nodes);
  return sealSnapshot({
    projectExtras: stored.projectExtras,
    nodes,
    edges: JSON.parse(revision.edges),
    document: stored.document,
    components: parseStoredComponents(revision.components),
    process: parseStoredProcess(revision.process_meta),
    subgraphs: stored.subgraphs,
    groups: stored.groups,
  }).snapshot;
}

/**
 * The `document` column holds the native document state plus the modelled `subgraphs` and `groups`
 * (no migration needed). Rows written before subgraphs were modelled lift them from the raw document.
 */
function decodeDocumentColumn(
  raw: string | null | undefined,
  nodes: Array<Record<string, any>>,
): { document: WorkflowDocumentState | null; subgraphs: SubgraphDefinition[]; groups: GroupRecord[]; projectExtras: ProjectExtras | undefined } {
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  const extras = parsed.projectExtras as Partial<ProjectExtras> | undefined;
  const document = parseDocument(parsed);
  const lifted = document ? liftSubgraphsAndGroups(document.raw, nodes) : { subgraphs: [], groups: [] };
  return {
    document,
    subgraphs: Array.isArray(parsed.subgraphs) ? (parsed.subgraphs as SubgraphDefinition[]) : lifted.subgraphs,
    groups: Array.isArray(parsed.groups) ? (parsed.groups as GroupRecord[]) : lifted.groups,
    projectExtras: extras && typeof extras === 'object' ? { extensions: { ...(extras.extensions ?? {}) }, fields: { ...(extras.fields ?? {}) } } : undefined,
  };
}

function encodeDocumentColumn(snapshot: Snapshot): string {
  return JSON.stringify({
    ...(snapshot.document ?? {}),
    subgraphs: snapshot.subgraphs ?? [],
    groups: snapshot.groups ?? [],
    ...(snapshot.projectExtras ? { projectExtras: snapshot.projectExtras } : {}),
  });
}

/** The extensions this version does not read itself (explanations come back through their own path) and unknown fields. */
function projectExtrasOf(extensions: Record<string, unknown>, fields: Record<string, unknown> | undefined): ProjectExtras | undefined {
  const others = Object.fromEntries(Object.entries(extensions).filter(([key]) => key !== EXPLANATIONS_EXTENSION));
  if (Object.keys(others).length === 0 && Object.keys(fields ?? {}).length === 0) return undefined;
  return { extensions: others, fields: { ...(fields ?? {}) } };
}

function subgraphIds(subgraphs: SubgraphDefinition[]): string[] {
  return subgraphs.filter((item) => !item.opaque).map((item) => item.id);
}

function sealSnapshot(snapshot: Snapshot, fallback?: Snapshot): { snapshot: Snapshot; orphans: string[] } {
  const subgraphs = snapshot.subgraphs ?? fallback?.subgraphs ?? [];
  const nodeIds = snapshot.nodes.map((node) => String(node.id));
  const present = new Set(nodeIds);
  // Group membership follows the canvas: a removed node leaves every group.
  const groups = (snapshot.groups ?? fallback?.groups ?? []).map((group) => (
    group.nodeIds.every((id) => present.has(id)) ? group : { ...group, nodeIds: group.nodeIds.filter((id) => present.has(id)) }
  ));
  const existing = snapshot.components ?? fallback?.components ?? [];
  const reconciled = reconcileComponents(existing, nodeIds, subgraphIds(subgraphs));
  const sealed: Snapshot = {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    document: snapshot.document,
    components: [...reconciled.components, ...innerComponents(existing, subgraphs, present)],
    process: normalizeProcess(snapshot.process ?? fallback?.process ?? EMPTY_PROCESS),
    subgraphs,
    groups,
    projectExtras: 'projectExtras' in snapshot ? snapshot.projectExtras : fallback?.projectExtras,
  };
  sealed.document = mirrorDocument(sealed);
  const kept = new Set(sealed.components!.map((record) => `${record.ownerKind}:${record.ownerId}`));
  return { orphans: reconciled.orphans.filter((key) => !kept.has(key)), snapshot: sealed };
}

/**
 * Written records (purpose or usage) of nodes that now live inside a subgraph definition. They are kept, so
 * making a subgraph does not lose them and dissolving it brings them back with the nodes.
 */
function innerComponents(existing: ComponentRecord[], subgraphs: SubgraphDefinition[], onCanvas: Set<string>): ComponentRecord[] {
  const inner = new Set(subgraphs.flatMap((definition) => (definition.opaque ? [] : definition.nodes.map((node) => String(node.id)))));
  const seen = new Set<string>();
  return existing.filter((record) => {
    if (record.ownerKind !== 'node' || onCanvas.has(record.ownerId) || !inner.has(record.ownerId)) return false;
    if (!record.purpose && !record.usage) return false;
    if (seen.has(record.ownerId)) return false;
    seen.add(record.ownerId);
    return true;
  });
}

function parseDocument(parsed: Record<string, unknown> | null): WorkflowDocumentState | null {
  if (!parsed || !parsed.raw || typeof parsed.raw !== 'object' || (parsed.formatVersion !== 1 && parsed.formatVersion !== 0.4)) return null;
  return { formatVersion: parsed.formatVersion, raw: parsed.raw as Record<string, unknown> };
}

/** The import report with the model files the nodes' fields name and this ComfyUI does not have. */
function withFieldModels(report: { missingNodes: string[]; missingModels: Array<{ directory: string; name: string }> }, nodes: GraphNodeLike[], catalog: CatalogView): { missingNodes: string[]; missingModels: Array<{ directory: string; name: string }> } {
  if (catalog.models.length === 0) return report;
  const fromFields = missingOnGraph(nodes.filter((node) => nodeRunMode(node.data as { comfy?: unknown } | undefined) === null), catalog, null).missingModels;
  const seen = new Set(report.missingModels.map((model) => `${model.directory}/${model.name}`));
  return { ...report, missingModels: [...report.missingModels, ...fromFields.filter((model) => !seen.has(`${model.directory}/${model.name}`))] };
}

export function readProjection(db: Database.Database, projectId: string): Projection | null {
  const current = readCurrent(db, projectId);
  if (!current) return null;
  const active = db
    .prepare(
      `SELECT run_id, status, expected_revision_id
       FROM runs
       WHERE project_id = ? AND status IN ('running', 'paused')
       ORDER BY rowid DESC
       LIMIT 1`,
    )
    .get(projectId) as { run_id: string; status: 'running' | 'paused'; expected_revision_id: string } | undefined;
  const activeRun: ActiveRun | null = active
    ? { runId: active.run_id, status: active.status, expectedRevisionId: active.expected_revision_id }
    : null;
  return {
    projectId,
    snapshot: current.snapshot,
    currentRevisionId: current.revisionId,
    revSeq: current.revSeq,
    activeRun,
    graphKey: graphKeyOf(db, projectId, current.revisionId) ?? '',
  };
}

export function ensureProject(db: Database.Database, projectId: string, name = projectId): void {
  const existing = db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as
    | { current_revision_id: string | null }
    | undefined;
  if (existing?.current_revision_id) return;
  const now = Date.now();
  const revisionId = `rev-${projectId}-1`;
  const write = db.transaction(() => {
    if (!existing) {
      db.prepare(
        `INSERT INTO projects (id, name, created_at, updated_at, graph_data, metadata, current_revision_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(projectId, name, now, now, '{}', '{}', revisionId);
    } else {
      db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run(revisionId, projectId);
    }
    db.prepare(
      `INSERT INTO graph_revisions
        (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document, components, process_meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(revisionId, projectId, now, '[]', '[]', null, 'Initial', 'system', 1, '{"subgraphs":[],"groups":[]}', '[]', '{}');
  });
  write.immediate();
}

export function ensureWorkspace(db: Database.Database): void {
  ensureProject(db, DESKTOP_PROJECT_ID, 'Desktop');
  ensureCatalog(db);
}

function arrayWidgetIndex(
  widgets: unknown[],
  catalog: CatalogView,
  classType: string,
  key: string,
  payloadIndex: number | undefined,
): number {
  if (payloadIndex !== undefined && (!Number.isInteger(payloadIndex) || payloadIndex < 0 || payloadIndex >= widgets.length)) {
    throw new CommandSignal('rejected', { error: 'widgetIndex is outside widgets_values.' });
  }
  const catalogNode = catalog.nodes.find((item) => item.classType === classType);
  const orderUsable = !!catalogNode && catalogNode.widgetOrderReliable !== false && widgets.length === catalogNode.widgetOrder.length;
  const catalogIndex = orderUsable ? widgetIndexFor(catalog, classType, key) : undefined;
  if (orderUsable && catalogIndex !== undefined && payloadIndex !== undefined && payloadIndex !== catalogIndex) {
    throw new CommandSignal('rejected', { error: 'widgetIndex does not match the catalog widget order.' });
  }
  if (orderUsable && catalogIndex !== undefined) return catalogIndex;
  if (payloadIndex !== undefined) return payloadIndex;
  if (catalogNode && (catalogNode.widgetOrderReliable === false || widgets.length !== catalogNode.widgetOrder.length)) {
    throw new CommandSignal('rejected', { error: 'Catalog widget order does not match widgets_values.' });
  }
  throw new CommandSignal('rejected', { error: 'widgetIndex is required when widgets_values is an array.' });
}

function portById(node: Record<string, any>, kind: 'inputs' | 'outputs', handle: string): { dataType: string } | null {
  const ports = Array.isArray(node.data?.[kind]) ? node.data[kind] : [];
  const port = ports.find((item: { id?: string; dataType?: unknown }) => item.id === handle);
  return port && typeof port.dataType === 'string' ? { dataType: port.dataType } : null;
}

function inputPort(node: Record<string, any>, handle: string): { dataType: string } | null {
  return portById(node, 'inputs', handle);
}

function outputPort(node: Record<string, any>, handle: string): { dataType: string } | null {
  return portById(node, 'outputs', handle);
}

function removeSelection(
  snapshot: Snapshot,
  payload: Extract<GraphMutation, { type: 'remove-selection' }>,
): { snapshot: Snapshot; result: Record<string, unknown> } {
  const nodeIds = new Set(payload.nodeIds);
  const selectedEdgeIds = new Set(payload.edgeIds);
  const presentNodes = new Set(snapshot.nodes.map((node) => String(node.id)));
  const presentEdges = new Set(snapshot.edges.map((edge) => String(edge.id)));
  for (const id of nodeIds) if (!presentNodes.has(id)) throw new CommandSignal('rejected', { error: 'Node was not found.' });
  for (const id of selectedEdgeIds) if (!presentEdges.has(id)) throw new CommandSignal('rejected', { error: 'Connection was not found.' });
  const removedEdgeIds = snapshot.edges
    .filter((edge) => selectedEdgeIds.has(String(edge.id)) || nodeIds.has(String(edge.source)) || nodeIds.has(String(edge.target)))
    .map((edge) => String(edge.id));
  return {
    snapshot: {
      ...snapshot,
      nodes: snapshot.nodes.filter((node) => !nodeIds.has(String(node.id))),
      edges: snapshot.edges.filter((edge) => !removedEdgeIds.includes(String(edge.id))),
    },
    result: { nodeIds: [...nodeIds], edgeIds: removedEdgeIds },
  };
}

function clipboardNode(raw: Record<string, unknown>, subgraphs: SubgraphDefinition[], destinationDefinitionId?: string): Record<string, any> {
  const node = structuredClone(raw) as Record<string, any>;
  if (
    typeof node.id !== 'string' || node.id === ''
    || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)
    || typeof node.data?.comfyType !== 'string' || node.data.comfyType === ''
  ) {
    throw new CommandSignal('rejected', { error: 'Clipboard data is not valid.' });
  }
  if (node.data.kind === 'subgraph-instance' || subgraphs.some((item) => item.id === node.data.comfyType)) {
    // Class identity and the engine's registry decide nesting, never clipboard-supplied kind/destination flags.
    const definitionId = String(node.data.comfyType);
    if (node.data.subgraphId && node.data.subgraphId !== definitionId) throw new CommandSignal('rejected', { error: 'Clipboard data is not valid.' });
    const definition = subgraphs.find((item) => item.id === definitionId && !item.opaque);
    if (!definition) throw new CommandSignal('rejected', { error: 'The pasted subgraph definition was not found.' });
    node.data.kind = 'subgraph-instance';
    node.data.subgraphId = definitionId;
    if (destinationDefinitionId && nestsItself(subgraphs, destinationDefinitionId, definitionId)) {
      throw new CommandSignal('rejected', { error: 'A subgraph cannot contain itself.' });
    }
  }
  return node;
}

function pasteSelection(
  snapshot: Snapshot,
  payload: Extract<GraphMutation, { type: 'paste-selection' }>,
  catalog: CatalogView,
  context?: { definitions: SubgraphDefinition[]; destinationId: string },
): { snapshot: Snapshot; result: Record<string, unknown> } {
  const sourceNodes = payload.nodes.map((node) => clipboardNode(node, context?.definitions ?? snapshot.subgraphs ?? [], context?.destinationId));
  const sourceIds = new Set(sourceNodes.map((node) => String(node.id)));
  const sourceEdges = payload.edges.map((raw) => {
    const edge = structuredClone(raw) as Record<string, any>;
    if (
      typeof edge.source !== 'string' || typeof edge.target !== 'string'
      || typeof edge.sourceHandle !== 'string' || typeof edge.targetHandle !== 'string'
      || !sourceIds.has(edge.source) || !sourceIds.has(edge.target)
    ) {
      throw new CommandSignal('rejected', { error: 'Clipboard data is not valid.' });
    }
    return edge;
  });
  if (sourceIds.size !== sourceNodes.length || sourceEdges.some((edge) => !validEdgeEndpoints(sourceNodes, edge))) {
    throw new CommandSignal('rejected', { error: 'Clipboard connection endpoints are not valid.' });
  }
  const hints = classHints(catalog);
  const bounds = boundsOfRects(sourceNodes.map((node) => nodeRectOf(node, hints)));
  if (!bounds) throw new CommandSignal('rejected', { error: 'Clipboard data is not valid.' });
  const obstacles = snapshot.nodes.map((node) => nodeRectOf(node, hints));
  const spot = findFreeSlot(
    obstacles,
    { x: bounds.x + payload.offsetX, y: bounds.y + payload.offsetY },
    { width: bounds.width, height: bounds.height },
  );
  const dx = spot.x - bounds.x;
  const dy = spot.y - bounds.y;
  const work: Snapshot = {
    ...snapshot,
    nodes: snapshot.nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } })),
    edges: snapshot.edges.map((edge) => ({ ...edge })),
  };
  const ids = new Ids(work);
  const taken = new Set(work.nodes.map((node) => String(node.id)));
  const idMap = new Map<string, string>();
  const addedNodes = sourceNodes.map((source) => {
    const oldId = String(source.id);
    const nodeId = ids.node(taken);
    taken.add(nodeId);
    idMap.set(oldId, nodeId);
    const x = source.position.x + dx;
    const y = source.position.y + dy;
    const comfy = source.data.comfy && typeof source.data.comfy === 'object'
      ? structuredClone(source.data.comfy) as Record<string, any>
      : { type: source.data.comfyType, flags: {}, order: 0, mode: 0, properties: {} };
    comfy.id = Number(nodeId);
    comfy.pos = [x, y];
    if (Array.isArray(comfy.inputs)) comfy.inputs = comfy.inputs.map((input: Record<string, unknown>) => ({ ...input, link: null }));
    if (Array.isArray(comfy.outputs)) comfy.outputs = comfy.outputs.map((output: Record<string, unknown>) => ({ ...output, links: [] }));
    const data = { ...source.data, comfy };
    delete data.importedLinks;
    return {
      ...source,
      id: nodeId,
      type: 'comfy',
      position: { x, y },
      selected: false,
      dragging: false,
      measured: undefined,
      data,
    } as Record<string, any>;
  });
  const addedEdges = sourceEdges.map((source) => {
    const linkId = ids.link();
    const sourceId = idMap.get(source.source)!;
    const targetId = idMap.get(source.target)!;
    const dataType = typeof source.data?.dataType === 'string' ? source.data.dataType : 'unknown';
    const originId = /^\d+$/.test(sourceId) ? Number(sourceId) : sourceId;
    const targetIdValue = /^\d+$/.test(targetId) ? Number(targetId) : targetId;
    const originSlot = numericSlot(source.sourceHandle);
    const targetSlot = numericSlot(source.targetHandle);
    if (originSlot === null || targetSlot === null) throw new CommandSignal('rejected', { error: 'Connection slots must be numbers.' });
    const native = source.data?.comfyLink;
    const comfyLink = work.document?.formatVersion === 0.4
      ? Object.assign(Array.isArray(native) ? structuredClone(native) : [], [linkId, originId, originSlot, targetIdValue, targetSlot, dataType])
      : { ...(native && !Array.isArray(native) ? structuredClone(native) : {}), id: linkId, origin_id: originId, origin_slot: originSlot, target_id: targetIdValue, target_slot: targetSlot, type: dataType };
    return {
      ...source,
      id: `link-${linkId}`,
      source: sourceId,
      target: targetId,
      sourceHandle: source.sourceHandle,
      targetHandle: source.targetHandle,
      selected: false,
      data: { ...source.data, dataType, linkId, comfyLink },
    };
  });
  work.nodes.push(...addedNodes);
  work.edges.push(...addedEdges);
  return {
    snapshot: work,
    result: {
      nodeIds: addedNodes.map((node) => String(node.id)),
      edgeIds: addedEdges.map((edge) => String(edge.id)),
      idMap: Object.fromEntries(idMap),
    },
  };
}

function stampComponentAuthor(snapshot: Snapshot, payload: { ownerKind: string; ownerId: string }, author: 'user' | 'assistant'): void {
  snapshot.components = (snapshot.components ?? []).map((record) => (
    record.ownerKind === payload.ownerKind && record.ownerId === payload.ownerId ? { ...record, author } : record
  ));
}

/** Edits a batch may not hold: they replace or rewind the whole graph, or nest. */
const NOT_IN_BATCH = new Set(['batch', 'restore-revision', 'import-workflow', 'open-native']);

/** "@k" in a batch edit: the node the k-th edit of the batch added. */
function resolveRefs(edit: Record<string, unknown>, added: Array<string | null>): Record<string, unknown> {
  const swap = (value: unknown) => {
    if (typeof value !== 'string' || !/^@\d+$/.test(value)) return value;
    const id = added[Number(value.slice(1))];
    if (!id) throw new CommandSignal('rejected', { error: 'Node was not found.' });
    return id;
  };
  const out: Record<string, unknown> = { ...edit };
  for (const key of ['source', 'target', 'nodeId']) if (key in out) out[key] = swap(out[key]);
  if (out.edit && typeof out.edit === 'object') out.edit = resolveRefs(out.edit as Record<string, unknown>, added);
  return out;
}

/** The node an applied edit added, if it added one (add-node, insert-subgraph, the same inside a subgraph). */
function addedNodeId(result: Record<string, unknown>): string | null {
  if (typeof result.nodeId === 'string' && result.nodeId) return result.nodeId;
  if (typeof result.nodeId === 'number') return String(result.nodeId);
  if (typeof result.instanceId === 'string') return result.instanceId;
  return null;
}

/** Applies a batch: each edit in turn on the graph the previous one left, all of it one revision. */
function applyBatch(snapshot: Snapshot, actionId: string, edits: Array<Record<string, unknown>>, catalog: CatalogView): { snapshot: Snapshot; result: Record<string, unknown> } {
  let current = snapshot;
  const added: Array<string | null> = [];
  const results: Array<Record<string, unknown>> = [];
  edits.forEach((raw, index) => {
    const parsed = mutationSchema.safeParse(resolveRefs(raw, added));
    if (!parsed.success || NOT_IN_BATCH.has(parsed.data.type)) throw new CommandSignal('rejected', { error: 'A part of this change is not valid.' });
    const applied = applyMutation(current, `${actionId}#${index}`, parsed.data, catalog);
    current = { ...current, ...applied.snapshot };
    results.push(applied.result);
    added.push(addedNodeId(applied.result));
  });
  return { snapshot: current, result: { results, nodeIds: results.flatMap((result, index) => Array.isArray(result.nodeIds) ? result.nodeIds.map(String) : added[index] ? [added[index]!] : []) } };
}

function applyMutation(snapshot: Snapshot, actionId: string, payload: GraphMutation, catalog: CatalogView, context?: { definitions: SubgraphDefinition[]; destinationId: string }): { snapshot: Snapshot; result: Record<string, unknown> } {
  if (payload.type === 'batch') return applyBatch(snapshot, actionId, payload.edits, catalog);
  const nodes: Array<Record<string, any>> = snapshot.nodes.map((node) => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  }));
  const edges: Array<Record<string, any>> = snapshot.edges.map((edge) => ({ ...edge }));
  if (payload.type === 'remove-selection') return removeSelection(snapshot, payload);
  if (payload.type === 'paste-selection') return pasteSelection(snapshot, payload, catalog, context);
  if (payload.type === 'add-node') {
    const work: GraphSnapshot = { nodes, edges, document: snapshot.document, subgraphs: snapshot.subgraphs };
    const nodeId = new Ids(work).node(new Set(nodes.map((node) => String(node.id))));
    // Editing: a Note, Reroute or Primitive is built from its own template (editOps.ts), not from the catalog.
    const editor = editorNode(payload.nodeType, nodeId, payload.title, payload.x ?? 300, payload.y ?? 200);
    if (editor) {
      nodes.push(editor);
      return { snapshot: { nodes, edges, document: work.document }, result: { nodeId, nodeType: payload.nodeType } };
    }
    const ports = portsForClassType(payload.nodeType, catalog);
    const spec = catalog.nodes.find((item) => item.classType === payload.nodeType);
    // A new node starts with the widget values ComfyUI would give it; values the caller passed win.
    const parameters = { ...defaultParameters(spec), ...(payload.parameters ?? {}) };
    const placed = widgetsFromParameters(payload.nodeType, parameters, catalog);
    if (!placed.ok) throw new CommandSignal('rejected', { error: placed.error });
    const title = payload.title || payload.nodeType;
    const x = payload.x ?? 300;
    const y = payload.y ?? 200;
    const comfy: Record<string, unknown> = {
      id: Number(nodeId),
      type: payload.nodeType,
      title,
      pos: [x, y],
      size: [200, 80],
      flags: {},
      order: 0,
      mode: 0,
      properties: {},
    };
    if (spec && spec.widgetOrderReliable !== false) comfy.widgets_values = placed.values;
    nodes.push({
      id: nodeId,
      type: 'comfy',
      position: { x, y },
      data: {
        comfyType: payload.nodeType,
        title,
        inputs: ports.inputs,
        outputs: ports.outputs,
        parameters,
        annotations: [],
        comfy,
      },
    });
    return { snapshot: { nodes, edges, document: work.document }, result: { nodeId, nodeType: payload.nodeType } };
  }
  if (payload.type === 'annotate-node') {
    const node = nodes.find((item) => item.id === payload.nodeId);
    if (!node) throw new CommandSignal('rejected');
    const annotations = Array.isArray(node.data.annotations) ? node.data.annotations : [];
    node.data = { ...node.data, annotations: [...annotations, payload.annotation] };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId } };
  }
  if (payload.type === 'remove-node') {
    if (!nodes.some((node) => node.id === payload.nodeId)) throw new CommandSignal('rejected', { error: 'Node was not found.' });
    return {
      snapshot: {
        nodes: nodes.filter((node) => node.id !== payload.nodeId),
        edges: edges.filter((edge) => edge.source !== payload.nodeId && edge.target !== payload.nodeId),
        document: snapshot.document,
      },
      result: { nodeId: payload.nodeId },
    };
  }
  if (payload.type === 'move-node') {
    const node = nodes.find((item) => item.id === payload.nodeId);
    if (!node) throw new CommandSignal('rejected');
    node.position = { x: payload.x, y: payload.y };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId } };
  }
  if (payload.type === 'set-parameter') {
    const node = nodes.find((item) => item.id === payload.nodeId);
    if (!node) throw new CommandSignal('rejected');
    const classType = String(node.data?.comfyType ?? '');
    const parameters = { ...(node.data.parameters ?? {}), [payload.key]: payload.value };
    const comfy = node.data.comfy && typeof node.data.comfy === 'object' ? { ...node.data.comfy } : {
      id: node.id,
      type: classType,
      title: node.data?.title || classType,
      pos: [node.position?.x ?? 0, node.position?.y ?? 0],
      size: [200, 80],
      flags: {},
      order: 0,
      mode: 0,
      properties: {},
    };
    if (comfy.widgets_values === undefined) {
      const placed = widgetsFromParameters(classType, parameters, catalog);
      if (!placed.ok) throw new CommandSignal('rejected', { error: placed.error });
      const spec = catalog.nodes.find((item) => item.classType === classType);
      if (spec && spec.widgetOrderReliable !== false) comfy.widgets_values = placed.values;
    } else {
      const widgets = comfy.widgets_values;
      const widgetIndex = Array.isArray(widgets)
        ? arrayWidgetIndex(widgets, catalog, classType, payload.key, payload.widgetIndex)
        : payload.widgetIndex;
      patchWidgets(comfy, payload.key, payload.value, widgetIndex);
    }
    node.data = { ...node.data, parameters, comfy };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId, key: payload.key } };
  }
  if (payload.type === 'retarget-edge') {
    const edge = edges.find((item) => item.id === payload.edgeId);
    if (!edge) throw new CommandSignal('rejected');
    const target = nodes.find((item) => item.id === payload.target);
    if (!target) throw new CommandSignal('rejected', { error: 'Target node was not found.' });
    const input = inputPort(target, payload.targetHandle);
    if (!input) throw new CommandSignal('rejected', { error: 'Target handle is not an input on that node.' });
    const source = nodes.find((item) => item.id === edge.source);
    if (!source) throw new CommandSignal('rejected', { error: 'Source node was not found.' });
    const output = outputPort(source, String(edge.sourceHandle ?? ''));
    if (!output) throw new CommandSignal('rejected', { error: 'Source handle is not an output on that node.' });
    if (!portsCompatible(output.dataType, input.dataType)) {
      throw new CommandSignal('rejected', { error: 'Port types cannot be connected.' });
    }
    if (createsCycle(edges.filter((item) => item !== edge).map((item) => ({ source: String(item.source), target: String(item.target) })), String(edge.source), payload.target)) {
      throw new CommandSignal('rejected', { error: 'Connection would create a cycle.' });
    }
    edge.target = payload.target;
    edge.targetHandle = payload.targetHandle;
    // An input takes one link: the edge that held it is replaced, as in ComfyUI.
    const replaced = edges.filter((item) => item !== edge && item.target === payload.target && item.targetHandle === payload.targetHandle);
    return {
      snapshot: { nodes, edges: edges.filter((item) => !replaced.includes(item)), document: snapshot.document },
      result: { edgeId: payload.edgeId, ...(replaced.length > 0 ? { replacedEdgeIds: replaced.map((item) => String(item.id)) } : {}) },
    };
  }
  if (payload.type === 'set-component') {
    const nodeIds = nodes.map((node) => String(node.id));
    const definitionIds = subgraphIds(snapshot.subgraphs ?? []);
    const known = payload.ownerKind === 'node' ? nodeIds.includes(payload.ownerId) : definitionIds.includes(payload.ownerId);
    if (!known) throw new CommandSignal('rejected', { error: 'That component is not in the graph.' });
    const reconciled = reconcileComponents(snapshot.components ?? [], nodeIds, definitionIds);
    reconciled.components.push(...innerComponents(snapshot.components ?? [], snapshot.subgraphs ?? [], new Set(nodeIds)));
    return {
      snapshot: {
        nodes,
        edges,
        document: snapshot.document,
        process: snapshot.process,
        components: reconciled.components.map((record) => (
          record.ownerKind === payload.ownerKind && record.ownerId === payload.ownerId
            ? { ...record, purpose: payload.purpose, usage: payload.usage }
            : record
        )),
      },
      result: { ownerKind: payload.ownerKind, ownerId: payload.ownerId },
    };
  }
  if (payload.type === 'set-process') {
    return {
      snapshot: {
        nodes,
        edges,
        document: snapshot.document,
        components: snapshot.components,
        process: { title: payload.title, notes: payload.notes },
      },
      result: { title: payload.title },
    };
  }
  if (payload.type === 'open-native') {
    const parsed = parseNativeProject(payload.project);
    if (!parsed.ok) throw new CommandSignal('rejected', { error: parsed.error });
    const graphNodes = parsed.project.graph.nodes as Array<Record<string, any>>;
    const document = parsed.project.graph.document;
    // A version 1 file has no modelled subgraphs or groups; lift them from its native document.
    const lifted = document && (!parsed.project.subgraphs || !parsed.project.groups)
      ? liftSubgraphsAndGroups(document.raw, graphNodes)
      : { subgraphs: [], groups: [] };
    const opened = {
      nodes: graphNodes,
      edges: parsed.project.graph.edges,
      document,
      components: parsed.project.components,
      process: parsed.project.process,
      subgraphs: parsed.project.subgraphs ?? lifted.subgraphs,
      groups: parsed.project.groups ?? lifted.groups,
      projectExtras: projectExtrasOf(parsed.project.extensions, parsed.project.preserved),
    };
    // A file from anywhere is opened only up to the size the canvas can draw (graphLimits.ts).
    const tooLarge = graphLimitError(opened);
    if (tooLarge) throw new CommandSignal('rejected', { error: tooLarge });
    return { snapshot: opened, result: { upgradedFrom: parsed.project.upgradedFrom } };
  }
  if (payload.type === 'import-workflow') {
    // The plain counts of the file first, so a huge file is refused before any work on it.
    const raw = payload.document && typeof payload.document === 'object' ? payload.document as Record<string, unknown> : null;
    const rawTooLarge = raw ? graphLimitError({ nodes: raw.nodes, edges: raw.links }) : null;
    if (rawTooLarge) throw new CommandSignal('rejected', { error: rawTooLarge });
    const projected = projectWorkflow(payload.document);
    if ('error' in projected) throw new CommandSignal('rejected', { error: projected.error });
    const tooLarge = graphLimitError(projected.snapshot);
    if (tooLarge) throw new CommandSignal('rejected', { error: tooLarge });
    return { snapshot: { ...projected.snapshot, projectExtras: undefined }, result: { formatVersion: projected.snapshot.document?.formatVersion ?? null } };
  }
  // --- edits inside a subgraph definition (begin) ---
  if (payload.type === 'edit-in-subgraph') {
    // The same rules as on the root canvas, run on the definition's inner graph with the definition's own id
    // counters, then written back into the definition (innerEdits.ts). The root canvas keeps its nodes and edges.
    try {
      const inner = applyInnerEdit(snapshot as GraphSnapshot, actionId, payload, catalog, (level, id, edit, view) => applyMutation(level as Snapshot, id, edit, view, { definitions: snapshot.subgraphs ?? [], destinationId: payload.definitionId }) as { snapshot: GraphSnapshot; result: Record<string, unknown> });
      return { snapshot: { ...snapshot, nodes, edges, subgraphs: inner.snapshot.subgraphs }, result: inner.result };
    } catch (error) {
      if (error instanceof GraphOpError) throw new CommandSignal('rejected', { error: error.message });
      throw error;
    }
  }
  // --- edits inside a subgraph definition (end) ---
  if (payload.type === 'rename-node') {
    const node = nodes.find((item) => item.id === payload.nodeId);
    if (!node) throw new CommandSignal('rejected', { error: 'Node was not found.' });
    const comfy = node.data.comfy && typeof node.data.comfy === 'object' ? { ...node.data.comfy, title: payload.title } : undefined;
    node.data = { ...node.data, title: payload.title, ...(comfy ? { comfy } : {}) };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId, title: payload.title } };
  }
  // ── Import look: collapse or open a node (native flags.collapsed; the other flags stay). ──
  if (payload.type === 'collapse-node') {
    const wanted = new Set(payload.nodeIds);
    const found = nodes.filter((item) => wanted.has(String(item.id)));
    if (found.length !== wanted.size) throw new CommandSignal('rejected', { error: 'Node was not found.' });
    for (const node of found) {
      const base = node.data.comfy && typeof node.data.comfy === 'object' ? node.data.comfy : null;
      const comfy = base
        ? { ...base, flags: withCollapsed(base.flags, payload.collapsed) }
        : { id: /^\d+$/.test(String(node.id)) ? Number(node.id) : node.id, type: node.data?.comfyType, pos: [node.position?.x ?? 0, node.position?.y ?? 0], size: [200, 80], flags: withCollapsed({}, payload.collapsed), order: 0, mode: 0, properties: {} };
      node.data = { ...node.data, comfy };
    }
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeIds: payload.nodeIds, collapsed: payload.collapsed } };
  }
  // ── Layout: an arrangement or a tidy moves many nodes in one revision. ──
  if (payload.type === 'move-nodes') {
    const applied = applyMoveNodes(nodes, payload);
    if ('missing' in applied) throw new CommandSignal('rejected', { error: 'Node was not found.' });
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeIds: applied.moved } };
  }
  // ── end layout ──
  // Editing: bypass and mute, notes, a node on a link, replacing a node, colours (editOps.ts).
  if (isEditOp(payload)) {
    try {
      const applied = applyEditOp(snapshot as GraphSnapshot, actionId, payload, catalog, (level, id, edit, view) => applyMutation(level as Snapshot, id, edit, view) as { snapshot: GraphSnapshot; result: Record<string, unknown> });
      return { snapshot: applied.snapshot as Snapshot, result: applied.result };
    } catch (error) {
      if (error instanceof EditOpError) throw new CommandSignal('rejected', { error: error.message });
      throw error;
    }
  }
  if (isGraphOp(payload)) {
    try {
      const applied = applyGraphOp(snapshot, actionId, payload);
      return { snapshot: applied.snapshot as Snapshot, result: applied.result };
    } catch (error) {
      if (error instanceof GraphOpError) throw new CommandSignal('rejected', { error: error.message });
      throw error;
    }
  }
  if (payload.type === 'connect') {
    const originSlot = numericSlot(payload.sourceHandle);
    const targetSlot = numericSlot(payload.targetHandle);
    if (originSlot === null || targetSlot === null) {
      throw new CommandSignal('rejected', { error: 'Connection slots must be numbers.' });
    }
    const source = nodes.find((item) => item.id === payload.source);
    if (!source) throw new CommandSignal('rejected', { error: 'Source node was not found.' });
    const output = outputPort(source, String(payload.sourceHandle ?? ''));
    if (!output) throw new CommandSignal('rejected', { error: 'Source handle is not an output on that node.' });
    const target = nodes.find((item) => item.id === payload.target);
    if (!target) throw new CommandSignal('rejected', { error: 'Target node was not found.' });
    const input = inputPort(target, String(payload.targetHandle ?? ''));
    if (!input) throw new CommandSignal('rejected', { error: 'Target handle is not an input on that node.' });
    if (!portsCompatible(output.dataType, input.dataType)) {
      throw new CommandSignal('rejected', { error: 'Port types cannot be connected.' });
    }
    if (createsCycle(edges.map((item) => ({ source: String(item.source), target: String(item.target) })), payload.source, payload.target)) {
      throw new CommandSignal('rejected', { error: 'Connection would create a cycle.' });
    }
    // Editing: a Primitive feeds fields only (editOps.ts).
    const editorRefusal = refuseEditorLink(source, target, String(payload.targetHandle ?? ''), catalog);
    if (editorRefusal) throw new CommandSignal('rejected', { error: editorRefusal });
    const dataType = output.dataType;
    const work: GraphSnapshot = { nodes, edges, document: snapshot.document, subgraphs: snapshot.subgraphs };
    const linkId = new Ids(work).link();
    const originId = /^\d+$/.test(payload.source) ? Number(payload.source) : payload.source;
    const targetId = /^\d+$/.test(payload.target) ? Number(payload.target) : payload.target;
    const comfyLink = work.document?.formatVersion === 0.4
      ? [linkId, originId, originSlot, targetId, targetSlot, dataType]
      : { id: linkId, origin_id: originId, origin_slot: originSlot, target_id: targetId, target_slot: targetSlot, type: dataType };
    const edgeId = `link-${linkId}`;
    // An input takes one link: connecting into a linked input replaces that link, as in ComfyUI.
    const replaced = edges.filter((item) => item.target === payload.target && item.targetHandle === payload.targetHandle);
    const kept = edges.filter((item) => !replaced.includes(item));
    kept.push({
      id: edgeId,
      source: payload.source,
      target: payload.target,
      sourceHandle: payload.sourceHandle,
      targetHandle: payload.targetHandle,
      data: { dataType, linkId, comfyLink },
    });
    // Editing: a Reroute or a Primitive takes the type of what it now carries (editOps.ts).
    adoptLinkedType(nodes, kept[kept.length - 1], catalog);
    return {
      snapshot: { nodes, edges: kept, document: work.document },
      result: { edgeId, linkId, ...(replaced.length > 0 ? { replacedEdgeIds: replaced.map((item) => String(item.id)) } : {}) },
    };
  }
  if (payload.type !== 'remove-edge') throw new CommandSignal('rejected');
  if (!edges.some((edge) => edge.id === payload.edgeId)) throw new CommandSignal('rejected', { error: 'Connection was not found.' });
  return {
    snapshot: {
      nodes,
      edges: edges.filter((edge) => edge.id !== payload.edgeId),
      document: snapshot.document,
    },
    result: { edgeId: payload.edgeId },
  };
}

/**
 * restore-revision (undo/redo): the named revision's whole snapshot (nodes, edges, document, components,
 * process, subgraphs, groups) becomes the next revision. The id counters stay where the current revision has
 * them, so a node made after an undo never takes the id of a node the undo took away.
 */
function restoreRevision(
  db: Database.Database,
  projectId: string,
  revisionId: string,
  current: Snapshot,
): { snapshot: Snapshot; result: Record<string, unknown> } {
  const row = db
    .prepare('SELECT id, rev_seq, nodes, edges, document, components, process_meta FROM graph_revisions WHERE id = ? AND project_id = ?')
    .get(revisionId, projectId) as RevisionRow | undefined;
  if (!row) throw new CommandSignal('rejected', { error: 'Revision was not found.' });
  const restored = snapshotFromRow(row);
  const lastNode = nextNodeId(current) - 1;
  const lastLink = nextLinkId(current) - 1;
  let document = restored.document;
  if (!document && (lastNode > 0 || lastLink > 0)) document = blankDocument();
  if (document && lastNode > 0 && nextNodeId({ ...restored, document }) - 1 < lastNode) document = rememberNodeId(document, lastNode);
  if (document && lastLink > 0 && nextLinkId({ ...restored, document }) - 1 < lastLink) document = rememberLinkId(document, lastLink);
  return {
    // Definitions keep their counters too, so an inner node made after an undo gets a fresh id.
    snapshot: { ...restored, document, subgraphs: keepDefinitionCounters(restored.subgraphs, current.subgraphs) },
    result: { revisionId: row.id, restoredRevSeq: row.rev_seq },
  };
}

interface CatalogWatch {
  version: Database.Statement;
  view: CatalogView | null;
  key: string;
}

const catalogWatches = new WeakMap<Database.Database, CatalogWatch>();

/**
 * readCatalog, cached per connection. This connection's own catalog writes bump a counter through temporary
 * triggers (no schema change); writes from another connection change PRAGMA data_version. Either drops the cache.
 */
export function cachedCatalog(db: Database.Database): CatalogView {
  let watch = catalogWatches.get(db);
  if (!watch) {
    // The temporary triggers are made outside a transaction, so a rollback cannot take them away.
    if (db.inTransaction) return readCatalog(db);
    try {
      db.exec(`CREATE TEMP TABLE IF NOT EXISTS graph_helper_catalog_version (n INTEGER NOT NULL)`);
      db.exec(`INSERT INTO graph_helper_catalog_version (n) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM graph_helper_catalog_version)`);
      for (const table of ['node_catalog', 'model_catalog']) {
        for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
          db.exec(`CREATE TEMP TRIGGER IF NOT EXISTS graph_helper_${table}_${event.toLowerCase()} AFTER ${event} ON main.${table}
            BEGIN UPDATE graph_helper_catalog_version SET n = n + 1; END`);
        }
      }
      watch = { version: db.prepare('SELECT n FROM graph_helper_catalog_version').pluck(), view: null, key: '' };
    } catch (error) {
      // No temporary storage (a full disk, a locked or unwritable profile): read the catalog each time instead.
      console.error('[Commit] Catalog cache unavailable:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
      return readCatalog(db);
    }
    catalogWatches.set(db, watch);
  }
  const key = `${String(watch.version.get())}:${String(db.pragma('data_version', { simple: true }))}`;
  if (!watch.view || watch.key !== key) {
    watch.view = readCatalog(db);
    watch.key = key;
  }
  return watch.view;
}

export function commitCommand(
  db: Database.Database,
  input: unknown,
  options?: { failBeforeCommit?: boolean },
): CommandResponse {
  const parsed = commandRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'rejected', projection: null, result: null };
  }
  const request: CommandRequest = parsed.data;
  const payloadCanonical = canonicalPayload(request.payload);
  try {
    // Sets up the catalog cache outside the transaction (it makes temporary triggers). Inside the try: on a database
    // that cannot be written the person gets "not stored", not an exception.
    if (!db.inTransaction) cachedCatalog(db);
    const outcome = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT run_id, payload_canonical, result_json
           FROM applied_commands WHERE project_id = ? AND action_id = ?`,
        )
        .get(request.projectId, request.actionId) as
        | { run_id: string | null; payload_canonical: string; result_json: string }
        | undefined;
      if (existing) {
        const sameRun = existing.run_id === request.runId;
        if (sameRun && existing.payload_canonical === payloadCanonical) {
          return { status: 'historical' as const, result: JSON.parse(existing.result_json) };
        }
        throw new CommandSignal('rejected');
      }
      if (request.actor === 'manual') {
        if (request.runId !== null) throw new CommandSignal('rejected');
      } else if (!request.runId) {
        throw new CommandSignal('rejected');
      }

      const current = readCurrent(db, request.projectId);
      if (!current) throw new CommandSignal('rejected');

      if (request.actor === 'ai') {
        const run = db
          .prepare('SELECT status, expected_revision_id FROM runs WHERE project_id = ? AND run_id = ?')
          .get(request.projectId, request.runId) as { status: string; expected_revision_id: string } | undefined;
        if (!run) throw new CommandSignal('rejected');
        if (
          run.status !== 'running' ||
          current.revisionId !== run.expected_revision_id ||
          current.revisionId !== request.expectedRevisionId
        ) {
          throw new CommandSignal('conflict');
        }
      } else if (current.revisionId !== request.expectedRevisionId) {
        throw new CommandSignal('conflict');
      }

      const catalog = cachedCatalog(db);
      // Layout: the helper's coordinates are a hint; its node never lands on another. The stored
      // payload (and so a retry's match) stays what was sent.
      const payload = request.actor === 'ai' && request.runId && request.payload.type === 'add-node'
        ? placeHelperNode(request.payload, current.snapshot.nodes, runCreatedNodeIds(db, request.projectId, request.runId), catalog)
        : request.actor === 'ai' && request.runId && request.payload.type === 'insert-subgraph'
          ? placeHelperSubgraph(request.payload, current.snapshot.nodes, current.snapshot.subgraphs ?? [], runCreatedNodeIds(db, request.projectId, request.runId), catalog)
          : request.payload;
      const applied = payload.type === 'restore-revision'
        ? restoreRevision(db, request.projectId, payload.revisionId, current.snapshot)
        : applyMutation(current.snapshot, request.actionId, payload, catalog);
      // The text of a component is the person's or the helper's: the badge on the canvas says which.
      if (payload.type === 'set-component') stampComponentAuthor(applied.snapshot, payload, request.actor === 'manual' ? 'user' : 'assistant');
      const sealed = sealSnapshot(applied.snapshot, current.snapshot);
      applied.snapshot = sealed.snapshot;
      if (request.payload.type === 'import-workflow') {
        const census = listSubgraphDefinitions(applied.snapshot.document?.raw);
        applied.result = {
          ...applied.result,
          // Model files by the fields of the nodes as well as the file's own list, as the check counts them; with no
          // model list read yet nothing is called missing (the import message says the node list is not read).
          ...withFieldModels(missingDeps(request.payload.document, catalog), applied.snapshot.nodes as GraphNodeLike[], catalog),
          shownDifferently: shownDifferently(request.payload.document),
          duplicateSubgraphIds: census.duplicateIds,
          unidentifiedSubgraphs: census.unidentified,
        };
      }
      if (request.payload.type === 'open-native') {
        const census = listSubgraphDefinitions(applied.snapshot.document?.raw);
        applied.result = {
          ...applied.result,
          orphans: sealed.orphans,
          duplicateSubgraphIds: census.duplicateIds,
          unidentifiedSubgraphs: census.unidentified,
        };
      }
      const nextSeq = current.revSeq + 1;
      const revisionId = `rev-${request.projectId}-${nextSeq}`;
      const now = Date.now();
      db.prepare(
        `INSERT INTO graph_revisions
          (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document, components, process_meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        revisionId,
        request.projectId,
        now,
        JSON.stringify(applied.snapshot.nodes),
        JSON.stringify(applied.snapshot.edges),
        current.revisionId,
        request.payload.type,
        request.actor === 'ai' ? 'ai' : 'user',
        nextSeq,
        encodeDocumentColumn(applied.snapshot),
        JSON.stringify(applied.snapshot.components ?? []),
        JSON.stringify(applied.snapshot.process ?? EMPTY_PROCESS),
      );
      db.prepare('UPDATE projects SET current_revision_id = ?, updated_at = ? WHERE id = ?').run(revisionId, now, request.projectId);
      // Explanations: the graph this revision shows, and what an opened project file brought (knowledge/projectExplanations.ts).
      applied.result = { ...applied.result, ...explanationsAfterCommit(db, { projectId: request.projectId, revisionId, parentRevisionId: current.revisionId, payload: request.payload, result: applied.result, before: current.snapshot, after: applied.snapshot }) };
      db.prepare(
        `INSERT INTO applied_commands
          (project_id, action_id, run_id, actor, payload_canonical, result_json, result_revision_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        request.projectId,
        request.actionId,
        request.runId,
        request.actor,
        payloadCanonical,
        JSON.stringify(applied.result),
        revisionId,
      );
      if (request.actor === 'ai') {
        db.prepare('UPDATE runs SET expected_revision_id = ? WHERE project_id = ? AND run_id = ?').run(
          revisionId,
          request.projectId,
          request.runId,
        );
      } else if (request.payload.type === 'import-workflow' || request.payload.type === 'open-native') {
        // Another graph took the canvas (a new project, an import, an opened project): a run that was building
        // stops here. None of its steps may land on a graph it did not start on.
        db.prepare(`UPDATE runs SET status = 'cancelled' WHERE project_id = ? AND status IN ('running', 'paused')`).run(request.projectId);
      } else {
        // The person edited during a run: the run continues from the person's state, not from a conflict.
        db.prepare(`UPDATE runs SET expected_revision_id = ? WHERE project_id = ? AND status IN ('running', 'paused')`).run(
          revisionId,
          request.projectId,
        );
      }
      if (request.payload.type === 'import-workflow' || request.payload.type === 'open-native') {
        // A different graph: no open proposal was made for it.
        supersedeAllOpen(db, request.projectId, request.payload.type);
      }
      const remaining = new Set(applied.snapshot.nodes.map((node) => String(node.id)));
      const vanished = current.snapshot.nodes.map((node) => String(node.id)).filter((id) => !remaining.has(id));
      if (vanished.length > 0) supersedeForMissingNodes(db, request.projectId, vanished, request.payload.type);
      if (options?.failBeforeCommit) {
        throw new Error('commit failed before stamp');
      }
      return { status: 'applied' as const, result: applied.result };
    }).immediate();
    const projection = readProjection(db, request.projectId);
    if (outcome.status === 'applied') pruneHistoryAfterCommit(db, request.projectId, projection?.revSeq);
    return { ...outcome, projection };
  } catch (error) {
    if (error instanceof CommandSignal) {
      return { status: error.status, projection: readProjection(db, request.projectId), result: error.detail };
    }
    // The disk is full or the file cannot be written: the transaction rolled back, so the graph is as it was.
    // The person is told why the change did not land instead of seeing it silently vanish.
    const storage = storageErrorCode(error);
    if (storage) {
      console.error('[Commit] Not stored:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
      let projection: Projection | null = null;
      try {
        projection = readProjection(db, request.projectId);
      } catch {
        projection = null;
      }
      return { status: 'rejected', projection, result: { error: storage } };
    }
    throw error;
  }
}

/** A new run. Any other open (running or paused) run of the project is closed first: one run at a time. */
export function startRun(db: Database.Database, projectId: string): RunStart {
  ensureProject(db, projectId);
  const runId = `run-${randomUUID()}`;
  const revisionId = db.transaction(() => {
    const current = readCurrent(db, projectId);
    if (!current) throw new Error(`Project ${projectId} has no revision`);
    db.prepare(`UPDATE runs SET status = 'closed' WHERE project_id = ? AND status IN ('running', 'paused')`).run(projectId);
    db.prepare(
      `INSERT INTO runs (project_id, run_id, status, base_revision_id, expected_revision_id)
       VALUES (?, ?, 'running', ?, ?)`,
    ).run(projectId, runId, current.revisionId, current.revisionId);
    return current.revisionId;
  }).immediate();
  const projection = readProjection(db, projectId);
  if (!projection) throw new Error(`Project ${projectId} has no projection`);
  return { runId, baseRevisionId: revisionId, expectedRevisionId: revisionId, projection };
}

/**
 * Reopen the project's newest paused run (same run id, status back to running, continuing from the current
 * revision). Starts a new run only when none is paused.
 */
export function resumeRun(db: Database.Database, projectId: string): RunStart {
  ensureProject(db, projectId);
  const resumed = db.transaction(() => {
    const paused = db
      .prepare(`SELECT run_id, base_revision_id FROM runs WHERE project_id = ? AND status = 'paused' ORDER BY rowid DESC LIMIT 1`)
      .get(projectId) as { run_id: string; base_revision_id: string } | undefined;
    if (!paused) return null;
    const current = readCurrent(db, projectId);
    if (!current) throw new Error(`Project ${projectId} has no revision`);
    db.prepare(`UPDATE runs SET status = 'closed' WHERE project_id = ? AND status IN ('running', 'paused') AND run_id <> ?`).run(projectId, paused.run_id);
    db.prepare(`UPDATE runs SET status = 'running', expected_revision_id = ? WHERE project_id = ? AND run_id = ?`).run(current.revisionId, projectId, paused.run_id);
    return { runId: paused.run_id, baseRevisionId: paused.base_revision_id, expectedRevisionId: current.revisionId };
  }).immediate();
  if (!resumed) return startRun(db, projectId);
  const projection = readProjection(db, projectId);
  if (!projection) throw new Error(`Project ${projectId} has no projection`);
  return { ...resumed, projection };
}

/** At startup no turn is in flight: every run left running or paused by an earlier session is closed. */
export function closeStaleRuns(db: Database.Database): number {
  return db.prepare(`UPDATE runs SET status = 'closed' WHERE status IN ('running', 'paused')`).run().changes;
}

export function pauseRun(db: Database.Database, projectId: string, runId: string): CommandResponse {
  return setRunStatus(db, projectId, runId, ['running'], 'paused');
}

export function cancelRun(db: Database.Database, projectId: string, runId: string): CommandResponse {
  return setRunStatus(db, projectId, runId, ['running', 'paused'], 'cancelled');
}

/**
 * The turn ended normally: the helper's nodes are tidied (one commit, so one undo takes it back), then the run
 * no longer accepts commits and the interface stops showing it.
 */
export function closeRun(db: Database.Database, projectId: string, runId: string): CommandResponse {
  tidyRun(db, projectId, runId);
  return setRunStatus(db, projectId, runId, ['running', 'paused'], 'closed');
}

// ── Layout: tidy at run close ──────────────────────────────────────────────────────────────────────
/**
 * Lays out the nodes a still-running run created, keeping every other node fixed, as one move-nodes commit of
 * the run. A failure only skips the tidy: closing the run never depends on it.
 */
export function tidyRun(db: Database.Database, projectId: string, runId: string): CommandResponse | null {
  try {
    const projection = readProjection(db, projectId);
    const active = projection?.activeRun;
    if (!projection || !active || active.runId !== runId || active.status !== 'running') return null;
    const moves = tidyMoves(
      projection.snapshot.nodes as Array<Record<string, any>>,
      projection.snapshot.edges as Array<Record<string, any>>,
      runCreatedNodeIds(db, projectId, runId),
      cachedCatalog(db),
    );
    if (moves.length === 0) return null;
    return commitCommand(db, {
      projectId,
      runId,
      actionId: `${runId}:tidy`,
      expectedRevisionId: projection.currentRevisionId,
      actor: 'ai',
      payload: { type: 'move-nodes', moves },
    });
  } catch (error) {
    console.warn('[Layout] Tidy skipped:', error instanceof Error ? error.message.slice(0, 200) : 'unknown error');
    return null;
  }
}
// ── end layout ───────────────────────────────────────────────────────────────────────────────────────────

function setRunStatus(
  db: Database.Database,
  projectId: string,
  runId: string,
  from: string[],
  to: 'paused' | 'cancelled' | 'closed',
): CommandResponse {
  const changed = db.transaction(() => {
    const run = db.prepare('SELECT status FROM runs WHERE project_id = ? AND run_id = ?').get(projectId, runId) as
      | { status: string }
      | undefined;
    if (!run || (!from.includes(run.status) && run.status !== to)) return false;
    if (run.status !== to) {
      db.prepare('UPDATE runs SET status = ? WHERE project_id = ? AND run_id = ?').run(to, projectId, runId);
    }
    return true;
  }).immediate();
  if (!changed) return { status: 'rejected', projection: readProjection(db, projectId), result: null };
  return { status: 'applied', projection: readProjection(db, projectId), result: { runId, status: to } };
}

export function switchProject(db: Database.Database, fromProjectId: string): Projection | null {
  db.transaction(() => {
    db.prepare(`UPDATE runs SET status = 'closed' WHERE project_id = ? AND status IN ('running', 'paused')`).run(fromProjectId);
  }).immediate();
  return readProjection(db, fromProjectId);
}

/** Read-only revision history: the newest `limit` revisions, oldest first. Never moves the current pointer. */
export function listRevisions(db: Database.Database, projectId: string, limit = 2000): RevisionSummary[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.rev_seq, r.timestamp, r.description, r.source, a.actor, a.result_json, a.run_id,
         CASE WHEN r.description IN ('import-workflow', 'open-native') THEN NULL ELSE a.payload_canonical END AS payload_canonical
       FROM graph_revisions r
       LEFT JOIN applied_commands a ON a.result_revision_id = r.id AND a.project_id = r.project_id
       WHERE r.project_id = ? ORDER BY r.rev_seq DESC, r.rowid DESC LIMIT ?`,
    )
    .all(projectId, limit) as Array<{
      id: string; rev_seq: number; timestamp: number; description: string | null; source: string;
      actor: string | null; result_json: string | null; payload_canonical: string | null; run_id: string | null;
    }>;
  return rows.reverse().map((row) => {
    const type = row.description ?? '';
    const parsed = row.payload_canonical ? parseRecord(row.payload_canonical) : null;
    const result = row.result_json ? parseRecord(row.result_json) : null;
    const payload = parsed ? recentPayload(type, parsed, result).payload : row.actor ? { type } : null;
    const restored = type === 'restore-revision' && typeof result?.revisionId === 'string' ? result.revisionId : null;
    return {
      id: row.id,
      revSeq: row.rev_seq,
      timestamp: row.timestamp,
      description: row.description,
      source: row.source,
      actor: row.actor === 'ai' ? 'ai' as const : row.actor === 'manual' ? 'manual' as const : null,
      payload,
      restoredRevisionId: restored,
      runId: row.run_id ?? null,
    };
  });
}

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** The snapshot of any revision of a project, sealed the same way as the current one; null when it is not there. */
export function loadRevision(db: Database.Database, projectId: string, revisionId: string): Projection['snapshot'] | null {
  const revision = db
    .prepare('SELECT id, rev_seq, nodes, edges, document, components, process_meta FROM graph_revisions WHERE id = ? AND project_id = ?')
    .get(revisionId, projectId) as RevisionRow | undefined;
  return revision ? snapshotFromRow(revision) : null;
}

/**
 * The last applied commands of a project, oldest first among the newest `limit`, with who did them, the
 * mutation type, the ids they touched and when. The source of "what the person did recently" in the agent
 * prompt. Commands that made no revision (refused, historical) are not in applied_commands.
 */
export function listRecentCommands(
  db: Database.Database,
  projectId: string,
  limit = 30,
  options: { actor?: 'ai' | 'manual' } = {},
): RecentCommand[] {
  const cap = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = db
    .prepare(
      `SELECT a.action_id, a.actor, a.payload_canonical, a.result_json, a.result_revision_id, r.timestamp, r.rev_seq
       FROM applied_commands a JOIN graph_revisions r ON r.id = a.result_revision_id AND r.project_id = a.project_id
       WHERE a.project_id = ? AND (? IS NULL OR a.actor = ?)
       ORDER BY r.rev_seq DESC, r.rowid DESC LIMIT ?`,
    )
    .all(projectId, options.actor ?? null, options.actor ?? null, cap) as Array<{
      action_id: string; actor: string; payload_canonical: string; result_json: string; result_revision_id: string; timestamp: number; rev_seq: number;
    }>;
  const parse = (text: string): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  };
  return rows.reverse().flatMap((row) => {
    const payload = parse(row.payload_canonical);
    if (!payload || typeof payload.type !== 'string') return [];
    const kept = recentPayload(payload.type, payload, parse(row.result_json));
    return [{
      actionId: row.action_id,
      actor: row.actor === 'ai' ? 'ai' as const : 'manual' as const,
      type: payload.type,
      ids: kept.ids,
      timestamp: row.timestamp,
      revisionId: row.result_revision_id,
      payload: kept.payload,
    }];
  });
}
