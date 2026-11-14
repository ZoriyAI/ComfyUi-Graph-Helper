import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyTurnError, parseTurnError, retryAfterSeconds } from '../../../src/shared/agent/turnError';
import { mainLLMService } from '../../../src/main/llmService';

function apiError(statusCode: number, message: string, responseHeaders: Record<string, string> = {}) {
  return Object.assign(new Error(message), { name: 'AI_APICallError', statusCode, responseHeaders });
}

describe('classifyTurnError', () => {
  it('sorts provider failures into a closed set with the next step in mind', () => {
    expect(classifyTurnError(apiError(401, 'Incorrect API key provided: sk-abc')).kind).toBe('key');
    expect(classifyTurnError(apiError(403, 'forbidden')).kind).toBe('key');
    // No key at all: nothing was sent, so no server is blamed.
    expect(classifyTurnError('Cloud model has no key for this session.').kind).toBe('no-key');
    expect(classifyTurnError(new Error('Cloud model has no key for this session.')).kind).toBe('no-key');
    expect(classifyTurnError(apiError(401, 'This request has no key')).kind).toBe('key');
    expect(classifyTurnError(apiError(429, 'Rate limit reached', { 'retry-after': '20' }))).toMatchObject({ kind: 'rate', retryAfterSeconds: 20 });
    expect(classifyTurnError(apiError(429, 'Rate limit reached. Please try again in 7s.'))).toMatchObject({ kind: 'rate', retryAfterSeconds: 7 });
    expect(classifyTurnError(apiError(429, 'slow down')).retryAfterSeconds).toBeUndefined();
    expect(classifyTurnError(apiError(503, 'upstream down')).kind).toBe('server');
    const refused = Object.assign(new Error('Cannot connect to API: connect ECONNREFUSED 127.0.0.1:1'), { name: 'AI_APICallError' });
    expect(classifyTurnError(refused).kind).toBe('unreachable');
    expect(classifyTurnError(Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND host' } })).kind).toBe('unreachable');
    expect(classifyTurnError(Object.assign(new Error('JSON parsing failed: Text: {not json'), { name: 'AI_JSONParseError' })).kind).toBe('unreadable');
    expect(classifyTurnError(apiError(400, '"m" does not support tools')).kind).toBe('no-tools');
    expect(classifyTurnError(new Error('something odd')).kind).toBe('unknown');
    // A retry wrapper is read through to its last error.
    expect(classifyTurnError(Object.assign(new Error('Failed after 3 attempts'), { name: 'AI_RetryError', lastError: apiError(500, 'boom') })).kind).toBe('server');
  });

  it('keeps the server words only as short redacted details', () => {
    const error = classifyTurnError(apiError(401, `Incorrect API key provided: sk-test-SECRET ${'x'.repeat(600)}`), (text) => text.replace(/sk-[\w-]+/g, '[redacted]'));
    expect(error.details).not.toContain('sk-test-SECRET');
    expect(error.details.length).toBeLessThanOrEqual(301);
  });

  it('reads Retry-After as seconds, as an HTTP date and in milliseconds', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(retryAfterSeconds({ 'Retry-After': '30' }, now)).toBe(30);
    expect(retryAfterSeconds({ 'retry-after': 'Sat, 14 Nov 2026 12:01:00 GMT' }, now)).toBe(60);
    expect(retryAfterSeconds({ 'retry-after-ms': '1500' }, now)).toBe(2);
    expect(retryAfterSeconds({}, now)).toBeNull();
  });

  it('parses the error chunk content defensively', () => {
    expect(parseTurnError({ message: 'm', kind: 'rate', retryAfterSeconds: 12, details: 'd' })).toEqual({ kind: 'rate', retryAfterSeconds: 12, details: 'd' });
    expect(parseTurnError({ type: 'error', error: { message: 'm', kind: 'key', details: 'd' } })).toEqual({ kind: 'key', details: 'd' });
    expect(parseTurnError({ kind: 'nope' })).toBeNull();
    expect(parseTurnError('text')).toBeNull();
  });
});

describe('a local server reply', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  async function drain(response: () => Response): Promise<Array<{ type: string; content: any }>> {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mainLLMService.setConfig({ provider: 'local', model: 'fixture', baseURL: 'http://127.0.0.1:9/v1' });
    const out: Array<{ type: string; content: any }> = [];
    try {
      for await (const part of mainLLMService.streamChatWithTools([{ role: 'user', content: 'hi' }], {})) out.push(part);
    } catch (error) {
      out.push({ type: 'thrown', content: classifyTurnError(error) });
    }
    return out;
  }

  it('an HTML page with status 200 is an error of kind not-a-model', async () => {
    const parts = await drain(() => new Response('<html><body>Bad gateway</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const error = parts.find((part) => part.type === 'error' || part.type === 'thrown');
    expect(error).toBeTruthy();
    const kind = error!.type === 'thrown' ? error!.content.kind : parseTurnError(error!.content)?.kind;
    expect(kind).toBe('not-a-model');
  });

  it('a 429 is asked once, not three times at once, and keeps the wait the server named', async () => {
    let calls = 0;
    const parts = await drain(() => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '20' } });
    });
    expect(calls).toBe(1);
    const error = parts.find((part) => part.type === 'error');
    expect(parseTurnError(error?.content)).toMatchObject({ kind: 'rate', retryAfterSeconds: 20 });
  });
});
