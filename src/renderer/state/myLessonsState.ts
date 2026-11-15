/**
 * "My lessons" in the window: the person's own, imported and accepted lessons as main keeps them in the profile,
 * and the lesson being written in the editor. The Lessons panel lists and runs them from here; the lesson state
 * (lessonState.ts) asks here whether a `my:` lesson can be opened.
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
  model: LessonDraftModel;
  /** The app id of the lesson it replaces when saved, or null for a new one. */
  replaces: string | null;
}

interface MyLessonsState {
  lessons: MyLesson[];
  loaded: boolean;
  editing: EditorState | null;
  /** Reads the list from main again (after start, an import, a save, a removal, an accepted draft). */
  refresh: () => Promise<void>;
  setEditing: (editing: EditorState | null) => void;
}

export const useMyLessonsStore = create<MyLessonsState>((set) => ({
  lessons: [],
  loaded: false,
  editing: null,
  refresh: async () => {
    const bridge = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!bridge?.listMyLessons) return;
    try {
      set({ lessons: await bridge.listMyLessons(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setEditing: (editing) => set({ editing }),
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
  return { title: words.title, result: words.result, steps: words.steps, ...(words.roles ? { roles: words.roles } : {}) };
}

/** Whether one of "My lessons" can be opened: it exists, and an adult one only while the switch is on. */
export function myLessonOpen(id: string, adultOn: boolean): boolean {
  const found = myLesson(id);
  return found !== null && (adultOn || !isAdultMine(found));
}
