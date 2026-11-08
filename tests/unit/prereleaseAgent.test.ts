import http from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { secretPersistenceDecision } from '../../src/shared/config/secretPolicy';
import { saveSettings, saveSecretIfProven, secretRecordCount } from '../../src/main/settings/repository';
import { migrate } from '../../src/main/settings/migrate';
import { mainLLMService } from '../../src/main/llmService';
import { applyComfyRead } from '../../src/main/comfy/read';
import { readCatalog } from '../../src/main/catalog/repository';
import { missingOnGraph } from '../../src/shared/graph/compatibility';
import { mutationFromTool } from '../../src/shared/commands/tools';
import { agentGraphContext } from '../../src/shared/agent/context';

const SETTINGS = {
  theme: 'graphite',
  motion: 'system',
  language: 'en',
} as const;

function listen(handler: http.RequestListener): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('no port');
      resolve({
        port: address.port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe('prerelease agent configuration', () => {
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
    mainLLMService.setSessionKey('');
  });

  it('refuses basic_text even when encryption is reported available', () => {
    expect(secretPersistenceDecision({
      platform: 'linux',
      backend: 'basic_text',
      encryptionAvailable: true,
      roundtrip: false,
      plaintextInCipher: true,
    })).toEqual({
      persist: false,
      reason: 'OS key storage is not an OS password manager, so a key is not written.',
    });
    expect(secretPersistenceDecision({
      platform: 'linux',
      backend: 'gnome_libsecret',
      encryptionAvailable: true,
      roundtrip: true,
      plaintextInCipher: false,
    }).persist).toBe(true);
  });

  it('writes ciphertext only after a proven decision and never the plaintext', () => {
    const db = new Database(':memory:');
    migrate(db);
    const blocked = saveSecretIfProven(db, { persist: false }, 'session-marker', Buffer.from('cipher'));
    expect(blocked).toEqual({ status: 'secret-storage-blocked' });
    expect(secretRecordCount(db)).toBe(0);
    const stored = saveSecretIfProven(db, { persist: true }, 'session-marker', Buffer.from('cipher-bytes'));
    expect(stored).toEqual({ status: 'stored' });
    const row = db.prepare('SELECT ciphertext FROM secret_records WHERE name = ?').get('provider-key') as { ciphertext: Buffer };
    expect(Buffer.from(row.ciphertext).includes(Buffer.from('session-marker'))).toBe(false);
    const leaked = saveSecretIfProven(db, { persist: true }, 'session-marker', Buffer.from('session-marker'));
    expect(leaked).toEqual({ status: 'secret-storage-blocked' });
    db.close();
  });

  it('saves a local endpoint and rejects a bad Comfy address without storing a key', () => {
    const db = new Database(':memory:');
    migrate(db);
    const saved = saveSettings(db, {
      ...SETTINGS,
      provider: 'local',
      model: 'fixture-local',
      baseURL: 'http://127.0.0.1:11434/v1',
      comfyOrigin: 'http://127.0.0.1:8188',
    });
    expect(saved.ok).toBe(true);
    const bad = saveSettings(db, {
      ...SETTINGS,
      provider: 'local',
      model: 'fixture-local',
      baseURL: 'http://127.0.0.1:11434/v1',
      comfyOrigin: 'notaurl',
    });
    expect(bad).toEqual({ ok: false, error: 'Settings do not match the schema' });
    const incomplete = saveSettings(db, {
      ...SETTINGS,
      provider: 'local',
      model: '',
      baseURL: '',
      comfyOrigin: '',
    });
    expect(incomplete).toEqual({ ok: false, error: 'Settings do not match the schema' });
    db.close();
  });

  it('stops cloud and local sends before fetch when they are not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mainLLMService.setConfig({
      provider: 'openai',
      model: 'fixture-model',
      baseURL: 'https://example.test/v1',
      apiKey: 'session-marker',
    });
    expect(mainLLMService.sessionStatus()).toEqual({ held: false });
    await expect(mainLLMService.streamChatWithTools([{ role: 'user', content: 'hi' }], {}).next()).rejects.toThrow(
      'Cloud model has no key for this session.',
    );
    mainLLMService.setSessionKey('session-marker');
    expect(JSON.stringify(mainLLMService.nextSendConfig())).not.toContain('session-marker');
    mainLLMService.setConfig({ provider: 'local', model: 'fixture-local', baseURL: '' });
    await expect(mainLLMService.streamChatWithTools([{ role: 'user', content: 'hi' }], {}).next()).rejects.toThrow(
      'Local model has no endpoint.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sends a local request only to the saved endpoint and does not attach a session key', async () => {
    const seen: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const headers = new Headers(init?.headers);
      seen.push(`${init?.method ?? 'GET'} ${String(input)} auth=${headers.get('authorization') ?? ''} body=${String(init?.body ?? '')}`);
      return new Response(JSON.stringify({ error: { message: 'fixture stop' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    });
    const logs: string[] = [];
    const record = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(record);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(record);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(record);
    try {
      mainLLMService.setSessionKey('sk-example-secret');
      mainLLMService.setConfig({
        provider: 'local',
        model: 'fixture-local',
        baseURL: 'http://127.0.0.1:9/v1',
      });
      try {
        for await (const _part of mainLLMService.streamChatWithTools([{ role: 'user', content: 'describe the node' }], {})) {
          // Drain until the fixture response fails the stream.
        }
      } catch {
        // The fixture endpoint rejects the call. The request itself is the assertion.
      }
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((line) => line.includes('http://127.0.0.1:9/v1/chat/completions'))).toBe(true);
      expect(seen.some((line) => line.includes('Bearer local'))).toBe(true);
      expect(seen.join('\n')).not.toContain('sk-example-secret');
      expect(logs.join('\n')).not.toContain('sk-example-secret');
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it('reads only Comfy system stats and object info', async () => {
    const hits: string[] = [];
    const server = await listen((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      if (req.url === '/system_stats') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ system: { comfyui_version: 'fixture-0' }, devices: [{ name: 'fixture' }] }));
        return;
      }
      if (req.url === '/object_info') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          SeedNode: {
            input: { required: { seed: ['INT', { default: 0 }] } },
            input_order: { required: ['seed'] },
            output: ['LATENT'],
            python_module: 'nodes',
          },
        }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const db = new Database(':memory:');
    migrate(db);
    const read = await applyComfyRead(db, `http://127.0.0.1:${server.port}`, globalThis.fetch);
    expect(read).toMatchObject({ ok: true, version: 'fixture-0', devices: 1, nodes: 1 });
    expect(readCatalog(db).nodeTypes).toContain('SeedNode');
    expect(hits.filter((hit) => hit.startsWith('POST'))).toEqual([]);
    expect(hits).toContain('GET /system_stats');
    expect(hits).toContain('GET /object_info');
    const redirected = await applyComfyRead(db, `http://127.0.0.1:${server.port}`, async (input, init) => {
      hits.push(`manual ${init?.method} ${String(input)}`);
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9/secret' } });
    });
    expect(redirected).toEqual({ ok: false, error: 'Comfy origin was not read.' });
    expect(hits.some((hit) => hit.includes('127.0.0.1:9'))).toBe(false);
    await server.close();
    db.close();
  });

  it('reports canvas node types that are absent from the catalog', () => {
    const report = missingOnGraph(
      [{ data: { comfyType: 'TestNode' } }, { data: { comfyType: 'CheckpointLoaderSimple' } }],
      { nodeTypes: ['CheckpointLoaderSimple'], models: [], nodes: [] },
      { nodes: [] },
    );
    expect(report.missingNodes).toEqual(['TestNode']);
    expect(agentGraphContext({
      nodes: [{ id: 'node-1', data: { comfyType: 'TestNode', title: 'Fixture step' } }],
      components: [{ ownerKind: 'node', ownerId: 'node-1', purpose: 'Fixture node purpose', usage: 'Connect it.' }],
      process: { title: 'Fixture process', notes: 'A note' },
    })).toContain('node-1 type=TestNode');
    expect(agentGraphContext({
      nodes: [],
      components: [],
      process: { title: '', notes: '' },
    })).toContain('The graph has no nodes.');
    expect(mutationFromTool('setProcess', { title: 'Fixture process', notes: 'A note' })).toEqual({
      type: 'set-process',
      title: 'Fixture process',
      notes: 'A note',
    });
  });
});
