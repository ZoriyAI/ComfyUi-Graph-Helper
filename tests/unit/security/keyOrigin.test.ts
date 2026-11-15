import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { MainLLMService } from '../../../src/main/llmService';
import {
  decodeKeyRecord, encodeKeyRecord, KEY_OTHER_ADDRESS, keyOriginFor, officialOrigin,
} from '../../../src/shared/config/keyOrigin';
import { readKeyFile, readKeyFileOrigins, removeKeyFromFile, writeKeyFile } from '../../../src/main/settings/keyFile';
import { createTranslator, translateKnownError } from '../../../src/shared/i18n';

const KEY = 'sk-proj-fake-key-for-tests-0000000000';
const PROXY_KEY = 'sk-proj-fake-proxy-key-0000000000';

/** Records every request; answers with an empty model list. */
function recording(seen: string[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: string[] = [];
    new Headers(init?.headers).forEach((value, name) => headers.push(`${name}=${value}`));
    seen.push(`${String(input)} ${headers.join(' ')}`);
    return new Response(JSON.stringify({ data: [{ id: 'gpt-5' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('a cloud key belongs to the address it was pasted for', () => {
  it('a key pasted for the official address is never sent to a typed address, and nothing is sent there at all', async () => {
    const service = new MainLLMService();
    service.setSessionKey('openai', KEY, '');
    const seen: string[] = [];
    for (const base of ['https://api.openai.co', 'https://api.openai.co/v1', 'https://evil.example/v1', 'https://api.openai.com.evil.example/v1']) {
      expect(await service.listModels({ provider: 'openai', baseURL: base }, recording(seen))).toEqual({ ok: false, error: KEY_OTHER_ADDRESS });
      expect(await service.probe({ provider: 'openai', model: 'gpt-5', baseURL: base }, async () => { seen.push('probe'); })).toEqual({ ok: false, error: KEY_OTHER_ADDRESS, latencyMs: null });
    }
    expect(seen).toEqual([]);
    // The official address still gets it.
    await service.listModels({ provider: 'openai', baseURL: '' }, recording(seen));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('https://api.openai.com/v1/models');
    expect(seen[0]).toContain(KEY);
  });

  it('a chat to another address than the key\'s is stopped in main before any client exists', () => {
    const service = new MainLLMService();
    service.setSessionKey('anthropic', KEY, '');
    service.setConfig({ provider: 'anthropic', model: 'claude-x', baseURL: 'https://gateway.example/v1' });
    expect(service.sendBlock()).toBe(KEY_OTHER_ADDRESS);
    service.setConfig({ provider: 'anthropic', model: 'claude-x', baseURL: '' });
    expect(service.sendBlock()).toBeNull();
  });

  it('a key pasted for the person\'s own https address goes there, and not to the official one', async () => {
    const service = new MainLLMService();
    service.setSessionKey('openai', PROXY_KEY, 'https://proxy.example/v1');
    expect(service.keyOrigin('openai')).toBe('https://proxy.example');
    const seen: string[] = [];
    expect(await service.listModels({ provider: 'openai', baseURL: '' }, recording(seen))).toEqual({ ok: false, error: KEY_OTHER_ADDRESS });
    expect(seen).toEqual([]);
    await service.listModels({ provider: 'openai', baseURL: 'https://proxy.example/v1' }, recording(seen));
    expect(seen[0]).toContain('https://proxy.example/v1/models');
  });

  it('takes no key for an http or broken address', () => {
    const service = new MainLLMService();
    expect(service.setSessionKey('openai', KEY, 'http://proxy.example/v1')).toEqual({ held: false, source: 'none' });
    expect(service.setSessionKey('openai', KEY, 'https://user:pw@proxy.example')).toEqual({ held: false, source: 'none' });
    expect(service.setSessionKey('openai', KEY, 'not an address')).toEqual({ held: false, source: 'none' });
  });

  it('a remembered key from before addresses were remembered is a key for the official address', () => {
    expect(decodeKeyRecord('google', 'AIza-old-bare-key')).toEqual({ key: 'AIza-old-bare-key', origin: officialOrigin('google') });
    const record = encodeKeyRecord('openai', PROXY_KEY, 'https://proxy.example');
    expect(decodeKeyRecord('openai', record)).toEqual({ key: PROXY_KEY, origin: 'https://proxy.example' });
    expect(encodeKeyRecord('openai', KEY, officialOrigin('openai')!)).toBe(KEY);
    expect(keyOriginFor('anthropic', '')).toBe('https://api.anthropic.com');
    // A record naming an http address is not trusted as a key address.
    expect(decodeKeyRecord('openai', JSON.stringify({ v: 2, key: KEY, origin: 'http://proxy.example' }))).toBeNull();
  });

  it('the key file remembers the address of a key for another address, and forgets it with the key', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-origin-'));
    try {
      writeKeyFile(dir, 'openai', PROXY_KEY, 'https://proxy.example');
      writeKeyFile(dir, 'anthropic', KEY);
      expect(readKeyFile(dir)).toEqual({ openai: PROXY_KEY, anthropic: KEY });
      expect(readKeyFileOrigins(dir)).toEqual({ openai: 'https://proxy.example' });
      removeKeyFromFile(dir, 'openai');
      expect(readKeyFileOrigins(dir)).toEqual({});
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the refusal is said in plain words in both languages', () => {
    expect(translateKnownError(createTranslator('en'), KEY_OTHER_ADDRESS)).toMatch(/^The key was pasted for another address/);
    expect(translateKnownError(createTranslator('ru'), KEY_OTHER_ADDRESS)).toMatch(/^Ключ вставлен для другого адреса/);
  });
});
