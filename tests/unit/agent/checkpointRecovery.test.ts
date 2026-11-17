/** Disk recovery is a task to reconsider, never a saved stream of commands to replay. */
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate, schemaVersion, SCHEMA_VERSION } from '../../../src/main/settings/migrate';
import { ensureWorkspace } from '../../../src/main/commands/commit';
import { clearChatHistory, loadChatHistory, saveChatMessage } from '../../../src/main/agent/chatHistory';
import { chatRecordFromMessage, messageFromChatRecord } from '../../../src/renderer/services/llm/chatModel';
import { ChatService } from '../../../src/renderer/services/llm/chatService';
import { useChatStore } from '../../../src/renderer/state/chatState';
import { useProjectionStore } from '../../../src/renderer/services/commands/projection';
import { parseTurnContext } from '../../../src/shared/agent/turnContext';
import type { Projection } from '../../../src/shared/commands/types';
import type { ChatMessage } from '../../../src/renderer/types/chat';

const databases: Database.Database[] = [];
const dirs: string[] = [];
const dbAt = (file = ':memory:') => { const db = new Database(file); databases.push(db); migrate(db); ensureWorkspace(db); return db; };
const paused = (): ChatMessage => ({ id: 'pause', role: 'assistant', timestamp: 1, content: 'First part built', checkpoint: {
  state: 'open', reason: 'step-limit', steps: 60, runId: 'old-run', graphKey: 'graph-1', revisionId: 'r1', task: 'Build a landscape workflow',
  context: { intent: 'build', language: 'en', selection: [{ kind: 'node', id: '1', subgraphId: 'inner' }], objectRef: { kind: 'node', id: '1', subgraphId: 'inner' } },
} });
const projection = (overrides: Partial<Projection> = {}): Projection => ({
  projectId: 'desktop', graphKey: 'graph-1', currentRevisionId: 'r1', revSeq: 10,
  snapshot: { nodes: [], edges: [] }, activeRun: null, ...overrides,
});
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

