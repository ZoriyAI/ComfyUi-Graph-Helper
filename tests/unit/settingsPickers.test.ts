import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import {
  getJson, isOpenAiChatModel, listCloudModels, listLocalModels, MODEL_LIST_REFUSED, MODEL_LIST_SHAPE, MODEL_LIST_TIMEOUT,
  MODEL_LIST_UNREACHABLE, modelListHttpError, ollamaOrigin, parseAnthropicList, parseGoogleList, parseOllamaCatalog, parseOllamaTags, parseOpenAiList,
} from '../../src/main/llm/modelList';
import { discoverLocalServers, LOCAL_PROBES, openAiBase, parseOllamaTargets } from '../../src/main/llm/localDiscovery';
import {
  assembleSuggestions, COMFY_ORIGIN_HISTORY_KEY, connectionSuggestions, HISTORY_LIMIT, MCP_URL_HISTORY_KEY, probeComfy, readHistory,
  rememberAddress, rememberSavedAddresses,
} from '../../src/main/settings/connectionSuggestions';
import { saveSettings } from '../../src/main/settings/repository';
import { writeState } from '../../src/main/mcp/sync';
import { MainLLMService } from '../../src/main/llmService';
import { readOnlySession } from '../../src/main/mcp/readOnly';
import type { McpSession, McpToolCallResult } from '../../src/shared/mcp/catalogSource';
import { createTranslator, explainError, translateKnownError } from '../../src/shared/i18n';
import { listable, modelSuggestions, sameBase, serverSuggestions, withKnownFacts } from '../../src/renderer/components/settings/sections/pickerItems';

const KEY = 'sk-test-listkey-0123456789';

type Route = (url: URL, init: RequestInit) => Response | Promise<Response> | null;

/** A fetch that answers from a route table and records every request. Nothing leaves the process. */
function fakeFetch(route: Route, seen: Array<{ url: string; headers: Record<string, string>; redirect?: string }> = []): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    seen.push({ url: url.href, headers: { ...(init.headers as Record<string, string>) }, redirect: init.redirect });
    const answer = await route(url, init);
    if (answer) return answer;
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  }) as typeof fetch;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

// Fixtures: trimmed copies of what each provider's list endpoint returns.
const OPENAI_FIXTURE = {
  object: 'list',
  data: [
    { id: 'gpt-5', object: 'model', owned_by: 'system' },
    { id: 'gpt-4.1-mini', object: 'model', owned_by: 'system' },
    { id: 'text-embedding-3-large', object: 'model' },
    { id: 'tts-1-hd', object: 'model' },
    { id: 'whisper-1', object: 'model' },
    { id: 'dall-e-3', object: 'model' },
    { id: 'gpt-image-1', object: 'model' },
    { id: 'gpt-4o-realtime-preview', object: 'model' },
    { id: 'omni-moderation-latest', object: 'model' },
    { id: 'gpt-4o-transcribe', object: 'model' },
    { id: 'gpt-4o-audio-preview', object: 'model' },
  ],
};
const ANTHROPIC_FIXTURE = {
  data: [
    { type: 'model', id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', created_at: '2025-09-29T00:00:00Z' },
    { type: 'model', id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' },
  ],
  has_more: false,
};
const GOOGLE_FIXTURE = {
  models: [
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] },
  ],
};
const OLLAMA_V1_FIXTURE = { object: 'list', data: [{ id: 'qwen3:14b', object: 'model', owned_by: 'library' }, { id: 'mistral:7b', object: 'model', owned_by: 'library' }] };
const OLLAMA_TAGS_FIXTURE = {
  models: [
    { name: 'qwen3:14b', model: 'qwen3:14b', size: 9276198565, details: { family: 'qwen3', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } },
    { name: 'mistral:7b', model: 'mistral:7b', size: 4372824384, details: { family: 'llama', parameter_size: '7.2B' } },
  ],
};
// The owner's MCP server, ollama_targets / ollama_models (shapes read on 2026-11-09).
const TARGETS_FIXTURE = {
  targets: [
    { target: 'ollama_5090', base_url: 'http://127.0.0.1:11444', gpu_uuid: 'GPU-b477', default_model: 'qwen3.5:9b-q4_K_M', tasks: ['text', 'json', 'vision'], health: 'ready', service_observation: { ActiveState: 'active' } },
    { target: 'ollama_4060', base_url: 'http://127.0.0.1:11445', gpu_uuid: 'GPU-eb34', default_model: 'qwen3.5:4b-q4_K_M', health: 'ready' },
    { target: 'broken', base_url: 'ftp://127.0.0.1:1' },
  ],
  telemetry: { gpu: { 'GPU-b477': { name: 'NVIDIA GeForce RTX 5090', total_mib: 32607 }, 'GPU-eb34': { name: 'NVIDIA GeForce RTX 4060', total_mib: 8188 } } },
};
const CATALOG_FIXTURE = (target: string) => ({
  target,
  base_url: 'http://127.0.0.1:11444',
  models: [
    { name: 'qwen3:14b', size: 9276198565, details: { family: 'qwen3', parameter_size: '14.8B', context_length: 40960 }, capabilities: ['completion', 'tools', 'thinking'], allowed: true },
    { name: 'llava-caption:Q4_K_M', details: { family: 'llama', parameter_size: '8.0B' }, capabilities: ['completion', 'vision'], allowed: true },
    { name: 'hidden:1b', details: {}, capabilities: ['completion'], allowed: false },
  ],
});

