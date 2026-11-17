/** Reuses validated domain handlers for a small explicit browser method list; never exposes arbitrary IPC. */
import type { IpcMainInvokeEvent } from 'electron';
import { BROWSER_METHODS } from '../../shared/browser/methods';
import { DESKTOP_PROJECT_ID } from '../../shared/project';
import type { BrowserPeer } from './server';

type Handler = Parameters<import('electron').IpcMain['handle']>[1];
const handlers = new Map<string, Handler>();
const channels = new Set<string>(Object.values(BROWSER_METHODS));
const special = new Map<string, (args: unknown[], peer: BrowserPeer) => unknown>();
const listeners = new Set<(channel: string, payload: unknown) => void>();

/** Capture only reviewed channels during trusted desktop handler registration. The first is the unwrapped handler. */
export function captureBrowserHandler(channel: string, handler: Handler): void {
  if (channels.has(channel) && !handlers.has(channel)) handlers.set(channel, handler);
}
/** Browser-specific files and streams still call the same domain code as the desktop. */
export function registerBrowserOperation(method: string, handler: (args: unknown[], peer: BrowserPeer) => unknown): void { special.set(method, handler); }
/** Runtime event bridge; the server and desktop windows subscribe once at startup. */
export function onBrowserEvent(listener: (channel: string, payload: unknown) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
/** Publish safe domain events without exposing an Electron event object. */
export function publishBrowserEvent(channel: string, payload: unknown): void { for (const listener of listeners) listener(channel, payload); }
/** A domain mutation has settled. Devices reload current state; commands are never replayed. */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let knowledgeChanged = false;
/** Coalesced state notification; a text token does not invalidate explanation caches. */
export function browserChanged(knowledge = false): void {
  knowledgeChanged ||= knowledge;
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { refreshTimer = null; const changed = knowledgeChanged; knowledgeChanged = false; publishBrowserEvent('browser:refresh', { knowledgeChanged: changed }); }, 100);
  refreshTimer.unref();
}

/** Invoke one reviewed operation after session, Origin, Host and body checks. */
export async function invokeBrowserMethod(method: string, args: unknown[], peer: BrowserPeer): Promise<unknown> {
  if (peer.isDestroyed()) throw new Error('Browser is disconnected.');
  if (special.has(method)) return special.get(method)!(args, peer);
  if (!Object.hasOwn(BROWSER_METHODS, method)) throw new Error('Operation is unavailable.');
  const projectFirst = ['readProjection', 'startRun', 'resumeRun', 'pauseRun', 'cancelRun', 'closeRun', 'listRevisions', 'loadChatHistory', 'clearChatHistory', 'checkGraph', 'listProposals'];
  if ((projectFirst.includes(method) || method === 'historyUsage') && args[0] !== DESKTOP_PROJECT_ID) throw new Error('Unknown project.');
  if (method === 'trimHistory' && (args[0] as { projectId?: unknown } | null)?.projectId !== DESKTOP_PROJECT_ID) throw new Error('Unknown project.');
  if (method === 'commitCommand' && (args[0] as { projectId?: unknown } | null)?.projectId !== DESKTOP_PROJECT_ID) throw new Error('Unknown project.');
  if (method === 'llmSetConfig') {
    const value = args[0] as Record<string, unknown> | null;
    if (!value || typeof value.provider !== 'string' || value.provider.length > 80 || typeof value.model !== 'string' || value.model.length > 200 || (value.baseURL != null && (typeof value.baseURL !== 'string' || value.baseURL.length > 500))) throw new Error('Invalid model configuration.');
    args = [{ provider: value.provider, model: value.model, baseURL: value.baseURL ?? '' }];
  }
  if (method === 'saveSettings') {
    const input = args[0] as { preferences?: Record<string, unknown> } | null;
    if (input?.preferences && Object.hasOwn(input.preferences, 'browserAccess')) {
      // Listener configuration can only be changed at the host, even by a paired phone.
      const { browserAccess: _hostOnly, ...preferences } = input.preferences;
      args = [{ ...input, preferences }];
    }
  }
  const channel = BROWSER_METHODS[method as keyof typeof BROWSER_METHODS];
  const handler = handlers.get(channel);
  if (!handler) throw new Error('Operation is unavailable.');
  // Every allowed domain handler ignores the Electron event; no native sender is fabricated.
  const result = await handler(undefined as unknown as IpcMainInvokeEvent, ...args);
  if (/^(command:(?!read-)|chat:(?:save|clear)|knowledge:(?:save|delete)|lessons:(?:save|remove|import|draft-resolve)|settings:save$|file:(?:open|import))/.test(channel)) browserChanged(channel.startsWith('knowledge:'));
  return result;
}
