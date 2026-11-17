/**
 * Protects explanations (the descriptions written for objects of the graph: nodes, ports, groups and more) as part of the
 * project: saved in the project file and brought back exactly, kept apart between graphs and inside subgraphs, carried
 * through undo, subgraph creation and dissolving, left out of a ComfyUI export, and kept by the schema 15 migration.
 * A person's notes on their graph must not leak to another graph or be lost when the file moves to another machine.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { nativeProjectFile, openNativeFile } from '../../src/main/ipc/projectFile';
import { currentGraphKey, graphKeyOf } from '../../src/main/knowledge/projectExplanations';
import { deletePersonExplanation, listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import { contentDigest, projectFileState, rememberProjectFile } from '../../src/main/projectFiles';
import { migrate, schemaVersion, SCHEMA_VERSION } from '../../src/main/settings/migrate';
import type { Explanation, ExplanationInput } from '../../src/shared/contracts/knowledge';
import { inSubgraph, type ObjectRef } from '../../src/shared/contracts/objects';
import { EXPLANATIONS_EXTENSION, readExplanationsBlock } from '../../src/shared/knowledge/projectExplanations';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

const P = DESKTOP_PROJECT_ID;

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function projection(db: Database.Database) {
  return readProjection(db, P)!;
}

function snap(db: Database.Database): GraphSnapshot {
  return projection(db).snapshot as GraphSnapshot;
}

let action = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  action += 1;
  const response = commitCommand(db, {
    projectId: P,
    actionId: `test-${action}`,
    expectedRevisionId: projection(db).currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
  expect(response.status).toBe('applied');
  return response;
}

/** Undo and redo as the app does them: restore-revision of a named revision. */
function restore(db: Database.Database, revisionId: string) {
  return commit(db, { type: 'restore-revision', revisionId });
}

