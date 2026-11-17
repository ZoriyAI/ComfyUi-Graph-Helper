/**
 * Protects what a person sees after the app or the window closed in the middle of an assistant build: the run is
 * closed at the next start and the chat gets one line saying how many nodes were added, while a run that changed
 * nothing leaves no line. Build step cards also keep the node title they were made with.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeInterruptedRuns, reportInterruptedRun } from '../../../src/main/agent/interrupted';
import { createBuildTools, nodeTitleAt } from '../../../src/main/agent/buildTools';
import { loadChatHistory } from '../../../src/main/agent/chatHistory';
import { ensureWorkspace, pauseRun, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { readSettings, saveSettings } from '../../../src/main/settings/repository';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

describe('a run cut off by closing the app', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('is closed at the next start with one line in the chat; a run that changed nothing leaves none', async () => {
    const db = openDb();
    // A run that made no change: closing it must not write to the chat.
    const quiet = startRun(db, P);
    expect(closeInterruptedRuns(db, 'ru')).toBe(0);
    expect(loadChatHistory(db, P)).toHaveLength(0);
    expect(quiet.runId).toBeTruthy();

    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple' }, { toolCallId: 'a' });
    await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'b' });
    // A paused run is still open; the next start must close it too.
    pauseRun(db, P, run.runId);
    expect(closeInterruptedRuns(db, 'ru', 1000)).toBe(1);
    const lines = loadChatHistory(db, P);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ role: 'assistant', timestamp: 1000 });
    expect(lines[0].content).toContain('приложение закрылось');
    expect(lines[0].content).toContain('нод: 2');
    expect(readProjection(db, P)!.activeRun).toBeNull();
  });

  it('a window closed during the build leaves the same line at once (the turn\'s end closes the run)', async () => {
    const db = openDb();
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'a' });
    expect(reportInterruptedRun(db, P, run.runId, 'en', 5)).toBe(true);
    expect(loadChatHistory(db, P)[0].content).toContain('nodes: 1');
    expect(reportInterruptedRun(db, P, 'no-such-run', 'en')).toBe(false);
  });

  it('a step keeps the name its node had, so the card never renames itself', async () => {
    const db = openDb();
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    const loader = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple', title: 'Загрузчик' }, { toolCallId: 'a' }) as Record<string, unknown>;
    const sampler = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'b' }) as Record<string, unknown>;
    expect(loader.nodeTitle).toBe('Загрузчик');
    const link = await tools.connectNodes.execute({ sourceNodeId: loader.nodeId, sourceHandle: 'out-0', targetNodeId: sampler.nodeId, targetHandle: 'in-0' }, { toolCallId: 'c' }) as Record<string, unknown>;
    expect(link).toMatchObject({ sourceTitle: 'Загрузчик', targetTitle: expect.any(String) });
    expect(nodeTitleAt(null, '1')).toBeUndefined();
  });

  it('closes the interrupted run without writing a courtesy message when history storage is off', async () => {
    const db = openDb();
    const settings = readSettings(db);
    if (settings.source === 'corrupt') throw new Error('Fresh settings were corrupt');
    expect(saveSettings(db, { ...settings.values, preferences: { privacy: { saveChatHistory: false } } })).toMatchObject({ ok: true });
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'privacy-node' });
    pauseRun(db, P, run.runId);
    expect(reportInterruptedRun(db, P, run.runId, 'en')).toBe(false);
    expect(closeInterruptedRuns(db, 'en')).toBe(0);
    expect(loadChatHistory(db, P)).toEqual([]);
    expect(readProjection(db, P)!.activeRun).toBeNull();
    expect(readProjection(db, P)!.snapshot.nodes).toHaveLength(1);
    db.close();
  });
});
