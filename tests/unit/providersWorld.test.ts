import { describe, expect, it } from 'vitest';
import { COMPATIBLE_NO_ADDRESS, MainLLMService, refusedForKey, turnUsage } from '../../src/main/llmService';
import { isLocalChatModel, lmStudioNonChat, listLocalModels, MODEL_LIST_NEEDS_KEY, parseOllamaShow } from '../../src/main/llm/modelList';
import { createWindowVariant, loadAndReadContext, resetLocalContextMemory, windowVariantName } from '../../src/main/llm/localContext';
import { decodeKeyRecord, encodeKeyRecord, keyOriginFor, officialOrigin } from '../../src/shared/config/keyOrigin';
import { isPrivateHost, proxyAddressValid, proxyRuleFor } from '../../src/shared/config/proxy';
import { ADVICE_DATE, CLOUD_ADVICE, costOf, LOCAL_ADVICE, priceOf } from '../../src/shared/config/modelAdvice';
import { classifyTurnError } from '../../src/shared/agent/turnError';
import { nonSecretDefaults, nonSecretSettingsSchema } from '../../src/shared/config/schema';
import { MODEL_SUGGESTIONS, parsePreferences } from '../../src/shared/config/preferences';
import { knownContextTokens } from '../../src/shared/agent/contextWindow';
import { TOOL_CAPABLE_EXAMPLES } from '../../src/shared/agent/providerErrors';
import { explainError, createTranslator } from '../../src/shared/i18n';

/** Labelled fake servers: injected fetch functions that record what was asked; nothing leaves the process. */
type Seen = { url: string; method: string; headers: Record<string, string>; body: string };

function fakeFetch(seen: Seen[], answer: (url: string, body: string) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value;
    });
    const body = typeof init?.body === 'string' ? init.body : '';
    seen.push({ url: String(input), method: init?.method ?? 'GET', headers, body });
    return answer(String(input), body);
  }) as typeof fetch;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

const GATEWAY = 'https://gateway.example.test/v1';
const KEY = 'gw-key-for-tests-12345678';

