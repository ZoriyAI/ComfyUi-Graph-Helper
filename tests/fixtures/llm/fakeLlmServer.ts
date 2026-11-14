import * as http from 'http';

/**
 * A fake model server for tests (not a live model): OpenAI-compatible chat completions with streaming, plus the
 * Ollama routes the app reads (/api/tags, /api/ps). What it answers is chosen by words in the person's latest
 * message, so one server covers a plain answer, markdown, a slow stream, every kind of failure, grey drafts and a
 * slow step-by-step build:
 *
 * - "markdown please": headings, lists, a table, code and a link;
 * - "slow answer": 40 words, one every 500 ms;
 * - "error401" / "error429" (Retry-After 20) / "error500" / "drop connection" / "garbage" / "html reply";
 * - "propose nodes": three proposeNode calls (KSampler, VAEDecode, SaveImage at fixed spots), then a sentence;
 * - "build slowly": eight build steps (six addNode, two connectNodes), one per request, 1.2 s apart;
 * - "build and fail": the same, with the third step naming a node that does not exist;
 * - anything else: one short sentence.
 */
export const FAKE_MODEL = 'fixture-model:7b';

export interface FakeLlm {
  origin: string;
  state: { window: number; bodies: string[] };
  close: () => Promise<void>;
}

const MARKDOWN = [
  '## What KSampler does', '', 'The sampler **removes noise** step by step.', '',
  '- first item', '- second item with `code`', '', '| Field | Value |', '|---|---|', '| steps | 20 |', '',
  '```json', '{ "steps": 20 }', '```', '', 'More: [ComfyUI docs](https://docs.comfy.org/).',
].join('\n');

