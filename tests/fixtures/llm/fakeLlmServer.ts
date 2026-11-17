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
 * - "draft a lesson": a draftLesson call whose lesson lacks the words of a step, then (after the refusal) the
 *   corrected lesson, then a sentence: the assistant's lesson draft and its repair in one turn;
 * - anything else: one short sentence.
 *
 * Used by assistant-runs.test.ts (e2e) and lessonDraft.test.ts (unit).
 */
import * as http from 'http';

/** The one model the fake lists in /v1/models, /api/tags and /api/ps. */
export const FAKE_MODEL = 'fixture-model:7b';

/**
 * A running fake. `state.window` is the context size /api/ps reports (a test may change it), `state.bodies` holds
 * every chat request body so a test can read what the app sent.
 */
export interface FakeLlm {
  origin: string;
  state: { window: number; bodies: string[]; loaded: Set<string>; unloaded: string[] };
  close: () => Promise<void>;
}

// The answer to "markdown please": one of each element the chat renders.
const MARKDOWN = [
  '## What KSampler does', '', 'The sampler **removes noise** step by step.', '',
  '- first item', '- second item with `code`', '', '| Field | Value |', '|---|---|', '| steps | 20 |', '',
  '```json', '{ "steps": 20 }', '```', '', 'More: [ComfyUI docs](https://docs.comfy.org/).',
].join('\n');

/** The lesson the fake model drafts: a loader that feeds a sampler (the names of ComfyUI's own nodes). */
const DRAFT_LESSON = () => ({
  id: 'loader-and-sampler',
  texts: {
    en: {
      title: 'A loader and a sampler',
      result: 'A checkpoint that feeds a sampler.',
      steps: {
        intro: { title: 'What we build', body: 'Two nodes: the model and the sampler that uses it.' },
        loader: { title: 'Add the loader', body: 'Add {checkpoint} and choose a model file in `ckpt_name`.' },
        sampler: { title: 'Add the sampler', body: 'Add {sampler}, connect `MODEL` to `model` and set `steps` to 20.' },
      },
    },
  },
  steps: [
    { id: 'intro', read: true },
    { id: 'loader', roles: [{ role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }], fields: [{ role: 'checkpoint', field: 'ckpt_name', test: { kind: 'chosen' } }] },
    { id: 'sampler', roles: [{ role: 'sampler', classes: ['KSampler'] }], links: [{ from: 'checkpoint', output: 'MODEL', to: 'sampler', input: 'model' }], fields: [{ role: 'sampler', field: 'steps', test: { kind: 'between', min: 10, max: 40, prefer: 20 } }] },
  ],
});

/** The text of the last user message; non-text content is turned into JSON so the word tests still work. */
function lastUser(messages: Array<{ role: string; content: unknown }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') {
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content)) return message.content.map(part => part?.type === 'text' ? String(part.text) : JSON.stringify(part)).join('\n');
      return JSON.stringify(message.content);
    }
  }
  return '';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts the fake on a free 127.0.0.1 port; `initialWindow` is the context size it reports at first. */
