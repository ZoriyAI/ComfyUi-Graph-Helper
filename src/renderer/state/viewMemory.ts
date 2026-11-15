/**
 * Remembers how the person left the window, per profile (Preferences ▸ view in SQLite, never a project file):
 * the library tab and whether it is folded, the right panel's tab, width and whether it is folded, and the
 * Models tab's kind, family and order. Restored once the preferences are read, after a reload and a restart.
 *
 * Who uses it: commands/appCommands.ts installs it; components/library/ModelLibrary.tsx uses useRememberedChoice.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Preferences } from '../../shared/config/preferences';
import { usePreferencesStore } from './preferencesState';
import { useUiStore, type RailTab } from './uiState';
import { normalizeDockTab, useDockStore } from './dockState';

type View = Preferences['view'];

/** Saves are gathered for a moment: a drag of the panel edge sends one write, not one per pixel. */
const SAVE_DELAY_MS = 400;
let pending: Partial<View> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

/** Queues a change of the remembered view; it is saved SAVE_DELAY_MS after the last change. */
export function rememberView(patch: Partial<View>): void {
  pending = { ...pending, ...patch };
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const next = pending;
    pending = {};
    // Its own narrow save: the full settings save also re-applies the helper and the connection.
    void window.electronAPI.saveViewPreferences?.(next).then((stored) => {
      if (stored) usePreferencesStore.getState().setPreferences(stored);
    }).catch(() => undefined);
  }, SAVE_DELAY_MS);
}

/** The stores take what was saved (the library and the right panel). */
function restore(view: View): void {
  const ui = useUiStore.getState();
  const railTab = view.railTab as RailTab;
  if (ui.railTab !== railTab || (view.railOpen !== undefined && ui.railOpen !== view.railOpen)) {
    ui.setRail(view.railOpen ?? ui.railOpen, railTab);
  }
  const dock = useDockStore.getState();
  const patch: Partial<{ tab: ReturnType<typeof normalizeDockTab>; width: number; collapsed: boolean }> = {};
  if (view.dockTab) patch.tab = normalizeDockTab(view.dockTab);
  if (view.dockWidth !== undefined) patch.width = view.dockWidth;
  if (view.dockCollapsed !== undefined) patch.collapsed = view.dockCollapsed;
  if (Object.keys(patch).length > 0) useDockStore.setState(patch);
}

/** The uninstall of the current installation, returned again by a second call. */
let installed: (() => void) | null = null;

/** Restores the view when the preferences arrive and keeps later changes saved. Idempotent. */
export function installViewMemory(): () => void {
  if (installed) return installed;
  // Store changes are saved only after the restore, so the defaults of a fresh window never overwrite the saved view.
  let restored = false;
  const start = () => {
    if (restored || !usePreferencesStore.getState().loaded) return;
    restored = true;
    restore(usePreferencesStore.getState().preferences.view);
  };
  const offPreferences = usePreferencesStore.subscribe(start);
  start();
  const offUi = useUiStore.subscribe((state, before) => {
    if (!restored) return;
    if (state.railTab !== before.railTab || state.railOpen !== before.railOpen) rememberView({ railTab: state.railTab, railOpen: state.railOpen });
  });
  const offDock = useDockStore.subscribe((state, before) => {
    if (!restored) return;
    if (state.tab !== before.tab || state.width !== before.width || state.collapsed !== before.collapsed) {
      rememberView({ dockTab: state.tab, dockWidth: Math.round(state.width), dockCollapsed: state.collapsed });
    }
  });
  installed = () => {
    offPreferences();
    offUi();
    offDock();
    installed = null;
  };
  return installed;
}

/**
 * A choice of the Models tab that is remembered (kind, family, order): starts from what was saved and saves each
 * change. Waits for the preferences, so a value set before they arrive is not overwritten.
 */
export function useRememberedChoice<K extends 'modelKind' | 'modelFamily' | 'modelSort'>(key: K): [View[K], (value: View[K]) => void] {
  const saved = usePreferencesStore((state) => state.preferences.view[key]);
  const loaded = usePreferencesStore((state) => state.loaded);
  const [value, setValue] = useState<View[K]>(saved);
  const touched = useRef(false);
  useEffect(() => {
    if (loaded && !touched.current) setValue(saved);
  }, [loaded, saved]);
  const set = useCallback((next: View[K]) => {
    touched.current = true;
    setValue(next);
    rememberView({ [key]: next } as Partial<View>);
  }, [key]);
  return [value, set];
}
