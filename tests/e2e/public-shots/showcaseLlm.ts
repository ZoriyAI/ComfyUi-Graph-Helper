/**
 * A fake model server for the public screenshots only (never a live model). It speaks the same OpenAI-compatible
 * streaming protocol as tests/fixtures/llm/fakeLlmServer.ts, but answers in the language of the pictures and is
 * driven by the plain questions a person would type, so a screenshot shows a believable conversation instead of
 * test trigger words. Two questions are understood:
 * - a question about what is missing for a picture: three grey drafts (sampler, decoder, save) with a sentence each;
 * - a request to build a picture from text: sixteen build steps (seven nodes, nine links), each with its reason,
 *   then a closing sentence.
 * Anything else gets one short answer. Answers are fixed, so every run of the screenshots is the same.
 * Used only by public.test.ts.
 */
import * as http from 'http';

/** The one model the fake lists; public.test.ts saves it as the assistant model. */
export const SHOWCASE_MODEL = 'fixture-model:7b';

export type ShowcaseLanguage = 'en' | 'ru';

/** The exact questions the screenshot script types; the server recognizes them by their whole text. */
export const SHOWCASE_QUESTIONS: Record<ShowcaseLanguage, { drafts: string; build: string }> = {
  en: { drafts: 'What is missing to get a picture from this graph?', build: 'Build a graph that makes a picture from text, step by step.' },
  ru: { drafts: 'Чего не хватает, чтобы этот граф сделал картинку?', build: 'Собери граф, который делает картинку по тексту, по шагам.' },
};

// Every sentence the fake can say, per language; build steps and draft notes read their `why` and `note` here.
const WORDS: Record<ShowcaseLanguage, Record<string, string>> = {
  en: {
    sampler: 'Turns noise into a picture, guided by both prompts.',
    decoder: 'Turns the finished latent into pixels.',
    save: 'Saves the picture to the ComfyUI output folder.',
    draftsSaid: 'Three nodes are missing: a sampler, a decoder and a save node. I put them on the canvas as grey drafts; accept the ones you want.',
    loader: 'One file holds the model, the text encoder (CLIP) and the VAE.',
    positive: 'The words you want to see in the picture.',
    negative: 'The words you do not want to see.',
    clipPositive: 'The prompt is read through the CLIP of the checkpoint.',
    clipNegative: 'The negative prompt is read the same way.',
    latent: 'An empty canvas of noise: it sets the size of the picture.',
    samplerWhy: 'The picture is made here, step by step.',
    modelLink: 'The sampler needs the model to know what to draw.',
    decoderWhy: 'The sampler works in latent space; the decoder turns it into pixels.',
    saveWhy: 'Keeps the result as a file.',
    positiveLink: 'The sampler follows the prompt.',
    negativeLink: 'And steers away from the negative prompt.',
    latentLink: 'It starts from the empty latent.',
    samplesLink: 'The finished latent goes to the decoder.',
    vaeLink: 'The decoder uses the VAE from the same checkpoint.',
    imageLink: 'The picture goes to the save node.',
    done: 'Done: the graph makes a picture from your prompt. Each step says why it is there.',
    plain: 'The sampler removes noise step by step, following the model and both prompts.',
    titleLoader: 'Model', titlePositive: 'Prompt', titleNegative: 'Negative prompt', titleLatent: 'Picture size',
    titleSampler: 'Sampler', titleDecoder: 'Decoder', titleSave: 'Save',
  },
  ru: {
    sampler: 'Превращает шум в картинку по обоим промптам.',
    decoder: 'Переводит готовый латент в пиксели.',
    save: 'Сохраняет картинку в папку output ComfyUI.',
    draftsSaid: 'Не хватает трёх нод: сэмплера, декодера и сохранения. Я поставил их на холст серыми черновиками; примите те, что нужны.',
    loader: 'В одном файле лежат модель, текстовый энкодер (CLIP) и VAE.',
    positive: 'Слова о том, что должно быть на картинке.',
    negative: 'Слова о том, чего на картинке быть не должно.',
    clipPositive: 'Промпт читается через CLIP из чекпойнта.',
    clipNegative: 'Негативный промпт читается так же.',
    latent: 'Пустой холст из шума: он задаёт размер картинки.',
    samplerWhy: 'Здесь шаг за шагом рождается картинка.',
    modelLink: 'Сэмплеру нужна модель, чтобы знать, что рисовать.',
    decoderWhy: 'Сэмплер работает в латенте; декодер переводит его в пиксели.',
    saveWhy: 'Сохраняет результат файлом.',
    positiveLink: 'Сэмплер следует промпту.',
    negativeLink: 'И уходит от негативного промпта.',
    latentLink: 'Он начинает с пустого латента.',
    samplesLink: 'Готовый латент идёт в декодер.',
    vaeLink: 'Декодер берёт VAE из того же чекпойнта.',
    imageLink: 'Картинка идёт в ноду сохранения.',
    done: 'Готово: граф делает картинку по вашему промпту. У каждого шага написано, зачем он.',
    plain: 'Сэмплер убирает шум шаг за шагом, следуя модели и обоим промптам.',
    titleLoader: 'Модель', titlePositive: 'Промпт', titleNegative: 'Негативный промпт', titleLatent: 'Размер картинки',
    titleSampler: 'Сэмплер', titleDecoder: 'Декодер', titleSave: 'Сохранение',
  },
};