export async function startFakeLlm(initialWindow = 32768): Promise<FakeLlm> {
  const state = { window: initialWindow, bodies: [] as string[], loaded: new Set([FAKE_MODEL]), unloaded: [] as string[] };
  const server = http.createServer((req, res) => {
    const send = (status: number, type: string, body: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': type, ...headers });
      res.end(body);
    };
    if (req.method === 'GET' && req.url === '/v1/models') return send(200, 'application/json', JSON.stringify({ object: 'list', data: [{ id: FAKE_MODEL, object: 'model' }] }));
    if (req.method === 'GET' && req.url === '/api/tags') return send(200, 'application/json', JSON.stringify({ models: [{ name: FAKE_MODEL, model: FAKE_MODEL, details: { parameter_size: '7B', family: 'fixture' } }] }));
    if (req.method === 'GET' && req.url === '/api/ps') return send(200, 'application/json', JSON.stringify({ models: [...state.loaded].map(name => ({ name, model: name, context_length: state.window })) }));
    if (req.method === 'POST' && req.url === '/api/generate') {
      let request = '';
      req.on('data', chunk => { request += String(chunk); });
      req.on('end', () => {
        const data = JSON.parse(request) as { model: string; keep_alive?: number };
        if (data.keep_alive === 0) { state.loaded.delete(data.model); state.unloaded.push(data.model); }
        else state.loaded.add(data.model);
        send(200, 'application/json', JSON.stringify({ done: true }));
      });
      return;
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return send(404, 'text/plain', 'not found');
    let raw = '';
    req.on('data', (chunk) => { raw += String(chunk); });
    req.on('end', async () => {
      state.bodies.push(raw);
      state.loaded.add(FAKE_MODEL);
      const body = JSON.parse(raw) as { stream?: boolean; messages: Array<{ role: string; content: unknown }> };
      const text = lastUser(body.messages);
      // A rough token count of the request (about 3.3 characters a token), kept under the window so it looks real.
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
      // Only tool results after the last question count: they tell which build step comes next.
      const userAt = body.messages.map((message) => message.role).lastIndexOf('user');
      const results = body.messages.slice(userAt).filter((message) => message.role === 'tool').map((message) => {
        try { return JSON.parse(String(message.content)) as Record<string, unknown>; } catch { return {}; }
      });
      if (/checkpoint recovery/.test(text)) {
        if (/Continue only the unfinished part of this saved task|Review this saved task/.test(text)) return say('Recovery fixture: checked the current graph; the existing node stays.');
        if (!results.length) return toolCall([{ name: 'addNode', args: { nodeType: 'EmptyLatentImage', title: 'Keep this existing node', why: 'Build the first part before the recovery fixture pauses.' } }]);
        return toolCall([{ name: 'setParameter', args: { nodeId: 'fixture-missing-node', key: 'width', value: 768, why: 'Deliberately fail to reach the pause guard.' } }]);
      }
      if (/canvas variants/.test(text)) {
        const graphs = (results[1]?.graphs ?? []) as Array<{ definitionId: string }>;
        const plan: Array<{ name: string; args: () => Record<string, unknown> }> = [
          { name: 'clearCanvas', args: () => ({ why: 'Start over as requested, keeping the previous canvas in history.' }) },
          { name: 'createGraphSet', args: () => ({ graphs: [{ name: 'Variant A' }, { name: 'Variant B' }], why: 'Two independent editable variants.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'EmptyLatentImage', inSubgraph: graphs[0]?.definitionId, parameters: { width: 512, height: 512, batch_size: 1 }, why: 'Set the size in the first graph.' }) },
          { name: 'addNode', args: () => ({ nodeType: 'EmptyLatentImage', inSubgraph: graphs[1]?.definitionId, parameters: { width: 1024, height: 512, batch_size: 1 }, why: 'Use a different size in the second graph.' }) },
          { name: 'configureSubgraph', args: () => ({ definitionId: graphs[0]?.definitionId, name: 'Variant A', description: 'An adjustable first variant.', widgets: [{ nodeId: String(results[2]?.nodeId), name: 'width' }], why: 'Expose width on the outer node.' }) },
        ];
        const step = plan[results.length];
        if (step) { toolCall([{ name: step.name, args: step.args() }]); return; }
        say('Created two editable size studies; they need generation and output nodes before execution.'); return;
      }
      const edit = /edit previous ([a-z0-9-]+) ([a-z0-9-]+)/i.exec(text);
      if (edit) {
        if (!results.length) toolCall([{ name: 'setParameter', args: { inSubgraph: edit[1], nodeId: edit[2], key: 'width', value: 768, why: 'Change the earlier graph as requested.' } }]);
        else say('Updated the existing inner node.');
        return;
      }
      if (/brief delayed answer/.test(text)) { await wait(1200); say('The delayed answer is complete.'); return; }
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
      if (/draft a lesson/.test(text)) {
        const last = results[results.length - 1];
        if (last?.success === true) return say('I drafted the lesson. Keep it or discard it.');
        if (results.length >= 3) return say('I could not draft the lesson.');
        const lesson = DRAFT_LESSON();
        // The first try forgets the words of the last step: the app's refusal names it, and the second try has them.
        if (results.length === 0) delete (lesson.texts.en.steps as Record<string, unknown>).sampler;
        return toolCall([{ name: 'draftLesson', args: { lesson } }]);
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
