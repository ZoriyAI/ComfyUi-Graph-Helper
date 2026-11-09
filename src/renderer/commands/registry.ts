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
  icon?: LucideIcon;
  /** 'Mod+S', 'Mod+Shift+Z', 'F1'. Mod is Ctrl on Linux and Windows, ⌘ on macOS. */
  shortcut?: string;
  /** Drawn in menus but matched elsewhere (React Flow owns Delete on the canvas). */
  shortcutDisplayOnly?: boolean;
  group: CommandGroup;
  enabled: () => boolean;
  /** Present for toggles and radio choices. */
  checked?: () => boolean;
  run: () => void | Promise<void>;
}

const commands = new Map<string, Command>();
const listeners = new Set<() => void>();
let revision = 0;

function emit(): void {
  revision += 1;
  for (const listener of listeners) listener();
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
  return commands.get(id);
}

export function allCommands(): Command[] {
  return [...commands.values()];
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
 * stores here once; hooks re-read the commands they show when any of them changes.
 */
type Subscribe = (listener: () => void) => () => void;
const sources = new Set<Subscribe>();

export function addCommandStateSource(subscribe: Subscribe): () => void {
  sources.add(subscribe);
  emit();
  return () => {
    sources.delete(subscribe);
  };
}

function subscribeAll(listener: () => void): () => void {
  listeners.add(listener);
  const offs = [...sources].map((subscribe) => subscribe(listener));
  return () => {
    listeners.delete(listener);
    for (const off of offs) off();
  };
}

export interface CommandState {
  command: Command | undefined;
  enabled: boolean;
  checked: boolean | undefined;
}

function snapshotKey(ids: readonly string[]): string {
  return `${revision}|${ids.map((id) => `${isEnabled(id) ? 1 : 0}${String(isChecked(id))}`).join(',')}`;
}

/**
 * The live state of a few commands. Re-renders only when one of them turns on or off (or is checked),
 * not on every store change, so a toolbar does not redraw while a node is dragged.
 */
export function useCommandStates(ids: readonly string[]): CommandState[] {
  const key = ids.join(',');
  useSyncExternalStore(subscribeAll, () => snapshotKey(key ? key.split(',') : []));
  return ids.map((id) => ({ command: commands.get(id), enabled: isEnabled(id), checked: isChecked(id) }));
}

export function useCommandState(id: string): CommandState {
  return useCommandStates([id])[0];
}

/** Everything a surface needs to show and run commands. */
export function useCommands() {
  useSyncExternalStore(subscribeAll, () => revision);
  return { get: getCommand, all: allCommands, run: runCommand, isEnabled, isChecked };
}
