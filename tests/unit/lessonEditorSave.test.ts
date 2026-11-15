/**
 * A delayed lesson save owns only the draft it captured. Typing, moving to another lesson or a failed IPC must
 * leave the current work in the editor; a new lesson saved twice keeps its first persistent identity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveEditorLesson } from '../../src/renderer/components/lessons/lessonAuthoring';
import { useMyLessonsStore } from '../../src/renderer/state/myLessonsState';
import { draftFromDoc } from '../../src/shared/lessons/share/authoring';
import type { LessonImportOutcome, MyLesson } from '../../src/shared/lessons/share/mine';
import type { LessonDoc } from '../../src/shared/lessons/share/format';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

vi.mock('../../src/renderer/ui/toastStore', () => ({ showToast: vi.fn() }));

/** A save or refresh whose result is controlled by the test. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const kept = new Map<string, LessonDoc>();
const api = {
  saveMyLesson: vi.fn(async (doc: LessonDoc): Promise<LessonImportOutcome> => {
    kept.set(doc.id, doc);
    return { ok: true, added: [`my:${doc.id}`], replaced: [] };
  }),
  listMyLessons: vi.fn(async (): Promise<MyLesson[]> => [...kept.values()].map((doc) => ({ id: `my:${doc.id}`, origin: 'made', savedAt: 1, adultMark: false, doc }))),
};
const model = () => ({ ...draftFromDoc(sampleDoc(), 'en'), title: 'Before' });

beforeEach(() => {
  kept.clear();
  vi.clearAllMocks();
  api.saveMyLesson.mockImplementation(async (doc) => { kept.set(doc.id, doc); return { ok: true, added: [`my:${doc.id}`], replaced: [] }; });
  api.listMyLessons.mockImplementation(async () => [...kept.values()].map((doc) => ({ id: `my:${doc.id}`, origin: 'made', savedAt: 1, adultMark: false, doc })));
  vi.stubGlobal('window', { electronAPI: api });
  useMyLessonsStore.setState({ lessons: [], loaded: false, editing: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('lesson editor save ownership', () => {
  it('keeps newer typing after a delayed save and reuses the first saved identity', async () => {
    const draft = model();
    useMyLessonsStore.getState().setEditing({ model: draft, replaces: null });
    const saved = deferred<LessonImportOutcome>();
    api.saveMyLesson.mockImplementationOnce(async (doc) => { kept.set(doc.id, doc); return saved.promise; });
    const pending = saveEditorLesson(draft, null);
    const current = useMyLessonsStore.getState().editing!;
    useMyLessonsStore.getState().updateEditing({ ...draft, title: 'After' });
    saved.resolve({ ok: true, added: ['my:before'], replaced: [] });
    await pending;
    const editing = useMyLessonsStore.getState().editing;
    expect(editing?.model.title).toBe('After');
    expect(editing?.session).toBe(current.session);
    expect(editing?.revision).toBe(current.revision + 1);
    expect(editing?.savedRevision).toBe(current.revision);
    expect(editing?.replaces).toBe('my:before');
    await saveEditorLesson(editing!.model, editing!.replaces);
    expect(kept.size).toBe(1);
    expect(kept.get('before')!.texts.en!.title).toBe('After');
  });

  it('does not close a different draft opened while the save was pending', async () => {
    const draft = model();
    useMyLessonsStore.getState().setEditing({ model: draft, replaces: 'my:my-first' });
    const saved = deferred<LessonImportOutcome>();
    api.saveMyLesson.mockReturnValueOnce(saved.promise);
    const pending = saveEditorLesson(draft, 'my:my-first');
    const other = { ...draft, id: 'other', title: 'Other' };
    useMyLessonsStore.getState().setEditing({ model: other, replaces: null });
    saved.resolve({ ok: true, added: [], replaced: ['my:my-first'] });
    await pending;
    expect(useMyLessonsStore.getState().editing?.model).toEqual(other);
  });

  it('rechecks ownership after refreshing the list', async () => {
    const draft = model();
    useMyLessonsStore.getState().setEditing({ model: draft, replaces: null });
    const refreshed = deferred<MyLesson[]>();
    api.listMyLessons.mockReturnValueOnce(refreshed.promise);
    const pending = saveEditorLesson(draft, null);
    await vi.waitFor(() => expect(api.listMyLessons).toHaveBeenCalledOnce());
    const current = useMyLessonsStore.getState().editing!;
    useMyLessonsStore.setState({ editing: { ...current, model: { ...current.model, result: 'Newer result' } } });
    refreshed.resolve([]);
    await pending;
    expect(useMyLessonsStore.getState().editing?.model.result).toBe('Newer result');
  });

  it('returns a safe write error after IPC rejection and keeps the draft for retry', async () => {
    const draft = model();
    useMyLessonsStore.getState().setEditing({ model: draft, replaces: null });
    api.saveMyLesson.mockRejectedValueOnce(new Error('private filesystem details'));
    await expect(saveEditorLesson(draft, null)).resolves.toEqual({ ok: false, error: 'The lesson file could not be written.' });
    expect(useMyLessonsStore.getState().editing?.model).toEqual(draft);
  });
});
