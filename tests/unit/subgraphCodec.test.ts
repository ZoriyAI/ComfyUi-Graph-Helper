import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { NATIVE_PROJECT_VERSION, parseNativeProject, serializeNativeProject } from '../../src/shared/native-project';
import { exportWorkflow, projectWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

const AT = '2026-11-08T00:00:00.000Z';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function snap(db: Database.Database): GraphSnapshot {
  return readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as GraphSnapshot;
}

function commit(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function roundTrip(document: Record<string, unknown>): Record<string, unknown> {
  const db = openDb();
  const imported = commit(db, 'import', { type: 'import-workflow', document: structuredClone(document) });
  expect(imported.status).toBe('applied');
  const result = exportWorkflow(snap(db), AT);
  db.close();
  if (!result.ok) throw new Error(result.error);
  return result.workflow;
}

describe('native subgraph codec', () => {
  it('round-trips a nested native subgraph losslessly through import, storage and export', () => {
    expect(roundTrip(nestedSubgraphWorkflow)).toEqual(nestedSubgraphWorkflow);
  });

  it('models both definitions, marks instances on the canvas and inside a definition, and lifts the group', () => {
    const projected = projectWorkflow(structuredClone(nestedSubgraphWorkflow));
    if ('error' in projected) throw new Error(projected.error);
    const { subgraphs, groups, nodes } = projected.snapshot;
    expect(subgraphs!.map((item) => [item.id, item.name, item.nestedIn])).toEqual([
      [OUTER_ID, 'Prompt block', null],
      [INNER_ID, 'Encode', null],
    ]);
    const outer = subgraphs![0];
    expect(outer.inputs).toEqual([
      { id: 'cccccccc-0000-4000-8000-000000000003', name: 'clip', type: 'CLIP', raw: { localized_name: 'clip', pos: [-100, 20] }, linkIds: [1] },
    ]);
    expect(outer.edges.map((edge) => [edge.source, edge.sourceHandle, edge.target, edge.targetHandle])).toEqual([
      ['-10', 'out-0', '1', 'in-0'],
      ['1', 'out-0', '2', 'in-0'],
      ['2', 'out-0', '-20', 'in-0'],
    ]);
    expect(outer.nodes[0].data).toMatchObject({ kind: 'subgraph-instance', subgraphId: INNER_ID });
    expect(nodes.find((node) => node.id === '2')!.data).toMatchObject({
      kind: 'subgraph-instance',
      subgraphId: OUTER_ID,
      inputs: [{ id: 'in-0', name: 'clip', dataType: 'CLIP', optional: false }],
      outputs: [{ id: 'out-0', name: 'CONDITIONING', dataType: 'CONDITIONING', optional: false }],
    });
    expect(groups).toEqual([
      expect.objectContaining({ id: '1', title: 'Generation', nodeIds: ['1', '2', '3'], color: '#3f789e', bounding: [0, -80, 900, 400] }),
    ]);
  });

  it('round-trips the typed and dense fixtures, with groups added, without changes', () => {
    const typed = { ...structuredClone(typedWorkflow), state: { lastNodeId: 3, lastLinkId: 2, lastGroupId: 3 }, groups: [{ id: 3, title: 'Text', bounding: [340, -40, 300, 420], color: '#a1309b', font_size: 24, flags: {} }] };
    // A file without `extra` keeps having none.
    expect(roundTrip(typed)).toEqual(typed);
    const dense = structuredClone(denseWorkflow);
    // The dense fixture leaves slot link fields empty; export fills them from links, so compare the graph itself.
    const back = roundTrip(dense);
    expect(back.links).toEqual(dense.links);
    expect((back.nodes as Array<{ id: number; pos: number[] }>).map((node) => [node.id, node.pos])).toEqual(dense.nodes.map((node) => [node.id, node.pos]));
    expect(back.definitions).toBeUndefined();
    expect(back.groups).toBeUndefined();
  });

  it('edits an imported nested definition and still exports the frontend shape', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    expect(commit(db, 'rename', { type: 'rename-subgraph', definitionId: INNER_ID, name: 'Text encode' }).status).toBe('applied');
    const added = commit(db, 'io', { type: 'add-subgraph-io', definitionId: OUTER_ID, direction: 'output', name: 'raw', dataType: 'CONDITIONING', nodeId: '1', handle: 'out-0' });
    expect(added.status).toBe('applied');
    const result = exportWorkflow(snap(db), AT);
    if (!result.ok) throw new Error(result.error);
    const [outer, inner] = (result.workflow.definitions as { subgraphs: Array<Record<string, any>> }).subgraphs;
    expect(inner.name).toBe('Text encode');
    expect(outer.outputs).toHaveLength(2);
    const newLink = outer.links.find((link: { target_id: number; target_slot: number }) => link.target_id === -20 && link.target_slot === 1);
    expect(newLink).toMatchObject({ origin_id: 1, origin_slot: 0, type: 'CONDITIONING' });
    expect(outer.outputs[1].linkIds).toEqual([newLink.id]);
    expect(outer.nodes[0].outputs[0].links).toEqual(expect.arrayContaining([2, newLink.id]));
    const instance = (result.workflow.nodes as Array<Record<string, any>>).find((node) => node.id === 2)!;
    expect(instance.outputs.map((slot: { name: string }) => slot.name)).toEqual(['CONDITIONING', 'raw']);
    expect(instance.inputs[0].localized_name).toBe('clip');
    db.close();
  });

  it('dissolves an imported instance and removes its definition', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    const dissolved = commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: '2' });
    expect(dissolved.status).toBe('applied');
    const snapshot = snap(db);
    // Inner id 1 collides with the loader, so it gets a fresh id above lastNodeId 3; id 2 is freed by the instance.
    expect((dissolved.result as { nodeIds: string[] }).nodeIds).toEqual(['4', '2']);
    expect(snapshot.subgraphs!.map((item) => item.id)).toEqual([INNER_ID]);
    const wiring = snapshot.edges.map((edge) => `${edge.source}:${edge.sourceHandle}>${edge.target}:${edge.targetHandle}`).sort();
    expect(wiring).toEqual(['1:out-1>4:in-0', '2:out-0>3:in-1', '4:out-0>2:in-0']);
    expect(snapshot.nodes.find((node) => node.id === '4')!.data.subgraphId).toBe(INNER_ID);
    db.close();
  });

  it('lifts subgraphs and groups from a revision stored before they were modelled', () => {
    const db = openDb();
    const projected = projectWorkflow(structuredClone(nestedSubgraphWorkflow));
    if ('error' in projected) throw new Error(projected.error);
    db.prepare(`INSERT INTO graph_revisions (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document, components, process_meta)
      VALUES ('rev-legacy', ?, 1, ?, ?, NULL, 'legacy', 'user', 2, ?, '[]', '{}')`).run(
      DESKTOP_PROJECT_ID,
      JSON.stringify(projected.snapshot.nodes),
      JSON.stringify(projected.snapshot.edges),
      JSON.stringify(projected.snapshot.document),
    );
    db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run('rev-legacy', DESKTOP_PROJECT_ID);
    const snapshot = snap(db);
    expect(snapshot.subgraphs!.map((item) => item.id)).toEqual([OUTER_ID, INNER_ID]);
    expect(snapshot.groups!.map((group) => group.title)).toEqual(['Generation']);
    expect(snapshot.components!.filter((item) => item.ownerKind === 'subgraph')).toHaveLength(2);
    db.close();
  });
});

