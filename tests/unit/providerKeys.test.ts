import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainLLMService } from '../../src/main/llmService';
import { MODEL_LIST_REFUSED } from '../../src/main/llm/modelList';
import { migrate } from '../../src/main/settings/migrate';
import {
  forgetProviderKey,
  migrateLegacyProviderKey,
  readProviderKeyCipher,
  readSecretCipher,
  saveSecretIfProven,
  secretRecordCount,
} from '../../src/main/settings/repository';
import { keyFileHolds, keyFilePath, readKeyFile, removeKeyFromFile, writeKeyFile } from '../../src/main/settings/keyFile';
import { keySourceOf, NO_KEYS } from '../../src/renderer/state/providerState';

const OPENAI_KEY = 'sk-openai-key-for-tests-111111';
const ANTHROPIC_KEY = 'anthropic-key-for-tests-222222';
const GOOGLE_KEY = 'google-key-for-tests-333333';

type Seen = { url: string; headers: Record<string, string> };

/** An injected fetch that records every outgoing URL and header, and answers with a model list. */
function recordingFetch(seen: Seen[], status = 200): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value;
    });
    seen.push({ url: String(input), headers });
    if (status !== 200) return new Response('{"error":"nope"}', { status });
    return new Response(JSON.stringify({ data: [{ id: 'gpt-5' }, { id: 'claude-x', type: 'model' }], models: [{ name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

function allHeaderText(seen: Seen[]): string {
  return seen.map((request) => `${request.url} ${JSON.stringify(request.headers)}`).join('\n');
}

describe('a key per provider', () => {
  it('lists models with the key of the provider it asks, never another provider\'s', async () => {
    const service = new MainLLMService();
    service.setSessionKey('anthropic', ANTHROPIC_KEY);
    const seen: Seen[] = [];
    // OpenAI and Google have no key: nothing is sent to them, and the Anthropic key is not borrowed.
    expect(await service.listModels({ provider: 'openai', baseURL: '' }, recordingFetch(seen))).toEqual({ ok: false, error: 'Cloud model has no key for this session.' });
    expect(await service.listModels({ provider: 'google', baseURL: '' }, recordingFetch(seen))).toEqual({ ok: false, error: 'Cloud model has no key for this session.' });
    expect(seen).toEqual([]);

    await service.listModels({ provider: 'anthropic', baseURL: '' }, recordingFetch(seen));
    expect(seen).toHaveLength(1);
    expect(seen[0].url.startsWith('https://api.anthropic.com/')).toBe(true);
    expect(seen[0].headers['x-api-key']).toBe(ANTHROPIC_KEY);

    service.setSessionKey('openai', OPENAI_KEY);
    service.setSessionKey('google', GOOGLE_KEY);
    seen.length = 0;
    await service.listModels({ provider: 'openai', baseURL: '' }, recordingFetch(seen));
    await service.listModels({ provider: 'google', baseURL: '' }, recordingFetch(seen));
    const [openai, google] = seen;
    expect(openai.url.startsWith('https://api.openai.com/')).toBe(true);
    expect(openai.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(JSON.stringify(openai)).not.toContain(ANTHROPIC_KEY);
    expect(JSON.stringify(openai)).not.toContain(GOOGLE_KEY);
    expect(google.url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true);
    expect(google.headers['x-goog-api-key']).toBe(GOOGLE_KEY);
    expect(JSON.stringify(google)).not.toContain(ANTHROPIC_KEY);
    expect(JSON.stringify(google)).not.toContain(OPENAI_KEY);
  });

  it('stops a chat send in main when only another provider has a key', async () => {
    const service = new MainLLMService();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      service.setSessionKey('anthropic', ANTHROPIC_KEY);
      service.setConfig({ provider: 'openai', model: 'gpt-5', baseURL: '' });
      expect(service.sendBlock()).toBe('Cloud model has no key for this session.');
      await expect(service.streamChatWithTools([{ role: 'user', content: 'hi' }], {}).next()).rejects.toThrow('Cloud model has no key for this session.');
      service.setConfig({ provider: 'google', model: 'gemini-3-pro', baseURL: '' });
      expect(service.sendBlock()).toBe('Cloud model has no key for this session.');
      service.setConfig({ provider: 'anthropic', model: 'claude-x', baseURL: '' });
      expect(service.sendBlock()).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('sends the chat stream with the chosen provider\'s key only', async () => {
    const service = new MainLLMService();
    const seen: Seen[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((value, name) => {
        headers[name] = value;
      });
      seen.push({ url: String(input), headers });
      return new Response(JSON.stringify({ error: { message: 'fixture stop' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      service.setSessionKey('openai', OPENAI_KEY);
      service.setSessionKey('anthropic', ANTHROPIC_KEY);
      service.setSessionKey('google', GOOGLE_KEY);
      for (const [provider, key, header] of [
        ['openai', OPENAI_KEY, 'authorization'],
        ['anthropic', ANTHROPIC_KEY, 'x-api-key'],
        ['google', GOOGLE_KEY, 'x-goog-api-key'],
      ] as const) {
        seen.length = 0;
        service.setConfig({ provider, model: 'fixture-model', baseURL: '' });
        try {
          for await (const _part of service.streamChatWithTools([{ role: 'user', content: 'hi' }], {})) {
            // Drain until the fixture answer ends the stream.
          }
        } catch {
          // The fixture answers 400; only the request matters here.
        }
        expect(seen.length).toBeGreaterThan(0);
        const text = allHeaderText(seen);
        expect(seen[0].headers[header]).toContain(key);
        for (const other of [OPENAI_KEY, ANTHROPIC_KEY, GOOGLE_KEY].filter((value) => value !== key)) {
          expect(text).not.toContain(other);
        }
      }
    } finally {
      fetchSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });

  it('probes with the key of the provider it checks', async () => {
    const service = new MainLLMService();
    service.setSessionKey('anthropic', ANTHROPIC_KEY);
    const generate = vi.fn(async () => ({}));
    expect(await service.probe({ provider: 'openai', model: 'gpt-5', baseURL: '' }, generate)).toEqual({ ok: false, error: 'Cloud model has no key for this session.', latencyMs: null });
    expect(generate).not.toHaveBeenCalled();
    expect(await service.probe({ provider: 'anthropic', model: 'claude-x', baseURL: '' }, generate)).toMatchObject({ ok: true });
  });

  it('redacts every provider\'s held key from errors and logs', async () => {
    const service = new MainLLMService();
    service.setSessionKey('openai', OPENAI_KEY);
    service.holdOsKey('anthropic', ANTHROPIC_KEY);
    service.holdFileKey('google', GOOGLE_KEY);
    const text = service.redact(`a ${OPENAI_KEY} b ${ANTHROPIC_KEY} c ${GOOGLE_KEY}`);
    expect(text).not.toContain(OPENAI_KEY);
    expect(text).not.toContain(ANTHROPIC_KEY);
    expect(text).not.toContain(GOOGLE_KEY);
    expect(service.containsHeldSecret(`x ${GOOGLE_KEY}`)).toBe(true);
    const failed = await service.probe({ provider: 'openai', model: 'gpt-5', baseURL: '' }, async () => {
      throw new Error(`denied for ${ANTHROPIC_KEY} and ${GOOGLE_KEY}`);
    });
    expect(JSON.stringify(failed)).not.toContain(ANTHROPIC_KEY);
    expect(JSON.stringify(failed)).not.toContain(GOOGLE_KEY);
  });

  it('reports each provider\'s key place and forgets one without touching the others', () => {
    const service = new MainLLMService();
    expect(service.keySources()).toEqual({ openai: 'none', anthropic: 'none', google: 'none', compatible: 'none', local: 'none' });
    service.setSessionKey('anthropic', ANTHROPIC_KEY);
    service.holdOsKey('google', GOOGLE_KEY);
    expect(service.keySources()).toEqual({ openai: 'none', anthropic: 'session', google: 'os', compatible: 'none', local: 'none' });
    service.setConfig({ provider: 'openai', model: 'gpt-5' });
    expect(service.sessionStatus()).toEqual({ held: false, source: 'none' });
    service.setConfig({ provider: 'anthropic', model: 'claude-x' });
    expect(service.sessionStatus()).toEqual({ held: true, source: 'session' });
    service.setSessionKey('anthropic', '');
    expect(service.keySources()).toEqual({ openai: 'none', anthropic: 'none', google: 'os', compatible: 'none', local: 'none' });
    // Your own server takes a key only with its address; with none there is nowhere to bind it.
    expect(service.setSessionKey('local', OPENAI_KEY)).toEqual({ held: false, source: 'none' });
    expect(service.setSessionKey('mistral', OPENAI_KEY)).toEqual({ held: false, source: 'none' });
    expect(service.setSessionKey('test', OPENAI_KEY)).toEqual({ held: false, source: 'none' });
    service.forgetKeys();
    expect(service.keySources()).toEqual({ openai: 'none', anthropic: 'none', google: 'none', compatible: 'none', local: 'none' });
  });

  it('the renderer reads each card\'s own key place', () => {
    const sources = { ...NO_KEYS, anthropic: 'session' as const };
    expect(keySourceOf(sources, 'anthropic')).toBe('session');
    expect(keySourceOf(sources, 'openai')).toBe('none');
    expect(keySourceOf(sources, 'google')).toBe('none');
    expect(keySourceOf(sources, 'local')).toBe('none');
  });
});

describe('a key the provider refuses', () => {
  it('drops a pasted key on 401 and 403', async () => {
    for (const status of [401, 403]) {
      const service = new MainLLMService();
      service.setSessionKey('openai', OPENAI_KEY);
      service.setSessionKey('anthropic', ANTHROPIC_KEY);
      const listed = await service.listModels({ provider: 'openai', baseURL: '' }, recordingFetch([], status));
      expect(listed).toEqual({ ok: false, error: MODEL_LIST_REFUSED, dropped: true });
      expect(service.keyStatus('openai')).toEqual({ held: false, source: 'none' });
      // The other provider's key is not touched.
      expect(service.keyStatus('anthropic')).toEqual({ held: true, source: 'session' });
    }
  });

  it('keeps the key when the provider could not be reached', async () => {
    const service = new MainLLMService();
    service.setSessionKey('openai', OPENAI_KEY);
    const offline = (async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { cause: { code: 'ENOTFOUND' } });
    }) as unknown as typeof fetch;
    const listed = await service.listModels({ provider: 'openai', baseURL: '' }, offline);
    expect(listed.ok).toBe(false);
    expect(listed.ok === false && listed.dropped).toBeFalsy();
    expect(service.keyStatus('openai')).toEqual({ held: true, source: 'session' });
  });

  it('keeps a remembered key until the person forgets it', async () => {
    const service = new MainLLMService();
    service.holdOsKey('google', GOOGLE_KEY);
    const listed = await service.listModels({ provider: 'google', baseURL: '' }, recordingFetch([], 401));
    expect(listed).toEqual({ ok: false, error: MODEL_LIST_REFUSED });
    expect(service.keyStatus('google')).toEqual({ held: true, source: 'os' });
  });
});

describe('stored key records', () => {
  const openDb = () => {
    const db = new Database(':memory:');
    migrate(db);
    return db;
  };

  it('keeps one record per provider', () => {
    const db = openDb();
    expect(saveSecretIfProven(db, { persist: true }, 'openai', OPENAI_KEY, Buffer.from('cipher-openai'))).toEqual({ status: 'stored' });
    expect(saveSecretIfProven(db, { persist: true }, 'google', GOOGLE_KEY, Buffer.from('cipher-google'))).toEqual({ status: 'stored' });
    expect(saveSecretIfProven(db, { persist: true }, 'mistral', OPENAI_KEY, Buffer.from('cipher-mistral'))).toEqual({ status: 'secret-storage-blocked' });
    expect(readProviderKeyCipher(db, 'openai')?.toString()).toBe('cipher-openai');
    expect(readProviderKeyCipher(db, 'google')?.toString()).toBe('cipher-google');
    expect(readProviderKeyCipher(db, 'anthropic')).toBeNull();
    forgetProviderKey(db, 'openai');
    expect(readProviderKeyCipher(db, 'openai')).toBeNull();
    expect(readProviderKeyCipher(db, 'google')?.toString()).toBe('cipher-google');
    forgetProviderKey(db);
    expect(secretRecordCount(db)).toBe(0);
    db.close();
  });

  it('moves the one-key-era record to the saved provider once', () => {
    const db = openDb();
    db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)').run('provider-key', Buffer.from('legacy-cipher'));
    expect(migrateLegacyProviderKey(db, 'anthropic')).toBe('moved');
    expect(readProviderKeyCipher(db, 'anthropic')?.toString()).toBe('legacy-cipher');
    expect(readSecretCipher(db, 'provider-key')).toBeNull();
    expect(readProviderKeyCipher(db, 'openai')).toBeNull();
    expect(migrateLegacyProviderKey(db, 'anthropic')).toBe('none');
    db.close();
  });

  it('does not overwrite a record the provider already has', () => {
    const db = openDb();
    db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)').run('provider-key:openai', Buffer.from('newer'));
    db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)').run('provider-key', Buffer.from('legacy'));
    expect(migrateLegacyProviderKey(db, 'openai')).toBe('moved');
    expect(readProviderKeyCipher(db, 'openai')?.toString()).toBe('newer');
    expect(secretRecordCount(db)).toBe(1);
    db.close();
  });

  it('drops the one-key-era record when no cloud provider is saved, rather than guess whose it was', () => {
    for (const saved of ['', 'local', 'test']) {
      const db = openDb();
      db.prepare('INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)').run('provider-key', Buffer.from('legacy'));
      expect(migrateLegacyProviderKey(db, saved)).toBe('dropped');
      expect(secretRecordCount(db)).toBe(0);
      db.close();
    }
  });
});

describe('the app folder key file', () => {
  let dir = '';
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = '';
  });
  const tempDir = () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-file-'));
    return dir;
  };

  it('reads the one-key shape as the provider it was written for', () => {
    const userData = tempDir();
    fs.writeFileSync(keyFilePath(userData), JSON.stringify({ version: 1, provider: 'anthropic', key: ANTHROPIC_KEY }));
    expect(readKeyFile(userData)).toEqual({ anthropic: ANTHROPIC_KEY });
    expect(keyFileHolds(userData, 'anthropic')).toBe(true);
    expect(keyFileHolds(userData, 'openai')).toBe(false);
  });

  it('holds a key per provider, owner-only, and removes one at a time', () => {
    const userData = tempDir();
    fs.writeFileSync(keyFilePath(userData), JSON.stringify({ version: 1, provider: 'anthropic', key: ANTHROPIC_KEY }));
    writeKeyFile(userData, 'openai', OPENAI_KEY);
    expect(readKeyFile(userData)).toEqual({ anthropic: ANTHROPIC_KEY, openai: OPENAI_KEY });
    expect(JSON.parse(fs.readFileSync(keyFilePath(userData), 'utf8')).version).toBe(2);
    if (process.platform !== 'win32') expect(fs.statSync(keyFilePath(userData)).mode & 0o777).toBe(0o600);
    removeKeyFromFile(userData, 'anthropic');
    expect(readKeyFile(userData)).toEqual({ openai: OPENAI_KEY });
    removeKeyFromFile(userData, 'openai');
    expect(fs.existsSync(keyFilePath(userData))).toBe(false);
  });

  it('ignores unknown providers and unreadable files', () => {
    const userData = tempDir();
    expect(readKeyFile(userData)).toEqual({});
    fs.writeFileSync(keyFilePath(userData), JSON.stringify({ version: 2, keys: { openai: OPENAI_KEY, mistral: 'x', google: '' } }));
    expect(readKeyFile(userData)).toEqual({ openai: OPENAI_KEY });
    fs.writeFileSync(keyFilePath(userData), 'not json');
    expect(readKeyFile(userData)).toEqual({});
  });
});