async function renderer(options: { head?: Projection; restored?: boolean; delayRead?: Promise<Projection> } = {}) {
  useChatStore.getState().clearChat();
  useProjectionStore.setState({ projectId: 'desktop', graphKey: 'graph-1', currentRevisionId: 'r1', revSeq: 0, activeRun: null });
  const head = options.head ?? projection();
  const saved: unknown[] = [];
  const api = {
    llmGetConfig: async () => ({ provider: 'test', model: 'test-fixture', baseURL: '' }),
    readProjection: vi.fn(async () => options.delayRead ?? head),
    startRun: vi.fn(async () => ({ runId: 'new-run', baseRevisionId: head.currentRevisionId, expectedRevisionId: head.currentRevisionId, projection: head })),
    resumeRun: vi.fn(async () => ({ runId: 'old-run', baseRevisionId: head.currentRevisionId, expectedRevisionId: head.currentRevisionId, projection: head })),
    saveChatMessage: vi.fn(async (record: unknown) => { saved.push(record); return { ok: true }; }),
    llmStreamChat: vi.fn(async (_history: unknown, _specs: unknown, onChunk: (chunk: { type: string }) => void) => { onChunk({ type: 'done' }); }),
    llmCancel: vi.fn(async () => undefined), cancelRun: vi.fn(async () => ({ projection: head })),
  };
  (globalThis as { window?: unknown }).window = { electronAPI: api };
  const message = paused();
  if (options.restored !== false) message.checkpoint!.recovered = true;
  useChatStore.getState().addMessage(message);
  const service = new ChatService();
  return { service, api, saved };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('durable paused tasks', () => {
  it('preserves task, inner object identity and closed state through a real database restart, then erases owned backups', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-task-')); dirs.push(dir);
    const file = path.join(dir, 'nodewise.db'); let db = dbAt(file);
    const record = chatRecordFromMessage(paused(), 'desktop', 'r1');
    expect(saveChatMessage(db, record)).toEqual({ ok: true }); db.close();
    db = dbAt(file);
    const restored = messageFromChatRecord(loadChatHistory(db, 'desktop')[0]);
    expect(restored.checkpoint).toEqual({ ...paused().checkpoint, recovered: true });
    expect(saveChatMessage(db, { ...record, checkpoint: { ...record.checkpoint, state: 'stopped' } })).toEqual({ ok: true });
    db.close(); fs.copyFileSync(file, `${file}.before-v22.bak`); db = dbAt(file);
    expect(messageFromChatRecord(loadChatHistory(db, 'desktop')[0]).checkpoint).toMatchObject({ state: 'stopped', recovered: false });
    expect(clearChatHistory(db, 'desktop')).toEqual({ ok: true, removed: 1 });
    expect(loadChatHistory(db, 'desktop')).toEqual([]);
    expect(loadChatHistory(dbAt(`${file}.before-v22.bak`), 'desktop')).toEqual([]);
  });

  it('rolls back schema22 completely and upgrades21 without losing previous chat', () => {
    const db = new Database(':memory:'); databases.push(db); migrate(db, { upTo: 21 }); ensureWorkspace(db);
    db.exec("INSERT INTO chat_messages(id,project_id,role,content,timestamp) VALUES ('old','desktop','user','keep me',1)");
    expect(() => migrate(db, { failBeforeVersionStamp: true })).toThrow();
    expect(schemaVersion(db)).toBe(21);
    expect(db.prepare('PRAGMA table_info(chat_messages)').all().some((row: any) => row.name === 'checkpoint')).toBe(false);
    migrate(db); expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(loadChatHistory(db, 'desktop')[0]).toMatchObject({ id: 'old', content: 'keep me' });
  });

  it('refuses held credentials in task metadata, redacts patterns, ignores corrupted saved cards', () => {
    const db = dbAt(); const record = chatRecordFromMessage(paused(), 'desktop', 'r1');
    expect(saveChatMessage(db, { ...record, checkpoint: { ...record.checkpoint, task: 'hidden-held-key' } }, text => text.includes('hidden-held-key')).ok).toBe(false);
    expect(saveChatMessage(db, { ...record, checkpoint: { ...record.checkpoint, task: 'Build with sk-examplesecret then explain' } }, () => false).ok).toBe(true);
    expect(loadChatHistory(db, 'desktop')[0].checkpoint?.task).toBe('Build with [redacted] then explain');
    db.exec("UPDATE chat_messages SET checkpoint = '{broken'");
    expect(loadChatHistory(db, 'desktop')[0]).not.toHaveProperty('checkpoint');
    expect(loadChatHistory(db, 'desktop')[0].content).toBe('First part built');
  });

  it('does not lose the subgraph identity or documentation object kinds in the turn boundary', () => {
    const refs = [{ kind: 'node', id: '1', subgraphId: 'inside' }, { kind: 'linkType', id: 'IMAGE' }, { kind: 'family', id: 'flux1' }];
    expect(parseTurnContext({ intent: 'ask', objectRef: refs[0], selection: refs }, 'ru')).toMatchObject({ objectRef: refs[0], selection: refs });
  });

  it('restores a task with a fresh graph and new run, discarding stale selections and persisting completion', async () => {
    const { service, api, saved } = await renderer({ head: projection({ currentRevisionId: 'edited-after-pause' }) });
    await service.continueFromCheckpoint('pause'); await flush();
    expect(api.readProjection).toHaveBeenCalledTimes(1); expect(api.startRun).toHaveBeenCalledTimes(1); expect(api.resumeRun).not.toHaveBeenCalled();
    const args = api.llmStreamChat.mock.calls[0] as unknown as any[];
    expect(args[0].at(-1).content).toContain('Build a landscape workflow');
    expect(args[4]).toMatchObject({ intent: 'build', selection: [] }); expect(args[4].objectRef).toBeUndefined();
    expect(saved.filter((x: any) => x.id === 'pause').at(-1)).toMatchObject({ checkpoint: { state: 'continued' } });
    await service.continueFromCheckpoint('pause'); expect(api.startRun).toHaveBeenCalledTimes(1);
  });

  it('does not modify a different document, and explicit review remains an ask turn', async () => {
    const { service, api } = await renderer({ head: projection({ graphKey: 'different' }) });
    await service.continueFromCheckpoint('pause'); expect(api.startRun).not.toHaveBeenCalled();
    expect(useChatStore.getState().messages[0].checkpoint?.state).toBe('open');
    await service.continueFromCheckpoint('pause', true);
    expect((api.llmStreamChat.mock.calls[0] as unknown as any[])[4].intent).toBe('ask');
  });

  it('stopping while the fresh graph read is pending prevents all subsequent turns', async () => {
    let resolve!: (p: Projection) => void;
    const delayRead = new Promise<Projection>(r => { resolve = r; });
    const { service, api, saved } = await renderer({ delayRead });
    const waiting = service.continueFromCheckpoint('pause'); service.stopAtCheckpoint('pause'); resolve(projection()); await waiting; await flush();
    expect(api.startRun).not.toHaveBeenCalled(); expect(api.llmStreamChat).not.toHaveBeenCalled();
    expect(saved.filter((x: any) => x.id === 'pause').at(-1)).toMatchObject({ checkpoint: { state: 'stopped' } });
  });

  it('does not let a late open-card write overwrite Stop on disk', async () => {
    const { service, api } = await renderer(); const db = dbAt(); let release!: () => void; let first = true;
    api.saveChatMessage.mockImplementation(async (record: unknown) => {
      if (first) { first = false; await new Promise<void>(r => { release = r; }); }
      return saveChatMessage(db, record);
    });
    // Retry a failed original save, then immediately stop. The first write is deliberately delayed.
    useChatStore.getState().updateMessage('pause', { persistence: 'failed' }); service.retrySaving(); await flush();
    service.stopAtCheckpoint('pause'); await flush();
    expect(api.saveChatMessage).toHaveBeenCalledTimes(1);
    release(); await flush();
    expect(loadChatHistory(db, 'desktop')[0].checkpoint?.state).toBe('stopped');
  });
});
