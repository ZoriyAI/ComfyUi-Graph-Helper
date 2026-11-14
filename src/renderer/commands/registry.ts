import { useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Menu-bar menu (and toolbar group) a command belongs to. */
export type CommandGroup = 'file' | 'edit' | 'view' | 'graph' | 'assistant' | 'sync' | 'help';

/**
 * One thing the person can do. The menu bar, the toolbar, the canvas context menu, the dock header and
 * the hotkeys all read the same command, so its label, shortcut and enabled state match everywhere.
 */
export interface Command {
  id: string;
  /** i18n key of the label. */
  labelKey: string;
  /** i18n key of a longer explanation (tooltip, or why the command is off). */
  hintKey?: string;
  /** A live tooltip ("Undo: connect 2 → 4"), already translated. Wins over hintKey when it returns text. */
  hint?: () => string | undefined;
  icon?: LucideIcon;
  /** 'Mod+S', 'Mod+Shift+Z', 'F1'. Mod is Ctrl on Linux and Windows, ⌘ on macOS. */
  shortcut?: string;
  /** More keys that run the command, as people know them from other programs (Ctrl+Y for redo). Fixed; listed in Help. */
  altShortcuts?: string[];
  /** Drawn in menus but matched elsewhere (React Flow owns Delete on the canvas). */
  shortcutDisplayOnly?: boolean;
  /** Set on the views getCommand/allCommands return when Preferences ▸ Shortcuts overrides `shortcut`. */
  defaultShortcut?: string;
  group: CommandGroup;
  enabled: () => boolean;
  /** Present for toggles and radio choices. */
  checked?: () => boolean;
  run: () => void | Promise<void>;
}

const commands = new Map<string, Command>();
const listeners = new Set<() => void>();
let revision = 0;
/** Preferences ▸ Shortcuts: command id → chord ('' = no shortcut). */
let overrides: Record<string, string> = {};
/** Overridden views, so a command keeps one identity until the overrides or the command change. */
const views = new Map<string, Command>();

function emit(): void {
  revision += 1;
  views.clear();
  for (const listener of listeners) listener();
}

/** The command as surfaces see it: its shortcut replaced by the person's override, if any. */
function view(command: Command | undefined): Command | undefined {
  if (!command || !Object.prototype.hasOwnProperty.call(overrides, command.id)) return command;
  const chord = overrides[command.id];
  if (chord === (command.shortcut ?? '')) return command;
  const cached = views.get(command.id);
  if (cached) return cached;
  // An override makes the key a real hotkey even where the default was display-only (Delete on the canvas).
  const next: Command = { ...command, shortcut: chord || undefined, defaultShortcut: command.shortcut ?? '', shortcutDisplayOnly: false };
  views.set(command.id, next);
  return next;
}

/**
 * Replaces the shortcut overrides (Preferences ▸ Shortcuts). Menus, the toolbar hints, the shortcuts dialog
 * and the hotkeys all read commands through getCommand/allCommands, so the change applies everywhere at once.
 */
export function setShortcutOverrides(next: Record<string, string>): void {
  const same = JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(overrides).sort());
  if (same) return;
  overrides = { ...next };
  emit();
}

export function shortcutOverrides(): Record<string, string> {
  return { ...overrides };
}

/** The shortcut a command ships with, ignoring overrides. */
export function defaultShortcutOf(id: string): string {
  return commands.get(id)?.shortcut ?? '';
}

/** Adds commands (replacing any with the same id). Returns a function that removes exactly these. */
export function registerCommands(list: Command[]): () => void {
  for (const command of list) commands.set(command.id, command);
  emit();
  return () => {
    let changed = false;
    for (const command of list) {
      if (commands.get(command.id) === command) {
        commands.delete(command.id);
        changed = true;
      }
    }
    if (changed) emit();
  };
}

export function getCommand(id: string): Command | undefined {
  return view(commands.get(id));
}

export function allCommands(): Command[] {
  return [...commands.values()].map((command) => view(command) as Command);
}

export function isEnabled(id: string): boolean {
  const command = commands.get(id);
  if (!command) return false;
  try {
    return command.enabled();
  } catch {
    return false;
  }
}

export function isChecked(id: string): boolean | undefined {
  const command = commands.get(id);
  if (!command?.checked) return undefined;
  try {
    return command.checked();
  } catch {
    return false;
  }
}

/** Runs a command when it exists and is enabled. Resolves to whether it ran. */
export async function runCommand(id: string): Promise<boolean> {
  const command = commands.get(id);
  if (!command || !isEnabled(id)) return false;
  await command.run();
  return true;
}

/**
 * Stores whose changes can flip a command's enabled or checked state. The app registers its zustand
 * stores here once; hooks re-read the commands they show when any of them changes. A source added after
 * a hook subscribed still reaches it, because every source feeds the same listener set.
 */
type Subscribe = (listener: () => void) => () => void;

function notify(): void {
  for (const listener of listeners) listener();
}

export function addCommandStateSource(subscribe: Subscribe): () => void {
  const off = subscribe(notify);
  emit();
  return () => {
    off();
  };
}

function subscribeAll(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live tooltip of a command, or undefined. */
export function hintOf(id: string): string | undefined {
  const command = commands.get(id);
  if (!command?.hint) return undefined;
  try {
    return command.hint();
  } catch {
    return undefined;
  }
}

export interface CommandState {
  command: Command | undefined;
  enabled: boolean;
  checked: boolean | undefined;
}

function snapshotKey(ids: readonly string[]): string {
  return `${revision}|${ids.map((id) => `${isEnabled(id) ? 1 : 0}${String(isChecked(id))}${hintOf(id) ?? ''}`).join(',')}`;
}

/**
 * The live state of a few commands. Re-renders only when one of them turns on or off (or is checked),
 * not on every store change, so a toolbar does not redraw while a node is dragged.
 */
export function useCommandStates(ids: readonly string[]): CommandState[] {
  const key = ids.join(',');
  useSyncExternalStore(subscribeAll, () => snapshotKey(key ? key.split(',') : []));
  return ids.map((id) => ({ command: getCommand(id), enabled: isEnabled(id), checked: isChecked(id) }));
}

export function useCommandState(id: string): CommandState {
  return useCommandStates([id])[0];
}

/** Everything a surface needs to show and run commands. */
export function useCommands() {
  useSyncExternalStore(subscribeAll, () => revision);
  return { get: getCommand, all: allCommands, run: runCommand, isEnabled, isChecked };
}