function lastUser(messages: Array<{ role: string; content: unknown }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') return typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  }
  return '';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startFakeLlm(initialWindow = 32768): Promise<FakeLlm> {
  const state = { window: initialWindow, bodies: [] as string[] };
  const server = http.createServer((req, res) => {
    const send = (status: number, type: string, body: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': type, ...headers });
      res.end(body);
    };
    if (req.method === 'GET' && req.url === '/v1/models') return send(200, 'application/json', JSON.stringify({ object: 'list', data: [{ id: FAKE_MODEL, object: 'model' }] }));
    if (req.method === 'GET' && req.url === '/api/tags') return send(200, 'application/json', JSON.stringify({ models: [{ name: FAKE_MODEL, model: FAKE_MODEL, details: { parameter_size: '7B', family: 'fixture' } }] }));
    if (req.method === 'GET' && req.url === '/api/ps') return send(200, 'application/json', JSON.stringify({ models: [{ name: FAKE_MODEL, model: FAKE_MODEL, context_length: state.window }] }));
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return send(404, 'text/plain', 'not found');
    let raw = '';
    req.on('data', (chunk) => { raw += String(chunk); });
    req.on('end', async () => {
      state.bodies.push(raw);
      const body = JSON.parse(raw) as { stream?: boolean; messages: Array<{ role: string; content: unknown }> };
      const text = lastUser(body.messages);
      const usage = { prompt_tokens: Math.min(Math.ceil(raw.length / 3.3), state.window - 6), completion_tokens: 4, total_tokens: 10 };
      if (!body.stream) return send(200, 'application/json', JSON.stringify({ id: 'c1', object: 'chat.completion', created: 1, model: FAKE_MODEL, choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }], usage }));
      if (/error401/.test(text)) return send(401, 'application/json', JSON.stringify({ error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } }));
      if (/error429/.test(text)) return send(429, 'application/json', JSON.stringify({ error: { message: 'Rate limit reached.' } }), { 'retry-after': '20' });
      if (/error500/.test(text)) return send(500, 'application/json', JSON.stringify({ error: { message: 'internal server error' } }));
      if (/drop connection/.test(text)) { req.socket.destroy(); return; }
      if (/html reply/.test(text)) return send(200, 'text/html', '<html><body>Bad gateway</body></html>');
      const chunk = (delta: Record<string, unknown>, finish: string | null, withUsage = false) => `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: FAKE_MODEL, choices: [{ index: 0, delta, finish_reason: finish }], ...(withUsage ? { usage } : {}) })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (/garbage/.test(text)) { res.end('data: {not json at all\n\n'); return; }
      const toolCall = (calls: Array<{ name: string; args: Record<string, unknown> }>) => {
        res.write(chunk({ role: 'assistant', content: null, tool_calls: calls.map((call, index) => ({ index, id: `call_${index}_${Date.now()}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, null));
        res.write(chunk({}, 'tool_calls', true));
        res.end('data: [DONE]\n\n');
      };
      const say = (words: string) => {
        res.write(chunk({ role: 'assistant', content: words }, null));
        res.write(chunk({}, 'stop', true));
        res.end('data: [DONE]\n\n');
      };
      const userAt = body.messages.map((message) => message.role).lastIndexOf('user');
      const results = body.messages.slice(userAt).filter((message) => message.role === 'tool').map((message) => {
        try { return JSON.parse(String(message.content)) as Record<string, unknown>; } catch { return {}; }
      });
      if (/build slowly|build and fail/.test(text)) {
        const ids = results.map((result) => String(result.nodeId ?? ''));
        const fail = /build and fail/.test(text);
        const plan: Array<{ name: string; args: () => Record<string, unknown> }> = [
          { name: 'addNode', args: () => ({ nodeType: 'CheckpointLoaderSimple', title: 'Loader', x: 0, y: 200, why: 'Model, CLIP and VAE in one file.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'CLIPTextEncode', title: 'Description', x: 380, y: 40, why: 'The words you want to see.' }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-1', targetNodeId: fail ? 'missing' : ids[1], targetHandle: 'in-0', why: 'The description reads the CLIP.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'KSampler', title: 'Sampler', x: 780, y: 200, why: 'The picture is made here.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'EmptyLatentImage', title: 'Empty latent', x: 380, y: 500, why: 'The size of the picture.' }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-0', targetNodeId: ids[3], targetHandle: 'in-0', why: 'The sampler needs the model.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'VAEDecode', title: 'Decoder', x: 1160, y: 200, why: 'Latent to pixels.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'SaveImage', title: 'Save', x: 1500, y: 200, why: 'Saves the picture.' }) },
        ];
        await wait(1200);
        const failed = results.find((result) => result.success === false);
        if (failed || results.length >= plan.length) return say(failed ? `Step ${results.length} failed. I stop.` : 'Done: eight steps.');
        const step = plan[results.length];
        return toolCall([{ name: step.name, args: step.args() }]);
      }
      if (/propose nodes/.test(text) && results.length === 0) {
        return toolCall([
          { name: 'proposeNode', args: { nodeType: 'KSampler', title: 'Sampler', x: 420, y: 200, note: 'Turns noise into a picture.' } },
          { name: 'proposeNode', args: { nodeType: 'VAEDecode', title: 'Decoder', x: 800, y: 200, note: 'Latent to pixels.' } },
          { name: 'proposeNode', args: { nodeType: 'SaveImage', title: 'Save', x: 1100, y: 200, note: 'Saves the picture.' } },
        ]);
      }
      if (/propose nodes/.test(text)) return say('I suggested three nodes. Accept or reject them.');
      if (/markdown please/.test(text)) return say(MARKDOWN);
      if (/slow answer/.test(text)) {
        res.write(chunk({ role: 'assistant', content: '' }, null));
        for (let index = 0; index < 40; index += 1) {
          if (res.destroyed) return;
          res.write(chunk({ content: `word${index} ` }, null));
          await wait(500);
        }
        res.write(chunk({}, 'stop', true));
        res.end('data: [DONE]\n\n');
        return;
      }
      return say('A plain answer: the sampler removes noise.');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake model server has no port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
