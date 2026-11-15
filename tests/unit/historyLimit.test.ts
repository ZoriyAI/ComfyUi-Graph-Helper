/**
 * The limit on graph history (main/commands/history.ts: pruned after commits and trimmed at start by database.ts).
 * Every change stores the whole graph, so without a limit months of work would fill the disk and slow every start.
 * These tests check that pruning removes only the oldest revisions with their command records, never the one on
 * screen or one an open assistant run or suggestion needs, that Undo still works on what is kept, and that the
 * revision list is read from an index.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, listRevisions, loadRevision, readProjection, startRun } from '../../src/main/commands/commit';
import {
  HISTORY_BUDGET_BYTES,
  HISTORY_MAX_REVISIONS,
  HISTORY_MIN_REVISIONS,
  HISTORY_PRUNE_EVERY,
  historyKeepCount,
  pruneHistory,
  trimAllHistories,
} from '../../src/main/commands/history';
import { migrate } from '../../src/main/settings/migrate';
import { planUndo, EMPTY_SESSION } from '../../src/renderer/state/undoState';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';

function fresh(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function head(db: Database.Database): string {
  return readProjection(db, P)!.currentRevisionId;
}

function addNode(db: Database.Database, index: number) {
  return commitCommand(db, {
    projectId: P, runId: null, actionId: `add-${index}`, expectedRevisionId: head(db), actor: 'manual',
    payload: { type: 'add-node', nodeType: 'Note', x: index, y: 0 },
  });
}

function move(db: Database.Database, index: number) {
  return commitCommand(db, {
    projectId: P, runId: null, actionId: `move-${index}`, expectedRevisionId: head(db), actor: 'manual',
    payload: { type: 'move-node', nodeId: '1', x: index, y: index },
  });
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE project_id = ?`).get(P) as { c: number }).c;
}

describe('graph history limit', () => {
  it('keeps between the minimum and the list limit, fewer for a bigger graph', () => {
    expect(historyKeepCount(1)).toBe(HISTORY_MAX_REVISIONS);
    expect(historyKeepCount(HISTORY_BUDGET_BYTES)).toBe(HISTORY_MIN_REVISIONS);
    // A 1 MB graph: the 256 MB budget holds 256 of them.
    expect(historyKeepCount(1024 * 1024)).toBe(256);
    expect(historyKeepCount(0)).toBe(HISTORY_MAX_REVISIONS);
  });

  it('removes the oldest revisions and their command records, never the one on screen', () => {
    const db = fresh();
    expect(addNode(db, 0).status).toBe('applied');
    for (let index = 0; index < 40; index += 1) expect(move(db, index).status).toBe('applied');
    // The initial empty revision, the add and 40 moves.
    expect(count(db, 'graph_revisions')).toBe(42);
    const before = readProjection(db, P)!;
    const removed = pruneHistory(db, P, { keep: 10, batch: 1000 });
    expect(removed).toBe(32);
    expect(count(db, 'graph_revisions')).toBe(10);
    // Every remaining revision still has the record of the command that made it; no record points at nothing.
    const orphans = db.prepare(`SELECT COUNT(*) AS c FROM applied_commands a WHERE a.project_id = ?
      AND NOT EXISTS (SELECT 1 FROM graph_revisions r WHERE r.id = a.result_revision_id)`).get(P) as { c: number };
    expect(orphans.c).toBe(0);
    expect(count(db, 'applied_commands')).toBe(10);
    const after = readProjection(db, P)!;
    expect(after.currentRevisionId).toBe(before.currentRevisionId);
    expect(after.snapshot).toEqual(before.snapshot);
    // Nothing more to do.
    expect(pruneHistory(db, P, { keep: 10 })).toBe(0);
  });

  it('removes in batches', () => {
    const db = fresh();
    addNode(db, 0);
    for (let index = 0; index < 30; index += 1) move(db, index);
    expect(pruneHistory(db, P, { keep: 5, batch: 10 })).toBe(10);
    expect(pruneHistory(db, P, { keep: 5, batch: 10 })).toBe(10);
    expect(pruneHistory(db, P, { keep: 5, batch: 10 })).toBe(7);
    expect(pruneHistory(db, P, { keep: 5, batch: 10 })).toBe(0);
    expect(count(db, 'graph_revisions')).toBe(5);
  });

  it('keeps what an open assistant run and an open suggestion need', () => {
    const db = fresh();
    addNode(db, 0);
    const run = startRun(db, P);
    for (let index = 0; index < 20; index += 1) move(db, index);
    const proposalRevision = `rev-${P}-5`;
    db.prepare(`INSERT INTO proposals (id, project_id, run_id, kind, status, payload, note, revision_id, created_at)
      VALUES ('p1', ?, NULL, 'add-node', 'open', '{}', '', ?, 1)`).run(P, proposalRevision);
    pruneHistory(db, P, { keep: 3, batch: 1000 });
    // Three newest plus the run's base and the suggestion's revision.
    const left = new Set((db.prepare('SELECT id FROM graph_revisions WHERE project_id = ?').all(P) as Array<{ id: string }>).map((row) => row.id));
    expect(left.has(run.baseRevisionId)).toBe(true);
    expect(left.has(proposalRevision)).toBe(true);
    expect(loadRevision(db, P, proposalRevision)).not.toBeNull();
    expect(left.size).toBe(5);
  });

  it('undo still works on what is kept, down to the oldest kept revision', () => {
    const db = fresh();
    addNode(db, 0);
    for (let index = 0; index < 12; index += 1) move(db, index);
    pruneHistory(db, P, { keep: 4, batch: 1000 });
    let revisions = listRevisions(db, P);
    expect(revisions).toHaveLength(4);
    let plan = planUndo(revisions, head(db), EMPTY_SESSION, { running: false });
    expect(plan.undo).not.toBeNull();
    const restored = commitCommand(db, {
      projectId: P, runId: null, actionId: 'undo-1', expectedRevisionId: head(db), actor: 'manual',
      payload: { type: 'restore-revision', revisionId: plan.undo!.target },
    });
    expect(restored.status).toBe('applied');
    const node = (restored.projection!.snapshot.nodes as Array<{ id: string; position: { x: number } }>).find((item) => item.id === '1');
    expect(node?.position.x).toBe(10);
    // At the oldest kept revision there is nothing more to undo.
    revisions = listRevisions(db, P);
    plan = planUndo(revisions, revisions[0].id, EMPTY_SESSION, { running: false });
    expect(plan.undo).toBeNull();
  });

  it('trims after commits on its own and at start, in steps', () => {
    const db = fresh();
    addNode(db, 0);
    // Below the limit nothing is removed.
    for (let index = 0; index < HISTORY_PRUNE_EVERY * 2; index += 1) move(db, index);
    expect(count(db, 'graph_revisions')).toBe(HISTORY_PRUNE_EVERY * 2 + 2);
    // A history grown past the limit (as before the limit existed) shrinks at start.
    const top = db.prepare('SELECT * FROM graph_revisions WHERE project_id = ? ORDER BY rev_seq DESC LIMIT 1').get(P) as Record<string, unknown>;
    const insert = db.prepare(`INSERT INTO graph_revisions (id, project_id, timestamp, nodes, edges, parent_revision_id, description, source, rev_seq, document, components, process_meta, graph_key)
      VALUES (?, ?, ?, ?, ?, ?, 'move-node', 'user', ?, ?, ?, ?, ?)`);
    const extra = HISTORY_MAX_REVISIONS + 250;
    db.transaction(() => {
      for (let index = 1; index <= extra; index += 1) {
        const seq = Number(top.rev_seq) + index;
        insert.run(`rev-${P}-${seq}`, P, 1, top.nodes, top.edges, `rev-${P}-${seq - 1}`, seq, top.document, top.components, top.process_meta, top.graph_key);
      }
      db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run(`rev-${P}-${Number(top.rev_seq) + extra}`, P);
    })();
    // The scheduler only queues each step; the loop runs them one by one, as the app's ticks would.
    const steps: Array<() => void> = [];
    trimAllHistories(db, (step) => steps.push(step));
    let ticks = 1;
    while (steps.length > 0) {
      ticks += 1;
      steps.shift()!();
    }
    expect(ticks).toBeGreaterThan(1);
    expect(count(db, 'graph_revisions')).toBe(HISTORY_MAX_REVISIONS);
  });

  it('answers the revision list from the index, without reading the stored graphs', () => {
    const db = fresh();
    const plan = db.prepare(`EXPLAIN QUERY PLAN
      SELECT r.id, r.rev_seq, r.timestamp, r.description, r.source, a.actor
      FROM graph_revisions r LEFT JOIN applied_commands a ON a.result_revision_id = r.id AND a.project_id = r.project_id
      WHERE r.project_id = ? ORDER BY r.rev_seq DESC, r.rowid DESC LIMIT 2000`).all(P) as Array<{ detail: string }>;
    const details = plan.map((row) => row.detail).join('\n');
    expect(details).toMatch(/COVERING INDEX idx_revisions_history/);
    expect(details).toMatch(/idx_commands_revision/);
  });
});
