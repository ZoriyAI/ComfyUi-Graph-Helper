import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { parseNativeProject, serializeNativeProject } from '../../shared/native-project';
import { EXPLANATIONS_EXTENSION } from '../../shared/knowledge/projectExplanations';
import type { GraphSnapshot } from '../../shared/workflow/codec';
import { commitCommand, readProjection, type ProjectExtras } from '../commands/commit';
import { explanationsExtension } from '../knowledge/projectExplanations';

/** "Save project": the native project file of the graph on screen, with the explanations of its objects. */
export function nativeProjectFile(db: Database.Database, projectId: string) {
  const projection = readProjection(db, projectId);
  if (!projection) return { ok: false as const, error: 'Project is not ready.' };
  const snapshot = projection.snapshot as GraphSnapshot & { projectExtras?: ProjectExtras };
  return {
    ok: true as const,
    project: serializeNativeProject({
      process: snapshot.process ?? { title: '', notes: '' },
      graph: {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        document: snapshot.document,
      },
      components: snapshot.components ?? [],
      // Explanations of this graph's objects travel with the project (knowledge/projectExplanations.ts).
      // What the opened file carried that this version does not use goes back out unchanged.
      extensions: { ...snapshot.projectExtras?.extensions, [EXPLANATIONS_EXTENSION]: explanationsExtension(db, projectId, snapshot) },
      preserved: snapshot.projectExtras?.fields,
    }),
  };
}

/** "Open project": one commit that replaces the graph; its explanations come back with it (explanationsAfterCommit). */
export function openNativeFile(db: Database.Database, projectId: string, document: unknown) {
  const parsed = parseNativeProject(document);
  if (!parsed.ok) {
    return { status: 'rejected' as const, projection: readProjection(db, projectId), result: { error: parsed.error } };
  }
  const current = readProjection(db, projectId);
  if (!current) return { status: 'rejected' as const, projection: null, result: { error: 'Project is not ready.' } };
  return commitCommand(db, {
    projectId,
    actionId: `open-native-${randomUUID()}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'open-native', project: parsed.project },
  });
}
