/**
 * Protects the unsaved mark and Ctrl+S, which read the project file of the graph on screen. That state is kept per
 * graph in SQLite, so a reload or a restart (a new connection to the same file) says the same, and an undo back to
 * the saved content is clean. Also covers default file names and the extension a save adds.
 * A wrong mark either loses work (clean when it is not) or nags the person (dirty when nothing changed).
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { contentDigest, defaultSavePaths, fileNameFromTitle, projectFileState, rememberProjectFile, withCurrentProjectSuffix, withFileExtension } from '../../src/main/projectFiles';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { LEGACY_PROJECT_FILE_SUFFIXES } from '../../src/shared/legacyNames';

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

/** The frozen v1.1.0 fingerprint; migration fixtures must not use the current digest function. */
function oldDigest(snapshot: Record<string, unknown>): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .filter(([key, item]) => !['selected', 'dragging', 'measured', 'resizing'].includes(key) && item !== undefined)
      .map(([key, item]) => [key, sorted(item)]));
  };
  return createHash('sha256').update(JSON.stringify(sorted({
    process: snapshot.process ?? { title: '', notes: '' }, nodes: snapshot.nodes ?? [], edges: snapshot.edges ?? [],
    document: snapshot.document ?? null, components: snapshot.components ?? [], subgraphs: snapshot.subgraphs ?? [],
    groups: snapshot.groups ?? [], projectExtras: snapshot.projectExtras ?? null,
  }))).digest('hex');
}

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

  it.each(['selected', 'measured', 'dragging', 'resizing'])('keeps nested content named %s in the fingerprint', (key) => {
    const node = { id: '1', data: { parameters: { [key]: 'before' } } };
    const a = { nodes: [node], edges: [] };
    expect(contentDigest(a)).not.toBe(contentDigest({ ...a, nodes: [{ ...node, data: { parameters: { [key]: 'after' } } }] }));
    expect(contentDigest({ nodes: [], edges: [], document: { raw: { extra: { [key]: 1 } } } }))
      .not.toBe(contentDigest({ nodes: [], edges: [], document: { raw: { extra: { [key]: 2 } } } }));
    expect(contentDigest({ nodes: [], edges: [], projectExtras: { fields: { [key]: 1 } } }))
      .not.toBe(contentDigest({ nodes: [], edges: [], projectExtras: { fields: { [key]: 2 } } }));
  });

  it('ignores only record flags on nodes and links of the main graph and subgraph definitions', () => {
    const node = { id: '1', data: { parameters: { selected: 'kept' } } };
    const edge = { id: 'link-1', source: '1', target: '2', data: { measured: 12 } };
    const definition = { id: 'inner', nodes: [node], edges: [edge] };
    const flags = { selected: true, dragging: true, measured: { width: 10 }, resizing: true };
    const a = { nodes: [node], edges: [edge], subgraphs: [definition] };
    const b = { nodes: [{ ...node, ...flags }], edges: [{ ...edge, ...flags }], subgraphs: [{ ...definition, nodes: [{ ...node, ...flags }], edges: [{ ...edge, ...flags }] }] };
    expect(contentDigest(a)).toBe(contentDigest(b));
    expect(contentDigest(a)).not.toBe(contentDigest({ ...a, subgraphs: [{ ...definition, nodes: [{ ...node, data: { parameters: { selected: 'changed' } } }] }] }));
  });

  it('keeps an unchanged v1.1.0 project clean and upgrades its old digest without a schema migration', () => {
    const db = open();
    commit(db, { type: 'add-node', nodeType: 'KSampler' });
    const saved = readProjection(db, DESKTOP_PROJECT_ID)!;
    const graphKey = projectFileState(db, DESKTOP_PROJECT_ID).graphKey;
    const digest = oldDigest(saved.snapshot);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/legacy.json', { graphKey, digest });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(false);
    const row = () => db.prepare('SELECT saved_digest FROM project_files WHERE project_id = ? AND graph_key = ?').get(DESKTOP_PROJECT_ID, graphKey) as { saved_digest: string };
    expect(row().saved_digest).toBe(contentDigest(saved.snapshot));
    expect(row().saved_digest).toMatch(/^v2:[a-f0-9]{64}$/);
    commit(db, { type: 'move-node', nodeId: '1', x: 42, y: 13 });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(true);
    // A changed old project remains dirty, and a save with omitted values is never upgraded to clean.
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/legacy.json', { graphKey, digest });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(true);
    expect(row().saved_digest).toBe(digest);
    rememberProjectFile(db, DESKTOP_PROJECT_ID, '/tmp/omitted.json', { graphKey, digest: `omitted:${contentDigest(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot)}` });
    expect(projectFileState(db, DESKTOP_PROJECT_ID).dirty).toBe(true);
    expect(row().saved_digest).toMatch(/^omitted:/);
    db.close();
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