/** A running showcase server: its origin for the app's settings and a way to stop it. */
export interface ShowcaseLlm {
  origin: string;
  close: () => Promise<void>;
}

/** The text of the last user message; non-text content is turned into JSON so a keyword search still works. */
function lastUser(messages: Array<{ role: string; content: unknown }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') return typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  }
  return '';
}

/** Starts the server on a free loopback port. The language decides every word it answers with. */
export async function startShowcaseLlm(language: ShowcaseLanguage): Promise<ShowcaseLlm> {
  const w = WORDS[language];
  const server = http.createServer((req, res) => {
    const send = (status: number, type: string, body: string) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
    const models = [{ id: SHOWCASE_MODEL, object: 'model' }];
    if (req.method === 'GET' && req.url === '/v1/models') return send(200, 'application/json', JSON.stringify({ object: 'list', data: models }));
    if (req.method === 'GET' && req.url === '/api/tags') return send(200, 'application/json', JSON.stringify({ models: [{ name: SHOWCASE_MODEL, model: SHOWCASE_MODEL, details: { parameter_size: '7B', family: 'fixture' } }] }));
    if (req.method === 'GET' && req.url === '/api/ps') return send(200, 'application/json', JSON.stringify({ models: [{ name: SHOWCASE_MODEL, model: SHOWCASE_MODEL, context_length: 32768 }] }));
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return send(404, 'text/plain', 'not found');
    let raw = '';
    req.on('data', (chunk) => { raw += String(chunk); });
    req.on('end', () => {
      const body = JSON.parse(raw) as { stream?: boolean; messages: Array<{ role: string; content: unknown }> };
      const usage = { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 };
      if (!body.stream) return send(200, 'application/json', JSON.stringify({ id: 'c1', object: 'chat.completion', created: 1, model: SHOWCASE_MODEL, choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }], usage }));
      const text = lastUser(body.messages);
      const chunk = (delta: Record<string, unknown>, finish: string | null, withUsage = false) => `data: ${JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: SHOWCASE_MODEL, choices: [{ index: 0, delta, finish_reason: finish }], ...(withUsage ? { usage } : {}) })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      // The app keys a build step by its call id, so every step needs its own (the step number keeps runs repeatable).
      const toolCall = (calls: Array<{ name: string; args: Record<string, unknown> }>, step = 0) => {
        res.write(chunk({ role: 'assistant', content: null, tool_calls: calls.map((call, index) => ({ index, id: `call_${step}_${index}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, null));
        res.write(chunk({}, 'tool_calls', true));
        res.end('data: [DONE]\n\n');
      };
      const say = (words: string) => {
        res.write(chunk({ role: 'assistant', content: words }, null));
        res.write(chunk({}, 'stop', true));
        res.end('data: [DONE]\n\n');
      };
      // Only tool results after the last question count: they tell how far the current answer has got.
      const userAt = body.messages.map((message) => message.role).lastIndexOf('user');
      const results = body.messages.slice(userAt).filter((message) => message.role === 'tool').map((message) => {
        try { return JSON.parse(String(message.content)) as Record<string, unknown>; } catch { return {}; }
      });
      const q = SHOWCASE_QUESTIONS[language];
      if (text.includes(q.build)) {
        const ids = results.map((result) => String(result.nodeId ?? ''));
        // Each step is one tool call; the ids of nodes added earlier come back in the tool results.
        const plan: Array<{ name: string; args: () => Record<string, unknown> }> = [
          { name: 'addNode', args: () => ({ nodeType: 'CheckpointLoaderSimple', title: w.titleLoader, x: 0, y: 220, why: w.loader }) },
          { name: 'addNode', args: () => ({ nodeType: 'CLIPTextEncode', title: w.titlePositive, x: 420, y: 0, why: w.positive }) },
          { name: 'addNode', args: () => ({ nodeType: 'CLIPTextEncode', title: w.titleNegative, x: 420, y: 300, why: w.negative }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-1', targetNodeId: ids[1], targetHandle: 'in-0', why: w.clipPositive }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-1', targetNodeId: ids[2], targetHandle: 'in-0', why: w.clipNegative }) },
          { name: 'addNode', args: () => ({ nodeType: 'EmptyLatentImage', title: w.titleLatent, x: 420, y: 600, why: w.latent }) },
          { name: 'addNode', args: () => ({ nodeType: 'KSampler', title: w.titleSampler, x: 840, y: 220, why: w.samplerWhy }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-0', targetNodeId: ids[6], targetHandle: 'in-0', why: w.modelLink }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[1], sourceHandle: 'out-0', targetNodeId: ids[6], targetHandle: 'in-1', why: w.positiveLink }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[2], sourceHandle: 'out-0', targetNodeId: ids[6], targetHandle: 'in-2', why: w.negativeLink }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[5], sourceHandle: 'out-0', targetNodeId: ids[6], targetHandle: 'in-3', why: w.latentLink }) },
          { name: 'addNode', args: () => ({ nodeType: 'VAEDecode', title: w.titleDecoder, x: 1240, y: 220, why: w.decoderWhy }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[6], sourceHandle: 'out-0', targetNodeId: ids[11], targetHandle: 'in-0', why: w.samplesLink }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[0], sourceHandle: 'out-2', targetNodeId: ids[11], targetHandle: 'in-1', why: w.vaeLink }) },
          { name: 'addNode', args: () => ({ nodeType: 'SaveImage', title: w.titleSave, x: 1600, y: 220, why: w.saveWhy }) },
          { name: 'connectNodes', args: () => ({ sourceNodeId: ids[11], sourceHandle: 'out-0', targetNodeId: ids[14], targetHandle: 'in-0', why: w.imageLink }) },
        ];
        if (results.some((result) => result.success === false) || results.length >= plan.length) return say(w.done);
        const step = plan[results.length];
        return toolCall([{ name: step.name, args: step.args() }], results.length);
      }
      if (text.includes(q.drafts)) {
        if (results.length > 0) return say(w.draftsSaid);
        return toolCall([
          // Staggered, so the drafts' notes (drawn at screen size) never cover each other when the view is zoomed out.
          { name: 'proposeNode', args: { nodeType: 'KSampler', title: w.titleSampler, x: 880, y: 60, note: w.sampler } },
          { name: 'proposeNode', args: { nodeType: 'VAEDecode', title: w.titleDecoder, x: 1360, y: 420, note: w.decoder } },
          { name: 'proposeNode', args: { nodeType: 'SaveImage', title: w.titleSave, x: 1840, y: 60, note: w.save } },
        ]);
      }
      return say(w.plain);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('the showcase model server has no port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
