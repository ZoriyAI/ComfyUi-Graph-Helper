/**
 * Protects what leaves the app when a person copies diagnostics or the app logs a failure (main/diagnostics,
 * ipc/diagnosticsIpc, main/crash): versions and settings go in, keys, tokens and the hosts the person set up do not,
 * renderer error lines are clipped and rate-limited, and crash notices show at most once a minute. A person must be
 * able to paste a report into a public issue without giving away a key or their network.
 */
import { describe, expect, it } from 'vitest';
import { buildDiagnosticsReport, scrubUrl } from '../../src/main/diagnostics';
import { createRateLimiter, rendererErrorLine } from '../../src/main/ipc/diagnosticsIpc';
import { redactSecrets, exactMatchRedactor } from '../../src/shared/config/draft';
import { createNoticeGate } from '../../src/main/crash';

/** A value caught by its key-like shape. */
const FAKE_KEY = 'sk-proj-FAKEKEY1234567890abcdef';
/** A token the app holds; it looks like plain text, so only the exact match can catch it. */
const HELD = 'plain-held-token-value-9876';

describe('diagnostics report', () => {
  it('carries versions, settings and the log tail but no key or token', () => {
    const report = buildDiagnosticsReport({
      generatedAt: '2026-11-09T00:00:00.000Z',
      versions: { app: '0.1.0', electron: '45.2.3' },
      platform: { os: 'linux', release: '6.0', arch: 'x64' },
      locale: 'en-US',
      paths: { userData: '/home/me/.config/nodewise-studio', logs: '/home/me/.config/nodewise-studio/logs' },
      settingsSource: 'stored',
      settings: {
        provider: 'openai', model: 'gpt-x', baseURL: `https://user:${HELD}@api.example.com/v1?key=${HELD}`,
        apiKey: FAKE_KEY, comfyOrigin: 'http://127.0.0.1:8188', notes: `see ${FAKE_KEY}`,
      },
      preferences: { assistant: { token: HELD }, privacy: { sendFieldValues: false } },
      sync: { state: 'idle', mcpUrl: `https://mcp.example.com/mcp?access_token=${HELD}`, tokenHeld: true },
      catalog: { nodeClasses: 3272, models: 2000 },
      keyHeld: true,
      logTail: [`INFO request with Authorization: Bearer ${FAKE_KEY}`, `INFO held ${HELD}`],
      redact: (text) => exactMatchRedactor([FAKE_KEY, HELD])(redactSecrets(text)),
    });
    expect(report).not.toContain(FAKE_KEY);
    expect(report).not.toContain(HELD);
    expect(report).toContain('electron: 45.2.3');
    expect(report).toContain('nodeClasses: 3272');
    expect(report).toContain('"provider": "openai"');
    expect(report).toContain('https://[internet]:443');
    expect(report).not.toContain('api.example.com');
    expect(report).toContain('provider key held: yes');
    expect(report).toMatch(/"apiKey": "\[(omitted|redacted)\]"/);
    expect(report).toContain('"tokenHeld": true');
    expect(report).toMatch(/## Log \(last 2 lines\)/);
  });

  it('keeps only the scheme, where the server is and its port', () => {
    expect(scrubUrl('https://a:b@host.example:8080/path?token=x#frag')).toBe('https://[internet]:8080');
    expect(scrubUrl('http://127.0.0.1:9000/mcp')).toBe('http://[this computer]:9000');
    expect(scrubUrl('http://192.168.1.50:8188')).toBe('http://[local network]:8188');
    expect(scrubUrl('http://studio.local:8188')).toBe('http://[local network]:8188');
    expect(scrubUrl('https://mcp.example.net/s/capability-path-secret/mcp')).toBe('https://[internet]:443');
    // A public service every install uses keeps its name.
    expect(scrubUrl('https://api.openai.com/v1')).toBe('https://api.openai.com');
    expect(scrubUrl('not a url')).toBe('not a url');
  });

  it('never carries a host the person set up, in settings, sync or log lines', () => {
    const report = buildDiagnosticsReport({
      generatedAt: 'now', versions: {}, platform: { os: 'linux', release: '6', arch: 'x64' }, locale: 'en', paths: {},
      settingsSource: 'database', settings: { mcpUrl: 'https://mcp.example.net/s/abc/mcp', comfyOrigin: 'http://192.168.1.50:8188' },
      preferences: null, sync: { mcpUrl: 'https://mcp.example.net/s/abc/mcp' }, catalog: {}, keyHeld: false,
      logTail: ['[Sync] End error=The MCP server at mcp.example.net did not answer'],
      redact: (text) => text,
      addresses: ['https://mcp.example.net/s/abc/mcp', 'http://192.168.1.50:8188'],
    });
    expect(report).not.toContain('mcp.example.net');
    expect(report).not.toContain('192.168.1.50');
    expect(report).not.toContain('/s/abc');
    expect(report).toContain('[internet]');
  });
});

describe('renderer error reports', () => {
  it('are clipped and redacted', () => {
    const line = rendererErrorLine({ kind: 'error', message: `failed with ${FAKE_KEY}`, source: 'file:///app/index.js:1:2', stack: 'x'.repeat(5000) });
    expect(line).not.toBeNull();
    expect(line).not.toContain(FAKE_KEY);
    expect(line!.length).toBeLessThan(3000);
    expect(rendererErrorLine({ message: '' })).toBeNull();
    expect(rendererErrorLine('nope')).toBeNull();
  });

  it('are rate-limited per minute', () => {
    let now = 0;
    const limiter = createRateLimiter(3, 60_000, () => now);
    expect([limiter.allow(), limiter.allow(), limiter.allow(), limiter.allow()]).toEqual([true, true, true, false]);
    expect(limiter.takeDropped()).toBe(1);
    now = 60_000;
    expect(limiter.allow()).toBe(true);
  });
});

describe('crash notices', () => {
  it('show at most once a minute', () => {
    let now = 1000;
    const gate = createNoticeGate(60_000, () => now);
    expect(gate()).toBe(true);
    now += 30_000;
    expect(gate()).toBe(false);
    now += 30_000;
    expect(gate()).toBe(true);
  });
});
