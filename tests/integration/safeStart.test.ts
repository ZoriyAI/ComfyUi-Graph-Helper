/**
 * Protects the safe start guard (src/main/startGuard.ts, src/main/ipc/startIpc.ts). When a graph replaced the one on
 * screen and was never drawn (the window hung or closed on it), the next start asks whether to open it again or
 * start from an empty canvas. A person must never be stuck in a crash loop on a graph that cannot be drawn.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() }, BrowserWindow: {}, dialog: {} }));

import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { createTranslator } from '../../src/shared/i18n';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { beginDrawing, readStartMark } from '../../src/main/startGuard';
import { drawn, startChoice, watchReplacingCommit } from '../../src/main/ipc/startIpc';

const P = DESKTOP_PROJECT_ID;

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-start-'));
  return { db, userData };
}

function importNodes(db: Database.Database, count: number) {
  const nodes = Array.from({ length: count }, (_, index) => ({ id: index + 1, type: 'Note', pos: [0, index * 10], size: [100, 60], flags: {}, order: index, mode: 0, properties: {}, widgets_values: ['x'] }));
  const input = { projectId: P, actionId: `imp-${Math.random()}`, expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: { version: 0.4, last_node_id: count, last_link_id: 0, nodes, links: [] } } };
  const response = commitCommand(db, input);
  return { input, response };
}

describe('safe start', () => {
  it('a load that never said "drawn" makes the next load of the same graph unfinished', () => {
    const { userData } = setup();
    expect(beginDrawing(userData, 'r1')).toBe(false);
    expect(beginDrawing(userData, 'r1')).toBe(true);
    expect(drawn(userData, 'r1')).toBe(true);
    expect(readStartMark(userData)?.state).toBe('drawn');
    expect(beginDrawing(userData, 'r1')).toBe(false);
    // The mark file is the owner's only.
    expect(fs.statSync(path.join(userData, 'graph-start.json')).mode & 0o777).toBe(0o600);
  });

  it('a graph that replaced the one on screen and was never drawn is asked about at the next start; an empty canvas can be chosen', async () => {
    const { db, userData } = setup();
    const { input, response } = importNodes(db, 5);
    expect(response.status).toBe('applied');
    watchReplacingCommit(userData, input, response);
    // Typed as the dependency it stands for, so the question it was asked can be read back.
    const ask = vi.fn<Parameters<typeof startChoice>[0]['ask']>(async () => 0);
    const choice = await startChoice({ db, userData, translate: createTranslator('ru'), ask });
    expect(choice).toEqual({ unfinished: true, emptied: true });
    const asked = ask.mock.calls[0][0] as { detail: string; buttons: string[] };
    expect(asked.detail).toContain('нод: 5');
    expect(asked.buttons).toEqual(['Начать с пустого холста', 'Открыть граф снова']);
    expect((readProjection(db, P)!.snapshot.nodes as unknown[]).length).toBe(0);
  });

  it('"Open the graph again" keeps the graph and watches this draw again', async () => {
    const { db, userData } = setup();
    const { input, response } = importNodes(db, 3);
    watchReplacingCommit(userData, input, response);
    const choice = await startChoice({ db, userData, translate: createTranslator('en'), ask: async () => 1 });
    expect(choice).toEqual({ unfinished: true, emptied: false });
    expect((readProjection(db, P)!.snapshot.nodes as unknown[]).length).toBe(3);
    expect(readStartMark(userData)?.state).toBe('drawing');
  });

  it('asks nothing when the graph was drawn, or when it is empty', async () => {
    const { db, userData } = setup();
    const { input, response } = importNodes(db, 3);
    watchReplacingCommit(userData, input, response);
    drawn(userData, readProjection(db, P)!.currentRevisionId);
    const ask = vi.fn(async () => 0);
    expect(await startChoice({ db, userData, translate: createTranslator('en'), ask })).toEqual({ unfinished: false, emptied: false });
    const fresh = setup();
    beginDrawing(fresh.userData, readProjection(fresh.db, P)!.currentRevisionId);
    expect(await startChoice({ db: fresh.db, userData: fresh.userData, translate: createTranslator('en'), ask })).toEqual({ unfinished: false, emptied: false });
    expect(ask).not.toHaveBeenCalled();
  });

  it('an ordinary edit does not start a watch', () => {
    const { userData } = setup();
    watchReplacingCommit(userData, { payload: { type: 'move-nodes' } }, { status: 'applied', projection: { currentRevisionId: 'x' } });
    expect(readStartMark(userData)).toBeNull();
  });
});

describe('safe start within one run of the app', () => {
  it('a reload in the same run draws as usual; the question waits for the next start', async () => {
    const { db, userData } = setup();
    const { input, response } = importNodes(db, 3);
    watchReplacingCommit(userData, input, response);
    const ask = vi.fn(async () => 0);
    expect(await startChoice({ firstLoad: false, db, userData, translate: createTranslator('en'), ask })).toEqual({ unfinished: false, emptied: false });
    expect(ask).not.toHaveBeenCalled();
    expect(readStartMark(userData)?.state).toBe('drawing');
  });
});

describe('what starts a watch', () => {
  it('through the command channel only Undo and Redo (restore-revision); a file is watched where it is read', () => {
    const { userData } = setup();
    watchReplacingCommit(userData, { payload: { type: 'import-workflow' } }, { status: 'applied', projection: { currentRevisionId: 'a' } }, true);
    expect(readStartMark(userData)).toBeNull();
    watchReplacingCommit(userData, { payload: { type: 'restore-revision' } }, { status: 'applied', projection: { currentRevisionId: 'b' } }, true);
    expect(readStartMark(userData)).toMatchObject({ state: 'drawing', revisionId: 'b' });
  });
});
