/** Real loopback HTTP tests of browser pairing, isolation, lifecycle and bounded access. No desktop profile or live service. */
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserAccessServer } from '../../src/main/browser/server';
import { parsePreferences } from '../../src/shared/config/preferences';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function fixture(now?: () => number) {
  const dir = mkdtempSync(join(tmpdir(), 'browser-access-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Shared renderer</title>');
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const service = new BrowserAccessServer({ rendererDir: dir, now, addresses: () => [{ address: '127.0.0.1', name: 'Loopback fixture' }], invoke: async (method, args) => { calls += 1; return { method, args }; }, bootstrap: () => ({ versions: { app: '1.1.0' } }) });
  cleanups.push(() => service.close());
  // Get an available non-privileged port without assuming a host port is free.
  const allocator = createServer();
  await new Promise<void>((resolve) => allocator.listen(0, '127.0.0.1', resolve));
  const port = (allocator.address() as { port: number }).port;
  await new Promise<void>((resolve) => allocator.close(() => resolve()));
  await service.configure({ enabled: true, address: '127.0.0.1', port });
  const url = `http://127.0.0.1:${port}`;
  const post = (route: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${url}${route}`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const pair = async () => {
    const code = service.pairingCode().code;
    const response = await post('/browser/pair', { code });
    expect(response.status).toBe(200);
    return response.headers.get('set-cookie')!.split(';')[0];
  };
  return { service, url, port, post, pair, calls: () => calls };
}

describe('browser access', () => {
  it('accepts selected media bytes only from a paired same-origin device', async () => {
    const f = await fixture();
    const send = (cookie = '', origin = f.url) => fetch(`${f.url}/browser/media?name=phone.png`, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array([1, 2, 3]) });
    expect((await send()).status).toBe(401);
    const cookie = await f.pair();
    expect((await send(cookie, 'https://example.invalid')).status).toBe(403);
    const response = await send(cookie);
    expect(response.status).toBe(200);
    const result = await response.json() as { value: { method: string; args: unknown[] } };
    expect(result.value.method).toBe('uploadNodeFile'); expect(result.value.args[0]).toBe('phone.png');
    expect(result.value.args[1]).toEqual({ type: 'Buffer', data: [1, 2, 3] });
    f.service.revoke(f.service.status().devices[0].id);
    expect((await send(cookie)).status).toBe(401);
    expect(f.calls()).toBe(1);
  });
  it('defaults off and keeps only a validated configurable port and interface', () => {
    expect(parsePreferences({}).browserAccess).toEqual({ enabled: false, address: '', port: 8787 });
    expect(parsePreferences({ browserAccess: { enabled: true, address: '127.0.0.1', port: 80 } }).browserAccess.port).toBe(8787);
  });
  it('serves the shared renderer but requires pairing for every operation', async () => {
    const f = await fixture();
    expect(f.service.status().state).toBe('listening');
    expect(await (await fetch(f.url)).text()).toContain('Shared renderer');
    expect((await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] })).status).toBe(401);
    const cookie = await f.pair();
    expect(cookie).not.toContain(f.service.pairingCode().code);
    const response = await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] }, { Cookie: cookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: { method: 'readProjection', args: ['desktop'] } });
    expect(f.calls()).toBe(1);
  });
  it('rejects foreign origins, missing origins and DNS rebinding hosts before invoking', async () => {
    const f = await fixture(); const cookie = await f.pair();
    for (const headers of [{ Origin: 'https://example.invalid' }, { Origin: 'null' }]) {
      expect((await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] }, { Cookie: cookie, ...headers })).status).toBe(403);
    }
    expect((await fetch(`${f.url}/browser/call`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
    const hostStatus = await new Promise<number>((done, fail) => { const req = request(f.url, { headers: { Host: 'example.invalid' } }, (res) => { res.resume(); done(res.statusCode!); }); req.on('error', fail); req.end(); });
    expect(hostStatus).toBe(403);
    expect(f.calls()).toBe(0);
  });
  it('refuses arbitrary IPC, paths and malformed arguments even after pairing', async () => {
    const f = await fixture(); const cookie = await f.pair();
    for (const method of ['settings:save-secret', 'openPath', '__proto__', 'constructor', 'setSecretStore']) {
      expect((await f.post('/browser/call', { method, args: [] }, { Cookie: cookie })).status).toBe(403);
    }
    expect((await f.post('/browser/call', { method: 'readProjection', args: {} }, { Cookie: cookie })).status).toBe(400);
    expect(f.calls()).toBe(0);
  });
  it('limits guesses and expires pairing codes', async () => {
    const f = await fixture(); f.service.pairingCode();
    for (let n = 0; n < 5; n += 1) expect((await f.post('/browser/pair', { code: 'wrong' })).status).toBe(401);
    expect((await f.post('/browser/pair', { code: f.service.pairingCode().code })).status).toBe(429);
  });
  it('expires a code and an existing session without extending their lifetimes', async () => {
    let time = 1000;
    const f = await fixture(() => time);
    const old = f.service.pairingCode().code;
    time += 5 * 60_000 + 1;
    expect((await f.post('/browser/pair', { code: old })).status).toBe(401);
    const cookie = await f.pair();
    time += 8 * 60 * 60_000 + 1;
    expect((await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] }, { Cookie: cookie })).status).toBe(401);
    expect(f.service.status().devices).toEqual([]);
  });
  it('pushes events to an authenticated stream and closes it on revocation', async () => {
    const f = await fixture(); const cookie = await f.pair();
    const stream = await fetch(`${f.url}/browser/events`, { headers: { Cookie: cookie } });
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    await reader.read();
    f.service.publish('browser:refresh', { changed: true });
    const data = new TextDecoder().decode((await reader.read()).value);
    expect(data).toContain('"changed":true');
    f.service.revoke(f.service.status().devices[0].id);
    expect((await reader.read()).done).toBe(true);
  });
  it('keeps the newest configuration when changes arrive while a listen is pending', async () => {
    const f = await fixture();
    const enable = f.service.configure({ enabled: true, address: '127.0.0.1', port: f.port });
    const disable = f.service.configure({ enabled: false, address: '127.0.0.1', port: f.port });
    await Promise.all([enable, disable]);
    expect(f.service.status()).toMatchObject({ state: 'disabled', url: null });
  });
  it('revokes a device without revealing its session token', async () => {
    const f = await fixture(); const cookie = await f.pair();
    const device = f.service.status().devices[0];
    expect(JSON.stringify(device)).not.toContain(cookie.split('=')[1]);
    f.service.revoke(device.id);
    expect((await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] }, { Cookie: cookie })).status).toBe(401);
  });
  it('closes the listener and sessions when disabled and can bind again', async () => {
    const f = await fixture(); const cookie = await f.pair();
    await f.service.configure({ enabled: false, address: '127.0.0.1', port: f.port });
    expect(f.service.status().state).toBe('disabled');
    await expect(fetch(f.url)).rejects.toThrow();
    await f.service.configure({ enabled: true, address: '127.0.0.1', port: f.port });
    expect((await f.post('/browser/call', { method: 'readProjection', args: ['desktop'] }, { Cookie: cookie })).status).toBe(401);
  });
  it('reports an occupied port without advertising a working URL', async () => {
    const f = await fixture();
    const other = new BrowserAccessServer({ rendererDir: '.', addresses: () => [{ address: '127.0.0.1', name: 'Fixture' }], invoke: async () => null, bootstrap: () => ({}) });
    cleanups.push(() => other.close());
    await other.configure({ enabled: true, address: '127.0.0.1', port: f.port });
    expect(other.status()).toMatchObject({ state: 'error', error: 'port-in-use', url: null });
  });
  it('refuses unavailable interfaces and traversal requests', async () => {
    const f = await fixture();
    expect((await fetch(`${f.url}/%2e%2e%2fpackage.json`)).status).toBe(404);
    await f.service.configure({ enabled: true, address: '192.0.2.1', port: f.port });
    expect(f.service.status()).toMatchObject({ state: 'error', error: 'address-unavailable', url: null });
  });
});
