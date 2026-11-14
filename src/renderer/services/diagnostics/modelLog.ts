import { i18n } from '../../i18n';
import type { ModelLogExportRequest, ModelLogList } from '../../../shared/contracts/modelLog';
import { logErrorKey } from '../../components/log/modelLogView';

/**
 * The model conversation log from the window's side: read the list of recorded turns, save chosen turns into one
 * file, copy a short report of a turn. The window never sees a turn's body: main keeps the files, writes the
 * export through a system save dialog and hands back only where it went.
 *
 * Nothing here shows a toast: the log window is a modal dialog, and a toast behind a modal cannot be clicked or
 * read by a screen reader. Each call returns what happened and the window says it in its own status line.
 */

const t = (key: string, values: Record<string, unknown> = {}) => String(i18n.t(key, values));

const EMPTY: ModelLogList = { enabled: true, turns: [], files: 0, bytes: 0, folder: null };

export type LogActionResult = { ok: true } | { ok: false; message: string };
export type LogSaveResult = { ok: true; path: string; turns: number } | { ok: false; canceled: boolean; message: string };

function errorText(error: string | undefined, fallbackKey: string): string {
  const key = logErrorKey(error);
  if (key) return t(key);
  return error && error.trim() !== '' ? error : t(fallbackKey);
}

/** Copies text to the clipboard; false when the clipboard refused. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Without focus the async clipboard refuses; a hidden textarea and execCommand still work in Electron.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const done = document.execCommand('copy');
      area.remove();
      return done;
    } catch {
      return false;
    }
  }
}

export async function loadModelLog(): Promise<ModelLogList> {
  try {
    return await window.electronAPI.traceList();
  } catch {
    return EMPTY;
  }
}

/** Saves turns into one file the person picks a place for. Closing the system dialog is not a failure. */
export async function saveModelLog(request: ModelLogExportRequest): Promise<LogSaveResult> {
  try {
    const result = await window.electronAPI.traceExport(request);
    if (result.ok) return { ok: true, path: result.path, turns: result.turns };
    if (result.canceled) return { ok: false, canceled: true, message: '' };
    return { ok: false, canceled: false, message: errorText(result.error, 'modelLog.error.writeFailed') };
  } catch {
    return { ok: false, canceled: false, message: t('modelLog.error.writeFailed') };
  }
}

/** Shows the file saved last in the file manager. */
export async function revealSavedLog(): Promise<void> {
  try {
    await window.electronAPI.traceRevealExport();
  } catch {
    // The file manager did not open; the path is on screen.
  }
}

/** Copies the short report of one turn (readable text, a few screens at most) for pasting into a message. */
export async function copyTurnReport(id: string): Promise<LogActionResult> {
  try {
    const result = await window.electronAPI.traceReport(id);
    if (!result.ok) return { ok: false, message: errorText(result.error, 'modelLog.error.turnGone') };
    return await writeClipboard(result.text) ? { ok: true } : { ok: false, message: t('modelLog.copyFailed') };
  } catch {
    return { ok: false, message: t('modelLog.copyFailed') };
  }
}

/** Removes every record; returns how many went. */
export async function clearModelLog(): Promise<number> {
  try {
    return (await window.electronAPI.traceClear()).removed;
  } catch {
    return 0;
  }
}

export async function openModelLogFolder(): Promise<LogActionResult> {
  try {
    const result = await window.electronAPI.traceOpenFolder();
    return result.ok ? { ok: true } : { ok: false, message: `${t('modelLog.openFolderFailed')}. ${errorText(result.error, 'modelLog.error.noFolder')}` };
  } catch {
    return { ok: false, message: t('modelLog.openFolderFailed') };
  }
}
