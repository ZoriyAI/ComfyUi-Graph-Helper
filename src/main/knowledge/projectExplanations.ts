import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Explanation } from '../../shared/contracts/knowledge';
import { inSubgraph, objectScope, type ObjectRef } from '../../shared/contracts/objects';
import {
  explanationsBlock,
  isGraphOwnerKind,
  readExplanationsBlock,
  type ExplanationsBlock,
  type ProjectExplanation,
} from '../../shared/knowledge/projectExplanations';

/**
 * Explanations that travel with the project.
 *
 * What identifies a graph. Every revision of a project carries a graph key (graph_revisions.graph_key). An edit
 * keeps the key of the revision it was made on; replacing the graph (New project, Open a ComfyUI workflow, Open
 * project) gives the new revision a fresh key; undo and redo (restore-revision) take the key of the revision they
 * bring back. So the key is part of what a revision keeps, and the current revision's key says which graph is on
 * screen. A revision written before keys existed and never stamped reads as `first:<project>`.
 *
 * What identifies an owner. A row of `explanations` about an object of the graph (node, port, link, group, subgraph
 * definition, the graph itself: GRAPH_OWNER_KINDS) is keyed by (project_id, graph_key, scope, owner_kind, owner_id).
 * `scope` is '' on the main canvas and the definition's id for a node, port or link inside a subgraph definition,
 * where node numbers repeat those of the main canvas; every instance of a definition shares its scope. Knowledge
 * about a node class, a model file, a link type or a family has graph_key NULL: it is the app's, shown in every
 * graph and never written into a project file.
 *
 * What is stored where. The database keeps every row of every graph the project has shown, as it keeps every
 * revision. The project file keeps the rows of the graph it saves, for objects still in that graph, in
 * `extensions.explanations` (shared/knowledge/projectExplanations.ts). A ComfyUI workflow export keeps none.
 *
 * At each event:
 * - edit, or a description written (by hand, by the assistant, a build step's "why"): a row under the current key.
 * - delete: nothing is removed. Ids are never reused within a graph, so the row waits for an undo; the save leaves
 *   it out while its object is gone.
 * - undo / redo: the restored revision's key comes back, and with it exactly that graph's rows.
 * - new project, open a workflow: a fresh key with no rows. The previous graph's rows stay under its key.
 * - open project: a fresh key, and the file's rows are written under it in the same transaction as the revision.
 * - save project: the current key's rows whose objects exist, with aspect, text, source, link, author, time, revision.
 * - subgraph: making one copies the rows of the moved nodes, their ports and inner links into the definition's
 *   scope; dissolving copies them back to the nodes' new numbers. Copies, not moves: undo needs the originals.
 *
 * The renderer learns the key through Projection.graphKey and reads the explanations again when it changes.
 */

const FALLBACK_PREFIX = 'first:';

function fallbackKey(projectId: string): string {
  return `${FALLBACK_PREFIX}${projectId}`;
}

export function isGraphOwner(owner: ObjectRef): boolean {
  return isGraphOwnerKind(owner.kind);
}

/** The graph key a revision shows; null when the revision is not there. */
export function graphKeyOf(db: Database.Database, projectId: string, revisionId: string): string | null {
  const row = db.prepare('SELECT graph_key FROM graph_revisions WHERE id = ? AND project_id = ?').get(revisionId, projectId) as
    | { graph_key: string | null }
    | undefined;
  if (!row) return null;
  return row.graph_key ?? fallbackKey(projectId);
}

/** The key of the graph on screen in a project; null when the project has no revision yet. */
export function currentGraphKey(db: Database.Database, projectId: string): string | null {
  const row = db
    .prepare(`SELECT p.current_revision_id AS revision, r.graph_key AS key
      FROM projects p LEFT JOIN graph_revisions r ON r.id = p.current_revision_id WHERE p.id = ?`)
    .get(projectId) as { revision: string | null; key: string | null } | undefined;
  if (!row?.revision) return null;
  return row.key ?? fallbackKey(projectId);
}

export function newGraphKey(): string {
  return `graph-${randomUUID()}`;
}

interface Row {
  id: string;
  project_id: string | null;
  graph_key: string | null;
  scope: string;
  owner_kind: string;
  owner_id: string;
  owner_json: string;
  aspect: string;
  text: string;
  provenance: string;
  source_url: string | null;
  revision_id: string | null;
  created_by: string;
  created_at: number;
}

