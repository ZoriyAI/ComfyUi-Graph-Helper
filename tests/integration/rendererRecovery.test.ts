/** Exercises delayed chat operations and retryable renderer state without losing accepted work. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../src/renderer/services/llm/chatService';
import { useChatStore } from '../../src/renderer/state/chatState';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { useMyLessonsStore } from '../../src/renderer/state/myLessonsState';
import { useLessonStore } from '../../src/renderer/state/lessonState';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';

const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const started = (runId: string) => ({ runId, baseRevisionId: 'r', expectedRevisionId: 'r', projection: { projectId: P, currentRevisionId: 'r', revSeq: 1, activeRun: { runId, status: 'running', expectedRevisionId: 'r' }, snapshot: { nodes: [], edges: [] } } });
let api: any;
beforeEach(() => {
  api = { llmGetConfig: vi.fn(async () => ({ provider: 'test' })), startRun: vi.fn(async () => started('new')),
    llmStreamChat: vi.fn(async () => undefined), llmCancel: vi.fn(async () => undefined), cancelRun: vi.fn(async () => ({ projection: null })),
    loadChatHistory: vi.fn(async () => []), saveChatMessage: vi.fn(async () => ({ ok: true })),
    clearChatHistory: vi.fn(async () => ({ ok: true, removed: 1 })),
    listMyLessons: vi.fn(), savePreferencesPatch: vi.fn(async () => ({ ok: false })),
  };
  vi.stubGlobal('window', { electronAPI: api, dispatchEvent: vi.fn() });
  useChatStore.setState({ messages: [], historyState: 'idle', isStreaming: false, isPaused: false, clearEpoch: 0 });
  useProjectionStore.setState({ projectId: P, revSeq: 0, currentRevisionId: '', activeRun: null });
  useGraphStore.setState({ nodes: [], edges: [] });
  useMyLessonsStore.setState({ lessons: [], loaded: false, loading: false, error: false });
  useLessonStore.setState({ persistence: 'saved', answers: {} });
});

describe('recovering work without losing new edits', () => {
  it('retries a failed history read and merges it with a newly typed message', async () => {
    const service = new ChatService(); api.loadChatHistory.mockRejectedValueOnce(new Error('read failed'));
    await service.loadHistory(); expect(useChatStore.getState().historyState).toBe('error');
    useChatStore.getState().addMessage({ id: 'now', role: 'user', content: 'new', timestamp: 2 });
    api.loadChatHistory.mockResolvedValueOnce([{ id: 'old', projectId: P, role: 'user', content: 'previous', timestamp: 1, graphRevisionId: null, toolCalls: null }]);
    await service.loadHistory();
    expect(useChatStore.getState().messages.map(m => m.id)).toEqual(['old', 'now']);
    expect(useChatStore.getState().historyState).toBe('loaded');
  });
  it('does not resurrect history cleared while reading it', async () => {
    const history = deferred<any[]>(); api.loadChatHistory.mockReturnValueOnce(history.promise);
    const work = new ChatService().loadHistory(); useChatStore.getState().clearChat();
    history.resolve([{ id: 'old', role: 'user', content: 'old', timestamp: 1 }]); await work;
    expect(useChatStore.getState().messages).toEqual([]);
  });
  it('cancels a late started run by its own id without cancelling the next message', async () => {
    const old = deferred<any>(); api.startRun.mockReturnValueOnce(old.promise);
    const service = new ChatService(); const first = service.sendMessage('first');
    await vi.waitFor(() => expect(api.startRun).toHaveBeenCalledOnce());
    service.cancel(); const next = service.sendMessage('second'); await next;
    old.resolve(started('old')); await first;
    expect(api.cancelRun).toHaveBeenCalledWith(P, 'old');
    expect(api.llmCancel).not.toHaveBeenCalled();
    expect(api.llmStreamChat).toHaveBeenCalledOnce();
    expect(api.llmStreamChat.mock.calls[0][3].runId).toBe('new');
  });
  it('cancelAndWait owns pending startup before a new graph can replace the old one', async () => {
    const start = deferred<any>(); api.startRun.mockReturnValueOnce(start.promise);
    const service = new ChatService(); const send = service.sendMessage('first');
    await vi.waitFor(() => expect(api.startRun).toHaveBeenCalledOnce());
    let settled = false; const cancel = service.cancelAndWait().then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    start.resolve(started('late')); await Promise.all([cancel, send]);
    expect(api.cancelRun).toHaveBeenCalledWith(P, 'late'); expect(api.llmStreamChat).not.toHaveBeenCalled();
  });
  it('retries an unsaved message with the same id', async () => {
    api.saveChatMessage.mockResolvedValueOnce({ ok: false }); const service = new ChatService();
    await service.sendMessage('keep this');
    await vi.waitFor(() => expect(useChatStore.getState().messages[0].persistence).toBe('failed'));
    const id = useChatStore.getState().messages[0].id; service.retrySaving();
    await vi.waitFor(() => expect(useChatStore.getState().messages[0].persistence).toBeUndefined());
    expect(api.saveChatMessage.mock.calls.map((call: any[]) => call[0].id)).toEqual([id, id]);
  });
  it('keeps failed lesson-list reads retryable and unsaved answers in the window', async () => {
    api.listMyLessons.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([]);
    await useMyLessonsStore.getState().refresh(); expect(useMyLessonsStore.getState()).toMatchObject({ loaded: false, error: true });
    await useMyLessonsStore.getState().refresh(); expect(useMyLessonsStore.getState()).toMatchObject({ loaded: true, error: false });
    useLessonStore.getState().answer('lesson', 'step', 'q', 'yes');
    await vi.waitFor(() => expect(useLessonStore.getState().persistence).toBe('failed'));
    useLessonStore.getState().hydrate({ active: '', read: {}, done: [], answers: {}, outcomes: {} });
    expect(useLessonStore.getState().answers.lesson.step.q).toBe('yes');
  });
});

it('waits for an accepted pending save before clearing the stored conversation', async () => {
  const write = deferred<any>(); api.saveChatMessage.mockReturnValueOnce(write.promise);
  const service = new ChatService(); await service.sendMessage('old message');
  const clearing = service.clearHistory(); await Promise.resolve();
  expect(api.clearChatHistory).not.toHaveBeenCalled();
  write.resolve({ ok: true }); expect(await clearing).toEqual({ ok: true, removed: 1 });
  expect(useChatStore.getState().messages).toEqual([]);
  expect(api.clearChatHistory).toHaveBeenCalledOnce();
});
