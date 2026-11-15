import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { contentDigest, defaultSavePaths, fileNameFromTitle, projectFileState, rememberProjectFile, withCurrentProjectSuffix, withFileExtension } from '../../src/main/projectFiles';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { LEGACY_PROJECT_FILE_SUFFIXES } from '../../src/shared/legacyNames';

/**
 * The unsaved mark and Ctrl+S read the project file of the graph on screen: kept per graph in SQLite, so a reload or
 * a restart (a new connection to the same file) says the same, and an undo back to the saved content is clean.
 */
function open(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

let action = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  action += 1;
  const result = commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: `a-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: payload as never });
  expect(result.status).toBe('applied');
  return result;
}

const EMPTY = { last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [], config: {}, extra: {}, version: 0.4 };

describe('project file state', () => {
  it('an empty canvas with no file is clean; a graph with no file is not', () => {
    const db = open();
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: false, empty: true, filePath: null });
    commit(db, { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: true, empty: false, filePath: null });
  });

  it('is clean after a save, dirty after an edit, clean again when undo returns to the saved content', () => {
    const db = open();
    commit(db, { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/fox/Fox.nodewise.json');
    const saved = readProjection(db, DESKTOP_PROJECT_ID)!;
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: false, fileName: 'Fox.nodewise.json' });
    commit(db, { type: 'move-node', nodeId: '1', x: 50, y: 50 });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(true);
    commit(db, { type: 'restore-revision', revisionId: saved.currentRevisionId });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(false);
  });

  it('forgets the file for a new graph and brings it back when undo returns to the saved graph', () => {
    const db = open();
    commit(db, { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/fox/Fox.nodewise.json');
    const saved = readProjection(db, DESKTOP_PROJECT_ID)!;
    commit(db, { type: 'import-workflow', document: EMPTY });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ filePath: null, dirty: false, empty: true });
    commit(db, { type: 'restore-revision', revisionId: saved.currentRevisionId });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ filePath: '/tmp/fox/Fox.nodewise.json', dirty: false });
  });

  it('marks an imported workflow as not in a project file', () => {
    const db = open();
    commit(db, { type: 'import-workflow', document: { ...EMPTY, last_node_id: 1, nodes: [{ id: 1, type: 'KSampler', pos: [0, 0], size: [200, 100], flags: {}, order: 0, mode: 0, properties: {}, inputs: [], outputs: [] }] } });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: true, filePath: null });
  });

  it('ignores screen-only flags in the fingerprint', () => {
    const a = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler' } }], edges: [] };
    const b = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler' }, selected: true, measured: { width: 3 } }], edges: [] };
    expect(contentDigest(a)).toBe(contentDigest(b));
    expect(contentDigest(a)).not.toBe(contentDigest({ ...a, nodes: [{ ...a.nodes[0], position: { x: 1, y: 0 } }] }));
  });
});

describe('the name a save writes', () => {
  it('adds the extension when the person typed a name without one, so Open still lists the file', () => {
    expect(withFileExtension('/work/a/fox', 'project')).toBe('/work/a/fox.nodewise.json');
    expect(withFileExtension('/work/a/fox', 'workflow')).toBe('/work/a/fox.json');
    expect(withFileExtension('/work/a/fox.', 'workflow')).toBe('/work/a/fox.json');
    expect(withFileExtension('/work/a/fox.v2', 'workflow')).toBe('/work/a/fox.v2.json');
    expect(withFileExtension('/work/a/fox.JSON', 'project')).toBe('/work/a/fox.JSON');
    expect(withFileExtension('/work/a/fox.nodewise.json', 'project')).toBe('/work/a/fox.nodewise.json');
  });
});

describe('default file names', () => {
  it('come from the project title, cleaned for the file system', () => {
    expect(fileNameFromTitle('Fox: red/blue?', 'x')).toBe('Fox red blue');
    expect(fileNameFromTitle('   ', 'project')).toBe('project');
    expect(defaultSavePaths({ graphKey: 'g', filePath: null, fileName: null, dirty: true, empty: false, title: 'Лиса' })).toEqual({ project: 'Лиса.nodewise.json', workflow: 'Лиса.json' });
    expect(defaultSavePaths({ graphKey: 'g', filePath: null, fileName: null, dirty: true, empty: false, title: '' })).toEqual({ project: 'project.nodewise.json', workflow: 'workflow.json' });
    expect(defaultSavePaths({ graphKey: 'g', filePath: '/work/a/fox.nodewise.json', fileName: 'fox.nodewise.json', dirty: false, empty: false, title: 'Fox' }))
      .toEqual({ project: '/work/a/fox.nodewise.json', workflow: '/work/a/Fox.json' });
  });

  it('offer the 1.0 ending on Save as for a project opened from a 0.x file, and keep a 0.x name a person typed', () => {
    for (const legacy of LEGACY_PROJECT_FILE_SUFFIXES) {
      const old = `/work/a/fox${legacy}`;
      expect(withCurrentProjectSuffix(old)).toBe('/work/a/fox.nodewise.json');
      expect(withCurrentProjectSuffix(old.toUpperCase())).toBe('/WORK/A/FOX.nodewise.json');
      expect(defaultSavePaths({ graphKey: 'g', filePath: old, fileName: `fox${legacy}`, dirty: false, empty: false, title: 'Fox' }).project).toBe('/work/a/fox.nodewise.json');
      // A name typed in the dialog is taken as it is: it ends in .json and Open lists it.
      expect(withFileExtension(old, 'project')).toBe(old);
    }
    expect(withCurrentProjectSuffix('/work/a/fox.json')).toBe('/work/a/fox.json');
  });
});

describe('empty-root and captured-save regressions', () => {
  it('keeps last-node deletion dirty even though the root is empty', () => {
    const db = open();
    commit(db, { type: 'add-node', nodeType: 'KSampler' });
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/saved.json');
    commit(db, { type: 'remove-node', nodeId: '1' });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: true, empty: true });
  });
  it('treats definitions and process-only projects as meaningful unsaved content', async () => {
    const { nestedSubgraphWorkflow } = await import('../e2e/fixtures/nestedSubgraphWorkflow');
    const db = open();
    commit(db, { type: 'import-workflow', document: { ...nestedSubgraphWorkflow, nodes: [], links: [] } });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: true, empty: false });
    commit(db, { type: 'import-workflow', document: EMPTY });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(false);
    commit(db, { type: 'set-process', title: 'Only metadata', notes: '' });
    expect(projectFileState(db, DESKTOP_PROJECT_ID)).toMatchObject({ dirty: true, empty: false });
  });
  it('records the content actually written when a save dialog overlapped an edit or graph replacement', () => {
    const db = open();
    commit(db, { type: 'add-node', nodeType: 'KSampler' });
    const saved = readProjection(db, DESKTOP_PROJECT_ID)!;
    const written = { graphKey: projectFileState(db, DESKTOP_PROJECT_ID).graphKey, digest: contentDigest(saved.snapshot) };
    commit(db, { type: 'move-node', nodeId: '1', x: 123, y: 456 });
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/earlier.json', written);
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(true);
    commit(db, { type: 'restore-revision', revisionId: saved.currentRevisionId });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(false);
    commit(db, { type: 'import-workflow', document: EMPTY });
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/earlier.json', written);
    expect(projectFileState(db, DESKTOP_PROJECT_ID).filePath).toBeNull();
  });
});