function importNested(db: Database.Database) {
  return commit(db, { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
}

function newProject(db: Database.Database) {
  return commit(db, { type: 'import-workflow', document: { version: 1, state: { lastNodeId: 0, lastLinkId: 0 }, nodes: [], links: [] } });
}

function write(db: Database.Database, owner: ObjectRef, text: string, extra: Partial<ExplanationInput> = {}): Explanation {
  return saveExplanation(db, {
    projectId: P,
    owner,
    aspect: 'what',
    text,
    provenance: 'user',
    sourceUrl: null,
    revisionId: projection(db).currentRevisionId,
    createdBy: 'user',
    ...extra,
  });
}

function texts(db: Database.Database, owner: ObjectRef, projectId: string | null = P): string[] {
  return listExplanations(db, { projectId, owner }).map((item) => item.text);
}

/** "Save project" as the menu does it, through the JSON text written to disk. */
function saveFile(db: Database.Database): Record<string, any> {
  const saved = nativeProjectFile(db, P);
  if (!saved.ok) throw new Error(saved.error);
  return JSON.parse(JSON.stringify(saved.project, null, 2));
}

function openFile(db: Database.Database, file: unknown) {
  const opened = openNativeFile(db, P, file);
  expect(opened.status).toBe('applied');
  return opened;
}

const NODE: ObjectRef = { kind: 'node', id: '1', classType: 'CheckpointLoaderSimple' };
const PORT: ObjectRef = { kind: 'port', id: '1:out-1', nodeId: '1', direction: 'output', portName: 'CLIP' };
const PROCESS: ObjectRef = { kind: 'process', id: 'process' };
const OUTER_NODE: ObjectRef = { kind: 'node', id: '1', classType: INNER_ID, subgraphId: OUTER_ID };
const INNER_NODE: ObjectRef = { kind: 'node', id: '1', classType: 'CLIPTextEncode', subgraphId: INNER_ID };
const INNER_PORT: ObjectRef = { kind: 'port', id: '1:in-0', nodeId: '1', direction: 'input', portName: 'clip', subgraphId: INNER_ID };

describe('project file fingerprints include graph explanations', () => {
  it('marks explanation additions, edits and removals dirty, but not global knowledge or bookkeeping', () => {
    const db = openDb();
    importNested(db);
    rememberProjectFile(db, P, '/tmp/explanations.json');
    expect(projectFileState(db, P).dirty).toBe(false);
    const note = write(db, NODE, 'First words.');
    expect(projectFileState(db, P).dirty).toBe(true);
    rememberProjectFile(db, P, '/tmp/explanations.json');
    expect(projectFileState(db, P).dirty).toBe(false);
    db.prepare('UPDATE explanations SET text = ? WHERE id = ?').run('Changed words.', note.id);
    expect(projectFileState(db, P).dirty).toBe(true);
    rememberProjectFile(db, P, '/tmp/explanations.json');
    db.prepare('UPDATE explanations SET created_at = ?, revision_id = ?, created_by = ? WHERE id = ?').run(123, 'another-revision', 'file', note.id);
    expect(projectFileState(db, P).dirty).toBe(false);
    write(db, { kind: 'nodeClass', id: 'KSampler' }, 'Shared knowledge.');
    expect(projectFileState(db, P).dirty).toBe(false);
    db.prepare('UPDATE explanations SET created_by = ? WHERE id = ?').run('user', note.id);
    expect(deletePersonExplanation(db, note.id)).toBe(1);
    expect(projectFileState(db, P).dirty).toBe(true);
    db.close();
  });

  it('is clean after opening the saved file, and later explanation changes count in that graph', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Travels with the graph.');
    const file = saveFile(db);
    const other = openDb();
    openFile(other, file);
    rememberProjectFile(other, P, '/tmp/opened.json');
    expect(projectFileState(other, P).dirty).toBe(false);
    write(other, NODE, 'Added after opening.', { aspect: 'why' });
    expect(projectFileState(other, P).dirty).toBe(true);
    db.close();
    other.close();
  });

  it('treats a description-only project as meaningful content', () => {
    const db = openDb();
    write(db, PROCESS, 'The plan for this project.');
    expect(projectFileState(db, P)).toMatchObject({ empty: false, dirty: true });
    db.close();
  });

  it('uses semantic explanation fields, a stable order and the content captured before a save dialog', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Captured words.');
    rememberProjectFile(db, P, '/tmp/captured.json');
    const graphKey = projectFileState(db, P).graphKey;
    const row = db.prepare('SELECT saved_digest FROM project_files WHERE project_id = ? AND graph_key = ?').get(P, graphKey) as { saved_digest: string };
    write(db, NODE, 'New words while the dialog waits.', { aspect: 'why' });
    rememberProjectFile(db, P, '/tmp/captured.json', { graphKey, digest: row.saved_digest });
    expect(projectFileState(db, P).dirty).toBe(true);
    const items = saveFile(db).extensions.explanations.items;
    const graph = snap(db);
    expect(contentDigest(graph, items)).toBe(contentDigest(graph, [...items].reverse().map((item) => ({ ...item, createdAt: 1, revisionId: 'other', createdBy: 'file' }))));
    for (const patch of [{ text: 'Changed' }, { aspect: 'connect' }, { provenance: 'web' }, { sourceUrl: 'https://example.org/source' }, { owner: { kind: 'node', id: '2' } }]) {
      expect(contentDigest(graph, items)).not.toBe(contentDigest(graph, [{ ...items[0], ...patch }, ...items.slice(1)]));
    }
    db.close();
  });
});

function owners(db: Database.Database) {
  const snapshot = snap(db);
  const edge: ObjectRef = { kind: 'edge', id: String(snapshot.edges[0].id) };
  const group: ObjectRef = { kind: 'group', id: String(snapshot.groups![0].id) };
  const definition: ObjectRef = { kind: 'subgraph', id: OUTER_ID };
  const outer = snapshot.subgraphs!.find((item) => item.id === OUTER_ID)!;
  const innerEdge = outer.edges.find((item) => String(item.source) === '1' && String(item.target) === '2')!;
  const outerEdge: ObjectRef = { kind: 'edge', id: String(innerEdge.id), subgraphId: OUTER_ID };
  return { edge, group, definition, outerEdge };
}

