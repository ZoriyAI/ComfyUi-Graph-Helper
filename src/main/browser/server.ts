/** Optional LAN HTTP host for the production renderer, paired sessions and explicitly reviewed operations. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { networkInterfaces } from 'node:os';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { BrowserAccessConfig, BrowserAccessStatus, BrowserAddress, BrowserDevice } from '../../shared/browser/contracts';
import { BROWSER_METHODS } from '../../shared/browser/methods';

const SESSION_MS = 8 * 60 * 60_000;
const PAIR_MS = 5 * 60_000;
const BODY_MAX = 16 * 1024 * 1024;
const COOKIE = 'nodewise_browser';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

/** Assigned noninternal IPv4 addresses; a user picks the adapter explicitly, without a wildcard bind. */
export function browserAddresses(): BrowserAddress[] {
  return Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => ({ address: entry.address, name }))).concat([{ address: '127.0.0.1', name: 'lo' }]);
}

/** A paired device's event destination. Disconnecting SSE alone leaves its current turn running. */
export class BrowserPeer extends EventEmitter {
  readonly id = -randomInt(1, 0x7fffffff);
  private ended = false;
  private streams = new Set<ServerResponse>();
  constructor(readonly device: BrowserDevice, private readonly valid: () => boolean) { super(); }
  isDestroyed(): boolean { return this.ended || !this.valid(); }
  send(channel: string, payload: unknown): void {
    if (this.isDestroyed()) return;
    const frame = `data: ${JSON.stringify({ channel, payload })}\n\n`;
    for (const stream of this.streams) {
      if (stream.writableLength > 2 * 1024 * 1024) { stream.destroy(); this.streams.delete(stream); }
      else stream.write(frame);
    }
  }
  attach(response: ServerResponse): void {
    // A reopened tab replaces an abandoned stream instead of accumulating live responses.
    if (this.streams.size >= 2) { const oldest = this.streams.values().next().value; oldest?.end(); if (oldest) this.streams.delete(oldest); }
    this.streams.add(response);
    response.on('close', () => this.streams.delete(response));
    response.write('retry: 1500\n: connected\n\n');
  }
  close(): void {
    this.ended = true;
    this.emit('destroyed');
    for (const response of this.streams) response.end();
    this.streams.clear();
    this.removeAllListeners();
  }
}

interface Session { peer: BrowserPeer; expiresAt: number; activeCalls: number }
/** Host dependencies keep tests on a real loopback server without Electron or a profile. */
export interface BrowserServerDeps {
  rendererDir: string;
  addresses?: () => BrowserAddress[];
  invoke: (method: string, args: unknown[], peer: BrowserPeer) => Promise<unknown>;
  bootstrap: () => unknown;
  now?: () => number;
}

