/**
 * E2E spec for Settings > Assistant for a person anywhere (a labelled fixture server on 127.0.0.1 that speaks like
 * Ollama; not a live model): the local model list marks a model that cannot call tools, the advice says which model to
 * take, a server that loads the model with a small window offers Ollama's copy with a larger one, an OpenAI-compatible
 * service takes its key only after its https address, a cloud company shows where to get a key and what it costs,
 * and the proxy field refuses an address with a password.
 */
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

type Created = { model: string; from: string; parameters: { num_ctx: number } };

function fixtureServer(state: { window: number; created: Created[] }) {
  return http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    let raw = '';
    req.on('data', (chunk) => { raw += String(chunk); });
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/v1/models') return send(200, { object: 'list', data: [{ id: 'fixture-tools:8b' }, { id: 'fixture-plain:4b' }, { id: 'fixture-embed:1b' }] });
      if (req.method === 'GET' && req.url === '/api/tags') return send(200, { models: [{ name: 'fixture-tools:8b', details: { parameter_size: '8B', family: 'fixture' } }, { name: 'fixture-plain:4b' }, { name: 'fixture-embed:1b' }] });
      if (req.method === 'POST' && req.url === '/api/show') {
        const model = (JSON.parse(raw || '{}') as { model?: string }).model ?? '';
        if (model.startsWith('fixture-tools')) return send(200, { capabilities: ['completion', 'tools'], model_info: { 'fixture.context_length': 40960 } });
        if (model.startsWith('fixture-plain')) return send(200, { capabilities: ['completion'] });
        return send(200, { capabilities: ['embedding'] });
      }
      if (req.method === 'GET' && req.url === '/api/ps') return send(200, { models: [{ name: 'fixture-tools:8b', context_length: state.window }, { name: 'fixture-tools:8b-ctx16k', context_length: 16384 }] });
      if (req.method === 'POST' && req.url === '/api/create') {
        state.created.push(JSON.parse(raw) as Created);
        return send(200, { status: 'success' });
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        return send(200, { id: 'c1', object: 'chat.completion', created: 1, model: 'fixture-tools:8b', choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } });
      }
      return send(404, { error: 'not found' });
    });
  });
}

async function openAssistantSettings(window: Page) {
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await dialog.getByRole('tab', { name: 'Assistant' }).click();
  return dialog;
}

test('Settings ▸ Assistant: model advice, tools marks, a larger window, a compatible service and the proxy', async () => {
  test.setTimeout(180_000);
  const state = { window: 8192, created: [] as Created[] };
  const server = fixtureServer(state);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server has no port');
  const origin = `http://127.0.0.1:${address.port}`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-world-'));
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: { ...process.env, NODE_ENV: 'production' } });
  const errors: string[] = [];
  try {
    const window = await app.firstWindow();
    window.on('pageerror', (error) => errors.push(error.message));
    await window.setViewportSize({ width: 1400, height: 860 });
    await useEnglish(window);
    const dialog = await openAssistantSettings(window);

    // A cloud company: which model, what it costs, where the key and the data rules are.
    await dialog.getByRole('radio', { name: 'OpenAI', exact: true }).click();
    const advice = dialog.locator('.provider-advice[data-provider="openai"]');
    await expect(advice).toContainText('Which model to take');
    await expect(advice).toContainText('Cloud requests cost money');
    await expect(advice.locator('[data-address^="https://"]')).toHaveCount(2);
    await expect(dialog.locator('.provider-sent')).toContainText('field values');
    await expect(dialog.locator('.web-search-paid')).toContainText('per 1000 searches');

    // An OpenAI-compatible service: the key waits for its https address.
    await dialog.getByRole('radio', { name: 'OpenAI-compatible', exact: true }).click();
    const key = dialog.getByRole('textbox', { name: /key/i }).or(dialog.locator('.provider-key input[type="password"]')).first();
    await expect(dialog.locator('.provider-key input[type="password"]')).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Service address' }).fill('https://gateway.example.test/v1');
    await expect(dialog.locator('.provider-key input[type="password"]')).toBeEnabled();
    void key;

    // Your own server: the list marks the model without tools and leaves out the embedding model.
    await dialog.getByRole('radio', { name: 'Your own server', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Server address', exact: true }).fill(`${origin}/v1`);
    await expect(dialog.getByText(/^2 models from/)).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator('.provider-advice[data-provider="local"]')).toContainText('qwen3:8b');
    await expect(dialog.locator('.provider-key input[type="password"]')).toBeEnabled();
    await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('fixture-plain:4b');
    await expect(dialog.getByText('This model cannot call tools; the assistant needs them to read the catalog and build.')).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('fixture-tools:8b');

    // A small window: Ollama's copy with a larger window, chosen in place of the model.
    await dialog.getByRole('button', { name: 'Test connection' }).click();
    await expect(dialog.locator('.context-window-note')).toHaveAttribute('data-window', '8192', { timeout: 20_000 });
    await expect(dialog.locator('.window-help')).toContainText('How to set the window by hand');
    await dialog.getByRole('button', { name: /Make a copy with a 16,384-token window/ }).click();
    await expect(dialog.locator('.window-help')).toContainText('fixture-tools:8b-ctx16k', { timeout: 15_000 });
    expect(state.created).toEqual([{ model: 'fixture-tools:8b-ctx16k', from: 'fixture-tools:8b', parameters: { num_ctx: 16384 }, stream: false }]);
    await expect(dialog.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-tools:8b-ctx16k');

    // The proxy refuses an address with a password, takes a plain one.
    const proxy = dialog.getByRole('textbox', { name: 'Proxy (optional)' });
    await proxy.scrollIntoViewIfNeeded();
    await proxy.fill('http://user:secret@proxy.example:8080');
    await expect(dialog.getByText(/This is not a proxy address/)).toBeVisible();
    await proxy.fill('http://proxy.example:8080');
    await expect(dialog.getByText(/This is not a proxy address/)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
