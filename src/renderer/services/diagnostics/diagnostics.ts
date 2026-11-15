/**
 * Renderer side of diagnostics: Help ▸ Copy diagnostics / Open logs folder, and window.onerror /
 * unhandledrejection reports to the main log. Reports are rate-limited here too, and never print to the
 * console, so the app's console stays clean.
 *
 * Who uses it: commands/diagnosticsCommands.ts (the Help menu), components/shell/AboutContent.tsx (copy button),
 * index.tsx (installs the error reporting) and ErrorBoundary.tsx (reports a crashed view).
 */
import { showToast } from '../../ui/Toast';
import { i18n } from '../../i18n';

const t = (key: string) => String(i18n.t(key));

/** Copies text to the clipboard; false when the clipboard refused. */
export async function writeClipboard(text: string): Promise<boolean> {
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

/** Help ▸ Copy diagnostics: main's report text to the clipboard, with a toast either way. */
export async function copyDiagnostics(): Promise<boolean> {
  try {
    const report = await window.electronAPI.collectDiagnostics();
    const copied = await writeClipboard(report);
    if (copied) showToast({ id: 'diagnostics', tone: 'success', title: t('diagnostics.copied'), description: t('diagnostics.copiedHint'), duration: 5000 });
    else showToast({ id: 'diagnostics', tone: 'error', title: t('diagnostics.copyFailed') });
    return copied;
  } catch {
    showToast({ id: 'diagnostics', tone: 'error', title: t('diagnostics.copyFailed') });
    return false;
  }
}

/** Help ▸ Open logs folder in the file manager; a toast when it could not open. */
export async function openLogsFolder(): Promise<void> {
  try {
    const result = await window.electronAPI.openLogsFolder();
    if (!result.ok) showToast({ id: 'diagnostics', tone: 'error', title: t('diagnostics.openLogsFailed') });
  } catch {
    showToast({ id: 'diagnostics', tone: 'error', title: t('diagnostics.openLogsFailed') });
  }
}

/** One renderer error: where it came from ('boundary' is a React view that crashed) and what it said. */
type Report = { kind: 'error' | 'unhandledrejection' | 'boundary'; message: string; source?: string; stack?: string };

/** At most LIMIT reports per WINDOW_MS; `sent` holds the times of the reports in the current window. */
const WINDOW_MS = 60_000;
const LIMIT = 10;
const sent: number[] = [];

/** Sends one error report to main; at most ten a minute leave the renderer. Never throws, never logs. */
export function reportRendererError(report: Report): void {
  const now = Date.now();
  while (sent.length > 0 && now - sent[0] >= WINDOW_MS) sent.shift();
  if (sent.length >= LIMIT) return;
  sent.push(now);
  try {
    const call = window.electronAPI?.reportRendererError;
    if (typeof call !== 'function') return;
    void call({
      kind: report.kind,
      message: String(report.message ?? '').slice(0, 500),
      source: report.source ? String(report.source).slice(0, 300) : undefined,
      stack: report.stack ? String(report.stack).slice(0, 2000) : undefined,
    }).catch(() => undefined);
  } catch {
    // Main is gone; nothing else to do.
  }
}

/** A message and stack from whatever was thrown (an Error, a string, or any value). */
function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, stack: reason.stack };
  if (typeof reason === 'string') return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

let installed = false;

/** window error and unhandledrejection go to the main log. Listeners only observe; default handling stays. */
export function installRendererErrorReporting(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event) => {
    const detail = describe(event.error ?? event.message);
    const source = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
    reportRendererError({ kind: 'error', message: detail.message || String(event.message), source, stack: detail.stack });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const detail = describe(event.reason);
    reportRendererError({ kind: 'unhandledrejection', message: detail.message, stack: detail.stack });
  });
}
