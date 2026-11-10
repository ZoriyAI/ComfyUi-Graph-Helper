import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ElectronApplication, Page } from '@playwright/test';
import { useEnglish } from './locale';

const MARKER = 'sk-fakemarker';

function launch(userData: string) {
  return electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

async function settingsRow(app: ElectronApplication, appRoot: string) {
  return app.evaluate(async ({ app: electronApp }, { appRoot: root }) => {
    const nodeModule = process.getBuiltinModule('module');
    const nodePath = process.getBuiltinModule('path');
    const Database = nodeModule.createRequire(nodePath.join(root, 'package.json'))('better-sqlite3');
    const db = new Database(nodePath.join(electronApp.getPath('userData'), 'comfyui-desktop.db'), { readonly: true, fileMustExist: true });
    const row = db.prepare('SELECT provider, model, base_url FROM settings WHERE id = 1').get();
    const secrets = db.prepare('SELECT COUNT(*) AS count FROM secret_records').get() as { count: number };
    db.close();
    return { row, secrets: secrets.count };
  }, { appRoot });
}

async function openSettings(window: Page) {
  await window.locator('#chat-provider').waitFor();
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await dialog.getByRole('tab', { name: 'Assistant' }).click();
  return dialog;
}

async function runtimeConfig(window: Page) {
  return window.evaluate(async () => {
    const bridge = (window as unknown as {
      electronAPI: { llmGetConfig: () => Promise<{ provider: string; model: string; baseURL: string }> };
    }).electronAPI;
    return bridge.llmGetConfig();
  });
}

test('stored provider, model, and base URL are what the next send would use after relaunch', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-settings-'));
  const appRoot = path.join(__dirname, '../..');
  const app = await launch(userData);
  const window = await app.firstWindow();
  await window.locator('.app-shell').waitFor();
  await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(window.locator('#chat-provider')).toHaveAttribute('data-value', '');
  await expect.poll(() => runtimeConfig(window)).toEqual({ provider: '', model: '', baseURL: '' });
  await window.getByRole('button', { name: 'Настройки', exact: true }).click();
  const fresh = window.locator('[role="dialog"].settings-dialog');
  await fresh.getByRole('tab', { name: 'Помощник' }).click();
  await expect(fresh.getByText('Настройки по умолчанию, ещё не сохранены.')).toBeVisible();
  await expect(fresh.getByRole('button', { name: 'Сохранить настройки' })).toBeDisabled();
  await fresh.getByRole('button', { name: 'Отмена' }).click();
  await useEnglish(window);
  const dialog = await openSettings(window);
  await expect(dialog.getByText('Settings loaded.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();

  // Provider is a radio-card group in the Preferences window (it was a select).
  await dialog.getByRole('radio', { name: 'OpenAI', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('  fixture-model  ');
  await dialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill(' https://example.test/v1 ');
  await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  await expect(window.locator('#chat-provider')).toHaveAttribute('data-value', 'openai');
  const savedRuntime = { provider: 'openai', model: 'fixture-model', baseURL: 'https://example.test/v1' };
  await expect.poll(() => runtimeConfig(window)).toEqual(savedRuntime);
  const savedDialog = await openSettings(window);
  await expect(savedDialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await expect(savedDialog.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-model');
  await expect(savedDialog.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://example.test/v1');

  await savedDialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill('notaurl');
  await expect(savedDialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await expect(savedDialog.getByText('Check the highlighted fields; the settings cannot be saved without them.')).toBeVisible();
  const schemaReject = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }> } }).electronAPI;
    return bridge.saveSettings({
      theme: 'graphite',
      motion: 'system',
      provider: 'openai',
      model: 'fixture-model',
      baseURL: 'notaurl',
      comfyOrigin: '',
    });
  });
  expect(schemaReject).toEqual({ ok: false, error: 'Settings do not match the schema' });

  await savedDialog.getByRole('textbox', { name: 'Model', exact: true }).fill(MARKER);
  await expect(savedDialog.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await expect(savedDialog.getByText('Settings cannot store a secret')).toBeVisible();
  const secretReject = await window.evaluate(async (marker) => {
    const bridge = (window as unknown as { electronAPI: { saveSettings: (input: unknown) => Promise<{ ok: boolean; error?: string }> } }).electronAPI;
    return bridge.saveSettings({
      theme: 'graphite',
      motion: 'system',
      provider: 'openai',
      model: marker,
      baseURL: 'notaurl',
      comfyOrigin: '',
    });
  }, MARKER);
  expect(secretReject).toEqual({ ok: false, error: 'Settings cannot store a secret' });
  await expect(window.locator('#chat-provider')).toHaveAttribute('data-value', 'openai');
  await expect.poll(() => runtimeConfig(window)).toEqual(savedRuntime);

  const stored = await settingsRow(app, appRoot);
  expect(stored.row).toEqual({ provider: 'openai', model: 'fixture-model', base_url: 'https://example.test/v1' });
  expect(stored.secrets).toBe(0);
  await app.close();

  for (const name of ['comfyui-desktop.db', 'comfyui-desktop.db-wal', 'comfyui-desktop.db-shm', 'comfyui-desktop.db-journal']) {
    const file = path.join(userData, name);
    if (!fs.existsSync(file)) continue;
    expect(fs.readFileSync(file).includes(Buffer.from(MARKER))).toBe(false);
  }

  const reopened = await launch(userData);
  const again = await reopened.firstWindow();
  await expect.poll(() => runtimeConfig(again)).toEqual(savedRuntime);
  await expect(again.locator('#chat-provider')).toHaveAttribute('data-value', 'openai');
  const restored = await openSettings(again);
  await expect(restored.getByText('Settings loaded.')).toBeVisible();
  await expect(restored.getByRole('radio', { name: 'OpenAI', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(restored.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-model');
  await expect(restored.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://example.test/v1');
  const reread = await settingsRow(reopened, appRoot);
  expect(reread.row).toEqual({ provider: 'openai', model: 'fixture-model', base_url: 'https://example.test/v1' });
  expect(reread.secrets).toBe(0);

  await restored.getByRole('radio', { name: 'TEST fixture', exact: true }).click();
  await restored.getByRole('textbox', { name: 'Model', exact: true }).fill('test-fixture');
  await restored.getByRole('textbox', { name: 'Base URL', exact: true }).fill('https://fixture.example/v1');
  await restored.getByRole('button', { name: 'Save settings' }).click();
  await expect(restored).toHaveCount(0);
  await expect.poll(async () => again.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  await expect(again.locator('#chat-provider')).toHaveAttribute('data-value', 'test');
  await expect.poll(() => runtimeConfig(again)).toEqual({
    provider: 'test',
    model: 'test-fixture',
    baseURL: 'https://fixture.example/v1',
  });
  await again.getByRole('tab', { name: 'Assistant' }).click();
  await expect(again.getByRole('textbox', { name: 'Chat message' })).toHaveValue('');
  await reopened.close();
});

test('a key pasted for one provider belongs to that provider only', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-keys-'));
  const app = await launch(userData);
  const window = await app.firstWindow();
  await window.locator('.app-shell').waitFor();
  await useEnglish(window);
  const dialog = await openSettings(window);
  await dialog.getByRole('radio', { name: 'Anthropic', exact: true }).click();
  // An https address nobody answers at: the key cannot be checked, so it is kept and nothing reaches a provider.
  await dialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill('https://127.0.0.1:9/v1');
  await dialog.getByRole('textbox', { name: 'Anthropic key', exact: true }).fill(MARKER);
  await expect(dialog.getByRole('status', { name: 'Anthropic key' })).toHaveText('The key is kept until restart.', { timeout: 20000 });
  await expect(dialog.getByText(/^The key could not be checked:/)).toBeVisible();

  // Only the Anthropic card claims a key; OpenAI and Google say they have none.
  await expect(dialog.getByRole('radio', { name: 'Anthropic', exact: true })).toContainText('Key for this session');
  await expect(dialog.getByRole('radio', { name: 'OpenAI', exact: true })).toContainText('No key');
  await expect(dialog.getByRole('radio', { name: 'Google Gemini', exact: true })).toContainText('No key');
  const status = await window.evaluate(() => (window as unknown as {
    electronAPI: { llmSessionStatus: () => Promise<{ providers: Record<string, string> }> };
  }).electronAPI.llmSessionStatus());
  expect(status.providers).toEqual({ openai: 'none', anthropic: 'session', google: 'none' });

  // The OpenAI panel is OpenAI's: no key there, and a check of OpenAI stops in main.
  await dialog.getByRole('radio', { name: 'OpenAI', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'OpenAI key', exact: true })).toHaveValue('');
  await expect(dialog.getByRole('status', { name: 'OpenAI key' })).toHaveText('No key.');
  const probe = await window.evaluate(() => (window as unknown as {
    electronAPI: { llmProbe: (draft: { provider: string; model: string; baseURL: string }) => Promise<{ ok: boolean; error?: string }> };
  }).electronAPI.llmProbe({ provider: 'openai', model: 'gpt-5', baseURL: '' }));
  expect(probe).toMatchObject({ ok: false, error: 'Cloud model has no key for this session.' });

  // Privacy lists a row per provider that has a key, and "Forget all" clears every one.
  await dialog.getByRole('tab', { name: 'Privacy' }).click();
  await expect(dialog.getByRole('rowheader', { name: 'Anthropic key' })).toBeVisible();
  await expect(dialog.getByRole('rowheader', { name: 'OpenAI key' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Forget all keys and tokens' }).click();
  await expect(dialog.getByRole('rowheader', { name: 'Anthropic key' })).toHaveCount(0);
  await expect(dialog.getByRole('rowheader', { name: 'Model key' })).toBeVisible();
  const cleared = await window.evaluate(() => (window as unknown as {
    electronAPI: { llmSessionStatus: () => Promise<{ providers: Record<string, string> }> };
  }).electronAPI.llmSessionStatus());
  expect(cleared.providers).toEqual({ openai: 'none', anthropic: 'none', google: 'none' });
  await app.close();
});
