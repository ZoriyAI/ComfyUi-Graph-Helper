/**
 * The helper's "Learn" mode: which lesson is open, what the person has read in it, what they answered in the steps
 * they answer (checklists, rubrics, quizzes, "I checked it myself") and which outcomes a lesson reached. Where they
 * are on the canvas is not kept: it is read off the graph (shared/lessons/engine.ts). The session's state is here so the panel
 * answers at once; every change is also saved to preferences, and read back from them at start.
 *
 * Who uses it: components/lessons (LessonPanel, MyLessons, lessonAuthoring.ts), components/chat/ChatDock.tsx,
 * commands/actions.ts (openLessons) and state/preferencesBridge.ts (hydrate at start).
 */
import { create } from 'zustand';
import { adultContentOn, type Preferences, type LessonStoredProgress } from '../../shared/config/preferences';
import { lessonOpen } from '../../shared/lessons/lessons';
import { currentPreferences, savePreferencesPatch } from './preferencesState';
import { useDockStore } from './dockState';
// A lesson of the person (`my:` id) opens like a built-in one, behind the same 18+ switch when marked.
import { myLessonOpen, useMyLessonsStore } from './myLessonsState';
import { isMyLessonId } from '../../shared/lessons/share/mine';

/** The part of the lesson state that is saved in preferences. */
type Stored = Preferences['lessons'];
const EMPTY_PROGRESS: LessonStoredProgress = { read: {}, done: [], answers: {}, outcomes: {} };
/** Stable empty value keeps store selectors from re-rendering in a loop. */
export function lessonStoredProgress(state: Stored, scope = ''): LessonStoredProgress {
  return scope ? state.contexts?.[scope] ?? EMPTY_PROGRESS : state;
}
export const lessonReachedKey = (lessonId: string, scope = ''): string => scope ? JSON.stringify([scope, lessonId]) : lessonId;
function progressPatch(state: Stored, scope: string, patch: Partial<LessonStoredProgress>): Partial<Stored> {
  return scope ? { contexts: { ...state.contexts, [scope]: { ...lessonStoredProgress(state, scope), ...patch } } } : patch;
}

interface LessonState extends Stored {
  persistence: 'saved' | 'saving' | 'failed';
  retrySave: () => void;
  /** The helper panel shows lessons instead of the conversation. */
  learning: boolean;
  setLearning: (learning: boolean) => void;
  /** Opens a lesson (and the Learn mode with it). A lesson for adults opens only while the switch is on. */
  start: (lessonId: string) => void;
  /** Back to the list; the lesson keeps its place. */
  leave: () => void;
  markRead: (lessonId: string, stepId: string, scope?: string) => void;
  /** Sets one answer of a step (a tick, a level, a choice); null takes it back. */
  answer: (lessonId: string, stepId: string, itemId: string, value: string | null, scope?: string) => void;
  /** Clears the answers of one step of a lesson, or of every step when no step is named. */
  clearAnswers: (lessonId: string, stepId?: string, scope?: string) => void;
  /** Keeps the outcomes a lesson has reached, for the list (see Preferences lessons.outcomes). */
  setOutcomes: (lessonId: string, outcomes: Stored['outcomes'][string], scope?: string) => void;
  finish: (lessonId: string, scope?: string) => void;
  /** Start the reading of a lesson over; what is on the canvas stays. */
  again: (lessonId: string, scope?: string) => void;
  /** Takes the stored part back; a profile saved before version 1.1 has no answers or outcomes. */
  hydrate: (stored: Omit<Stored, 'answers' | 'outcomes' | 'contexts'> & Partial<Pick<Stored, 'answers' | 'outcomes' | 'contexts'>>) => void;
  /**
   * The furthest step reached in each lesson in this session. When the graph takes a lesson back behind it, the
   * panel says that something on the canvas changed instead of moving back without a word.
   */
  reached: Record<string, number>;
  reach: (lessonId: string, step: number, scope?: string) => void;
  /**
   * Where the workflow opened last in this session came from (a picture, an API-format file...), for the read-check
   * "the workflow came from a picture". Set by commands/actions.ts finishOpen; never saved.
   */
  openedFrom: 'json' | 'picture' | 'video' | 'api' | 'example' | null;
  setOpenedFrom: (from: LessonState['openedFrom']) => void;
}