function ownerOf(row: Row): ObjectRef {
  try {
    const value = JSON.parse(row.owner_json) as unknown;
    if (value && typeof value === 'object' && typeof (value as ObjectRef).kind === 'string' && typeof (value as ObjectRef).id === 'string') {
      return inSubgraph(value as ObjectRef, row.scope || null);
    }
  } catch {
    // Fall through to the columns.
  }
  return inSubgraph({ kind: row.owner_kind as ObjectRef['kind'], id: row.owner_id }, row.scope || null);
}

function insertRow(db: Database.Database, row: Row): void {
  db.prepare(`
    INSERT INTO explanations (id, project_id, graph_key, scope, owner_kind, owner_id, owner_json, aspect, text, provenance,
      source_url, revision_id, created_by, created_at)
    VALUES (@id, @project_id, @graph_key, @scope, @owner_kind, @owner_id, @owner_json, @aspect, @text, @provenance,
      @source_url, @revision_id, @created_by, @created_at)
  `).run(row);
}

function rowsOfGraph(db: Database.Database, projectId: string, graphKey: string): Row[] {
  return db
    .prepare('SELECT * FROM explanations WHERE project_id = ? AND graph_key = ? ORDER BY created_at, rowid')
    .all(projectId, graphKey) as Row[];
}

// ── Commit ───────────────────────────────────────────────────────────────────────────────────────────────

interface SnapshotLike {
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
  subgraphs?: Array<{ id: string; nodes: Array<Record<string, any>>; edges: Array<Record<string, any>>; opaque?: true }>;
  groups?: Array<{ id: string }>;
}

export interface CommitFacts {
  projectId: string;
  revisionId: string;
  parentRevisionId: string;
  payload: { type: string } & Record<string, any>;
  result: Record<string, unknown>;
  before: SnapshotLike;
  after: SnapshotLike;
}

/**
 * Inside the commit transaction, after the new revision is written: stamps its graph key, writes what an opened
 * project file brought, copies descriptions into or out of a subgraph definition. Returns what goes into the
 * command result (only an opened project reports anything).
 */
export function explanationsAfterCommit(db: Database.Database, facts: CommitFacts): Record<string, unknown> {
  const parentKey = graphKeyOf(db, facts.projectId, facts.parentRevisionId) ?? fallbackKey(facts.projectId);
  const type = facts.payload.type;
  let key = parentKey;
  if (type === 'import-workflow' || type === 'open-native') key = newGraphKey();
  else if (type === 'restore-revision' && typeof facts.payload.revisionId === 'string') {
    key = graphKeyOf(db, facts.projectId, facts.payload.revisionId) ?? parentKey;
  }
  db.prepare('UPDATE graph_revisions SET graph_key = ? WHERE id = ?').run(key, facts.revisionId);
  if (type === 'open-native') {
    const project = facts.payload.project as { extensions?: unknown } | undefined;
    const read = readExplanationsBlock(project?.extensions);
    for (const item of read.items) adoptItem(db, facts.projectId, key, item);
    return { explanations: { restored: read.items.length, skipped: read.skipped, unreadable: read.unreadable } };
  }
  if (type === 'create-subgraph' && typeof facts.result.definitionId === 'string' && Array.isArray(facts.payload.nodeIds)) {
    copyIntoDefinition(db, facts, key, facts.result.definitionId, facts.payload.nodeIds.map(String));
  }
  if (type === 'dissolve-subgraph' && typeof facts.result.definitionId === 'string' && Array.isArray(facts.result.nodeIds)) {
    copyOutOfDefinition(db, facts, key, facts.result.definitionId, (facts.result.nodeIds as unknown[]).map(String));
  }
  return {};
}

function adoptItem(db: Database.Database, projectId: string, graphKey: string, item: ProjectExplanation): void {
  const owner = item.owner;
  const scope = objectScope(owner);
  const level = levelColumns(owner);
  insertRow(db, {
    id: randomUUID(),
    project_id: projectId,
    graph_key: graphKey,
    scope,
    owner_kind: owner.kind,
    owner_id: level,
    owner_json: JSON.stringify(owner),
    aspect: item.aspect,
    text: item.text,
    provenance: item.provenance,
    source_url: item.sourceUrl,
    revision_id: item.revisionId,
    created_by: item.createdBy,
    created_at: item.createdAt || Date.now(),
  });
}

/** owner_id as repository.ownerColumns writes it: a port is "<node>:<direction>:<name>". */
function levelColumns(owner: ObjectRef): string {
  if (owner.kind === 'port') return `${owner.nodeId ?? ''}:${owner.direction ?? ''}:${owner.portName ?? owner.id}`;
  return owner.id;
}

/** The node a row is about: the node itself, or the node of a port. */
function rowNode(row: Row, owner: ObjectRef): string | null {
  if (row.owner_kind === 'node') return row.owner_id;
  if (row.owner_kind === 'port') return owner.nodeId ?? row.owner_id.split(':')[0];
  return null;
}

