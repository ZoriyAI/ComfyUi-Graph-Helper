/** Adapts the renderer API to the authorized operations of the paired desktop browser server. */
import { guideSource } from '../../shared/guidance/catalog';
/** Browser transport for the existing renderer. Only reviewed operations travel to the running desktop. */
import type { ElectronAPI } from '../../preload';
import { BROWSER_METHODS } from '../../shared/browser/methods';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { i18n } from '../i18n';
import { readVideoMetadata, VIDEO_EXTENSIONS, VIDEO_METADATA_CANCELLED } from '../../shared/workflow/videoMetadata';

export const BROWSER_CONNECTION = 'nodewise-browser-connection';
/** The desktop preload supplies this object before renderer scripts run; HTTP browsers install it below. */
export function isBrowserClient(): boolean { return !window.electronAPI || document.documentElement.dataset.client === 'browser'; }

/** UUID v4 from getRandomValues, available on HTTP LAN pages where randomUUID is absent. */
export function installBrowserUuid(): void {
  if (typeof crypto.randomUUID === 'function') return;
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } });
}

/** Ask the browser to save a generated file; it never supplies a path on the computer. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name.replace(/[\\/\x00-\x1f]/g, '_'); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
/** File selection resolves cancellation too, so it cannot leave a command waiting forever. */
function pickFile(accept: string): Promise<File | null> {
  return new Promise((done) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept;
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => done(null), { once: true }); input.click();
  });
}
async function encodedFile(file: File, signal: AbortSignal): Promise<string> {
  if (VIDEO_EXTENSIONS.test(file.name)) {
    const metadata = await readVideoMetadata({ size: file.size, read: async (at, length) => new Uint8Array(await file.slice(at, at + length).arrayBuffer()) }, signal);
    if (metadata !== null) {
      if (!metadata.length) throw new Error('This file holds no workflow.');
      let binary = '\0'; for (let at = 0; at < metadata.length; at += 8192) binary += String.fromCharCode(...metadata.subarray(at, at + 8192));
      return btoa(binary);
    }
  }
  if (file.size > 11 * 1024 * 1024) throw new Error(String(i18n.t('browser.fileTooLarge')));
  return new Promise((done, fail) => {
    const reader = new FileReader(); const abort = () => { reader.abort(); fail(new Error(VIDEO_METADATA_CANCELLED)); };
    if (signal.aborted) { abort(); return; } signal.addEventListener('abort', abort, { once: true });
    reader.onload = () => done(String(reader.result).split(',')[1]); reader.onerror = () => fail(reader.error);
    reader.onloadend = () => signal.removeEventListener('abort', abort); reader.readAsDataURL(file);
  });
}

