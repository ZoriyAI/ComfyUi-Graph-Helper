import * as http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MCP_HTTPS_ERROR, MCP_IS_COMFYUI, MCP_NO_SERVER_AT_PATH, MCP_NOT_MCP, MCP_URL_CREDENTIALS, MCP_URL_NO_SCHEME, MCP_URL_NOT_ADDRESS, MCP_URL_PROTOCOL,
  McpTimeoutError, mcpTooSlow, mcpUrlBadHost, mcpUrlError,
} from '../../src/main/mcp/client';
import { connectFailureKind, explainFailureNow } from '../../src/main/mcp/connectError';
import { detectMcpAuth } from '../../src/main/mcp/detect';
import { nonSecretDefaults, nonSecretSettingsSchema } from '../../src/shared/config/schema';
import { createTranslator, explainError } from '../../src/shared/i18n';
import { isPlausibleHost, mcpUrlNeedsHttps, withLoopbackScheme } from '../../src/shared/mcp/loopback';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/** TEST fixtures only: fake MCP and tiny HTTP servers on 127.0.0.1. Nothing leaves the machine. */
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

async function tinyServer(handler: http.RequestListener): Promise<string> {
  const server = http.createServer(handler);
  const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
  closers.push(() => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${port}`;
}

describe('an address typed without http://', () => {
  it('is completed for this computer and left alone for another', () => {
    expect(withLoopbackScheme(' 127.0.0.1:9000/mcp ')).toBe('http://127.0.0.1:9000/mcp');
    expect(withLoopbackScheme('localhost:8188')).toBe('http://localhost:8188');
    expect(withLoopbackScheme('[::1]:9000/mcp')).toBe('http://[::1]:9000/mcp');
    expect(withLoopbackScheme('https://127.0.0.1:9000/mcp')).toBe('https://127.0.0.1:9000/mcp');
    expect(withLoopbackScheme('192.168.1.5:9000/mcp')).toBe('192.168.1.5:9000/mcp');
    expect(withLoopbackScheme('мой комфи')).toBe('мой комфи');
    expect(withLoopbackScheme('')).toBe('');
  });

  it('is saved completed, so the person can save without pressing Check first', () => {
    const parsed = nonSecretSettingsSchema.parse({ ...nonSecretDefaults, mcpUrl: '127.0.0.1:9000/mcp', comfyOrigin: 'localhost:8188', provider: 'local', model: 'm', baseURL: '127.0.0.1:11434/v1' });
    expect(parsed.mcpUrl).toBe('http://127.0.0.1:9000/mcp');
    expect(parsed.comfyOrigin).toBe('http://localhost:8188');
    expect(parsed.baseURL).toBe('http://127.0.0.1:11434/v1');
  });
});

describe('what is wrong with an MCP address, without asking anything', () => {
  it('names each mistake with its own sentence, never the false "needs https" for a typo', () => {
    expect(mcpUrlError('192.168.1.5:9000/mcp')).toBe(MCP_URL_NO_SCHEME);
    expect(mcpUrlError('htp://127.0.0.1:9000/mcp')).toBe(MCP_URL_PROTOCOL);
    expect(mcpUrlError('ftp://127.0.0.1/mcp')).toBe(MCP_URL_PROTOCOL);
    expect(mcpUrlError('мой комфи')).toBe(MCP_URL_NOT_ADDRESS);
    expect(mcpUrlError('http://user:pass@127.0.0.1:9000/mcp')).toBe(MCP_URL_CREDENTIALS);
    expect(mcpUrlError('http://127.0.0.l:9000/mcp')).toBe(mcpUrlBadHost('127.0.0.l'));
    expect(mcpUrlError('http://192.168.1:9000/mcp')).toBe(mcpUrlBadHost('192.168.1'));
    expect(mcpUrlError('http://192.168.1.5:9000/mcp')).toBe(MCP_HTTPS_ERROR);
    expect(mcpUrlError('https://comfy.example.org/mcp')).toBeNull();
    expect(mcpUrlError('http://127.0.0.1:9000/mcp')).toBeNull();
    expect(mcpUrlNeedsHttps('http://127.0.0.l:9000/mcp')).toBe(false);
    expect(mcpUrlNeedsHttps('http://192.168.1.5:9000/mcp')).toBe(true);
    expect(isPlausibleHost('comfy-box.local')).toBe(true);
    expect(isPlausibleHost('256.1.1.1')).toBe(false);
  });

  it('has a Russian and an English sentence for every code', () => {
    const codes = [MCP_URL_NO_SCHEME, MCP_URL_PROTOCOL, MCP_URL_NOT_ADDRESS, MCP_URL_CREDENTIALS, mcpUrlBadHost('127.0.0.l'), MCP_NO_SERVER_AT_PATH, MCP_IS_COMFYUI, MCP_NOT_MCP, mcpTooSlow(30), 'MCP server host was not found: nowhere.invalid.'];
    for (const language of ['ru', 'en'] as const) {
      const t = createTranslator(language);
      for (const code of codes) {
        const { summary, diagnostic } = explainError(t, code);
        expect(diagnostic, code).toBeNull();
        expect(summary, code).not.toBe(t('errors.unknown'));
        expect(summary).not.toBe(code);
      }
    }
    expect(explainError(createTranslator('ru'), mcpTooSlow(30)).summary).toContain('слишком долго');
    expect(explainError(createTranslator('ru'), MCP_NO_SERVER_AT_PATH).summary).toContain('/mcp');
  });
});

describe('what is wrong with an MCP address, found by asking it', () => {
  it('completes a bare address on this computer and says so', async () => {
    const fake = await startFakeMcp();
    closers.push(fake.close);
    const bare = fake.url.replace('http://', '');
    expect(await detectMcpAuth(bare)).toEqual({ ok: true, mode: 'none', tools: expect.any(Number), completedUrl: fake.url });
  });

  it('says that the address is ComfyUI itself', async () => {
    const fake = await startFakeMcp();
    closers.push(fake.close);
    expect(await detectMcpAuth(fake.comfyUrl)).toEqual({ ok: false, error: MCP_IS_COMFYUI });
    // Only reads: the ComfyUI fixture saw a GET of /system_stats and the refused POST of the handshake.
    expect(fake.comfyHits.every((hit) => hit.startsWith('GET /system_stats') || hit.startsWith('POST '))).toBe(true);
  });

  it('says that nothing is at this path', async () => {
    const fake = await startFakeMcp();
    closers.push(fake.close);
    expect(await detectMcpAuth(fake.url.replace('/mcp', '/mpc'))).toEqual({ ok: false, error: MCP_NO_SERVER_AT_PATH });
  });

  it('says that a web page is not an MCP server', async () => {
    const origin = await tinyServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body>Hello</body></html>');
    });
    expect(await detectMcpAuth(`${origin}/mcp`)).toEqual({ ok: false, error: MCP_NOT_MCP });
  });

  it('says that nothing listens on the port', async () => {
    expect(await detectMcpAuth('http://127.0.0.1:1/mcp')).toEqual({ ok: false, error: 'MCP server unreachable: 127.0.0.1:1.' });
  });
});

describe('slow is not gone', () => {
  it('tells a timeout apart from a refused connection', () => {
    expect(connectFailureKind(new McpTimeoutError(30_000))).toEqual({ kind: 'timeout', timeoutMs: 30_000 });
    const sdkTimeout = Object.assign(new Error('Request timed out'), { code: 'REQUEST_TIMEOUT', data: { timeout: 60_000 } });
    expect(explainFailureNow(sdkTimeout, 'http://127.0.0.1:9000/mcp')).toBe(mcpTooSlow(60));
    const refused = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
    expect(explainFailureNow(refused, 'http://127.0.0.1:9000/mcp')).toBe('MCP server unreachable: 127.0.0.1:9000.');
    const unknownHost = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) });
    expect(explainFailureNow(unknownHost, 'https://comfy-box.example/mcp')).toBe('MCP server host was not found: comfy-box.example.');
  });
});
