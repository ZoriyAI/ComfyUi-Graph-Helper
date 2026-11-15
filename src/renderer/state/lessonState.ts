import { create } from 'zustand';
import { adultContentOn, type Preferences } from '../../shared/config/preferences';
import { lessonOpen } from '../../shared/lessons/lessons';
import { currentPreferences, savePreferencesPatch } from './preferencesState';
import { useDockStore } from './dockState';
// LESSON FILES: a lesson of the person (`my:` id) opens like a built-in one, behind the same 18+ switch when marked.
import { myLessonOpen, useMyLessonsStore } from './myLessonsState';
import { isMyLessonId } from '../../shared/lessons/share/mine';

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
  /** Opens a lesson (and the Learn mode with it). A lesson for adults opens only while the switch is on. */
  start: (lessonId: string) => void;
  /** Back to the list; the lesson keeps its place. */
  leave: () => void;
  markRead: (lessonId: string, stepId: string) => void;
  finish: (lessonId: string) => void;
  /** Start the reading of a lesson over; what is on the canvas stays. */
  again: (lessonId: string) => void;
  hydrate: (stored: Stored) => void;
  /**
   * The furthest step reached in each lesson in this session. When the graph takes a lesson back behind it, the
   * panel says that something on the canvas changed instead of moving back without a word.
   */
  reached: Record<string, number>;
  reach: (lessonId: string, step: number) => void;
}

function save(state: Stored): void {
  void savePreferencesPatch({ lessons: { active: state.active, read: state.read, done: state.done } });
}

export const useLessonStore = create<LessonState>((set, get) => ({
  learning: false,
  active: '',
  read: {},
  done: [],
  reached: {},
  reach: (lessonId, step) => {
    if ((get().reached[lessonId] ?? -1) === step) return;
    set({ reached: { ...get().reached, [lessonId]: step } });
  },
  setLearning: (learning) => set({ learning }),
  start: (lessonId) => {
    const adultOn = adultContentOn(currentPreferences());
    if (!lessonOpen(lessonId, adultOn) && !myLessonOpen(lessonId, adultOn)) return;
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
    const reached = { ...get().reached };
    delete reached[lessonId];
    set({ read, reached, done: get().done.filter((id) => id !== lessonId) });
    save(get());
  },
  hydrate: (stored) => {
    set({ active: stored.active, read: stored.read, done: stored.done });
    // A lesson that was open when the app closed is on screen again at once, at the step the canvas is at; a lesson
    // for adults only while the switch is on.
    const active = stored.active;
    if (!active) return;
    const reopen = () => {
      // The person may have opened or left a lesson while My lessons were read: their choice stands.
      if (get().active !== active) return;
      const adultOn = adultContentOn(currentPreferences());
      if (!lessonOpen(active, adultOn) && !myLessonOpen(active, adultOn)) return;
      set({ learning: true });
      useDockStore.getState().show('assistant');
    };
    // One of My lessons is known only once main has handed the list over, which nothing else asks for at start.
    if (isMyLessonId(active) && !useMyLessonsStore.getState().loaded) {
      void useMyLessonsStore.getState().refresh().then(reopen);
      return;
    }
    reopen();
  },
}));

/**
 * The lesson the panel shows: the open one, unless it is a lesson for adults and the switch is off now (turned off
 * after it was opened, or a profile carried over). Then the list shows, and the lesson keeps its place.
 */
export function shownLesson(active: string, adultOn: boolean): string {
  return active !== '' && (lessonOpen(active, adultOn) || myLessonOpen(active, adultOn)) ? active : '';
}
