/**
 * Opening and saving a NodeWise project file (src/main/ipc/projectFile, src/shared/native-project): fields and
 * extensions this version does not know are written back unchanged, they are dropped when a workflow is imported
 * over the project, and a file saved by 0.x under the old format id opens and is saved with the current one.
 * Why: a person who opens a file made by a newer version or another tool and saves it must not lose what it held.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { nativeProjectFile, openNativeFile } from '../../src/main/ipc/projectFile';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { isNativeProjectFormat, parseNativeProject, serializeNativeProject } from '../../src/shared/native-project';
import { NATIVE_PROJECT_FORMAT_ID } from '../../src/shared/productNames';
import { LEGACY_NATIVE_PROJECT_FORMAT_IDS } from '../../src/shared/legacyNames';

/** A migrated in-memory database with the desktop workspace ready. */
function fresh(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

/** A project file as a later version of the app (or another tool) might write it: fields this version does not know. */
function laterProjectFile(): Record<string, unknown> {
  const project = serializeNativeProject({
    process: { title: 'Kept', notes: '' },
    graph: { nodes: [], edges: [], document: null },
    components: [],
    extensions: { 'other.tool': { colour: 'teal', list: [1, 2, 3] } },
  });
  return { ...project, futureSetting: { mode: 'later' }, savedBy: 'a later version' };
}

describe('a project file opened and saved again', () => {
  it('keeps the fields and extensions this version does not know', () => {
    const db = fresh();
    const opened = openNativeFile(db, P, laterProjectFile());
    expect(opened.status).toBe('applied');
    // Some ordinary editing in between: the bag stays with the graph.
    const added = commitCommand(db, { projectId: P, runId: null, actionId: 'a', expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual', payload: { type: 'add-node', nodeType: 'Note' } });
    expect(added.status).toBe('applied');
    const saved = nativeProjectFile(db, P);
    expect(saved.ok).toBe(true);
    const project = (saved as { project: Record<string, unknown> }).project;
    expect((project.extensions as Record<string, unknown>)['other.tool']).toEqual({ colour: 'teal', list: [1, 2, 3] });
    expect(project.futureSetting).toEqual({ mode: 'later' });
    expect(project.savedBy).toBe('a later version');
    // What this version writes itself still wins over a stale copy of it.
    expect(project.format).toBe('nodewise-studio-project');
    expect(parseNativeProject(project).ok).toBe(true);
  });

  it('does not carry them into a workflow imported afterwards', () => {
    const db = fresh();
    openNativeFile(db, P, laterProjectFile());
    const imported = commitCommand(db, {
      projectId: P, runId: null, actionId: 'imp', expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual',
      payload: { type: 'import-workflow', document: { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 } },
    });
    expect(imported.status).toBe('applied');
    const project = (nativeProjectFile(db, P) as { project: Record<string, unknown> }).project;
    expect((project.extensions as Record<string, unknown>)['other.tool']).toBeUndefined();
    expect(project.futureSetting).toBeUndefined();
  });
});

describe('a project file saved by 0.x, before the product was renamed', () => {
  it('opens, and is written back with the current format id', () => {
    const db = fresh();
    for (const legacy of LEGACY_NATIVE_PROJECT_FORMAT_IDS) {
      const old = { ...laterProjectFile(), format: legacy };
      expect(isNativeProjectFormat(old.format)).toBe(true);
      expect(parseNativeProject(old).ok).toBe(true);
      expect(openNativeFile(db, P, old).status).toBe('applied');
      const project = (nativeProjectFile(db, P) as { project: Record<string, unknown> }).project;
      expect(project.format).toBe(NATIVE_PROJECT_FORMAT_ID);
    }
    expect(parseNativeProject({ ...laterProjectFile(), format: 'some-other-tool' })).toEqual({ ok: false, error: 'This file is not a native project.' });
  });
});
