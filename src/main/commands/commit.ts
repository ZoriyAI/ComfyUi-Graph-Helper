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
import { ensureCatalog, readCatalog } from '../catalog/repository';
import { inferInputs, inferOutputs } from '../../shared/graph/ports';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import {
  missingDeps,
  patchWidgets,
  projectWorkflow,
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
}

interface RevisionRow {
  id: string;
  rev_seq: number;
  nodes: string;
  edges: string;
  document: string | null;
}

function readCurrent(db: Database.Database, projectId: string): { revisionId: string; revSeq: number; snapshot: Snapshot } | null {
  const project = db.prepare('SELECT current_revision_id FROM projects WHERE id = ?').get(projectId) as
    | { current_revision_id: string | null }
    | undefined;
  if (!project?.current_revision_id) return null;
  const revision = db.prepare('SELECT id, rev_seq, nodes, edges, document FROM graph_revisions WHERE id = ?').get(project.current_revision_id) as
    | RevisionRow
    | undefined;
  if (!revision) return null;
  return {
    revisionId: revision.id,
    revSeq: revision.rev_seq,
    snapshot: {
      nodes: JSON.parse(revision.nodes),
      edges: JSON.parse(revision.edges),
      document: parseDocument(revision.document),
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
        (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(revisionId, projectId, now, '[]', '[]', null, 'Initial', 'system', 1, '{}');
  });
  write.immediate();
}

export function ensureWorkspace(db: Database.Database): void {
  ensureProject(db, DESKTOP_PROJECT_ID, 'Desktop');
  ensureCatalog(db);
}

function applyMutation(snapshot: Snapshot, actionId: string, payload: GraphMutation): { snapshot: Snapshot; result: Record<string, unknown> } {
  const nodes: Array<Record<string, any>> = snapshot.nodes.map((node) => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  }));
  const edges: Array<Record<string, any>> = snapshot.edges.map((edge) => ({ ...edge }));
  if (payload.type === 'add-node') {
    const nodeId = `node-${actionId}`;
    nodes.push({
      id: nodeId,
      type: 'comfy',
      position: { x: payload.x ?? 300, y: payload.y ?? 200 },
      data: {
        comfyType: payload.nodeType,
        title: payload.title || payload.nodeType,
        inputs: inferInputs(payload.nodeType),
        outputs: inferOutputs(payload.nodeType),
        parameters: payload.parameters ?? {},
        annotations: [],
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
    const comfy = node.data.comfy && typeof node.data.comfy === 'object' ? { ...node.data.comfy } : {};
    patchWidgets(comfy, payload.key, payload.value, payload.widgetIndex);
    node.data = {
      ...node.data,
      parameters: { ...(node.data.parameters ?? {}), [payload.key]: payload.value },
      comfy,
    };
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { nodeId: payload.nodeId, key: payload.key } };
  }
  if (payload.type === 'retarget-edge') {
    const edge = edges.find((item) => item.id === payload.edgeId);
    if (!edge) throw new CommandSignal('rejected');
    edge.target = payload.target;
    edge.targetHandle = payload.targetHandle;
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { edgeId: payload.edgeId } };
  }
  if (payload.type === 'import-workflow') {
    const projected = projectWorkflow(payload.document);
    if ('error' in projected) throw new CommandSignal('rejected', { error: projected.error });
    return { snapshot: projected.snapshot, result: { formatVersion: projected.snapshot.document?.formatVersion ?? null } };
  }
  if (payload.type === 'connect') {
    const edgeId = `edge-${actionId}`;
    edges.push({
      id: edgeId,
      source: payload.source,
      target: payload.target,
      sourceHandle: payload.sourceHandle,
      targetHandle: payload.targetHandle,
      data: { dataType: 'unknown' },
    });
    return { snapshot: { nodes, edges, document: snapshot.document }, result: { edgeId } };
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

      const applied = applyMutation(current.snapshot, request.actionId, request.payload);
      if (request.payload.type === 'import-workflow') {
        applied.result = {
          ...applied.result,
          ...missingDeps(request.payload.document, readCatalog(db)),
        };
      }
      const nextSeq = current.revSeq + 1;
      const revisionId = `rev-${request.projectId}-${nextSeq}`;
      const now = Date.now();
      db.prepare(
        `INSERT INTO graph_revisions
          (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
