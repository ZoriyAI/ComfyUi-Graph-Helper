import type { Preferences } from '../../shared/config/preferences';
import { descriptionsModeOf, parsePreferences } from '../../shared/config/preferences';
import { setShortcutOverrides } from '../commands/registry';
import { setCanvasPersist, useCanvasStore } from '../components/graph/canvasStore';
import { applyAppearance, savePreferencesPatch, usePreferencesStore } from './preferencesState';
import { useUiStore } from './uiState';
import { useLessonStore } from './lessonState';

/** localStorage keys the canvas used before preferences moved to SQLite. Read once, saved, then deleted. */
export const LEGACY_CANVAS_KEYS = {
  showDescriptions: 'helper.canvas.descriptions',
  showMinimap: 'helper.canvas.minimap',
  followAgent: 'helper.canvas.follow',
} as const;

type CanvasToggles = Pick<Preferences['canvas'], 'showDescriptions' | 'showMinimap' | 'followAgent'>;
type StorageLike = Pick<Storage, 'getItem' | 'removeItem'>;

/** What the old keys said ('on' / 'off'), and which keys exist. A missing or unreadable store gives nothing. */
export function legacyCanvasPatch(storage: StorageLike | null): { patch: Partial<CanvasToggles>; keys: string[] } {
  const patch: Partial<CanvasToggles> = {};
  const keys: string[] = [];
  if (!storage) return { patch, keys };
  for (const [field, key] of Object.entries(LEGACY_CANVAS_KEYS) as Array<[keyof CanvasToggles, string]>) {
    let value: string | null = null;
    try {
      value = storage.getItem(key);
    } catch {
      value = null;
    }
    if (value === null) continue;
    keys.push(key);
    if (value === 'on' || value === 'off') patch[field] = value === 'on';
  }
  return { patch, keys };
}

/**
 * One-time move of the old canvas keys into preferences: save what they said, then delete them.
 * The keys stay when the save fails, so the next start tries again. Resolves to whether anything moved.
 */
export async function migrateLegacyCanvas(
  storage: StorageLike | null,
  save: (patch: { canvas: Partial<CanvasToggles> }) => Promise<boolean>,
): Promise<boolean> {
  const { patch, keys } = legacyCanvasPatch(storage);
  if (keys.length === 0) return false;
  if (Object.keys(patch).length > 0 && !(await save({ canvas: patch }))) return false;
  for (const key of keys) {
    try {
      storage?.removeItem(key);
    } catch {
      // Storage went away; the values are already saved.
    }
  }
  return true;
}

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Pushes preferences into the stores and the document. Canvas toggles move only when the preference moved. */
function apply(next: Preferences, previous: Preferences | null): void {
  applyAppearance(next.appearance);
  setShortcutOverrides(next.shortcuts);
  const canvas = useCanvasStore.getState();
  const mode = descriptionsModeOf(next.canvas);
  if (!previous || descriptionsModeOf(previous.canvas) !== mode) {
    if (canvas.descriptionsMode !== mode) useCanvasStore.setState({ descriptionsMode: mode, descriptionsOn: mode !== 'off' });
  }
  if (!previous || previous.canvas.showMinimap !== next.canvas.showMinimap) {
    if (canvas.minimapOn !== next.canvas.showMinimap) useCanvasStore.setState({ minimapOn: next.canvas.showMinimap });
  }
  if (!previous || previous.canvas.followAgent !== next.canvas.followAgent) {
    useUiStore.getState().setFollowAgent(next.canvas.followAgent);
  }
  // Lessons: read once at start; after that the lesson store is ahead of what is saved.
  if (!previous) useLessonStore.getState().hydrate(next.lessons);
}

let installed: (() => void) | null = null;

/**
 * Reads preferences from main, applies them, moves the old localStorage canvas keys once, and keeps the
 * document, canvas, follow mode and shortcut overrides in step with later saves. Idempotent.
 */
export function installPreferences(): () => void {
  if (installed) return installed;
  setCanvasPersist((patch) => void savePreferencesPatch({ canvas: patch }));
  const off = usePreferencesStore.subscribe((state, before) => {
    if (state.preferences !== before.preferences) apply(state.preferences, before.loaded ? before.preferences : null);
  });
  void window.electronAPI.getSettings().then(async (read) => {
    usePreferencesStore.getState().setPreferences(read.preferences ?? parsePreferences({}));
    await migrateLegacyCanvas(storage(), (patch) => savePreferencesPatch(patch));
  }).catch(() => undefined);
  installed = () => {
    off();
    setCanvasPersist(null);
    installed = null;
  };
  return installed;
}
