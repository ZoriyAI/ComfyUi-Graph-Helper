/**
 * Preferences as the renderer sees them, and the two ways to change them from outside Settings.
 *
 * Who uses it: state/preferencesBridge.ts fills it at start and applies it; the canvas, library, toolbar, lessons,
 * menu commands and many settings sections read it or call savePreferencesPatch.
 */
import { create } from 'zustand';
import {
  parsePreferences,
  preferencesDefaults,
  type Preferences,
  type PreferencesPatch,
} from '../../shared/config/preferences';
import type { NonSecretSettings } from '../../shared/config/schema';
import { SETTINGS_CHANGED } from '../commands/events';

/**
 * Preferences as the renderer sees them: filled from settings:get at start and replaced after every save.
 * The source of truth is the settings row in SQLite (preferences_json); nothing here is kept in localStorage.
 */
interface PreferencesState {
  preferences: Preferences;
  /** True after the first read from main. */
  loaded: boolean;
  setPreferences: (preferences: Preferences) => void;
}

/** The current preferences; the defaults until main has answered (`loaded`). */
export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: parsePreferences({}),
  loaded: false,
  setPreferences: (preferences) => set({ preferences, loaded: true }),
}));

/** The current preferences, for code outside React. */
export function currentPreferences(): Preferences {
  return usePreferencesStore.getState().preferences;
}

/** Appearance preferences as attributes on <html>; tokens.css overrides the colour and spacing tokens. */
export function applyAppearance(appearance: Preferences['appearance'], root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return;
  root.dataset.accent = appearance.accent;
  root.dataset.density = appearance.density;
  if (appearance.reduceGlow) root.dataset.glow = 'reduced';
  else delete root.dataset.glow;
  // Accessibility: the interface size is browser zoom of the whole window (preload setInterfaceScale).
  if (typeof window !== 'undefined') window.electronAPI?.setInterfaceScale?.((appearance.interfaceScale ?? 100) / 100);
}

/** Saves run one after another, so two quick patches do not read the same old row and lose one change. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Saves one preferences change made outside the Settings dialog (a canvas toggle, a menu choice).
 * The stored row is read first so its other fields stay as they are; a corrupt row is never overwritten.
 * Saves run one after another. Resolves to whether the change was stored.
 */
export function savePreferencesPatch(patch: PreferencesPatch): Promise<boolean> {
  const run = queue.then(async () => {
    try {
      const read = await window.electronAPI.getSettings();
      if (!('values' in read) || !read.values) return false;
      const result = await window.electronAPI.saveSettings({ ...read.values, preferences: patch });
      if (!result.ok) return false;
      if (result.preferences) usePreferencesStore.getState().setPreferences(result.preferences);
      window.dispatchEvent(new CustomEvent<NonSecretSettings>(SETTINGS_CHANGED, { detail: result.values }));
      return true;
    } catch {
      return false;
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

// Re-exported so renderer code reads the defaults from the same place as the store.
export { preferencesDefaults };
