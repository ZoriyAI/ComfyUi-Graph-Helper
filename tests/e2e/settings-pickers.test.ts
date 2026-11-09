import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

/**
 * Settings offers lists instead of making the person type: a local OpenAI-compatible server's models
 * (a labelled fixture server on 127.0.0.1, not a discovered environment) and the addresses saved before.
 */
test('the model picker lists what a local server serves and fills the model field', async () => {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'fixture-beta', object: 'model' }, { id: 'fixture-alpha', object: 'model' }] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server has no port');
  const origin = `http://127.0.0.1:${address.port}`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-pickers-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  try {
    const window = await app.firstWindow();
    await window.locator('.app-shell').waitFor();
    await useEnglish(window);
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Assistant' }).click();
    await dialog.getByRole('radio', { name: 'Local endpoint', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Find local servers' })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill(`${origin}/v1`);
    await expect(dialog.getByText(`2 models from ${origin}.`)).toBeVisible({ timeout: 15_000 });
    expect(hits).toContain('GET /v1/models');

    const picker = dialog.getByRole('combobox', { name: 'Models found', exact: true });
    await expect(picker).toBeEnabled();
    await picker.click();
    await expect(window.getByRole('option')).toHaveText(['fixture-alpha', 'fixture-beta']);
    await window.getByRole('option', { name: 'fixture-beta' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-beta');
    await expect(picker).toHaveAttribute('data-value', 'fixture-beta');

    // Typing stays free: an id the server does not list is kept as typed.
    await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('typed-by-hand');
    await expect(picker).toHaveAttribute('data-value', '');

    // Refresh asks the server again.
    const before = hits.filter((hit) => hit === 'GET /v1/models').length;
    await dialog.getByRole('button', { name: 'Refresh list' }).click();
    await expect.poll(() => hits.filter((hit) => hit === 'GET /v1/models').length).toBeGreaterThan(before);

    // A saved Comfy origin comes back as a pick in Connection.
    await dialog.getByRole('tab', { name: 'Connection' }).click();
    await dialog.getByRole('textbox', { name: 'Comfy origin', exact: true }).fill(origin);
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const again = window.locator('[role="dialog"].settings-dialog');
    await again.getByRole('tab', { name: 'Connection' }).click();
    const known = again.getByRole('combobox', { name: 'Known ComfyUI addresses', exact: true });
    await expect(known).toHaveAttribute('data-value', origin);
    await known.click();
    await expect(window.getByRole('option', { name: new RegExp(origin.replace(/[.:/]/g, '\\$&')) })).toContainText('saved in Settings');
    await window.keyboard.press('Escape');
    await expect(again).toBeVisible();
  } finally {
    await app.close();
    server.close();
  }
});