function toolResult(value: unknown): McpToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function fakeMcp(calls: Array<{ name: string; args: Record<string, unknown> }>, closed: { count: number }, tools = ['studio_info', 'ollama_targets', 'ollama_models', 'ollama_pull']): McpSession {
  return {
    async listTools() {
      return tools.map((name) => ({ name }));
    },
    async callTool(name, args) {
      calls.push({ name, args });
      if (name === 'ollama_targets') return toolResult(TARGETS_FIXTURE);
      if (name === 'ollama_models') return toolResult(CATALOG_FIXTURE(String(args.target)));
      return { isError: true, content: [] };
    },
    async close() {
      closed.count += 1;
    },
  };
}

describe('model list parsers', () => {
  it('reads OpenAI-compatible lists and keeps only chat models for OpenAI', () => {
    expect(parseOpenAiList(OLLAMA_V1_FIXTURE)?.map((model) => model.id)).toEqual(['mistral:7b', 'qwen3:14b']);
    expect(parseOpenAiList({ models: [] })).toBeNull();
    expect(parseOpenAiList({ data: [{ id: '' }, { id: 'a\u0000b' }, { id: 42 }, { id: 'ok' }, { id: 'ok' }] })?.map((m) => m.id)).toEqual(['ok']);
    const chat = parseOpenAiList(OPENAI_FIXTURE)!.filter((model) => isOpenAiChatModel(model.id)).map((model) => model.id);
    expect(chat).toEqual(['gpt-4.1-mini', 'gpt-5']);
  });

  it('reads Anthropic and Google lists with display names; Google keeps generateContent models without the prefix', () => {
    expect(parseAnthropicList(ANTHROPIC_FIXTURE)).toEqual([
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    ]);
    expect(parseGoogleList(GOOGLE_FIXTURE)).toEqual([
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ]);
    expect(parseGoogleList({ data: [] })).toBeNull();
  });

  it('reads Ollama tags and the MCP catalog with size, family and capabilities', () => {
    expect(parseOllamaTags(OLLAMA_TAGS_FIXTURE)).toEqual([
      { id: 'mistral:7b', detail: '7.2B · llama' },
      { id: 'qwen3:14b', detail: '14.8B · qwen3' },
    ]);
    expect(parseOllamaCatalog(CATALOG_FIXTURE('ollama_5090'))).toEqual([
      { id: 'llava-caption:Q4_K_M', detail: '8.0B · llama', tools: false, vision: true, thinking: false },
      { id: 'qwen3:14b', detail: '14.8B · qwen3', tools: true, vision: false, thinking: true },
    ]);
  });

  it('recognises an Ollama-shaped base URL', () => {
    expect(ollamaOrigin('http://127.0.0.1:11444/v1')).toBe('http://127.0.0.1:11444');
    expect(ollamaOrigin('http://127.0.0.1:11444/v1/')).toBe('http://127.0.0.1:11444');
    expect(ollamaOrigin('http://127.0.0.1:11444')).toBe('http://127.0.0.1:11444');
    expect(ollamaOrigin('http://127.0.0.1:1234/api/v1')).toBeNull();
    expect(ollamaOrigin('file:///etc/passwd')).toBeNull();
  });
});

