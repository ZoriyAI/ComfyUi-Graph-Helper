/**
 * "My lessons" in the window: the person's own, imported and accepted lessons as main keeps them in the profile,
 * and the lesson being written in the editor. The Lessons panel lists and runs them from here; the lesson state
 * (lessonState.ts) asks here whether a `my:` lesson can be opened. Callers: components/lessons (LessonPanel,
 * MyLessons, LessonEditor, LessonDraftCard, lessonAuthoring.ts, lessonFiles.ts) and state/lessonState.ts.
 *
 * Why a store of its own: the built-in lessons are constants of the app, these come and go (import, remove,
 * accept a draft). Main is the only one that writes them; this store only reads them back after every change.
 */

import { create } from 'zustand';
import type { Lesson } from '../../shared/lessons/engine';
import { docWords } from '../../shared/lessons/share/format';
import type { LessonDraftModel } from '../../shared/lessons/share/authoring';
import { isAdultMine, isMyLessonId, myEngineLesson, type MyLesson } from '../../shared/lessons/share/mine';
import type { LessonWords } from '../../shared/lessons/texts';

/** The lesson the editor holds: a new one made from the graph, or one of "My lessons" being changed. */
export interface EditorState {
  /** A distinct editing session; an old save never owns another session. */
  session: number;
  /** Every local edit advances the revision, even while a save is pending. */
  revision: number;
  /** The latest revision main confirmed, or null before the first save. */
  savedRevision: number | null;
  model: LessonDraftModel;
  /** The app id of the lesson it replaces when saved, or null for a new one. */
  replaces: string | null;
}

interface MyLessonsState {
  lessons: MyLesson[];
  loaded: boolean;
  loading: boolean;
  error: boolean;
  editing: EditorState | null;
  /** Reads the list from main again (after start, an import, a save, a removal, an accepted draft). */
  refresh: () => Promise<void>;
  setEditing: (editing: Pick<EditorState, 'model' | 'replaces'> | null) => void;
  /** Changes the current draft without starting another session. */
  updateEditing: (model: LessonDraftModel) => void;
}

let nextSession = 0;
let refreshTicket = 0;

/** My lessons as main last listed them, and the lesson open in the editor. */
export const useMyLessonsStore = create<MyLessonsState>((set) => ({
  lessons: [],
  loaded: false,
  loading: false,
  error: false,
  editing: null,
  refresh: async () => {
    const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!bridge?.listMyLessons) return;
    const ticket = ++refreshTicket;
    set({ loading: true, error: false });
    try {
      const lessons = await bridge.listMyLessons();
      if (!Array.isArray(lessons)) throw new Error('Invalid lesson list');
      if (ticket === refreshTicket) set({ lessons, loaded: true, loading: false });
    } catch {
      if (ticket === refreshTicket) set({ error: true, loading: false });
    }
  },
  setEditing: (editing) => set({ editing: editing ? { ...editing, session: ++nextSession, revision: 0, savedRevision: null } : null }),
  updateEditing: (model) => set((state) => ({ editing: state.editing ? { ...state.editing, model, revision: state.editing.revision + 1 } : null })),
}));

/** One of "My lessons" by its app id. */
export function myLesson(id: string): MyLesson | null {
  if (!isMyLessonId(id)) return null;
  return useMyLessonsStore.getState().lessons.find((lesson) => lesson.id === id) ?? null;
}

/** The engine lesson of one of "My lessons". */
export function myLessonById(id: string): Lesson | null {
  const found = myLesson(id);
  return found ? myEngineLesson(found) : null;
}

/** The words of one of "My lessons" in a language, in the shape the built-in lessons have (texts.ts). */
export function myLessonWords(language: string, id: string): LessonWords | null {
  const found = myLesson(id);
  if (!found) return null;
  const words = docWords(found.doc, language);
  return { title: words.title, result: words.result, steps: words.steps, ...(words.roles ? { roles: words.roles } : {}), ...(words.meta ? { meta: words.meta } : {}) };
}

/** Whether one of "My lessons" can be opened: it exists, and an adult one only while the switch is on. */
export function myLessonOpen(id: string, adultOn: boolean): boolean {
  const found = myLesson(id);
  return found !== null && (adultOn || !isAdultMine(found));
}
