/**
 * Two guards against foreign content driving the app. The IPC sender guard (src/main/ipc/guard.ts, which wraps every
 * handler main registers) answers only the app's own page, so a page opened by a link or a dropped file cannot read
 * keys or change the graph. The drop guard (src/renderer/dropGuard.ts) stops a dropped file or link from navigating
 * the window away, while the canvas's own drags still work.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { appEntryUrl, guardedHandle, guardedIpcMain, isTrustedAppUrl, setTrustedAppUrl, UNTRUSTED_SENDER_ERROR } from '../../src/main/ipc/guard';
import { isForeignDrag } from '../../src/renderer/dropGuard';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

/** A stand-in for Electron's ipcMain that only records handlers, so a test can call one with a made-up sender. */
function fakeIpc() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    handle(channel: string, handler: Handler) {
      handlers.set(channel, handler);
    },
    removeHandler(channel: string) {
      handlers.delete(channel);
    },
  };
}

const event = (url: string | null) => ({ senderFrame: url === null ? null : { url } });

afterEach(() => setTrustedAppUrl(null));

describe('IPC sender guard', () => {
  it('computes the entry URL for the built app and the dev server', () => {
    expect(appEntryUrl({ development: false, rendererIndexPath: '/opt/app/dist/renderer/index.html' })).toBe('file:///opt/app/dist/renderer/index.html');
    expect(appEntryUrl({ development: true, devServerUrl: 'http://localhost:5173/', rendererIndexPath: '/x' })).toBe('http://localhost:5173/');
  });

  it('accepts the app page and refuses every other sender', async () => {
    setTrustedAppUrl('file:///opt/app/dist/renderer/index.html');
    expect(isTrustedAppUrl('file:///opt/app/dist/renderer/index.html#/graph')).toBe(true);
    expect(isTrustedAppUrl('file:///opt/app/dist/renderer/other.html')).toBe(false);
    expect(isTrustedAppUrl('file:///tmp/evil/index.html')).toBe(false);
    expect(isTrustedAppUrl('https://example.com/')).toBe(false);
    expect(isTrustedAppUrl('')).toBe(false);

    const ipc = fakeIpc();
    let ran = 0;
    guardedHandle(ipc as never, 'x', (_event, value) => {
      ran += 1;
      return value;
    });
    const handler = ipc.handlers.get('x')!;
    expect(await handler(event('file:///opt/app/dist/renderer/index.html'), 7)).toBe(7);
    expect(() => handler(event('https://evil.example/'), 7)).toThrow(UNTRUSTED_SENDER_ERROR);
    expect(() => handler(event(null), 7)).toThrow(UNTRUSTED_SENDER_ERROR);
    expect(ran).toBe(1);
  });

  it('refuses everything until the app URL is known, and guards a wrapped IpcMain', () => {
    const ipc = fakeIpc();
    const wrapped = guardedIpcMain(ipc as never);
    wrapped.handle('y', () => 'ok');
    expect(() => ipc.handlers.get('y')!(event('file:///opt/app/dist/renderer/index.html'))).toThrow(UNTRUSTED_SENDER_ERROR);
    setTrustedAppUrl('http://localhost:5173/');
    expect(ipc.handlers.get('y')!(event('http://localhost:5173/index.html'))).toBe('ok');
    expect(() => ipc.handlers.get('y')!(event('http://localhost:5174/'))).toThrow(UNTRUSTED_SENDER_ERROR);
    wrapped.removeHandler('y');
    expect(ipc.handlers.has('y')).toBe(false);
  });
});

describe('document drop guard', () => {
  it('cancels file and link drops but not the canvas drag types or text', () => {
    expect(isForeignDrag(['Files'])).toBe(true);
    expect(isForeignDrag(['text/uri-list', 'text/plain'])).toBe(true);
    expect(isForeignDrag(['application/x-helper-node', 'text/plain'])).toBe(false);
    expect(isForeignDrag(['application/x-helper-model'])).toBe(false);
    expect(isForeignDrag(['text/plain'])).toBe(false);
  });
});