describe('explanations travel with the project file', () => {
  it('saves every owner kind with its source and brings each back exactly on another machine', () => {
    const db = openDb();
    importNested(db);
    const { edge, group, definition, outerEdge } = owners(db);
    const written = [
      write(db, NODE, 'Loads the checkpoint.', { provenance: 'fact', createdBy: 'ai' }),
      write(db, PORT, 'The text encoder goes out here.', { provenance: 'inference', createdBy: 'ai', aspect: 'connect' }),
      write(db, edge, 'Carries CLIP to the prompt block.', { provenance: 'web', createdBy: 'ai', sourceUrl: 'https://example.org/clip' }),
      write(db, group, 'Everything that makes the picture.'),
      write(db, definition, 'Turns the prompt into conditioning.', { aspect: 'why', provenance: 'inference', createdBy: 'ai' }),
      write(db, PROCESS, 'A portrait in two passes.'),
      write(db, OUTER_NODE, 'The nested encoder.'),
      write(db, outerEdge, 'Encoded text to the zero-out.'),
      write(db, INNER_NODE, 'Encodes the words.', { provenance: 'fact', createdBy: 'seed' }),
      write(db, INNER_PORT, 'The clip from outside.'),
    ];
    const file = saveFile(db);
    const block = file.extensions[EXPLANATIONS_EXTENSION];
    expect(block.version).toBe(1);
    expect(block.items).toHaveLength(written.length);

    const other = openDb();
    const opened = openFile(other, file);
    expect(opened.result).toMatchObject({ explanations: { restored: written.length, skipped: 0, unreadable: false } });
    for (const before of written) {
      const after = listExplanations(other, { projectId: P, owner: before.owner });
      expect(after).toHaveLength(1);
      const { id: _a, projectId: _b, ...kept } = after[0];
      const { id: _c, projectId: _d, ...expected } = before;
      void _a; void _b; void _c; void _d;
      // Whoever made the file wrote it: it comes back as "from the file", never as a fact, the person's own note or
      // built-in knowledge. A web finding keeps its label and link.
      expect(kept).toEqual({ ...expected, createdBy: 'file', provenance: before.provenance === 'web' ? 'web' : 'file' });
    }
    // Saved again on the other machine: the same objects and texts, now marked as from a file.
    const again = saveFile(other).extensions[EXPLANATIONS_EXTENSION];
    expect(again.items.map((item: { text: string }) => item.text)).toEqual(block.items.map((item: { text: string }) => item.text));
    expect(again.items.every((item: { createdBy: string }) => item.createdBy === 'file')).toBe(true);
    db.close();
    other.close();
  });

  it('keeps knowledge about classes, models, types and families out of the file', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Mine.');
    const global = (owner: ObjectRef, text: string, projectId: string | null = null) => saveExplanation(db, {
      projectId, owner, aspect: 'what', text, provenance: 'inference', sourceUrl: null, revisionId: null, createdBy: 'ai',
    });
    global({ kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, 'CLASS_SENTINEL');
    global({ kind: 'nodeClass', id: 'KSampler', classType: 'KSampler' }, 'PROJECT_CLASS_SENTINEL', P);
    global({ kind: 'model', id: 'checkpoints/a.safetensors', directory: 'checkpoints', name: 'a.safetensors' }, 'MODEL_SENTINEL');
    global({ kind: 'linkType', id: 'CLIP' }, 'TYPE_SENTINEL');
    global({ kind: 'family', id: 'sdxl' }, 'FAMILY_SENTINEL');
    const text = JSON.stringify(saveFile(db));
    expect(text).toContain('Mine.');
    for (const sentinel of ['CLASS_SENTINEL', 'PROJECT_CLASS_SENTINEL', 'MODEL_SENTINEL', 'TYPE_SENTINEL', 'FAMILY_SENTINEL']) expect(text).not.toContain(sentinel);
    // Global knowledge shows in every graph.
    newProject(db);
    expect(texts(db, { kind: 'nodeClass', id: 'KSampler' })).toEqual(['CLASS_SENTINEL', 'PROJECT_CLASS_SENTINEL']);
    db.close();
  });

  it('leaves out objects that are no longer in the graph, and brings them back with undo', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Loads the checkpoint.');
    write(db, PORT, 'CLIP leaves here.');
    const before = projection(db).currentRevisionId;
    commit(db, { type: 'remove-node', nodeId: '1' });
    expect(saveFile(db).extensions.explanations.items).toEqual([]);
    restore(db, before);
    expect(snap(db).nodes.some((node) => node.id === '1')).toBe(true);
    expect(texts(db, NODE)).toEqual(['Loads the checkpoint.']);
    expect(texts(db, PORT)).toEqual(['CLIP leaves here.']);
    expect(saveFile(db).extensions.explanations.items.map((item: { text: string }) => item.text)).toEqual(['Loads the checkpoint.', 'CLIP leaves here.']);
    db.close();
  });

  it('opens a project saved without the block, and one whose block is unknown or malformed', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Kept.');
    const file = saveFile(db);
    const { extensions: _drop, ...older } = file;
    void _drop;
    const target = openDb();
    expect(openFile(target, older).result).toMatchObject({ explanations: { restored: 0, skipped: 0, unreadable: false } });
    expect(snap(target).nodes.map((node) => node.id)).toEqual(snap(db).nodes.map((node) => node.id));
    expect(texts(target, NODE)).toEqual([]);

    for (const block of ['nonsense', 42, [], { version: 99, items: file.extensions.explanations.items }, { version: 1, items: 'none' }]) {
      const opened = openFile(target, { ...file, extensions: { explanations: block, other: { kept: true } } });
      expect(opened.result).toMatchObject({ explanations: { restored: 0, unreadable: true } });
      expect(texts(target, NODE)).toEqual([]);
    }
    const good = file.extensions.explanations.items[0];
    const mixed = {
      version: 1,
      items: [
        good,
        null,
        { ...good, aspect: 'opinion' },
        { ...good, text: '' },
        { ...good, owner: { kind: 'nodeClass', id: 'KSampler' } },
        { ...good, owner: { kind: 'port', id: 'x' } },
        { ...good, sourceUrl: 'javascript:alert(1)' },
        { ...good, provenance: 'rumour' },
      ],
    };
    const opened = openFile(target, { ...file, extensions: { explanations: mixed } });
    expect(opened.result).toMatchObject({ explanations: { restored: 1, skipped: 7, unreadable: false } });
    expect(texts(target, NODE)).toEqual(['Kept.']);
    expect(readExplanationsBlock(undefined)).toEqual({ items: [], skipped: 0, unreadable: false });
    db.close();
    target.close();
  });
});

