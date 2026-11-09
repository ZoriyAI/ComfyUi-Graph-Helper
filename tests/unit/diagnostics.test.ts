import { describe, expect, it } from 'vitest';
import { buildDiagnosticsReport, scrubUrl } from '../../src/main/diagnostics';
import { createRateLimiter, rendererErrorLine } from '../../src/main/ipc/diagnosticsIpc';
import { redactSecrets, exactMatchRedactor } from '../../src/shared/config/draft';
import { createNoticeGate } from '../../src/main/crash';

const FAKE_KEY = 'sk-proj-FAKEKEY1234567890abcdef';
const HELD = 'plain-held-token-value-9876';

describe('diagnostics report', () => {
  it('carries versions, settings and the log tail but no key or token', () => {
    const report = buildDiagnosticsReport({
      generatedAt: '2026-11-09T00:00:00.000Z',
      versions: { app: '0.1.0', electron: '45.2.3' },
      platform: { os: 'linux', release: '6.0', arch: 'x64' },
      locale: 'en-US',
      paths: { userData: '/home/me/.config/comfyui-graph-builder', logs: '/home/me/.config/comfyui-graph-builder/logs' },
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
    expect(report).toContain('https://api.example.com/v1');
    expect(report).toContain('provider key held: yes');
    expect(report).toMatch(/"apiKey": "\[(omitted|redacted)\]"/);
    expect(report).toContain('"tokenHeld": true');
    expect(report).toMatch(/## Log \(last 2 lines\)/);
  });

  it('scrubs user info and query from URLs', () => {
    expect(scrubUrl('https://a:b@host.example:8080/path?token=x#frag')).toBe('https://host.example:8080/path');
    expect(scrubUrl('not a url')).toBe('not a url');
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
