import { afterEach, describe, expect, it } from 'vitest';
import { detectMcpAuth } from '../../src/main/mcp/detect';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { startFakeOAuthMcp, type FakeOAuthMcp } from '../fixtures/mcp/fakeOAuthMcp';

/** TEST fixtures only: fake MCP servers on 127.0.0.1 (tests/fixtures/mcp). No real network. */

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});

async function plain(options: Parameters<typeof startFakeMcp>[0] = {}): Promise<FakeMcp> {
  const server = await startFakeMcp(options);
  closers.push(server.close);
  return server;
}

async function oauth(): Promise<FakeOAuthMcp> {
  const server = await startFakeOAuthMcp({ accessTtlSeconds: 60 });
  closers.push(server.close);
  return server;
}

describe('what the MCP server wants from a connection', () => {
  it('reports "none" with the tool count when a connection without credentials is accepted', async () => {
    const server = await plain();
    expect(await detectMcpAuth(server.url)).toEqual({ ok: true, mode: 'none', tools: expect.any(Number) });
    // Nothing but the ordinary MCP handshake reached the server.
    expect(server.calls.every((call) => call.authorized)).toBe(true);
    expect(server.calls.some((call) => call.method === 'tools/call')).toBe(false);
  });

  it('reports "token" when the server answers 401 without published OAuth metadata', async () => {
    const server = await plain({ token: 'fixture-token-not-a-secret' });
    expect(await detectMcpAuth(server.url)).toEqual({ ok: true, mode: 'token' });
    expect(JSON.stringify(server.calls)).not.toContain('fixture-token-not-a-secret');
  });

  it('tries a held token against the 401 and says whether the server took it', async () => {
    const server = await plain({ token: 'fixture-token-not-a-secret' });
    expect(await detectMcpAuth(server.url, { token: 'fixture-token-not-a-secret' })).toEqual({ ok: true, mode: 'token', tokenAccepted: true, tools: expect.any(Number) });
    expect(await detectMcpAuth(server.url, { token: 'wrong-token' })).toEqual({ ok: true, mode: 'token', tokenAccepted: false });
    expect(JSON.stringify(server.calls)).not.toContain('fixture-token-not-a-secret');
    expect(JSON.stringify(server.calls)).not.toContain('wrong-token');
  });

  it('reports "oauth" when the server answers 401 and publishes resource metadata', async () => {
    const server = await oauth();
    expect(await detectMcpAuth(server.mcpUrl)).toEqual({ ok: true, mode: 'oauth' });
  });

  it('names an unreachable server and refuses an address the app would never use', async () => {
    expect(await detectMcpAuth('http://127.0.0.1:1/mcp')).toEqual({ ok: false, error: 'MCP server unreachable: 127.0.0.1:1.' });
    expect(await detectMcpAuth('http://192.168.1.20:29100/mcp')).toMatchObject({ ok: false });
    expect(await detectMcpAuth('not a url')).toMatchObject({ ok: false });
  });
});