describe('graphs do not share explanations by accident', () => {
  it('two graphs with the same node numbers keep their own', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Nested graph node 1.');
    newProject(db);
    expect(texts(db, NODE)).toEqual([]);
    commit(db, { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    expect(snap(db).nodes.some((node) => node.id === '1')).toBe(true);
    expect(texts(db, NODE)).toEqual([]);
    write(db, NODE, 'Dense graph node 1.');
    expect(texts(db, NODE)).toEqual(['Dense graph node 1.']);
    // The same workflow opened again is another graph: what a ComfyUI workflow cannot carry does not come with it.
    importNested(db);
    expect(texts(db, NODE)).toEqual([]);
    db.close();
  });

  it('undo and redo across new, import and open bring each graph back with its own explanations', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'First graph.');
    const file = saveFile(db);
    const first = projection(db);

    newProject(db);
    const empty = projection(db);
    expect(empty.graphKey).not.toBe(first.graphKey);
    expect(texts(db, NODE)).toEqual([]);
    restore(db, first.currentRevisionId); // undo of New project
    expect(projection(db).graphKey).toBe(first.graphKey);
    expect(texts(db, NODE)).toEqual(['First graph.']);
    restore(db, empty.currentRevisionId); // redo
    expect(projection(db).graphKey).toBe(empty.graphKey);
    expect(texts(db, NODE)).toEqual([]);

    commit(db, { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    write(db, NODE, 'Dense graph.');
    const dense = projection(db);

    openFile(db, file);
    const reopened = projection(db);
    expect(reopened.graphKey).not.toBe(first.graphKey);
    expect(texts(db, NODE)).toEqual(['First graph.']);
    write(db, NODE, 'Edited after open.');
    restore(db, dense.currentRevisionId); // undo of Open project
    expect(texts(db, NODE)).toEqual(['Dense graph.']);
    restore(db, reopened.currentRevisionId); // redo
    expect(texts(db, NODE)).toEqual(['First graph.', 'Edited after open.']);
    // Edits keep the graph; only a replacement or a restore across one changes it.
    commit(db, { type: 'move-node', nodeId: '1', x: 5, y: 5 });
    expect(texts(db, NODE)).toEqual(['First graph.', 'Edited after open.']);
    db.close();
  });
});

describe('inside a subgraph definition', () => {
  it('tells inner nodes apart from main-canvas nodes with the same number and shares them between instances', () => {
    const db = openDb();
    importNested(db);
    write(db, NODE, 'Main canvas node 1.');
    write(db, OUTER_NODE, 'Outer definition node 1.');
    write(db, INNER_NODE, 'Inner definition node 1.');
    expect(texts(db, NODE)).toEqual(['Main canvas node 1.']);
    expect(texts(db, OUTER_NODE)).toEqual(['Outer definition node 1.']);
    expect(texts(db, INNER_NODE)).toEqual(['Inner definition node 1.']);
    // Another instance of the definition sees the same words: the scope is the definition, not the instance.
    commit(db, { type: 'insert-subgraph', definitionId: OUTER_ID, x: 900, y: 40 });
    expect(snap(db).nodes.filter((node) => node.data?.comfyType === OUTER_ID)).toHaveLength(2);
    expect(texts(db, OUTER_NODE)).toEqual(['Outer definition node 1.']);
    // The owner comes back naming its definition.
    expect(listExplanations(db, { projectId: P, owner: INNER_NODE })[0].owner).toMatchObject({ subgraphId: INNER_ID, id: '1' });
    db.close();
  });

  it('carries descriptions into a new subgraph and back out when it is dissolved', () => {
    const db = openDb();
    commit(db, { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    const prompt: ObjectRef = { kind: 'node', id: '2', classType: 'CLIPTextEncode' };
    const sampler: ObjectRef = { kind: 'node', id: '4', classType: 'KSampler' };
    write(db, prompt, 'The positive prompt.');
    write(db, sampler, 'Samples the picture.');
    write(db, { kind: 'edge', id: 'link-4' }, 'Positive into the sampler.');
    const created = commit(db, { type: 'create-subgraph', name: 'Prompt block', nodeIds: ['2', '3', '4'], inputs: [], outputs: [] });
    const definitionId = (created.result as { definitionId: string }).definitionId;
    expect(texts(db, inSubgraph(prompt, definitionId))).toEqual(['The positive prompt.']);
    expect(texts(db, inSubgraph({ kind: 'edge', id: 'link-4' }, definitionId))).toEqual(['Positive into the sampler.']);
    write(db, inSubgraph(sampler, definitionId), 'Written inside.');
    const instance = (created.result as { nodeId: string }).nodeId;
    const dissolved = commit(db, { type: 'dissolve-subgraph', nodeId: instance });
    const ids = (dissolved.result as { nodeIds: string[] }).nodeIds;
    const sampled = ids[2];
    expect(texts(db, { kind: 'node', id: sampled })).toEqual(sampled === '4' ? ['Samples the picture.', 'Written inside.'] : ['Written inside.']);
    // Saved, the file has each description once, for the objects on the canvas now.
    const items = saveFile(db).extensions.explanations.items as Array<{ text: string }>;
    expect(items.filter((item) => item.text === 'Samples the picture.')).toHaveLength(1);
    db.close();
  });
});

describe('a ComfyUI workflow export', () => {
  it('contains none of the explanations', () => {
    const db = openDb();
    importNested(db);
    const { edge, definition, outerEdge } = owners(db);
    for (const [owner, text] of [[NODE, 'EXPORT_NODE'], [PORT, 'EXPORT_PORT'], [edge, 'EXPORT_EDGE'], [definition, 'EXPORT_SG'],
      [PROCESS, 'EXPORT_PROCESS'], [OUTER_NODE, 'EXPORT_INNER'], [outerEdge, 'EXPORT_INNER_EDGE']] as Array<[ObjectRef, string]>) write(db, owner, text);
    expect(JSON.stringify(saveFile(db))).toContain('EXPORT_NODE');
    const exported = exportWorkflow(snap(db), '2026-11-14T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const encoded = JSON.stringify(exported.workflow);
    expect(encoded).not.toMatch(/EXPORT_/);
    expect(encoded).not.toContain(EXPLANATIONS_EXTENSION);
    db.close();
  });
});

describe('migration to version 15', () => {
  it('keeps the descriptions of a version 14 database on the graph it shows', () => {
    const db = openDb();
    commit(db, { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    const dense = projection(db).currentRevisionId;
    importNested(db);
    const nested = projection(db).currentRevisionId;
    restore(db, dense);
    const current = projection(db).currentRevisionId;
    // Back to version 14: no graph keys, no scope.
    db.exec(`
      DROP INDEX idx_explanations_graph;
      ALTER TABLE explanations DROP COLUMN graph_key;
      ALTER TABLE explanations DROP COLUMN scope;
      ALTER TABLE graph_revisions DROP COLUMN graph_key;
      DELETE FROM schema_migrations WHERE version >= 15;
      DROP TABLE project_files;
      DROP TABLE assistant_drafts;
      ALTER TABLE chat_messages DROP COLUMN checkpoint;
    `);
    expect(schemaVersion(db)).toBe(14);
    const insert = db.prepare(`INSERT INTO explanations (id, project_id, owner_kind, owner_id, owner_json, aspect, text, provenance,
      source_url, revision_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'what', ?, 'user', NULL, ?, 'user', ?)`);
    insert.run('old-node', P, 'node', '1', JSON.stringify(NODE), 'Written in 0.8.0.', current, 1);
    insert.run('old-port', P, 'port', '1:output:CLIP', JSON.stringify({ kind: 'port', id: '1:out-1', nodeId: '1', direction: 'output', portName: 'CLIP' }), 'Port in 0.8.0.', current, 2);
    insert.run('old-class', null, 'nodeClass', 'KSampler', JSON.stringify({ kind: 'nodeClass', id: 'KSampler' }), 'Class in 0.8.0.', null, 3);

    migrate(db);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(graphKeyOf(db, P, current)).toBe(graphKeyOf(db, P, dense));
    expect(graphKeyOf(db, P, nested)).not.toBe(graphKeyOf(db, P, dense));
    expect(currentGraphKey(db, P)).toBe(graphKeyOf(db, P, dense));
    expect(texts(db, NODE)).toEqual(['Written in 0.8.0.']);
    expect(texts(db, { kind: 'port', id: '1:out-1', nodeId: '1', direction: 'output', portName: 'CLIP' })).toEqual(['Port in 0.8.0.']);
    expect(texts(db, { kind: 'nodeClass', id: 'KSampler' })).toEqual(['Class in 0.8.0.']);
    // They now belong to that graph: not on the nested graph's node 1, back when undo returns.
    restore(db, nested);
    expect(texts(db, NODE)).toEqual([]);
    expect(texts(db, { kind: 'nodeClass', id: 'KSampler' })).toEqual(['Class in 0.8.0.']);
    restore(db, current);
    expect(texts(db, NODE)).toEqual(['Written in 0.8.0.']);
    expect(saveFile(db).extensions.explanations.items.map((item: { text: string }) => item.text)).toEqual(['Written in 0.8.0.', 'Port in 0.8.0.']);
    db.close();
  });
});