/** Saves the stored part; `reached` and `learning` are for this session only. */
let saveTicket = 0;
function save(state: Stored): void {
  const ticket = ++saveTicket;
  useLessonStore.setState({ persistence: 'saving' });
  void savePreferencesPatch({ lessons: { active: state.active, read: state.read, done: state.done, answers: state.answers, outcomes: state.outcomes, contexts: state.contexts } }).then(ok => {
    if (ticket === saveTicket) useLessonStore.setState({ persistence: ok ? 'saved' : 'failed' });
  }).catch(() => { if (ticket === saveTicket) useLessonStore.setState({ persistence: 'failed' }); });
}

/** The open lesson, what was read and finished, and whether the panel is in Learn mode. */
export const useLessonStore = create<LessonState>((set, get) => ({
  learning: false,
  persistence: 'saved',
  retrySave: () => save(get()),
  active: '',
  read: {},
  done: [],
  answers: {},
  outcomes: {},
  contexts: {},
  reached: {},
  openedFrom: null,
  setOpenedFrom: (openedFrom) => set({ openedFrom }),
  reach: (lessonId, step, scope = '') => {
    lessonId = lessonReachedKey(lessonId, scope);
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
  markRead: (lessonId, stepId, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    const seen = progress.read[lessonId] ?? [];
    if (seen.includes(stepId)) return;
    set(progressPatch(get(), scope, { read: { ...progress.read, [lessonId]: [...seen, stepId] } }));
    save(get());
  },
  answer: (lessonId, stepId, itemId, value, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    const lesson = progress.answers[lessonId] ?? {};
    const step = { ...(lesson[stepId] ?? {}) };
    if ((step[itemId] ?? null) === value) return;
    if (value === null) delete step[itemId];
    else step[itemId] = value;
    set(progressPatch(get(), scope, { answers: { ...progress.answers, [lessonId]: { ...lesson, [stepId]: step } } }));
    save(get());
  },
  clearAnswers: (lessonId, stepId, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    const answers = { ...progress.answers };
    if (stepId === undefined) delete answers[lessonId];
    else {
      const lesson = { ...(answers[lessonId] ?? {}) };
      delete lesson[stepId];
      answers[lessonId] = lesson;
    }
    set(progressPatch(get(), scope, { answers }));
    save(get());
  },
  setOutcomes: (lessonId, outcomes, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    const before = progress.outcomes[lessonId] ?? [];
    if (before.length === outcomes.length && before.every((item, index) => item === outcomes[index])) return;
    const next = { ...progress.outcomes };
    if (outcomes.length === 0) delete next[lessonId];
    else next[lessonId] = [...outcomes];
    set(progressPatch(get(), scope, { outcomes: next }));
    save(get());
  },
  finish: (lessonId, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    if (progress.done.includes(lessonId)) return;
    set(progressPatch(get(), scope, { done: [...progress.done, lessonId] }));
    save(get());
  },
  again: (lessonId, scope = '') => {
    const progress = lessonStoredProgress(get(), scope);
    const read = { ...progress.read };
    delete read[lessonId];
    const reached = { ...get().reached };
    delete reached[lessonReachedKey(lessonId, scope)];
    // Starting over clears the ticks, the scores and the outcomes too: the lesson is done anew.
    const answers = { ...progress.answers };
    delete answers[lessonId];
    const outcomes = { ...progress.outcomes };
    delete outcomes[lessonId];
    set({ ...progressPatch(get(), scope, { read, answers, outcomes, done: progress.done.filter((id) => id !== lessonId) }), reached });
    save(get());
  },
  hydrate: (stored) => {
    if (get().persistence !== 'saved') return;
    // A profile saved before version 1.1 has no answers or outcomes yet.
    set({ active: stored.active, read: stored.read, done: stored.done, answers: stored.answers ?? {}, outcomes: stored.outcomes ?? {}, contexts: stored.contexts ?? {} });
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
