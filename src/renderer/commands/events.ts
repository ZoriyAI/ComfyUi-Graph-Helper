/**
 * Names of window events the renderer sends to itself.
 *
 * Who uses it: commands/actions.ts, state/preferencesState.ts and state/providerState.ts dispatch it;
 * components/settings/SettingsPanel.tsx listens and dispatches it too.
 * Why a window event: the settings form keeps its own draft and must not import every place that saves.
 */

/** Fired after a settings change was saved outside the form (menu, provider choice), so an open form re-reads it. */
export const SETTINGS_CHANGED = 'helper:settings-changed';

/** An explicit panel opening, including actions outside the compact navigation. */
export const WORKSPACE_PANEL = 'workspace:panel';

/** Explicit navigation keeps the compact workspace in step with panels opened outside its bottom bar. */
export function requestWorkspacePanel(panel: 'canvas' | 'library' | 'assistant' | 'properties'): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_PANEL, { detail: panel }));
  }
}

/** Portaled flyouts close when a person returns to the canvas, including after an add. */
export function onWorkspaceCanvas(listener: () => void): () => void {
  if (typeof window === 'undefined' || !window.addEventListener) return () => undefined;
  const requested = (event: Event) => { if ((event as CustomEvent<string>).detail === 'canvas') listener(); };
  window.addEventListener(WORKSPACE_PANEL, requested);
  return () => window.removeEventListener(WORKSPACE_PANEL, requested);
}