/** Install after a successful paired bootstrap, before mounting App. No Electron runtime is bundled here. */
export async function installBrowserBridge(bootstrap: { platform?: string; versions?: Record<string, string>; flags?: Record<string, boolean> }): Promise<void> {
  document.documentElement.dataset.client = 'browser'; installBrowserUuid();
  const listeners = new Map<string, Set<(payload: any) => void>>();
  const subscribe = (channel: string, listener: (payload: any) => void) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(listener); return () => { listeners.get(channel)?.delete(listener); };
  };
  const call = async (method: string, args: unknown[] = []): Promise<any> => {
    let response: Response;
    try { response = await fetch('/browser/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) }); }
    catch { window.dispatchEvent(new CustomEvent(BROWSER_CONNECTION, { detail: 'offline' })); throw new Error(String(i18n.t('browser.disconnected'))); }
    if (response.status === 401) window.dispatchEvent(new CustomEvent(BROWSER_CONNECTION, { detail: 'unpaired' }));
    if (!response.ok) throw new Error(String(i18n.t(response.status === 401 ? 'browser.pairRequired' : 'browser.requestFailed')));
    const result = await response.json(); return result.value;
  };
  const api: Record<string, any> = {
    platform: bootstrap.platform ?? 'linux', versions: bootstrap.versions ?? {}, flags: bootstrap.flags ?? {},
    uploadNodeFile: async (name: string, data: ArrayBuffer) => {
      const response = await fetch(`/browser/media?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: data });
      if (response.status === 401) window.dispatchEvent(new CustomEvent(BROWSER_CONNECTION, { detail: 'unpaired' }));
      if (!response.ok) return { ok: false, error: response.status === 413 ? 'large' : 'failed' };
      return (await response.json()).value;
    },
    openGuideSource: async (id: string) => { const url = guideSource(id); if (!url) return { ok: false }; window.open(url, '_blank', 'noopener,noreferrer'); return { ok: true }; },
    setInterfaceScale: () => undefined,
    onSyncEvent: (listener: (payload: unknown) => void) => subscribe(IPC_CHANNELS.SYNC_EVENT, listener),
    onProposalsEvent: (listener: (payload: unknown) => void) => subscribe(IPC_CHANNELS.PROPOSALS_EVENT, listener),
    onBrowserRefresh: (listener: (notice?: { knowledgeChanged?: boolean; historyChanged?: boolean }) => void) => subscribe(IPC_CHANNELS.BROWSER_REFRESH, listener),
    onOpenRequest: () => () => undefined,
    startState: async () => ({ unfinished: false, emptied: false }), graphDrawn: async () => ({ ok: true }),
    pendingOpen: async () => null, openPending: async () => ({ status: 'cancelled', projection: null, result: null }),
    recentFiles: async () => [], pathForFile: () => '',
    saveViewPreferences: async (patch: unknown) => {
      const read = await api.getSettings();
      const view = { ...read.preferences.view, ...(patch as object) };
      localStorage.setItem('browser-view', JSON.stringify(view)); return { ...read.preferences, view };
    },
    loadRevision: (projectId: string, revisionId: string) => call('loadRevision', [{ projectId, revisionId }]),
    modelDetail: (directory: string, name: string) => call('modelDetail', [{ directory, name }]),
    modelPreview: (directory: string, name: string) => call('modelPreview', [{ directory, name }]),
    modelHash: (directory: string, name: string) => call('modelHash', [{ directory, name }]),
    modelLookup: (directory: string, name: string) => call('modelLookup', [{ directory, name }]),
    syncSetAuto: (enabled: boolean, intervalMinutes: number) => call('syncSetAuto', [{ enabled, intervalMinutes }]),
    llmCancel: (runId?: string) => call('llmCancel', [runId]),
    llmStreamChat: async (messages: unknown, tools: unknown, onChunk: (chunk: unknown) => void, run: unknown, context?: unknown) => {
      const channel = `browser-stream-${crypto.randomUUID()}`; const off = subscribe(channel, onChunk);
      try { await call('llmStreamChat', [messages, tools, channel, run, context]); } finally { off(); }
    },
    importCatalog: async () => { const file = await pickFile('.json'); return file ? call('browserImportCatalog', [await file.text()]) : { status: 'cancelled' }; },
    importWorkflow: async () => openFile(), openProject: async () => openFile(),
    cancelFileOpen: async () => { reading?.abort(); return { ok: true }; },
    importLessonsDialog: async () => { const file = await pickFile('.json,.yaml,.yml'); return file ? call('importLessonsText', [file.name, await file.text()]) : { ok: false, canceled: true }; },
    exportLessons: async (file: unknown, name: string) => { download(name, JSON.stringify(file, null, 2)); return { ok: true }; },
    saveProjectFile: async (choice?: string) => {
      const result = await call('browserProjectDocument', [choice]); if (!result.document) return result;
      download('project.nodewise.json', JSON.stringify(result.document, null, 2)); return { ok: true };
    },
    exportWorkflow: async (choice?: string) => {
      const result = await call('browserWorkflowExport', [choice]); if (!result.document) return result;
      const text = JSON.stringify(result.document, null, 2); lastExport = text;
      download('workflow.json', text); return { ok: true, unsetWidgets: [], fileName: 'workflow.json' };
    },
    exportedText: async () => lastExport, showExported: async () => ({ ok: false }),
    browserAccessStatus: async () => ({ state: 'disabled', error: null, url: null, addresses: [], devices: [], pairing: null }),
    reportRendererError: async () => ({ logged: false }),
    comfyAddressKnown: async () => false,
  };
  let lastExport: string | null = null;
  let reading: AbortController | null = null;
  const openFile = async () => {
    reading?.abort(); const controller = new AbortController(); reading = controller;
    try {
    const projection = await api.readProjection('desktop');
    const file = await pickFile('.json,.png,.webp,.jpg,.jpeg,.mp4,.mov,.webm,.mkv,.gif,.flac,.mp3,.opus,.ogg');
    if (!file || controller.signal.aborted) return { status: 'cancelled', projection: null, result: null };
    const encoded = await encodedFile(file, controller.signal);
    if (controller.signal.aborted) return { status: 'cancelled', projection: null, result: null };
    return await call('browserImport', [file.name, encoded, projection?.currentRevisionId, `browser-open-${crypto.randomUUID()}`]);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.message === VIDEO_METADATA_CANCELLED)) return { status: 'cancelled', projection: null, result: null };
      throw error;
    } finally { if (reading === controller) reading = null; }
  };
  for (const method of Object.keys(BROWSER_METHODS)) if (!(method in api)) api[method] = (...args: unknown[]) => call(method, args);
  const getSettings = api.getSettings;
  api.getSettings = async () => {
    const read = await getSettings();
    try { const view = JSON.parse(localStorage.getItem('browser-view') ?? 'null'); if (view && read.preferences) read.preferences = { ...read.preferences, view: { ...read.preferences.view, ...view } }; } catch { /* A damaged local view falls back to host defaults. */ }
    return read;
  };
  const unavailable = async () => { throw new Error(String(i18n.t('browser.onComputer'))); };
  window.electronAPI = new Proxy(api, { get: (target, key: string) => key in target ? target[key] : unavailable }) as unknown as ElectronAPI;
  const events = new EventSource('/browser/events');
  events.onmessage = (event) => {
    try { const { channel, payload } = JSON.parse(event.data); for (const listener of listeners.get(channel) ?? []) listener(payload); } catch { /* A malformed event never becomes code. */ }
  };
  events.onopen = () => {
    window.dispatchEvent(new CustomEvent(BROWSER_CONNECTION, { detail: 'online' }));
    for (const listener of listeners.get(IPC_CHANNELS.BROWSER_REFRESH) ?? []) listener(null);
  };
  events.onerror = () => { window.dispatchEvent(new CustomEvent(BROWSER_CONNECTION, { detail: 'offline' })); };
  window.addEventListener('pagehide', () => events.close(), { once: true });
  // A first stream cannot begin before its return event destination exists.
  await new Promise<void>((done) => { if (events.readyState === EventSource.OPEN) done(); else { events.addEventListener('open', () => done(), { once: true }); setTimeout(done, 3000); } });
}
