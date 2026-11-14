import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isDevelopmentRun, testSwitchesAllowed } from '../../../src/main/runMode';
import { secureProfileFolder } from '../../../src/main/profileFolder';
import { homeRedactor } from '../../../src/main/diagnostics';
import { guardedIpcMain, UNGUARDED_LISTENER_ERROR } from '../../../src/main/ipc/guard';

describe('development and test switches', () => {
  it('a development run needs an unpackaged app as well as NODE_ENV=development', () => {
    expect(isDevelopmentRun(false, { NODE_ENV: 'development' })).toBe(true);
    expect(isDevelopmentRun(true, { NODE_ENV: 'development' })).toBe(false);
    expect(isDevelopmentRun(false, {})).toBe(false);
  });

  it('test switches are honoured only in an unpackaged app', () => {
    expect(testSwitchesAllowed(false, { NODE_ENV: 'test' })).toBe(true);
    expect(testSwitchesAllowed(true, { NODE_ENV: 'test' })).toBe(false);
    expect(testSwitchesAllowed(false, { NODE_ENV: 'production' })).toBe(false);
  });
});

describe('the profile folder', () => {
  it('becomes readable by this user only', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-'));
    const dir = path.join(base, 'comfyui-graph-builder');
    fs.mkdirSync(dir, { mode: 0o755 });
    fs.chmodSync(dir, 0o755);
    try {
      expect(secureProfileFolder(dir)).toBe(0o700);
      expect(fs.statSync(dir).mode & 0o077).toBe(0);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});

describe('the home folder in texts meant for others', () => {
  it('becomes ~ only as a whole folder', () => {
    const redact = homeRedactor('/home/ann');
    expect(redact('userData=/home/ann/.config/app logs=/home/ann')).toBe('userData=~/.config/app logs=~');
    expect(redact('{"absolute_path":"/home/ann/ComfyUI/models/a.webp"}')).toBe('{"absolute_path":"~/ComfyUI/models/a.webp"}');
    expect(redact('/home/anna/x and /home/annex')).toBe('/home/anna/x and /home/annex');
    expect(homeRedactor('/')('/etc/x')).toBe('/etc/x');
  });
});

describe('the guarded IpcMain', () => {
  it('refuses listener registrations that would carry no sender check', () => {
    const ipc = { handle: () => undefined, on: () => undefined, once: () => undefined, handleOnce: () => undefined, removeHandler: () => undefined };
    const wrapped = guardedIpcMain(ipc as never);
    expect(() => wrapped.on('x', () => undefined)).toThrow(UNGUARDED_LISTENER_ERROR);
    expect(() => wrapped.once('x', () => undefined)).toThrow(UNGUARDED_LISTENER_ERROR);
    expect(() => wrapped.handleOnce('x', () => undefined)).toThrow(UNGUARDED_LISTENER_ERROR);
    expect(() => wrapped.handle('x', () => undefined)).not.toThrow();
  });
});

import { APP_ENTRY, bundleFileFor } from '../../../src/main/appProtocol';
import { appEntryUrl, isTrustedAppUrl, setTrustedAppUrl } from '../../../src/main/ipc/guard';

describe('the app scheme', () => {
  it('serves only files inside the bundle folder', () => {
    const dir = '/opt/app/dist/renderer';
    expect(bundleFileFor(dir, 'app://bundle/index.html')).toBe('/opt/app/dist/renderer/index.html');
    expect(bundleFileFor(dir, 'app://bundle/assets/index-abc.js?x=1#y')).toBe('/opt/app/dist/renderer/assets/index-abc.js');
    // The URL parser already folds a plain `..` into the bundle: it can only name a file inside it.
    expect(bundleFileFor(dir, 'app://bundle/../../../etc/passwd')).toBe('/opt/app/dist/renderer/etc/passwd');
    for (const url of [
      'app://bundle/a%2f..%2f..%2f..%2fetc%2fpasswd',
      'app://other/index.html', 'file:///etc/passwd', 'app://bundle/', 'app://bundle/x%00.js', 'app://bundle/%E0%A4%A',
    ]) {
      expect(bundleFileFor(dir, url), url).toBeNull();
    }
  });

  it('makes the bundle page the one trusted sender, and no other page of any scheme', () => {
    const entry = appEntryUrl({ development: false, rendererIndexPath: '/opt/app/dist/renderer/index.html', bundleEntry: APP_ENTRY });
    expect(entry).toBe('app://bundle/index.html');
    setTrustedAppUrl(entry);
    try {
      expect(isTrustedAppUrl('app://bundle/index.html#/graph')).toBe(true);
      expect(isTrustedAppUrl('app://bundle/other.html')).toBe(false);
      expect(isTrustedAppUrl('app://evil/index.html')).toBe(false);
      expect(isTrustedAppUrl('foo://bundle/index.html')).toBe(false);
      expect(isTrustedAppUrl('file:///opt/app/dist/renderer/index.html')).toBe(false);
    } finally {
      setTrustedAppUrl(null);
    }
  });
});

import { isLoopbackHost } from '../../../src/shared/mcp/loopback';
import { assertSecureTokenEndpoint } from '@modelcontextprotocol/client';

describe('what counts as this machine for a plain-http token', () => {
  it('is localhost, 127.x and ::1, not a name under .localhost', () => {
    for (const host of ['localhost', 'LOCALHOST.', '127.0.0.1', '127.1.2.3', '[::1]', '::1']) expect(isLoopbackHost(host), host).toBe(true);
    for (const host of ['evil.localhost', 'localhost.example.com', '10.0.0.1', '0.0.0.0']) expect(isLoopbackHost(host), host).toBe(false);
  });

  it('the sign-in library refuses a token endpoint over plain http off this machine', () => {
    expect(() => assertSecureTokenEndpoint('http://auth.example.com/token')).toThrow();
    expect(assertSecureTokenEndpoint('https://auth.example.com/token').href).toBe('https://auth.example.com/token');
  });
});