describe('native project version 2', () => {
  it('writes subgraphs, groups and extensions, and reopens them', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    commit(db, 'note', { type: 'annotate-node', nodeId: '2', annotation: 'app-only note' });
    const snapshot = snap(db);
    const file = serializeNativeProject({
      process: snapshot.process!,
      graph: { nodes: snapshot.nodes, edges: snapshot.edges, document: snapshot.document },
      components: snapshot.components!,
      subgraphs: snapshot.subgraphs,
      groups: snapshot.groups,
      extensions: { explanations: [{ id: 'e1', text: 'kept' }] },
    });
    expect(file.version).toBe(2);
    expect(NATIVE_PROJECT_VERSION).toBe(2);
    const parsed = parseNativeProject(JSON.parse(JSON.stringify(file)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.extensions).toEqual({ explanations: [{ id: 'e1', text: 'kept' }] });
    expect(parsed.project.subgraphs).toEqual(snapshot.subgraphs);
    expect(parsed.project.sourceVersion).toBe(2);

    const fresh = openDb();
    const opened = commit(fresh, 'open', { type: 'open-native', project: parsed.project });
    expect(opened.status).toBe('applied');
    const reopened = snap(fresh);
    expect(reopened.subgraphs).toEqual(snapshot.subgraphs);
    expect(reopened.groups).toEqual(snapshot.groups);
    expect(reopened.nodes.find((node) => node.id === '2')!.data.annotations).toEqual(['app-only note']);
    db.close();
    fresh.close();
  });

  it('reads a version 1 file and lifts its subgraphs from the native document', () => {
    const projected = projectWorkflow(structuredClone(nestedSubgraphWorkflow));
    if ('error' in projected) throw new Error(projected.error);
    const v1 = {
      format: 'nodewise-studio-project',
      version: 1,
      process: { title: 'Old', notes: '' },
      graph: { nodes: projected.snapshot.nodes, edges: projected.snapshot.edges, document: projected.snapshot.document },
      components: [],
    };
    const parsed = parseNativeProject(JSON.parse(JSON.stringify(v1)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.version).toBe(2);
    expect(parsed.project.sourceVersion).toBe(1);
    expect(parsed.project.subgraphs).toBeUndefined();
    expect(parsed.project.extensions).toEqual({});
    const db = openDb();
    expect(commit(db, 'open', { type: 'open-native', project: parsed.project }).status).toBe('applied');
    expect(snap(db).subgraphs!.map((item) => item.id)).toEqual([OUTER_ID, INNER_ID]);
    expect(snap(db).groups).toHaveLength(1);
    db.close();
  });

  it('rejects a version 2 file with a malformed subgraph list', () => {
    const bad = parseNativeProject({
      format: 'nodewise-studio-project',
      version: 2,
      process: { title: '', notes: '' },
      graph: { nodes: [], edges: [], document: null },
      components: [],
      subgraphs: [{ id: 'x' }],
    });
    expect(bad).toEqual({ ok: false, error: 'The native project file is not valid.' });
  });
});
