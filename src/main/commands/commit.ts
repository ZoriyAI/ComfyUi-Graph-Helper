import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { canonicalPayload } from '../../shared/commands/canonical';
import {
  commandRequestSchema,
  type ActiveRun,
  type CommandRequest,
  type CommandResponse,
  type GraphMutation,
  type Projection,
  type RunStart,
} from '../../shared/commands/types';
import { widgetIndexFor } from '../../shared/catalog/objectInfo';
import type { CatalogView } from '../../shared/catalog/types';
import { ensureCatalog, readCatalog } from '../catalog/repository';
import { portsCompatible } from '../../shared/graph/linkTypes';
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
import { parseNativeProject } from '../../shared/native-project';
import {
  missingDeps,
  nextLinkId,
  numericSlot,
  patchWidgets,
  projectWorkflow,
  rememberLinkId,
  widgetsFromParameters,
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
  const snapshot = sealSnapshot({
    nodes: JSON.parse(revision.nodes),
    edges: JSON.parse(revision.edges),
    document: parseDocument(revision.document),
    components: parseStoredComponents(revision.components),
    process: parseStoredProcess(revision.process_meta),
  });
  return {
    revisionId: revision.id,
    revSeq: revision.rev_seq,
    snapshot: snapshot.snapshot,
  };
}

function sealSnapshot(snapshot: Snapshot, fallback?: Snapshot): { snapshot: Snapshot; orphans: string[] } {
  const census = listSubgraphDefinitions(snapshot.document?.raw);
  const reconciled = reconcileComponents(
    snapshot.components ?? fallback?.components ?? [],
    snapshot.nodes.map((node) => String(node.id)),
    census.definitions.map((item) => item.id),
  );
  return {
    orphans: reconciled.orphans,
    snapshot: {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      document: snapshot.document,
      components: reconciled.components,
      process: normalizeProcess(snapshot.process ?? fallback?.process ?? EMPTY_PROCESS),
    },
  };
}

function parseDocument(raw: string | null | undefined): WorkflowDocumentState | null {
  if (!raw || raw === '{}') return null;
  const parsed = JSON.parse(raw) as WorkflowDocumentState;
  if (!parsed?.raw || (parsed.formatVersion !== 1 && parsed.formatVersion !== 0.4)) return null;
  return parsed;
}

