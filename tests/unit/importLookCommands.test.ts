import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, shownDifferently, type GraphSnapshot } from '../../src/shared/workflow/codec';

/**
 * What IMPORT+NODES reads from a file is written back exactly, and what it lets a person change on the canvas
 * (collapse, a Primitive's value and switch, a promoted field of a subgraph copy) changes only that in the file.
 */
type Json = Record<string, any>;
const EXPORTED_AT = '2026-11-14T00:00:00.000Z';
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/workflows/import-look-0.4.json'), 'utf8')) as Json;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let seq = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  seq += 1;
  return commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: `look-${seq}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload });
}

function imported(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  expect(commit(db, { type: 'import-workflow', document: copy(FIXTURE) }).status).toBe('applied');
  return db;
}

function exported(db: Database.Database): Json {
  const projection = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = exportWorkflow(projection.snapshot as GraphSnapshot, EXPORTED_AT, readCatalog(db));
  if (!result.ok) throw new Error(result.error);
  return copy(result.workflow) as Json;
}

const nodeOf = (doc: Json, id: number) => doc.nodes.find((node: Json) => node.id === id);

describe('import look round trip', () => {
  it('exports the fixture exactly: sizes, flags, colours, reroutes, Primitive, notes, Set / Get, promoted fields', () => {
    const db = imported();
    expect(exported(db)).toEqual(FIXTURE);
    db.close();
  });

  it('collapse and expand write flags.collapsed, and expanding a file\'s collapsed node then collapsing it again restores it', () => {
    const db = imported();
    expect(commit(db, { type: 'collapse-node', nodeIds: ['5', '2'], collapsed: true }).status).toBe('applied');
    const collapsed = copy(FIXTURE);
    nodeOf(collapsed, 5).flags = { collapsed: true };
    nodeOf(collapsed, 2).flags = { collapsed: true };
    expect(exported(db)).toEqual(collapsed);

    expect(commit(db, { type: 'collapse-node', nodeIds: ['6'], collapsed: false }).status).toBe('applied');
    nodeOf(collapsed, 6).flags = {};
    expect(exported(db)).toEqual(collapsed);
    expect(commit(db, { type: 'collapse-node', nodeIds: ['6', '5', '2'], collapsed: false }).status).toBe('applied');
    expect(commit(db, { type: 'collapse-node', nodeIds: ['6'], collapsed: true }).status).toBe('applied');
    expect(exported(db)).toEqual(FIXTURE);
    db.close();
  });

  it('refuses to collapse a node that is not there', () => {
    const db = imported();
    expect(commit(db, { type: 'collapse-node', nodeIds: ['99'], collapsed: true }).status).toBe('rejected');
    db.close();
  });

  it('collapses a node inside a subgraph definition', () => {
    const db = imported();
    const definitionId = FIXTURE.definitions.subgraphs[0].id;
    expect(commit(db, { type: 'edit-in-subgraph', definitionId, edit: { type: 'collapse-node', nodeIds: ['2'], collapsed: true } }).status).toBe('applied');
    const expected = copy(FIXTURE);
    expected.definitions.subgraphs[0].nodes[1].flags = { collapsed: true };
    expect(exported(db)).toEqual(expected);
    db.close();
  });

  it('a Primitive\'s value and its "after each run" switch change only those slots', () => {
    const db = imported();
    expect(commit(db, { type: 'set-parameter', nodeId: '8', key: 'widgets::0', value: 1024, widgetIndex: 0 }).status).toBe('applied');
    expect(commit(db, { type: 'set-parameter', nodeId: '8', key: 'widgets::1', value: 'increment', widgetIndex: 1 }).status).toBe('applied');
    const expected = copy(FIXTURE);
    nodeOf(expected, 8).widgets_values = [1024, 'increment'];
    expect(exported(db)).toEqual(expected);
    db.close();
  });

  it('a promoted field: the copy\'s own value goes to its slot, an inner field to the node inside', () => {
    const db = imported();
    expect(commit(db, { type: 'set-parameter', nodeId: '15', key: 'widgets::0', value: 30, widgetIndex: 0 }).status).toBe('applied');
    const definitionId = FIXTURE.definitions.subgraphs[0].id;
    expect(commit(db, { type: 'edit-in-subgraph', definitionId, edit: { type: 'set-parameter', nodeId: '1', key: 'text', value: 'a new inner prompt', widgetIndex: 0 } }).status).toBe('applied');
    const expected = copy(FIXTURE);
    nodeOf(expected, 15).widgets_values = [30, null];
    expected.definitions.subgraphs[0].nodes[0].widgets_values = ['a new inner prompt'];
    expect(exported(db)).toEqual(expected);
    db.close();
  });

  it('the import notice names only what is still shown differently', () => {
    expect(shownDifferently(FIXTURE)).toEqual({ groupNodes: 0 });
  });
});
