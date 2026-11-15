/**
 * The project file of the graph on screen: where it was last opened from or saved to, and whether the graph is in
 * that file as it stands. Kept per graph (graph_key), so undo across "Open" or "New project" brings the earlier
 * graph's file back with it, and so it survives a reload and a restart (table project_files, schema version 16).
 * Used by main/ipc.ts (save commands and the app bar's state) and ipc/openIpc.ts (opening a file).
 */
import type Database from 'better-sqlite3';
import { createHash } from 'crypto';
import * as path from 'path';
import { emptyWorkflow } from '../shared/workflow/codec';
import type { GraphSnapshot } from '../shared/workflow/codec';
import type { ProjectFileState } from '../shared/contracts/projectFile';
import { readProjection } from './commands/commit';
import { currentGraphKey } from './knowledge/projectExplanations';
import { PROJECT_FILE_SUFFIX } from '../shared/productNames';
import { LEGACY_PROJECT_FILE_SUFFIXES } from '../shared/legacyNames';

/** Screen-only flags React Flow may leave on a stored node or link; they are not content. */
const VOLATILE = new Set(['selected', 'dragging', 'measured', 'resizing']);

/** A copy with object keys sorted and screen-only flags and undefined values dropped, so equal content prints equal. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (VOLATILE.has(key)) continue;
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    out[key] = stable(item);
  }
  return out;
}

/** Fingerprint of what a project file holds of a graph: the same content gives the same digest, whatever its revision. */
export function contentDigest(snapshot: GraphSnapshot | Record<string, unknown>): string {
  const graph = snapshot as GraphSnapshot;
  const content = {
    process: graph.process ?? { title: '', notes: '' },
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
    document: graph.document ?? null,
    components: graph.components ?? [],
    subgraphs: graph.subgraphs ?? [],
    groups: graph.groups ?? [],
    projectExtras: (snapshot as Record<string, unknown>).projectExtras ?? null,
  };
  return createHash('sha256').update(JSON.stringify(stable(content))).digest('hex');
}

/** Whether the graph holds nothing a person would want to save: no nodes, notes, title or native content. */
function isEmpty(snapshot: GraphSnapshot): boolean {
  if (snapshot.nodes.length || snapshot.edges.length || snapshot.subgraphs?.length || snapshot.groups?.length || snapshot.components?.length) return false;
  if (Object.values(snapshot.process ?? {}).some((value) => value !== '' && value != null)) return false;
  if ((snapshot as unknown as Record<string, unknown>).projectExtras) return false;
  const raw = snapshot.document?.raw;
  if (!raw) return true;
  const baseline = emptyWorkflow();
  // Counters and an empty definition registry are bookkeeping, all other native content matters.
  const meaningful = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key, item]) =>
    key !== 'state' && key !== 'last_node_id' && key !== 'last_link_id' && key !== 'version'
    && !(key === 'definitions' && JSON.stringify(item) === '{"subgraphs":[]}')
    && !(Array.isArray(item) && item.length === 0) && !(item && typeof item === 'object' && Object.keys(item).length === 0)));
  return JSON.stringify(stable(meaningful(raw))) === JSON.stringify(stable(meaningful(baseline)));
}

/** One row of project_files: the file and the digest of what was last written to or read from it. */
interface Row { file_path: string; saved_digest: string }

/** The remembered file of one graph of a project. */
function rowOf(db: Database.Database, projectId: string, graphKey: string): Row | undefined {
  return db.prepare('SELECT file_path, saved_digest FROM project_files WHERE project_id = ? AND graph_key = ?').get(projectId, graphKey) as Row | undefined;
}

/**
 * The state the app bar and the file commands read. `dirty`: the graph is not in its project file as it stands;
 * a graph that never had a file is dirty unless it is empty.
 */
export function projectFileState(db: Database.Database, projectId: string): ProjectFileState {
  const projection = readProjection(db, projectId);
  const snapshot = (projection?.snapshot ?? { nodes: [], edges: [] }) as GraphSnapshot;
  const graphKey = currentGraphKey(db, projectId) ?? '';
  const row = graphKey ? rowOf(db, projectId, graphKey) : undefined;
  const empty = isEmpty(snapshot);
  const dirty = row ? row.saved_digest !== contentDigest(snapshot) : !empty;
  return {
    graphKey,
    filePath: row?.file_path ?? null,
    fileName: row ? path.basename(row.file_path) : null,
    dirty,
    empty,
    title: snapshot.process?.title?.trim() ?? '',
  };
}

/** After an open or a save: this graph is in `filePath` as it stands now. */
export function rememberProjectFile(db: Database.Database, projectId: string, filePath: string, written?: { graphKey: string; digest: string }): void {
  const projection = readProjection(db, projectId);
  const graphKey = written?.graphKey ?? currentGraphKey(db, projectId);
  if (!projection || !graphKey) return;
  db.prepare(`INSERT INTO project_files (project_id, graph_key, file_path, saved_digest, saved_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, graph_key) DO UPDATE SET file_path = excluded.file_path, saved_digest = excluded.saved_digest, saved_at = excluded.saved_at`)
    .run(projectId, graphKey, filePath, written?.digest ?? contentDigest(projection.snapshot as GraphSnapshot), Date.now());
}

/** A file name made of the project title: letters, digits, spaces and a few marks; never empty. */
export function fileNameFromTitle(title: string, fallback: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // No leading dots: the file would be hidden on Linux.
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

/**
 * The file name a save writes: as given when it ends in .json (any letter case), else with the extension added
 * (PROJECT_FILE_SUFFIX, `.nodewise.json`, for a project; `.json` for a workflow). On Linux the save dialog adds nothing to a name
 * typed without an extension, and Open lists only *.json files, so such a file would seem to vanish.
 */
export function withFileExtension(filePath: string, kind: 'project' | 'workflow'): string {
  if (/\.json$/i.test(filePath)) return filePath;
  return `${filePath.replace(/\.+$/, '')}${kind === 'project' ? PROJECT_FILE_SUFFIX : '.json'}`;
}

/**
 * A project file name with the current ending: a name with a 0.x ending (src/shared/legacyNames.ts) gets
 * PROJECT_FILE_SUFFIX instead, so Save as offers the new ending for a project opened from a 0.9 file. Save itself
 * still writes to the file that was opened, under its old name.
 */
export function withCurrentProjectSuffix(filePath: string): string {
  const lower = filePath.toLowerCase();
  const legacy = LEGACY_PROJECT_FILE_SUFFIXES.find((suffix) => lower.endsWith(suffix));
  return legacy ? `${filePath.slice(0, -legacy.length)}${PROJECT_FILE_SUFFIX}` : filePath;
}

/** Default names for the save dialogs, from the project title; next to the project file when there is one. */
export function defaultSavePaths(state: ProjectFileState): { project: string; workflow: string } {
  const base = fileNameFromTitle(state.title, '');
  const dir = state.filePath ? path.dirname(state.filePath) : '';
  const project = state.filePath ? withCurrentProjectSuffix(state.filePath) : `${base || 'project'}${PROJECT_FILE_SUFFIX}`;
  const workflow = base ? `${base}.json` : 'workflow.json';
  return { project, workflow: dir ? path.join(dir, workflow) : workflow };
}