describe('an OpenAI-compatible cloud service', () => {
  it('binds its key to the https address typed for it, never to an empty or http address', () => {
    expect(officialOrigin('compatible')).toBeNull();
    expect(keyOriginFor('compatible', '')).toBeNull();
    expect(keyOriginFor('compatible', 'http://gateway.example.test/v1')).toBeNull();
    expect(keyOriginFor('compatible', GATEWAY)).toBe('https://gateway.example.test');
    // A remembered record always carries its address; a bare record means no address and is dropped.
    const record = encodeKeyRecord('compatible', KEY, 'https://gateway.example.test');
    expect(record.startsWith('{')).toBe(true);
    expect(decodeKeyRecord('compatible', record)).toEqual({ key: KEY, origin: 'https://gateway.example.test' });
    expect(decodeKeyRecord('compatible', KEY)).toBeNull();
  });

  it('needs its address before anything is sent, then lists chat models with its key at that address only', async () => {
    const service = new MainLLMService();
    const seen: Seen[] = [];
    const answer = () => json({ data: [{ id: 'qwen3-235b' }, { id: 'text-embedding-3-small' }, { id: 'deepseek-chat' }] });
    expect(await service.listModels({ provider: 'compatible', baseURL: '' }, fakeFetch(seen, answer))).toEqual({ ok: false, error: COMPATIBLE_NO_ADDRESS });
    expect(service.setSessionKey('compatible', KEY, '')).toEqual({ held: false, source: 'none' });
    expect(service.setSessionKey('compatible', KEY, GATEWAY)).toEqual({ held: true, source: 'session' });
    const listed = await service.listModels({ provider: 'compatible', baseURL: GATEWAY }, fakeFetch(seen, answer));
    expect(listed).toEqual({ ok: true, models: [{ id: 'deepseek-chat' }, { id: 'qwen3-235b' }], source: 'gateway.example.test' });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`${GATEWAY}/models`);
    expect(seen[0].headers.authorization).toBe(`Bearer ${KEY}`);
    // Another address gets nothing, not even a request without the key.
    const other = await service.listModels({ provider: 'compatible', baseURL: 'https://other.example.test/v1' }, fakeFetch(seen, answer));
    expect(other.ok).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it('talks chat completions and has no provider web search', () => {
    const service = new MainLLMService();
    service.setConfig({ provider: 'compatible', model: 'deepseek-chat', baseURL: '' });
    expect(service.sendBlock()).toBe(COMPATIBLE_NO_ADDRESS);
    service.setConfig({ provider: 'compatible', model: 'deepseek-chat', baseURL: GATEWAY });
    expect(service.sendBlock()).toBe('Cloud model has no key for this session.');
    service.setSessionKey('compatible', KEY, GATEWAY);
    expect(service.sendBlock()).toBeNull();
    expect((service.getModel() as { provider: string }).provider).toBe('compatible.chat');
    expect(service.nativeSearchTool()).toBeNull();
    expect(service.keySources().compatible).toBe('session');
  });

  it('is a provider the settings row accepts only with an https address and a model', () => {
    const base = { ...nonSecretDefaults, provider: 'compatible' };
    expect(nonSecretSettingsSchema.safeParse({ ...base, baseURL: GATEWAY, model: 'deepseek-chat' }).success).toBe(true);
    expect(nonSecretSettingsSchema.safeParse({ ...base, baseURL: '', model: 'deepseek-chat' }).success).toBe(false);
    expect(nonSecretSettingsSchema.safeParse({ ...base, baseURL: 'http://gateway.example.test/v1', model: 'x' }).success).toBe(false);
    expect(nonSecretSettingsSchema.safeParse({ ...base, baseURL: GATEWAY, model: '' }).success).toBe(false);
  });
});

describe('your own server', () => {
  it('sends a key only when one was pasted for its address, and says when the server asks for one', async () => {
    const service = new MainLLMService();
    const seen: Seen[] = [];
    const locked = (url: string) => (url.endsWith('/models') ? new Response('{"error":"unauthorized"}', { status: 401 }) : new Response('not found', { status: 404 }));
    expect(await service.listModels({ provider: 'local', baseURL: 'http://127.0.0.1:8000/v1' }, fakeFetch(seen, locked))).toEqual({ ok: false, error: MODEL_LIST_NEEDS_KEY });
    expect(seen.every((request) => request.headers.authorization === undefined)).toBe(true);
    // The person's own server may be http: the key is bound to that origin.
    expect(keyOriginFor('local', 'http://127.0.0.1:8000/v1')).toBe('http://127.0.0.1:8000');
    expect(service.setSessionKey('local', 'vllm-key-123456', 'http://127.0.0.1:8000/v1').held).toBe(true);
    const open = () => json({ data: [{ id: 'Qwen/Qwen3-8B' }] });
    const list = await service.listModels({ provider: 'local', baseURL: 'http://127.0.0.1:8000/v1' }, fakeFetch(seen, open));
    expect(list.ok).toBe(true);
    expect(seen[seen.length - 1].headers.authorization).toBe('Bearer vllm-key-123456');
    // Another server does not get it.
    seen.length = 0;
    await service.listModels({ provider: 'local', baseURL: 'http://127.0.0.1:9000/v1' }, fakeFetch(seen, open));
    expect(seen.every((request) => request.headers.authorization === undefined)).toBe(true);
  });

  it('marks a 401 from your own server without a key as "needs a key", not as a refused key', () => {
    const error = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    expect(refusedForKey(error)).toBe(true);
    expect(refusedForKey(new Error('boom'))).toBe(false);
    expect(classifyTurnError(Object.assign(new Error('Unauthorized'), { statusCode: 401, kind: 'needs-key' })).kind).toBe('needs-key');
  });

  it('offers only chat models: embeddings and the like are left out, by name and by what LM Studio and Ollama say', async () => {
    expect(isLocalChatModel('qwen3:8b')).toBe(true);
    expect(isLocalChatModel('nomic-embed-text:latest')).toBe(false);
    expect(isLocalChatModel('text-embedding-nomic-embed-text-v1.5')).toBe(false);
    expect(isLocalChatModel('bge-m3')).toBe(false);
    expect(isLocalChatModel('multilingual-e5-large')).toBe(false);
    expect(isLocalChatModel('mistral-small3.2:24b')).toBe(true);
    expect([...lmStudioNonChat({ data: [{ id: 'a', type: 'llm' }, { id: 'b', type: 'embeddings' }, { id: 'c', type: 'vlm' }] })]).toEqual(['b']);

    const seen: Seen[] = [];
    const ollama = (url: string, body: string) => {
      if (url.endsWith('/v1/models')) return json({ data: [{ id: 'qwen3:8b' }, { id: 'gemma3:4b' }, { id: 'mystery-embedder:1b' }] });
      if (url.endsWith('/api/tags')) return json({ models: [{ name: 'qwen3:8b', details: { parameter_size: '8.2B', family: 'qwen3' } }, { name: 'gemma3:4b' }, { name: 'mystery-embedder:1b' }] });
      if (url.endsWith('/api/show')) {
        const model = (JSON.parse(body) as { model: string }).model;
        if (model === 'qwen3:8b') return json({ capabilities: ['completion', 'tools', 'thinking'], model_info: { 'qwen3.context_length': 40960 } });
        if (model === 'gemma3:4b') return json({ capabilities: ['completion', 'vision'], model_info: { 'gemma3.context_length': 131072 } });
        return json({ capabilities: ['embedding'] });
      }
      return new Response('not found', { status: 404 });
    };
    const result = await listLocalModels('http://127.0.0.1:11434/v1', fakeFetch(seen, ollama));
    expect(result).toEqual({
      ok: true,
      source: 'http://127.0.0.1:11434',
      models: [
        { id: 'qwen3:8b', detail: '8.2B · qwen3', tools: true, vision: false, thinking: true, contextLength: 40960 },
        { id: 'gemma3:4b', tools: false, vision: true, thinking: false, contextLength: 131072 },
      ],
    });
    expect(parseOllamaShow({ capabilities: ['completion'] })).toEqual({ tools: false, vision: false, thinking: false, chat: true });
  });

  it('knows the window before the first question: Ollama loads the model with an empty request and says it', async () => {
    resetLocalContextMemory();
    const seen: Seen[] = [];
    let loaded = false;
    const server = (url: string) => {
      if (url.endsWith('/api/ps')) return json({ models: loaded ? [{ name: 'qwen3:8b', context_length: 4096 }] : [] });
      if (url.endsWith('/api/generate')) {
        loaded = true;
        return json({ done: true });
      }
      return new Response('not found', { status: 404 });
    };
    expect(await loadAndReadContext('http://127.0.0.1:11434/v1', 'qwen3:8b', fakeFetch(seen, server))).toBe(4096);
    const generate = seen.find((request) => request.url.endsWith('/api/generate'));
    expect(JSON.parse(generate!.body)).toMatchObject({ model: 'qwen3:8b', prompt: '', stream: false });
  });

  it('asks Ollama for a copy of the model with a larger window, on the person\'s click', async () => {
    expect(windowVariantName('qwen3:8b', 16384)).toBe('qwen3:8b-ctx16k');
    expect(windowVariantName('qwen3:8b-ctx8k', 16384)).toBe('qwen3:8b-ctx16k');
    expect(windowVariantName('library/llama3.1', 32768)).toBe('library/llama3.1:ctx32k');
    const seen: Seen[] = [];
    const made = await createWindowVariant('http://127.0.0.1:11434/v1', 'qwen3:8b', 16384, fakeFetch(seen, () => json({ status: 'success' })));
    expect(made).toEqual({ ok: true, model: 'qwen3:8b-ctx16k' });
    expect(seen[0].url).toBe('http://127.0.0.1:11434/api/create');
    expect(JSON.parse(seen[0].body)).toEqual({ model: 'qwen3:8b-ctx16k', from: 'qwen3:8b', parameters: { num_ctx: 16384 }, stream: false });
    const notOllama = await createWindowVariant('http://127.0.0.1:1234/v1', 'some-model', 16384, fakeFetch([], () => new Response('no', { status: 404 })));
    expect(notOllama.ok).toBe(false);
    const service = new MainLLMService();
    expect((await service.makeWindowVariant({ provider: 'openai', model: 'x', baseURL: '' }, 16384)).ok).toBe(false);
  });
});

describe('the proxy', () => {
  it('takes a proxy address without credentials and turns it into a rule', () => {
    expect(proxyRuleFor('http://proxy.example:8080')).toBe('http://proxy.example:8080');
    expect(proxyRuleFor('socks5://10.0.0.2:1080/')).toBe('socks5://10.0.0.2:1080');
    expect(proxyRuleFor('https://proxy.example')).toBe('https://proxy.example:443');
    expect(proxyRuleFor('http://user:secret@proxy.example:8080')).toBeNull();
    expect(proxyRuleFor('ftp://proxy.example:21')).toBeNull();
    expect(proxyRuleFor('proxy.example:8080')).toBeNull();
    expect(proxyAddressValid('')).toBe(true);
    expect(proxyAddressValid('not a proxy')).toBe(false);
    expect(parsePreferences({ network: { proxy: 'http://user:pw@p:1' } }).network.proxy).toBe('');
    expect(parsePreferences({ network: { proxy: 'http://proxy.example:8080' } }).network.proxy).toBe('http://proxy.example:8080');
  });

  it('never sends your own server through a proxy', () => {
    for (const host of ['localhost', '127.0.0.1', '192.168.1.20', '10.1.2.3', '172.20.0.5', '[::1]', 'studio.local']) expect(isPrivateHost(host), host).toBe(true);
    for (const host of ['api.openai.com', '8.8.8.8', '172.32.0.1']) expect(isPrivateHost(host), host).toBe(false);
  });
});

describe('which model and what it costs', () => {
  it('suggests a cheap and a strong model per company from one dated list, and tool-capable local models', () => {
    expect(ADVICE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const provider of ['openai', 'anthropic', 'google'] as const) {
      const advice = CLOUD_ADVICE[provider];
      expect(MODEL_SUGGESTIONS[provider]).toEqual([advice.cheap, advice.strong]);
      expect(priceOf(provider, advice.cheap), advice.cheap).not.toBeNull();
      expect(priceOf(provider, advice.strong), advice.strong).not.toBeNull();
      expect(advice.keyPage.startsWith('https://')).toBe(true);
      expect(advice.dataPolicy.startsWith('https://')).toBe(true);
    }
    expect(MODEL_SUGGESTIONS.local).toEqual(LOCAL_ADVICE.map((item) => item.model));
    expect(TOOL_CAPABLE_EXAMPLES).toEqual(MODEL_SUGGESTIONS.local);
  });

  it('prices a turn by the longest matching model name, and only for a billed provider', () => {
    expect(priceOf('openai', 'gpt-5-mini-2026-01-01')).toEqual({ input: 0.25, output: 2 });
    expect(priceOf('openai', 'gpt-5')).toEqual({ input: 1.25, output: 10 });
    expect(priceOf('compatible', 'gpt-5')).toBeNull();
    expect(costOf('anthropic', 'claude-sonnet-5-5', 1_000_000, 100_000)).toBeCloseTo(3);
    const steps = [{ usage: { inputTokens: 30_000, outputTokens: 200 } }, { usage: { inputTokens: 31_000, outputTokens: 300 } }];
    const usage = turnUsage({ provider: 'openai', model: 'gpt-6-luna' }, steps);
    expect(usage).toMatchObject({ inputTokens: 61_000, outputTokens: 500, billed: true, pricesFrom: ADVICE_DATE });
    expect(usage!.costUsd).toBeCloseTo((61_000 * 0.1 + 500 * 0.5) / 1_000_000);
    expect(turnUsage({ provider: 'local', model: 'qwen3:8b' }, steps)).toMatchObject({ billed: false, costUsd: null });
    expect(turnUsage({ provider: 'openai', model: 'x' }, [{}])).toBeNull();
  });

  it('knows the windows of the current models', () => {
    expect(knownContextTokens('claude-sonnet-5-5')).toBe(1_000_000);
    expect(knownContextTokens('claude-haiku-4-5')).toBe(200_000);
    expect(knownContextTokens('gemini-4-hydrogen')).toBe(1_048_576);
  });
});

describe('failures on the provider side', () => {
  it('names a retired or unknown model', () => {
    const notFound = Object.assign(new Error('The model `gpt-4-32k` does not exist or you do not have access to it.'), { statusCode: 404 });
    expect(classifyTurnError(notFound).kind).toBe('model');
    expect(classifyTurnError(Object.assign(new Error('model "qwen9:1b" not found, try pulling it first'), { statusCode: 404 })).kind).toBe('model');
    expect(classifyTurnError(Object.assign(new Error('{"error":{"code":"model_not_found"}}'), { statusCode: 400 })).kind).toBe('model');
    // A tool refusal stays a tool refusal.
    expect(classifyTurnError(Object.assign(new Error('registry.ollama.ai/library/gemma3:4b does not support tools'), { statusCode: 400 })).kind).toBe('no-tools');
  });

  it('says every new provider sentence in both languages', () => {
    for (const language of ['en', 'ru'] as const) {
      const t = createTranslator(language);
      for (const code of [COMPATIBLE_NO_ADDRESS, MODEL_LIST_NEEDS_KEY, 'Only an Ollama server can make a copy with a larger window.', 'Ollama did not make the copy.']) {
        expect(explainError(t, code).diagnostic, `${language} ${code}`).toBeNull();
      }
      for (const key of ['chat.turnError.model', 'chat.turnError.needs-key', 'providers.whichModel', 'providers.proxyHint', 'settings.providerCompatible', 'preferences.providerDesc.compatible']) {
        expect(t(key), `${language} ${key}`).not.toBe(key);
      }
    }
  });
});

describe('an OpenAI organization and project', () => {
  it('are sent as headers with the model list only when set, and only to OpenAI', async () => {
    const service = new MainLLMService();
    service.setSessionKey('openai', 'sk-openai-key-for-tests-999999');
    const seen: Seen[] = [];
    const answer = () => json({ data: [{ id: 'gpt-6-luna' }] });
    await service.listModels({ provider: 'openai', baseURL: '' }, fakeFetch(seen, answer));
    expect(seen[0].headers['openai-organization']).toBeUndefined();
    service.setOpenAiAccount({ organization: 'org-abc123', project: 'proj_x1' });
    await service.listModels({ provider: 'openai', baseURL: '' }, fakeFetch(seen, answer));
    expect(seen[1].headers['openai-organization']).toBe('org-abc123');
    expect(seen[1].headers['openai-project']).toBe('proj_x1');
    service.setOpenAiAccount({ organization: 'bad value; with spaces' });
    expect(service.openAiAccountHeaders()).toEqual({});
    expect(parsePreferences({ network: { openaiOrganization: 'org abc' } }).network.openaiOrganization).toBe('');
  });
});

describe('what a turn on your own server reports (a labelled fixture server on 127.0.0.1, not a live model)', () => {
  async function withServer(handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void, run: (base: string) => Promise<void>) {
    const http = await import('http');
    const server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      await run(`http://127.0.0.1:${port}/v1`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
  async function collect(service: MainLLMService): Promise<Array<{ type: string; content: any }>> {
    const chunks: Array<{ type: string; content: any }> = [];
    for await (const chunk of service.streamChatWithTools([{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'hello' }], {})) chunks.push(chunk);
    return chunks;
  }

  it('a 401 without a key is "the server asks for a key"', async () => {
    await withServer((req, res) => {
      req.resume();
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":{"message":"Unauthorized"}}');
    }, async (base) => {
      const service = new MainLLMService();
      service.setConfig({ provider: 'local', model: 'm', baseURL: base });
      const chunks = await collect(service).catch((error) => [{ type: 'thrown', content: classifyTurnError(error) }]);
      const kinds = chunks.filter((chunk) => chunk.type === 'error' || chunk.type === 'thrown').map((chunk) => chunk.content?.error?.kind ?? chunk.content?.kind);
      expect(kinds).toContain('needs-key');
    });
  });

  it('an answer cut at the length limit says so, and the turn reports its tokens unbilled', async () => {
    await withServer((req, res) => {
      req.resume();
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (delta: unknown, finish: string | null, usage = false) => `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }], ...(usage ? { usage: { prompt_tokens: 120, completion_tokens: 7, total_tokens: 127 } } : {}) })}\n\n`;
      res.write(chunk({ role: 'assistant', content: 'part of an ans' }, null));
      res.write(chunk({}, 'length', true));
      res.end('data: [DONE]\n\n');
    }, async (base) => {
      const service = new MainLLMService();
      service.setConfig({ provider: 'local', model: 'm', baseURL: base });
      const chunks = await collect(service);
      expect(chunks.find((chunk) => chunk.type === 'notice')?.content).toEqual({ code: 'answer-cut', reason: 'length' });
      expect(chunks.find((chunk) => chunk.type === 'usage')?.content).toMatchObject({ inputTokens: 120, outputTokens: 7, billed: false, costUsd: null });
    });
  });
});

describe('the web search behind a proxy', () => {
  it('takes the proxy-aware fetch only when one is configured, else connects itself as before', async () => {
    const { configureSearchTransport, webSearchTransport } = await import('../../src/main/llmService');
    expect(await webSearchTransport('https://html.duckduckgo.com/html/?q=')).toBeUndefined();
    const proxied = (async () => new Response('')) as typeof fetch;
    configureSearchTransport(async (url) => (url.includes('duckduckgo') ? proxied : undefined));
    expect(await webSearchTransport('https://html.duckduckgo.com/html/?q=')).toBe(proxied);
    configureSearchTransport(async () => { throw new Error('no session'); });
    expect(await webSearchTransport('https://html.duckduckgo.com/html/?q=')).toBeUndefined();
    configureSearchTransport(async () => undefined);
  });
});

describe('the proxy bypass list', () => {
  it('names this computer and the private ranges', async () => {
    const { PROXY_BYPASS } = await import('../../src/shared/config/proxy');
    const parts = PROXY_BYPASS.split(';');
    expect(parts).toContain('<local>');
    expect(parts.filter((part) => /\/\d+$/.test(part))).toHaveLength(5);
  });
});

describe('each model\'s own window and the servers looked for', () => {
  it('reads the window from the Anthropic and Google lists and uses it before the table', async () => {
    const { parseAnthropicList, parseGoogleList } = await import('../../src/main/llm/modelList');
    expect(parseAnthropicList({ data: [{ id: 'claude-new-1', display_name: 'New', max_input_tokens: 500000 }] })).toEqual([{ id: 'claude-new-1', label: 'New', contextLength: 500000 }]);
    expect(parseGoogleList({ models: [{ name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 2000000 }] })).toEqual([{ id: 'gemini-x', contextLength: 2000000 }]);
    const { effectiveContextWindow } = await import('../../src/shared/agent/contextWindow');
    expect(effectiveContextWindow('unknown-model', 0, null, 65536)).toEqual({ tokens: 65536, source: 'known' });
    expect(effectiveContextWindow('unknown-model', 0, 8192, 65536)).toEqual({ tokens: 8192, source: 'server' });
    expect(effectiveContextWindow('unknown-model', 0, null, null)).toEqual({ tokens: 32000, source: 'default' });
  });

  it('remembers the listed window for the next turn of that model', async () => {
    const service = new MainLLMService();
    service.setSessionKey('anthropic', 'anthropic-key-for-tests-777777');
    await service.listModels({ provider: 'anthropic', baseURL: '' }, fakeFetch([], () => json({ data: [{ id: 'claude-new-1', max_input_tokens: 500000 }] })));
    service.setConfig({ provider: 'anthropic', model: 'claude-new-1', baseURL: '' });
    expect(service.listedContextTokens()).toBe(500000);
  });

  it('looks for llama.cpp\'s server too, and names a model\'s window in the picker', async () => {
    const { LOCAL_PROBES } = await import('../../src/main/llm/localDiscovery');
    expect(LOCAL_PROBES.map((probe) => probe.name)).toEqual(['Ollama', 'LM Studio', 'vLLM', 'llama.cpp']);
    const { modelSuggestions } = await import('../../src/renderer/components/settings/sections/pickerItems');
    const t = createTranslator('en');
    expect(modelSuggestions([{ id: 'qwen3:8b', contextLength: 40960, tools: true }], t)[0].detail).toBe('window up to 40,960');
  });
});