describe('local model list', () => {
  it('lists /v1/models and adds parameter size and family from /api/tags', async () => {
    const seen: Parameters<typeof fakeFetch>[1] = [];
    const fetchImpl = fakeFetch((url) => {
      if (url.pathname === '/v1/models') return json(OLLAMA_V1_FIXTURE);
      if (url.pathname === '/api/tags') return json(OLLAMA_TAGS_FIXTURE);
      return null;
    }, seen);
    const result = await listLocalModels('http://127.0.0.1:11444/v1/', fetchImpl);
    expect(result).toEqual({ ok: true, source: 'http://127.0.0.1:11444', models: [{ id: 'mistral:7b', detail: '7.2B · llama' }, { id: 'qwen3:14b', detail: '14.8B · qwen3' }] });
    expect(seen.map((request) => request.url).sort()).toEqual(['http://127.0.0.1:11444/api/tags', 'http://127.0.0.1:11444/v1/models']);
    expect(seen.every((request) => request.redirect === 'error' && !('authorization' in request.headers))).toBe(true);
  });

  it('falls back to Ollama /api/tags when /v1/models fails', async () => {
    const fetchImpl = fakeFetch((url) => (url.pathname === '/api/tags' ? json(OLLAMA_TAGS_FIXTURE) : new Response('no', { status: 404 })));
    const result = await listLocalModels('http://127.0.0.1:11444/v1', fetchImpl);
    expect(result.ok && result.models.map((model) => model.id)).toEqual(['mistral:7b', 'qwen3:14b']);
  });

  it('reports a fixed sentence when neither answers, and does not ask /api/tags of a non-Ollama path', async () => {
    const seen: Parameters<typeof fakeFetch>[1] = [];
    expect(await listLocalModels('http://127.0.0.1:1234/api/v1', fakeFetch(() => new Response('x', { status: 500 }), seen)))
      .toEqual({ ok: false, error: modelListHttpError(500) });
    expect(seen.map((request) => request.url)).toEqual(['http://127.0.0.1:1234/api/v1/models']);
    expect(await listLocalModels('http://127.0.0.1:9/v1', fakeFetch(() => null))).toEqual({ ok: false, error: MODEL_LIST_UNREACHABLE });
    expect(await listLocalModels('http://127.0.0.1:9/v1', fakeFetch(() => new Response('<html>', { status: 200 })))).toEqual({ ok: false, error: MODEL_LIST_SHAPE });
  });

  it('gives up after the time limit', async () => {
    const hanging = ((_input: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    expect(await getJson(hanging, 'http://127.0.0.1:9/v1/models', {}, 20)).toEqual({ ok: false, error: MODEL_LIST_TIMEOUT });
  });
});

describe('cloud model list', () => {
  it('sends each provider its own key header to its https list endpoint', async () => {
    const seen: Parameters<typeof fakeFetch>[1] = [];
    const fetchImpl = fakeFetch((url) => {
      if (url.host === 'api.openai.com') return json(OPENAI_FIXTURE);
      if (url.host === 'api.anthropic.com') return json(ANTHROPIC_FIXTURE);
      if (url.host === 'generativelanguage.googleapis.com') return json(GOOGLE_FIXTURE);
      return null;
    }, seen);
    const openai = await listCloudModels('openai', 'https://api.openai.com/v1', KEY, fetchImpl);
    const anthropic = await listCloudModels('anthropic', 'https://api.anthropic.com/v1', KEY, fetchImpl);
    const google = await listCloudModels('google', 'https://generativelanguage.googleapis.com/v1beta', KEY, fetchImpl);
    expect(openai).toEqual({ ok: true, source: 'api.openai.com', models: [{ id: 'gpt-4.1-mini' }, { id: 'gpt-5' }] });
    expect(anthropic.ok && anthropic.models.length).toBe(2);
    expect(google.ok && google.models.map((model) => model.id)).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
    expect(seen[0]).toMatchObject({ url: 'https://api.openai.com/v1/models', headers: { authorization: `Bearer ${KEY}` }, redirect: 'error' });
    expect(seen[1]).toMatchObject({ url: 'https://api.anthropic.com/v1/models?limit=1000', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' } });
    expect(seen[2]).toMatchObject({ url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', headers: { 'x-goog-api-key': KEY } });
    expect(JSON.stringify([openai, anthropic, google])).not.toContain(KEY);
  });

  it('reports a refused key without echoing it', async () => {
    const fetchImpl = fakeFetch(() => new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}` } }), { status: 401 }));
    expect(await listCloudModels('openai', 'https://api.openai.com/v1', KEY, fetchImpl)).toEqual({ ok: false, error: MODEL_LIST_REFUSED });
  });
});

describe('MainLLMService.listModels', () => {
  it('needs a held key for a cloud list and never sends it to http', async () => {
    const seen: Parameters<typeof fakeFetch>[1] = [];
    const fetchImpl = fakeFetch((url) => (url.host === 'api.openai.com' ? json(OPENAI_FIXTURE) : null), seen);
    const service = new MainLLMService();
    expect(await service.listModels({ provider: 'openai', baseURL: '' }, fetchImpl)).toEqual({ ok: false, error: 'Cloud model has no key for this session.' });
    expect(seen).toEqual([]);
    service.setSessionKey(KEY);
    expect(await service.listModels({ provider: 'anthropic', baseURL: 'http://gateway.example/v1' }, fetchImpl)).toEqual({ ok: false, error: 'Cloud key is not sent to an http address.' });
    expect(seen).toEqual([]);
    const listed = await service.listModels({ provider: 'openai', baseURL: '' }, fetchImpl);
    expect(listed.ok && listed.models.map((model) => model.id)).toEqual(['gpt-4.1-mini', 'gpt-5']);
    expect(seen.map((request) => request.url)).toEqual(['https://api.openai.com/v1/models']);
    expect(JSON.stringify(listed)).not.toContain(KEY);
  });

  it('lists a local server without a key and refuses a base URL that is not http(s)', async () => {
    const service = new MainLLMService();
    service.setSessionKey(KEY);
    const seen: Parameters<typeof fakeFetch>[1] = [];
    const fetchImpl = fakeFetch((url) => (url.pathname === '/v1/models' ? json(OLLAMA_V1_FIXTURE) : null), seen);
    const listed = await service.listModels({ provider: 'local', baseURL: 'http://127.0.0.1:11444/v1' }, fetchImpl);
    expect(listed.ok).toBe(true);
    expect(JSON.stringify(seen)).not.toContain(KEY);
    expect(await service.listModels({ provider: 'local', baseURL: 'file:///tmp/x' }, fetchImpl)).toEqual({ ok: false, error: 'Local model has no endpoint.' });
    expect(await service.listModels({ provider: 'nope', baseURL: '' }, fetchImpl)).toEqual({ ok: false, error: 'Model not configured' });
  });
});

describe('local server discovery', () => {
  it('turns MCP targets and their catalogs into base URLs with GPU, default model and capabilities', async () => {
    expect(parseOllamaTargets(TARGETS_FIXTURE)).toEqual([
      { target: 'ollama_5090', base: 'http://127.0.0.1:11444/v1', gpu: 'NVIDIA GeForce RTX 5090', defaultModel: 'qwen3.5:9b-q4_K_M' },
      { target: 'ollama_4060', base: 'http://127.0.0.1:11445/v1', gpu: 'NVIDIA GeForce RTX 4060', defaultModel: 'qwen3.5:4b-q4_K_M' },
    ]);
    expect(openAiBase('http://user:pw@127.0.0.1:1/')).toBeNull();
    expect(openAiBase('http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234/v1');
  });

  it('assembles MCP targets and loopback probes; only servers that answered are listed, through the read-only session', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const closed = { count: 0 };
    const seen: Parameters<typeof fakeFetch>[1] = [];
    // Only LM Studio's default port answers on this "computer".
    const fetchImpl = fakeFetch((url) => (url.port === '1234' && url.pathname === '/v1/models' ? json({ data: [{ id: 'local-model' }] }) : null), seen);
    const found = await discoverLocalServers({ fetchImpl, openMcp: async () => ({ ok: true, session: readOnlySession(fakeMcp(calls, closed)) }) });
    expect(found.notes).toEqual([]);
    expect(found.servers.map((server) => [server.origin, server.name, server.value])).toEqual([
      ['mcp', 'ollama_5090', 'http://127.0.0.1:11444/v1'],
      ['mcp', 'ollama_4060', 'http://127.0.0.1:11445/v1'],
      ['probe', 'LM Studio', 'http://127.0.0.1:1234/v1'],
    ]);
    expect(found.servers[0]).toMatchObject({ gpu: 'NVIDIA GeForce RTX 5090', defaultModel: 'qwen3.5:9b-q4_K_M' });
    expect(found.servers[0].models.find((model) => model.id === 'qwen3:14b')).toMatchObject({ tools: true, thinking: true });
    expect(found.servers[2].models).toEqual([{ id: 'local-model' }]);
    expect(calls).toEqual([
      { name: 'ollama_targets', args: {} },
      { name: 'ollama_models', args: { target: 'ollama_5090' } },
      { name: 'ollama_models', args: { target: 'ollama_4060' } },
    ]);
    expect(closed.count).toBe(1);
    for (const probe of LOCAL_PROBES) expect(seen.some((request) => request.url === `http://127.0.0.1:${probe.port}/v1/models`)).toBe(true);
    expect(seen.every((request) => new URL(request.url).hostname === '127.0.0.1')).toBe(true);
  });

  it('keeps one entry when the MCP server and a probe name the same server, and reports an MCP failure as a note', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const closed = { count: 0 };
    const session = fakeMcp(calls, closed);
    const sameServer: McpSession = {
      ...session,
      async callTool(name, args) {
        if (name === 'ollama_targets') return toolResult({ targets: [{ target: 'ollama_main', base_url: 'http://localhost:11434' }] });
        return session.callTool(name, args);
      },
    };
    const fetchImpl = fakeFetch((url) => (url.port === '11434' && url.pathname === '/v1/models' ? json(OLLAMA_V1_FIXTURE) : null));
    const merged = await discoverLocalServers({ fetchImpl, openMcp: async () => ({ ok: true, session: sameServer }) });
    expect(merged.servers.map((server) => [server.origin, server.name])).toEqual([['mcp', 'ollama_main']]);

    const failed = await discoverLocalServers({ fetchImpl: fakeFetch(() => null), openMcp: async () => ({ ok: false, error: 'MCP server refused the token.' }) });
    expect(failed).toEqual({ servers: [], notes: ['MCP server refused the token.'] });
    const noMcp = await discoverLocalServers({ fetchImpl: fakeFetch(() => null), openMcp: null });
    expect(noMcp).toEqual({ servers: [], notes: [] });
  });

  it('says nothing about an MCP server that runs no Ollama', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const closed = { count: 0 };
    const found = await discoverLocalServers({ fetchImpl: fakeFetch(() => null), openMcp: async () => ({ ok: true, session: fakeMcp(calls, closed, ['studio_info']) }) });
    expect(found).toEqual({ servers: [], notes: [] });
    expect(calls).toEqual([]);
    expect(closed.count).toBe(1);
  });
});

describe('connection suggestions', () => {
  function database() {
    const db = new Database(':memory:');
    migrate(db);
    return db;
  }

  it('keeps the last five saved addresses, most recent first, without repeats or non-http values', () => {
    const db = database();
    for (let port = 1; port <= 7; port += 1) rememberAddress(db, MCP_URL_HISTORY_KEY, `https://mcp${port}.example/mcp`);
    rememberAddress(db, MCP_URL_HISTORY_KEY, 'https://mcp5.example/mcp');
    rememberAddress(db, MCP_URL_HISTORY_KEY, 'javascript:alert(1)');
    rememberAddress(db, MCP_URL_HISTORY_KEY, '');
    expect(readHistory(db, MCP_URL_HISTORY_KEY)).toEqual([
      'https://mcp5.example/mcp', 'https://mcp7.example/mcp', 'https://mcp6.example/mcp', 'https://mcp4.example/mcp', 'https://mcp3.example/mcp',
    ]);
    expect(readHistory(db, MCP_URL_HISTORY_KEY)).toHaveLength(HISTORY_LIMIT);
    writeState(db, { [COMFY_ORIGIN_HISTORY_KEY]: 'not json' });
    expect(readHistory(db, COMFY_ORIGIN_HISTORY_KEY)).toEqual([]);
  });

  it('remembers the replaced and the new address when a save changes one', () => {
    const db = database();
    rememberSavedAddresses(db, { comfyOrigin: 'http://127.0.0.1:28188', mcpUrl: '' }, { comfyOrigin: 'http://127.0.0.1:8188', mcpUrl: '' });
    rememberSavedAddresses(db, { comfyOrigin: 'http://127.0.0.1:8188', mcpUrl: '' }, { comfyOrigin: 'http://127.0.0.1:8188', mcpUrl: '' });
    expect(readHistory(db, COMFY_ORIGIN_HISTORY_KEY)).toEqual(['http://127.0.0.1:8188', 'http://127.0.0.1:28188']);
    expect(readHistory(db, MCP_URL_HISTORY_KEY)).toEqual([]);
  });

  it('orders reported, saved, found and recent addresses and drops repeats', () => {
    expect(assembleSuggestions({
      saved: { comfyOrigin: 'http://127.0.0.1:28188', mcpUrl: 'https://llm.example/home_comfyui/mcp' },
      reportedComfy: 'http://127.0.0.1:28188/',
      probedComfy: ['http://127.0.0.1:8188'],
      comfyHistory: ['http://127.0.0.1:8188', 'http://192.168.1.5:8188'],
      mcpHistory: ['https://llm.example/home_comfyui/mcp', 'http://127.0.0.1:9000/mcp'],
    })).toEqual({
      comfyOrigins: [
        { value: 'http://127.0.0.1:28188/', source: 'reported' },
        { value: 'http://127.0.0.1:8188', source: 'probe' },
        { value: 'http://192.168.1.5:8188', source: 'recent' },
      ],
      mcpUrls: [
        { value: 'https://llm.example/home_comfyui/mcp', source: 'saved' },
        { value: 'http://127.0.0.1:9000/mcp', source: 'recent' },
      ],
    });
  });

  it('reads the reported ComfyUI address, the saved values and a ComfyUI answering on this computer', async () => {
    const db = database();
    const saved = saveSettings(db, { provider: '', model: '', baseURL: '', comfyOrigin: 'http://127.0.0.1:28188', mcpUrl: 'https://llm.example/mcp', theme: 'graphite', motion: 'system' });
    expect(saved.ok).toBe(true);
    writeState(db, { server_identity: JSON.stringify({ installation_id: 'home', comfyui_url: 'http://127.0.0.1:28188' }) });
    rememberAddress(db, MCP_URL_HISTORY_KEY, 'https://old.example/mcp');
    const seen: Parameters<typeof fakeFetch>[1] = [];
    const fetchImpl = fakeFetch((url) => {
      if (url.port === '8188' && url.pathname === '/system_stats') return json({ system: { comfyui_version: '0.3' }, devices: [] });
      if (url.port === '8000') return json({ data: [] });
      return null;
    }, seen);
    expect(await probeComfy(fetchImpl)).toEqual(['http://127.0.0.1:8188']);
    const quiet = await connectionSuggestions(db, fetchImpl);
    expect(quiet.comfyOrigins).toEqual([{ value: 'http://127.0.0.1:28188', source: 'reported' }]);
    seen.length = 0;
    const suggestions = await connectionSuggestions(db, fetchImpl, { probe: true });
    expect(suggestions.comfyOrigins).toEqual([
      { value: 'http://127.0.0.1:28188', source: 'reported' },
      { value: 'http://127.0.0.1:8188', source: 'probe' },
    ]);
    expect(suggestions.mcpUrls).toEqual([
      { value: 'https://llm.example/mcp', source: 'saved' },
      { value: 'https://old.example/mcp', source: 'recent' },
    ]);
    expect(seen.every((request) => new URL(request.url).hostname === '127.0.0.1' && request.url.endsWith('/system_stats'))).toBe(true);
  });
});

describe('picker rows in the renderer', () => {
  const english = createTranslator('en');

  it('adds what the MCP catalog knows to the live list and marks models without tool calls', () => {
    const merged = withKnownFacts([{ id: 'qwen3:14b' }, { id: 'llava-caption:Q4_K_M' }, { id: 'new:1b' }], parseOllamaCatalog(CATALOG_FIXTURE('x')));
    expect(merged).toEqual([
      { id: 'qwen3:14b', detail: '14.8B · qwen3', tools: true, vision: false, thinking: true },
      { id: 'llava-caption:Q4_K_M', detail: '8.0B · llama', tools: false, vision: true, thinking: false },
      { id: 'new:1b' },
    ]);
    const rows = modelSuggestions(merged, english);
    expect(rows[0].badges?.map((badge) => badge.text)).toEqual(['tools', 'thinking']);
    expect(rows[1].detail).toBe('8.0B · llama · no tool calls');
    expect(rows[1].badges?.map((badge) => badge.text)).toEqual(['no tool calls', 'vision']);
    expect(rows[2]).toEqual({ value: 'new:1b' });
  });

  it('labels servers with name, GPU, default model and where they were found', () => {
    const rows = serverSuggestions([
      { value: 'http://127.0.0.1:11444/v1', origin: 'mcp', name: 'ollama_5090', gpu: 'NVIDIA GeForce RTX 5090', defaultModel: 'qwen3.5:9b', models: [{ id: 'a' }, { id: 'b' }] },
      { value: 'http://127.0.0.1:1234/v1', origin: 'probe', name: 'LM Studio', models: [] },
    ], createTranslator('ru'));
    expect(rows[0].label).toBe('ollama_5090');
    expect(rows[0].detail).toBe('http://127.0.0.1:11444/v1 · видеокарта NVIDIA GeForce RTX 5090 · модель по умолчанию qwen3.5:9b · 2 модели · назван MCP-сервером');
    expect(rows[1].detail).toBe('http://127.0.0.1:1234/v1 · найден на этом компьютере');
    expect(sameBase('http://localhost:11434/v1/', 'http://127.0.0.1:11434/v1')).toBe(true);
    expect(listable('local', '')).toBe(false);
    expect(listable('local', 'http://127.0.0.1:1/v1')).toBe(true);
    expect(listable('openai', '')).toBe(true);
    expect(listable('test', '')).toBe(false);
  });

  it('translates the model list errors', () => {
    const russian = createTranslator('ru');
    expect(translateKnownError(russian, 'The provider refused the key.')).toBe('Провайдер не принял ключ.');
    expect(translateKnownError(russian, modelListHttpError(404))).toBe('Сервер ответил HTTP 404 на запрос списка моделей.');
    expect(explainError(russian, 'The server did not answer.').diagnostic).toBeNull();
    expect(russian('picker.modelsFound', { count: 23, source: 'http://127.0.0.1:11444' })).toBe('23 модели на http://127.0.0.1:11444.');
    expect(russian('picker.modelsFound', { count: 5, source: 'api.openai.com' })).toBe('5 моделей на api.openai.com.');
  });
});
