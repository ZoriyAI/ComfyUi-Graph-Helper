/**
 * E2E spec for a model on the person's own server that was loaded with a small context window (a labelled fixture
 * server on 127.0.0.1 that speaks like Ollama; not a live model). The connection check in Settings reports the window,
 * a question shows what happened in the chat in plain words, the record of the answer holds the numbers, and the
 * next question goes out with the reduced tool set. A small local model must degrade with an explanation, not fail.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { expectSoundLayout } from './layoutProfile';

const MODEL = 'fixture-small:4b';

function fixtureServer(state: { window: number; bodies: string[]; ps: number; variant: { name: string; window: number } | null }) {
  return http.createServer((req, res) => {
    const send = (status: number, type: string, body: string) => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    if (req.method === 'GET' && req.url === '/v1/models') {
      send(200, 'application/json', JSON.stringify({ object: 'list', data: [{ id: MODEL, object: 'model' }] }));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/tags') {
      send(200, 'application/json', JSON.stringify({ models: [{ name: MODEL, model: MODEL, details: { parameter_size: '4B', family: 'fixture' } }] }));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/ps') {
      state.ps += 1;
      send(200, 'application/json', JSON.stringify({ models: [{ name: MODEL, model: MODEL, context_length: state.window }, ...(state.variant ? [{ name: state.variant.name, context_length: state.variant.window }] : [])] }));
      return;
    }
    if (req.method === 'POST' && ['/api/show', '/api/create', '/api/generate'].includes(req.url ?? '')) {
      let raw = '';
      req.on('data', chunk => { raw += String(chunk); });
      req.on('end', () => {
        const body = JSON.parse(raw || '{}') as { model: string; parameters?: { num_ctx: number } };
        if (req.url === '/api/show') return send(200, 'application/json', JSON.stringify({ model_info: { 'fixture.context_length': 65536 }, capabilities: ['completion', 'tools'] }));
        if (req.url === '/api/create') state.variant = { name: body.model, window: body.parameters!.num_ctx };
        send(200, 'application/json', JSON.stringify(req.url === '/api/create' ? { status: 'success' } : { done: true }));
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = '';
      req.on('data', (chunk) => { body += String(chunk); });
      req.on('end', () => {
        state.bodies.push(body);
        const parsed = JSON.parse(body) as { stream?: boolean };
        // The server counts what it was sent and stops at its window, as a real one does after dropping the rest.
        const read = Math.min(Math.ceil(body.length / 3.3), state.window - 6);
        const usage = { prompt_tokens: read, completion_tokens: 4, total_tokens: read + 4 };
        if (!parsed.stream) {
          send(200, 'application/json', JSON.stringify({
            id: 'c1', object: 'chat.completion', created: 1, model: MODEL,
            choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
            usage,
          }));
          return;
        }
        const chunk = (delta: Record<string, unknown>, finish: string | null, withUsage = false) => `data: ${JSON.stringify({
          id: 'c1', object: 'chat.completion.chunk', created: 1, model: MODEL,
          choices: [{ index: 0, delta, finish_reason: finish }],
          ...(withUsage ? { usage } : {}),
        })}\n\n`;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(chunk({ role: 'assistant', content: 'A fixture answer.' }, null));
        res.write(chunk({}, 'stop', true));
        res.end('data: [DONE]\n\n');
      });
      return;
    }
    send(404, 'text/plain', 'not found');
  });
}

test('a local model with a small context window: Settings, the chat and the log all say so', async () => {
  const state = { window: 4096, bodies: [] as string[], ps: 0, variant: null as { name: string; window: number } | null };
  const server = fixtureServer(state);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server has no port');
  const origin = `http://127.0.0.1:${address.port}`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'local-window-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  try {
    const window = await app.firstWindow();
    await window.locator('.app-shell').waitFor();
    await useEnglish(window);

    // Settings: pick the server and the model it offers, check the connection, read what window it has.
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Assistant' }).click();
    await dialog.getByRole('radio', { name: 'Your own server', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Server address', exact: true }).fill(`${origin}/v1`);
    await expect(dialog.getByText(`1 model from ${origin}.`)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('combobox', { name: 'Models found', exact: true }).click();
    await window.getByRole('option', { name: MODEL }).click();
    await dialog.getByRole('button', { name: 'Test connection' }).click();
    const note = dialog.locator('.context-window-note');
    await expect(note).toHaveAttribute('data-window', '4096', { timeout: 20_000 });
    await expect(note).toContainText('The server allocated 4,096 tokens. The request and tools may not fit.');
    await expect(note).toContainText('Configure conversation capacity automatically below.');
    // The explanation and action must fit the settings panel.
    await note.scrollIntoViewIfNeeded();
    await expectSoundLayout(window, 'settings with the context-window note');
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    // The check already taught the app the window: the first question goes out with the reduced tool set.
    await window.getByRole('tab', { name: 'Assistant' }).click();
    const input = window.locator('textarea[aria-label="Chat message"]');
    await input.fill('What does KSampler do?');
    await input.press('Enter');
    const notice = window.locator('.turn-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    // Even the essential resource tool needs space: the fixture honestly reports truncation at 4k.
    await expect(notice).toHaveAttribute('data-state', 'cut');
    await expect(notice).toContainText('model read only part of the request');
    await expect(notice).toContainText(MODEL);
    await expect(notice).toContainText('4,096');
    await expect(notice.getByRole('button', { name: 'Configure automatically' })).toBeVisible();
    // The model's own words are still shown: the notice explains the answer, it does not replace it.
    await expect(window.getByText('A fixture answer.')).toBeVisible();
    await expect(input).toBeEnabled();
    await expectSoundLayout(window, 'chat with the context-window notice');
    await expect(notice).not.toContainText('systemctl');

    const chat = state.bodies.map((body) => JSON.parse(body) as { stream?: boolean; tools?: Array<{ function: { name: string } }>; messages: Array<{ role: string; content: string }> }).filter((body) => body.stream);
    expect(chat).toHaveLength(1);
    const names = (chat[0].tools ?? []).map((tool) => tool.function.name).sort();
    expect(names).toEqual(['addNode', 'assessResources', 'checkGraph', 'clearCanvas', 'configureSubgraph', 'connectNodes', 'createGraphSet', 'createSubgraph', 'describeNodeType', 'findInstalledModels', 'getGraph', 'insertSubgraph', 'removeNode', 'searchNodeTypes', 'setParameter']);
    expect(chat[0].messages[0].content).toContain('small context window here (4096 tokens)');
    expect(state.ps).toBeGreaterThan(0);

    // The record of this answer holds the numbers a reader needs first.
    await notice.getByRole('button', { name: 'The log of this answer' }).click();
    const log = window.locator('.model-log-dialog');
    await expect(log).toBeVisible();
    const row = log.locator('.model-log-turn').first();
    await expect(row).toContainText('What does KSampler do?');
    await expect(row).toContainText('local model');
    await row.getByRole('button', { name: 'Copy report' }).click();
    await expect(log.locator('.model-log-notice')).toContainText('Report copied');
    const report = await app.evaluate(({ clipboard }) => clipboard.readText());
    // The report follows the language of the interface, which is English in this test.
    expect(report).toContain('context window on the server: 4096');
    expect(report).toContain('THE REQUEST DID NOT FIT');
    expect(report).toContain('compact mode');
    await log.getByRole('button', { name: 'Close' }).click();

    // Apply from the notice: native settings are verified, saved, and the next request uses the new model.
    await notice.getByRole('button', { name: 'Configure automatically' }).click();
    await expect(notice).toContainText('Applied and saved.', { timeout: 20_000 });
    expect(state.variant?.window).toBeGreaterThanOrEqual(16384);
    const savedModel = await window.evaluate(async () => {
      const api = (window as unknown as { electronAPI: { getSettings: () => Promise<{ values: { model: string } }> } }).electronAPI;
      return (await api.getSettings()).values.model;
    });
    expect(savedModel).toBe(state.variant?.name);
    state.window = state.variant!.window;
    if (process.env.NODEWISE_UI_EVIDENCE) await window.screenshot({ path: path.join(process.env.NODEWISE_UI_EVIDENCE, 'context-repaired-chat.png') });
    await input.fill('And the scheduler?');
    await input.press('Enter');
    await expect(window.locator('.message-row[data-role="assistant"]')).toHaveCount(2, { timeout: 30_000 });
    await expect(input).toBeEnabled();
    await expect(window.locator('.turn-notice')).toHaveCount(1);
    const nextRequest = JSON.parse(state.bodies.filter(body => JSON.parse(body).stream).at(-1)!);
    expect(nextRequest.model).toBe(state.variant!.name);
    await expect(window.locator('#chat-provider')).toContainText(state.variant!.name);
  } finally {
    await app.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
