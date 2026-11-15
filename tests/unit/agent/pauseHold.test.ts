/**
 * Protects Pause and Stop during an assistant build: the next step waits while the run is paused and lands on the
 * revision the person left after Continue, Stop, an abort, a new project or a storage failure end the build cleanly,
 * and the build's steps share a run id so one Undo takes the whole build back. A person who pauses to look or edit
 * must not have the assistant keep changing the canvas.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuildTools, waitWhilePaused } from '../../../src/main/agent/buildTools';
import { closeIfRunning } from '../../../src/main/agent/turn';
import { cancelRun, closeRun, commitCommand, listRevisions, ensureWorkspace, pauseRun, readProjection, resumeRun, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { planUndo, EMPTY_SESSION } from '../../../src/renderer/state/undoState';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

describe('a paused build holds its next step', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('waits while paused and commits after Continue, from the revision the run continues from', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const context = { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId };
    let ticks = 0;
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: context,
      // The injected sleep is the wait loop's only clock, so each call is one poll of the paused run.
      sleep: async () => {
        ticks += 1;
        // The person edits by hand during the pause, then presses Continue.
        if (ticks === 2) {
          const current = readProjection(db, DESKTOP_PROJECT_ID)!;
          expect(commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: 'manual-1', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'add-node', nodeType: 'SaveImage', x: 0, y: 0 } }).status).toBe('applied');
        }
        if (ticks === 3) resumeRun(db, DESKTOP_PROJECT_ID);
      },
    });
    const first = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple' }, { toolCallId: 'a' }) as Record<string, unknown>;
    expect(first.success).toBe(true);
    pauseRun(db, DESKTOP_PROJECT_ID, run.runId);
    const second = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'b' }) as Record<string, unknown>;
    expect(ticks).toBe(3);
    expect(second).toMatchObject({ success: true });
    const third = await tools.connectNodes.execute({ sourceNodeId: first.nodeId, sourceHandle: 'out-0', targetNodeId: second.nodeId, targetHandle: 'in-0' }, { toolCallId: 'c' }) as Record<string, unknown>;
    expect(third.success).toBe(true);
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(3);
  });

  it('gives up waiting when the run is stopped or the turn is aborted', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const context = { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId };
    pauseRun(db, DESKTOP_PROJECT_ID, run.runId);
    const stopped = waitWhilePaused(db, context, { sleep: async () => { cancelRun(db, DESKTOP_PROJECT_ID, run.runId); } });
    await expect(stopped).resolves.toEqual({ state: 'ended' });

    const again = startRun(db, DESKTOP_PROJECT_ID);
    pauseRun(db, DESKTOP_PROJECT_ID, again.runId);
    const controller = new AbortController();
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: again.runId, expectedRevisionId: again.expectedRevisionId },
      signal: controller.signal,
      sleep: async () => { controller.abort(); },
    });
    const result = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'x' }) as Record<string, unknown>;
    expect(result).toMatchObject({ success: false, stopped: true });
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(0);
  });

  it('a turn that ends closes a run the person paused, but keeps a checkpoint pause', () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const context = { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId };
    pauseRun(db, DESKTOP_PROJECT_ID, run.runId);
    // keepPaused is true when the turn ended at a checkpoint; then the paused run stays open for Continue.
    expect(closeIfRunning(db, context, true)?.activeRun?.status).toBe('paused');
    expect(closeIfRunning(db, context)?.activeRun ?? null).toBeNull();
  });

  it('a new project or an import stops the build: no step lands on the graph that took the canvas', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    let ended = 0;
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      onRunEnded: () => { ended += 1; },
    });
    await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple' }, { toolCallId: 'a' });
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    const replaced = commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: 'new-project', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: { last_node_id: 0, last_link_id: 0, nodes: [], links: [], version: 0.4 } } });
    expect(replaced.status).toBe('applied');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.activeRun).toBeNull();
    const after = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'b' }) as Record<string, unknown>;
    expect(after).toMatchObject({ success: false, stopped: true });
    expect(ended).toBe(1);
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(0);
  });

  it('a step that cannot be stored stops the build with the reason', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const stopped: string[] = [];
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      onStorageFailure: (error) => stopped.push(error),
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // A read-only database makes the next commit fail the way a full or locked disk would.
    db.pragma('query_only = ON');
    const result = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'z' }) as Record<string, unknown>;
    expect(result).toMatchObject({ success: false, stopped: true, error: 'The change could not be stored.' });
    expect(stopped).toEqual(['The change could not be stored.']);
  });

  it('the revision list names the run of each helper step, so a closed build undoes in one step', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple' }, { toolCallId: 'a' });
    await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'b' });
    const list = listRevisions(db, DESKTOP_PROJECT_ID);
    expect(list.slice(-2).map((item) => item.runId)).toEqual([run.runId, run.runId]);
    const headId = readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId;
    expect(planUndo(list, headId, EMPTY_SESSION, { running: true, activeRunId: run.runId }).blocked).toBe('running');
    closeRun(db, DESKTOP_PROJECT_ID, run.runId);
    const plan = planUndo(list, headId, EMPTY_SESSION, { running: false, activeRunId: null });
    expect(plan.undo?.target).toBe(list[0].id);
  });
});