export function readProjection(db: Database.Database, projectId: string): Projection | null {
  const current = readCurrent(db, projectId);
  if (!current) return null;
  const active = db
    .prepare(
      `SELECT run_id, status, expected_revision_id
       FROM runs
       WHERE project_id = ? AND status IN ('running', 'paused')
       ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, rowid DESC
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
    ).run(revisionId, projectId, now, '[]', '[]', null, 'Initial', 'system', 1, '{}', '[]', '{}');
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

function applyMutation(snapshot: Snapshot, actionId: string, payload: GraphMutation, catalog: CatalogView): { snapshot: Snapshot; result: Record<string, unknown> } {
  const nodes: Array<Record<string, any>> = snapshot.nodes.map((node) => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  }));
  const edges: Array<Record<string, any>> = snapshot.edges.map((edge) => ({ ...edge }));
  if (payload.type === 'add-node') {
    const nodeId = `node-${actionId}`;
    const ports = portsForClassType(payload.nodeType, catalog);
    const parameters = payload.parameters ?? {};
    const placed = widgetsFromParameters(payload.nodeType, parameters, catalog);
    if (!placed.ok) throw new CommandSignal('rejected', { error: placed.error });
    const title = payload.title || payload.nodeType;
    const x = payload.x ?? 300;
    const y = payload.y ?? 200;
    const spec = catalog.nodes.find((item) => item.classType === payload.nodeType);
    const comfy: Record<string, unknown> = {
      id: nodeId,
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
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId, nodeType: payload.nodeType } };
  }
  if (payload.type === 'annotate-node') {
    const node = nodes.find((item) => item.id === payload.nodeId);
    if (!node) throw new CommandSignal('rejected');
    const annotations = Array.isArray(node.data.annotations) ? node.data.annotations : [];
    node.data = { ...node.data, annotations: [...annotations, payload.annotation] };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId } };
  }
  if (payload.type === 'remove-node') {
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
    edge.target = payload.target;
    edge.targetHandle = payload.targetHandle;
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { edgeId: payload.edgeId } };
  }
  if (payload.type === 'set-component') {
    const census = listSubgraphDefinitions(snapshot.document?.raw);
    const nodeIds = nodes.map((node) => String(node.id));
    const subgraphIds = census.definitions.map((item) => item.id);
    const known = payload.ownerKind === 'node' ? nodeIds.includes(payload.ownerId) : subgraphIds.includes(payload.ownerId);
    if (!known) throw new CommandSignal('rejected', { error: 'That component is not in the graph.' });
    const reconciled = reconcileComponents(snapshot.components ?? [], nodeIds, subgraphIds);
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
    return {
      snapshot: {
        nodes: parsed.project.graph.nodes,
        edges: parsed.project.graph.edges,
        document: parsed.project.graph.document,
        components: parsed.project.components,
        process: parsed.project.process,
      },
      result: { upgradedFrom: parsed.project.upgradedFrom },
    };
  }
  if (payload.type === 'import-workflow') {
    const projected = projectWorkflow(payload.document);
    if ('error' in projected) throw new CommandSignal('rejected', { error: projected.error });
    return { snapshot: projected.snapshot, result: { formatVersion: projected.snapshot.document?.formatVersion ?? null } };
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
    const dataType = output.dataType;
    const linkId = nextLinkId({ nodes, edges, document: snapshot.document });
    const originId = /^\d+$/.test(payload.source) ? Number(payload.source) : payload.source;
    const targetId = /^\d+$/.test(payload.target) ? Number(payload.target) : payload.target;
    const comfyLink = snapshot.document?.formatVersion === 0.4
      ? [linkId, originId, originSlot, targetId, targetSlot, dataType]
      : { id: linkId, origin_id: originId, origin_slot: originSlot, target_id: targetId, target_slot: targetSlot, type: dataType };
    const edgeId = `link-${linkId}`;
    edges.push({
      id: edgeId,
      source: payload.source,
      target: payload.target,
      sourceHandle: payload.sourceHandle,
      targetHandle: payload.targetHandle,
      data: { dataType, linkId, comfyLink },
    });
    return {
      snapshot: {
        nodes,
        edges,
        document: snapshot.document ? rememberLinkId(snapshot.document, linkId) : snapshot.document,
      },
      result: { edgeId, linkId },
    };
  }
  return {
    snapshot: {
      nodes,
      edges: edges.filter((edge) => edge.id !== payload.edgeId),
      document: snapshot.document,
    },
    result: { edgeId: payload.edgeId },
  };
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

      const applied = applyMutation(current.snapshot, request.actionId, request.payload, readCatalog(db));
      const sealed = sealSnapshot(applied.snapshot, current.snapshot);
      applied.snapshot = sealed.snapshot;
      if (request.payload.type === 'import-workflow') {
        const census = listSubgraphDefinitions(applied.snapshot.document?.raw);
        applied.result = {
          ...applied.result,
          ...missingDeps(request.payload.document, readCatalog(db)),
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
        JSON.stringify(applied.snapshot.document ?? {}),
        JSON.stringify(applied.snapshot.components ?? []),
        JSON.stringify(applied.snapshot.process ?? EMPTY_PROCESS),
      );
      db.prepare('UPDATE projects SET current_revision_id = ?, updated_at = ? WHERE id = ?').run(revisionId, now, request.projectId);
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
      }
      if (options?.failBeforeCommit) {
        throw new Error('commit failed before stamp');
      }
      return { status: 'applied' as const, result: applied.result };
    }).immediate();
    return { ...outcome, projection: readProjection(db, request.projectId) };
  } catch (error) {
    if (error instanceof CommandSignal) {
      return { status: error.status, projection: readProjection(db, request.projectId), result: error.detail };
    }
    throw error;
  }
}

export function startRun(db: Database.Database, projectId: string): RunStart {
  ensureProject(db, projectId);
  const current = readCurrent(db, projectId);
  if (!current) throw new Error(`Project ${projectId} has no revision`);
  const runId = `run-${randomUUID()}`;
  db.prepare(
    `INSERT INTO runs (project_id, run_id, status, base_revision_id, expected_revision_id)
     VALUES (?, ?, 'running', ?, ?)`,
  ).run(projectId, runId, current.revisionId, current.revisionId);
  const projection = readProjection(db, projectId);
  if (!projection) throw new Error(`Project ${projectId} has no projection`);
  return { runId, baseRevisionId: current.revisionId, expectedRevisionId: current.revisionId, projection };
}

export function resumeRun(db: Database.Database, projectId: string): RunStart {
  return startRun(db, projectId);
}

export function pauseRun(db: Database.Database, projectId: string, runId: string): CommandResponse {
  return setRunStatus(db, projectId, runId, ['running'], 'paused');
}

export function cancelRun(db: Database.Database, projectId: string, runId: string): CommandResponse {
  return setRunStatus(db, projectId, runId, ['running', 'paused'], 'cancelled');
}

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
