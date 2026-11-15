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
