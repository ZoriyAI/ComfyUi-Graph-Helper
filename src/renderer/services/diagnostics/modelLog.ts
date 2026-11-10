import { showToast } from '../../ui/Toast';
import { i18n } from '../../i18n';
import type { ModelLogExportRequest, ModelLogList } from '../../../shared/contracts/modelLog';
import { logErrorKey } from '../../components/log/modelLogView';

/**
 * The model conversation log from the window's side: read the list of recorded turns, save chosen turns into one
 * file, copy a short report of a turn. The window never sees a turn's body: main keeps the files, writes the
 * export through a system save dialog and hands back only where it went.
 */

const t = (key: string, values: Record<string, unknown> = {}) => String(i18n.t(key, values));

const EMPTY: ModelLogList = { enabled: true, turns: [], files: 0, bytes: 0, folder: null };

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

/**
 * Saves turns into one file the person picks a place for. Says where it went and offers to show it, because the
 * next thing a person does is attach that file somewhere. Returns true when a file was written.
 */
export async function saveModelLog(request: ModelLogExportRequest): Promise<boolean> {
  try {
    const result = await window.electronAPI.traceExport(request);
    if (result.ok) {
      showToast({
        id: 'model-log',
        tone: 'success',
        title: t('modelLog.saved', { count: result.turns }),
        description: t('modelLog.savedHint', { path: result.path }),
        duration: 15_000,
        action: { label: t('modelLog.showFile'), onSelect: () => void window.electronAPI.traceRevealExport().catch(() => undefined) },
      });
      return true;
    }
    // Closing the save dialog is a decision, not a failure.
    if (result.canceled) return false;
    showToast({ id: 'model-log', tone: 'error', title: t('modelLog.saveFailed'), description: errorText(result.error, 'modelLog.error.writeFailed') });
    return false;
  } catch {
    showToast({ id: 'model-log', tone: 'error', title: t('modelLog.saveFailed'), description: t('modelLog.error.writeFailed') });
    return false;
  }
}

/** Copies the short report of one turn (readable text, a few screens at most) for pasting into a message. */
export async function copyTurnReport(id: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.traceReport(id);
    if (!result.ok) {
      showToast({ id: 'model-log', tone: 'error', title: t('modelLog.copyFailed'), description: errorText(result.error, 'modelLog.error.turnGone') });
      return false;
    }
    const copied = await writeClipboard(result.text);
    if (copied) showToast({ id: 'model-log', tone: 'success', title: t('modelLog.copied'), description: t('modelLog.copiedHint'), duration: 6000 });
    else showToast({ id: 'model-log', tone: 'error', title: t('modelLog.copyFailed') });
    return copied;
  } catch {
    showToast({ id: 'model-log', tone: 'error', title: t('modelLog.copyFailed') });
    return false;
  }
}

export async function clearModelLog(): Promise<number> {
  try {
    const result = await window.electronAPI.traceClear();
    showToast({ id: 'model-log', tone: 'info', title: t('modelLog.cleared', { count: result.removed }) });
    return result.removed;
  } catch {
    return 0;
  }
}

export async function openModelLogFolder(): Promise<void> {
  try {
    const result = await window.electronAPI.traceOpenFolder();
    if (!result.ok) showToast({ id: 'model-log', tone: 'error', title: t('modelLog.openFolderFailed'), description: errorText(result.error, 'modelLog.error.noFolder') });
  } catch {
    showToast({ id: 'model-log', tone: 'error', title: t('modelLog.openFolderFailed') });
  }
}
