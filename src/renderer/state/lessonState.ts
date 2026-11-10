import { create } from 'zustand';
import type { Preferences } from '../../shared/config/preferences';
import { savePreferencesPatch } from './preferencesState';

/**
 * The helper's "Learn" mode: which lesson is open and what the person has read in it. Where they are in a lesson
 * is not kept: it is read off the graph (shared/lessons/engine.ts). The session's state is here so the panel
 * answers at once; every change is also saved to preferences, and read back from them at start.
 */
type Stored = Preferences['lessons'];

interface LessonState extends Stored {
  /** The helper panel shows lessons instead of the conversation. */
  learning: boolean;
  setLearning: (learning: boolean) => void;
  /** Opens a lesson (and the Learn mode with it). */
  start: (lessonId: string) => void;
  /** Back to the list; the lesson keeps its place. */
  leave: () => void;
  markRead: (lessonId: string, stepId: string) => void;
  finish: (lessonId: string) => void;
  /** Start the reading of a lesson over; what is on the canvas stays. */
  again: (lessonId: string) => void;
  hydrate: (stored: Stored) => void;
}

function save(state: Stored): void {
  void savePreferencesPatch({ lessons: { active: state.active, read: state.read, done: state.done } });
}

export const useLessonStore = create<LessonState>((set, get) => ({
  learning: false,
  active: '',
  read: {},
  done: [],
  setLearning: (learning) => set({ learning }),
  start: (lessonId) => {
    set({ learning: true, active: lessonId });
    save(get());
  },
  leave: () => {
    set({ active: '' });
    save(get());
  },
  markRead: (lessonId, stepId) => {
    const seen = get().read[lessonId] ?? [];
    if (seen.includes(stepId)) return;
    set({ read: { ...get().read, [lessonId]: [...seen, stepId] } });
    save(get());
  },
  finish: (lessonId) => {
    if (get().done.includes(lessonId)) return;
    set({ done: [...get().done, lessonId] });
    save(get());
  },
  again: (lessonId) => {
    const read = { ...get().read };
    delete read[lessonId];
    set({ read, done: get().done.filter((id) => id !== lessonId) });
    save(get());
  },
  hydrate: (stored) => set({ active: stored.active, read: stored.read, done: stored.done }),
}));