/** Copies a row to another scope and node, unless the same words are already there. */
function copyRow(db: Database.Database, row: Row, scope: string, nodeId: string | null): void {
  const owner = ownerOf(row);
  let moved: ObjectRef = inSubgraph(owner, scope || null);
  if (nodeId !== null) {
    if (owner.kind === 'node') moved = { ...moved, id: nodeId };
    if (owner.kind === 'port') moved = { ...moved, nodeId, id: owner.id.replace(/^[^:]*/, nodeId) };
  }
  const ownerId = levelColumns(moved);
  const same = db
    .prepare('SELECT 1 FROM explanations WHERE project_id = ? AND graph_key = ? AND scope = ? AND owner_kind = ? AND owner_id = ? AND aspect = ? AND text = ?')
    .get(row.project_id, row.graph_key, scope, row.owner_kind, ownerId, row.aspect, row.text);
  if (same) return;
  insertRow(db, { ...row, id: randomUUID(), scope, owner_id: ownerId, owner_json: JSON.stringify(moved) });
}

function copyIntoDefinition(db: Database.Database, facts: CommitFacts, key: string, definitionId: string, nodeIds: string[]): void {
  const moved = new Set(nodeIds);
  const definition = (facts.after.subgraphs ?? []).find((item) => item.id === definitionId);
  const innerEdges = new Set((definition?.edges ?? []).map((edge) => String(edge.id)));
  for (const row of rowsOfGraph(db, facts.projectId, key)) {
    if (row.scope !== '') continue;
    const owner = ownerOf(row);
    const node = rowNode(row, owner);
    if (node !== null ? moved.has(node) : row.owner_kind === 'edge' && innerEdges.has(row.owner_id)) copyRow(db, row, definitionId, null);
  }
}

function copyOutOfDefinition(db: Database.Database, facts: CommitFacts, key: string, definitionId: string, restored: string[]): void {
  const definition = (facts.before.subgraphs ?? []).find((item) => item.id === definitionId);
  if (!definition) return;
  // dissolve lists the restored ids in the order of the definition's nodes.
  const ids = new Map(definition.nodes.map((node, index) => [String(node.id), restored[index]]));
  for (const row of rowsOfGraph(db, facts.projectId, key)) {
    if (row.scope !== definitionId) continue;
    const node = rowNode(row, ownerOf(row));
    const target = node === null ? undefined : ids.get(node);
    if (target) copyRow(db, row, '', target);
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────────────────────────────────

function present(snapshot: SnapshotLike, row: Row, owner: ObjectRef): boolean {
  const level = row.scope === ''
    ? { nodes: snapshot.nodes, edges: snapshot.edges }
    : (snapshot.subgraphs ?? []).find((item) => item.id === row.scope);
  if (!level) return false;
  const hasNode = (id: string | null) => id !== null && level.nodes.some((node) => String(node.id) === id);
  switch (row.owner_kind) {
    case 'node':
    case 'port':
      return hasNode(rowNode(row, owner));
    case 'edge':
      return level.edges.some((edge) => String(edge.id) === row.owner_id);
    case 'group':
      return row.scope === '' && (snapshot.groups ?? []).some((group) => String(group.id) === row.owner_id);
    case 'subgraph':
      return (snapshot.subgraphs ?? []).some((item) => item.id === row.owner_id);
    case 'process':
      return true;
    default:
      return false;
  }
}

/** The explanations of the graph on screen whose objects are in it, oldest first, as the project file keeps them. */
export function projectExplanations(db: Database.Database, projectId: string, snapshot: SnapshotLike): ProjectExplanation[] {
  const key = currentGraphKey(db, projectId);
  if (!key) return [];
  return rowsOfGraph(db, projectId, key)
    .filter((row) => isGraphOwnerKind(row.owner_kind))
    .flatMap((row) => {
      const owner = ownerOf(row);
      if (!present(snapshot, row, owner)) return [];
      return [{
        owner,
        aspect: row.aspect as Explanation['aspect'],
        text: row.text,
        provenance: row.provenance as Explanation['provenance'],
        sourceUrl: row.source_url,
        createdBy: row.created_by as Explanation['createdBy'],
        createdAt: row.created_at,
        revisionId: row.revision_id,
      }];
    });
}

/** The block "Save project" writes into `extensions`. */
export function explanationsExtension(db: Database.Database, projectId: string, snapshot: SnapshotLike): ExplanationsBlock {
  return explanationsBlock(projectExplanations(db, projectId, snapshot));
}