/** A disabled-by-default host; settings changes are serialized so the last requested configuration wins. */
export class BrowserAccessServer {
  private server: Server | null = null;
  private origin: string | null = null;
  private state: BrowserAccessStatus['state'] = 'disabled';
  private error: BrowserAccessStatus['error'] = null;
  private sessions = new Map<string, Session>();
  private pair: BrowserAccessStatus['pairing'] = null;
  private attempts = new Map<string, { count: number; until: number }>();
  private queue: Promise<void> = Promise.resolve();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private addresses: () => BrowserAddress[];
  private now: () => number;
  constructor(private readonly deps: BrowserServerDeps) { this.addresses = deps.addresses ?? browserAddresses; this.now = deps.now ?? Date.now; }
  /** Native windows need cross-device refreshes only while another device is paired. */
  hasDevices(): boolean { return this.sessions.size > 0; }
  status(): BrowserAccessStatus {
    this.expire();
    return { state: this.state, error: this.error, url: this.origin, addresses: this.addresses(), devices: [...this.sessions.values()].map((s) => s.peer.device), pairing: this.pair && this.pair.expiresAt > this.now() ? this.pair : null };
  }
  pairingCode(): { code: string; expiresAt: number } {
    if (this.state !== 'listening') throw new Error('Browser access is not available.');
    if (!this.pair || this.pair.expiresAt <= this.now()) this.pair = { code: String(randomInt(0, 1_000_000)).padStart(6, '0'), expiresAt: this.now() + PAIR_MS };
    return { ...this.pair };
  }
  revoke(id: string): void {
    for (const [token, session] of this.sessions) if (session.peer.device.id === id) { session.peer.close(); this.sessions.delete(token); }
  }
  publish(channel: string, payload: unknown): void {
    this.expire();
    for (const session of this.sessions.values()) session.peer.send(channel, payload);
  }
  configure(config: BrowserAccessConfig): Promise<void> {
    const request = { ...config };
    this.queue = this.queue.catch(() => undefined).then(async () => {
      await this.stop();
      if (!request.enabled) return;
      if (!Number.isInteger(request.port) || request.port < 1024 || request.port > 65535 || !this.addresses().some((a) => a.address === request.address)) {
        this.state = 'error'; this.error = 'address-unavailable'; return;
      }
      this.state = 'starting';
      const server = createServer({ requestTimeout: 30_000, headersTimeout: 10_000, maxHeaderSize: 16_384 }, (req, res) => {
        void this.handle(req, res).catch(() => { if (!res.headersSent) this.json(res, 500, { error: 'request-failed' }); else res.end(); });
      });
      this.server = server;
      try {
        await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(request.port, request.address, () => { server.removeListener('error', fail); done(); }); });
        this.origin = `http://${request.address.includes(':') ? `[${request.address}]` : request.address}:${request.port}`;
        this.state = 'listening'; this.error = null;
        server.on('error', () => { this.origin = null; this.state = 'error'; this.error = 'failed'; });
        this.heartbeat = setInterval(() => {
          if (!this.addresses().some((address) => address.address === request.address)) {
            void this.configure(request);
            return;
          }
          this.expire(); this.publish('browser:heartbeat', null);
        }, 15_000);
        this.heartbeat.unref();
      } catch (error) {
        this.server = null; this.origin = null; this.state = 'error';
        const code = (error as NodeJS.ErrnoException).code;
        this.error = code === 'EADDRINUSE' ? 'port-in-use' : code === 'EADDRNOTAVAIL' ? 'address-unavailable' : 'failed';
      }
    });
    return this.queue;
  }
  async close(): Promise<void> { await this.configure({ enabled: false, address: '', port: 8787 }); }
  private async stop(): Promise<void> {
    this.origin = null; this.state = 'disabled'; this.error = null; this.pair = null;
    for (const session of this.sessions.values()) session.peer.close();
    this.sessions.clear(); this.attempts.clear();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const server = this.server; this.server = null;
    if (server) await new Promise<void>((done) => { server.close(() => done()); server.closeAllConnections(); });
  }
  private expire(): void {
    for (const [token, session] of this.sessions) if (session.expiresAt <= this.now()) { session.peer.close(); this.sessions.delete(token); }
    for (const [address, entry] of this.attempts) if (entry.until <= this.now()) this.attempts.delete(address);
  }
  private json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  }
  private async body(req: IncomingMessage): Promise<Record<string, unknown>> {
    if (!String(req.headers['content-type']).startsWith('application/json')) throw new Error('body');
    const declared = Number(req.headers['content-length']);
    if (declared > BODY_MAX) throw new Error('body');
    const chunks: Buffer[] = []; let total = 0;
    for await (const chunk of req) { total += chunk.length; if (total > BODY_MAX) throw new Error('body'); chunks.push(chunk); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body');
    return value as Record<string, unknown>;
  }
  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Frame-Options', 'DENY');
    const origin = this.origin;
    if (!origin || req.headers.host !== new URL(origin).host) { this.json(res, 403, { error: 'source-refused' }); return; }
    const pathname = new URL(req.url ?? '/', origin).pathname;
    if (!pathname.startsWith('/browser/')) {
      if (req.method !== 'GET') { this.json(res, 405, {}); return; }
      await this.staticFile(pathname, res); return;
    }
    if (req.method === 'POST' && req.headers.origin !== origin) { this.json(res, 403, { error: 'source-refused' }); return; }
    if (req.headers.origin && req.headers.origin !== origin) { this.json(res, 403, { error: 'source-refused' }); return; }
    this.expire();
    if (pathname === '/browser/pair' && req.method === 'POST') {
      const address = req.socket.remoteAddress ?? '';
      const attempt = this.attempts.get(address) ?? { count: 0, until: this.now() + 60_000 };
      if (attempt.count >= 5 || this.attempts.size > 256) { this.json(res, 429, { error: 'pair-throttled' }); return; }
      this.attempts.set(address, attempt); attempt.count += 1;
      let body; try { body = await this.body(req); } catch { this.json(res, 400, {}); return; }
      const code = typeof body.code === 'string' ? body.code : '';
      const expected = this.pair && this.pair.expiresAt > this.now() ? this.pair.code : null;
      if (!expected || Buffer.byteLength(code) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(code), Buffer.from(expected))) { this.json(res, 401, { error: 'pair-refused' }); return; }
      if (this.sessions.size >= 8) { this.json(res, 429, { error: 'devices-full' }); return; }
      const token = randomBytes(32).toString('hex');
      const device = { id: randomBytes(12).toString('hex'), name: String(req.headers['user-agent'] ?? 'Browser').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160), pairedAt: this.now() };
      const session: Session = { peer: new BrowserPeer(device, () => this.sessions.has(token)), expiresAt: this.now() + SESSION_MS, activeCalls: 0 };
      this.sessions.set(token, session); this.pair = null;
      res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/browser; Max-Age=${SESSION_MS / 1000}`);
      this.json(res, 200, { ok: true }); return;
    }
    const token = /(?:^|;\s*)nodewise_browser=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
    const session = token ? this.sessions.get(token) : null;
    if (!session) { this.json(res, 401, { error: 'pair-required' }); return; }
    if (pathname === '/browser/bootstrap' && req.method === 'GET') { this.json(res, 200, this.deps.bootstrap()); return; }
    if (pathname === '/browser/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      session.peer.attach(res); return;
    }
    if (pathname !== '/browser/call' || req.method !== 'POST') { this.json(res, 404, {}); return; }
    let body; try { body = await this.body(req); } catch { this.json(res, 400, { error: 'invalid-request' }); return; }
    if (typeof body.method !== 'string' || !Array.isArray(body.args) || body.args.length > 8) { this.json(res, 400, { error: 'invalid-request' }); return; }
    const special = ['llmStreamChat', 'llmCancel', 'browserImport', 'browserProjectDocument', 'browserWorkflowExport', 'browserImportCatalog'];
    if (!Object.hasOwn(BROWSER_METHODS, body.method) && !special.includes(body.method)) { this.json(res, 403, { error: 'operation-refused' }); return; }
    if (session.activeCalls >= 12) { this.json(res, 429, { error: 'request-throttled' }); return; }
    session.activeCalls += 1;
    try {
      const value = await this.deps.invoke(body.method, body.args, session.peer);
      if (!session.peer.isDestroyed()) this.json(res, 200, { value: value ?? null }); else this.json(res, 401, { error: 'pair-required' });
    } catch { this.json(res, 400, { error: 'request-failed' }); }
    finally { session.activeCalls -= 1; }
  }
  private async staticFile(pathname: string, res: ServerResponse): Promise<void> {
    try {
      const root = await realpath(this.deps.rendererDir);
      const name = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
      const target = await realpath(resolve(root, `.${name}`));
      if (!target.startsWith(root + sep) || !MIME[extname(target)] || name.includes('\0')) throw new Error('path');
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': MIME[extname(target)], 'Cache-Control': 'no-cache' }); res.end(data);
    } catch { this.json(res, 404, { error: 'not-found' }); }
  }
}
