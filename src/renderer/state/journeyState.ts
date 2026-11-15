/**
 * Which journey card is open and where the window tour stands.
 *
 * Who uses it: components/journey (the "Run it in ComfyUI" card after a save, "Explain a ComfyUI error", "No ComfyUI
 * yet", the window tour), the welcome card and the commands that open them.
 * Why a separate store: these cards are this package's own and come and go with the person's first hours; keeping
 * them out of uiState leaves the shell's dialog list as it was. "Seen" flags live in localStorage: they are a
 * convenience for one person on one computer, and losing them only shows a card once more.
 */
import { create } from 'zustand';

/** The journey card on screen, or null. */
export type JourneyDialog = 'run' | 'error' | 'no-comfy' | null;

interface JourneyState {
  dialog: JourneyDialog;
  /** Text the error card starts with (from the run card or a paste elsewhere). */
  errorText: string;
  /** The tour's step, or null when no tour is on. */
  tourStep: number | null;
  open: (dialog: Exclude<JourneyDialog, null>, errorText?: string) => void;
  close: () => void;
  startTour: () => void;
  setTourStep: (step: number | null) => void;
}

/** The open journey card, the error text it starts with, and the tour step. */
export const useJourneyStore = create<JourneyState>((set) => ({
  dialog: null,
  errorText: '',
  tourStep: null,
  open: (dialog, errorText) => set((state) => ({ dialog, errorText: errorText ?? state.errorText })),
  close: () => set({ dialog: null }),
  startTour: () => set({ tourStep: 0, dialog: null }),
  setTourStep: (tourStep) => set({ tourStep }),
}));

/** localStorage keys of the journey; a private window or blocked storage reads as "not seen" and never throws. */
export const SEEN_KEYS = { tour: 'journey.tourSeen', runCard: 'journey.runCardOff' } as const;

/** Whether a "seen" flag is set; false when storage cannot be read. */
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Sets or clears a "seen" flag. */
export function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // Storage is blocked: the card shows again next time, which is harmless.
  }
}
