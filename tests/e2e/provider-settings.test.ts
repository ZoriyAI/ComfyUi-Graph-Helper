import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ElectronApplication, Page } from '@playwright/test';

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
  return window.locator('dialog.settings-dialog');
}

test('provider, model, and base URL survive an Electron relaunch in the same sqlite file', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-settings-'));
  const appRoot = path.join(__dirname, '../..');
  const app = await launch(userData);
  const window = await app.firstWindow();
  const dialog = await openSettings(window);
  await expect(dialog.getByText('Defaults are shown and are not written yet.')).toBeVisible();

  await dialog.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('openai');
  await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('  fixture-model  ');
  await dialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill(' https://example.test/v1 ');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Non-secret settings saved.')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-model');
  await expect(dialog.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://example.test/v1');

  await dialog.getByRole('textbox', { name: 'Base URL', exact: true }).fill('notaurl');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Settings do not match the schema')).toBeVisible();

  await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill(MARKER);
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Settings cannot store a secret')).toBeVisible();

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
  await expect(again.locator('#chat-provider')).toHaveValue('');
  const restored = await openSettings(again);
  await expect(restored.getByText('Restored non-secret settings.')).toBeVisible();
  await expect(restored.getByRole('combobox', { name: 'Provider', exact: true })).toHaveValue('openai');
  await expect(restored.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue('fixture-model');
  await expect(restored.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://example.test/v1');
  const reread = await settingsRow(reopened, appRoot);
  expect(reread.row).toEqual({ provider: 'openai', model: 'fixture-model', base_url: 'https://example.test/v1' });
  expect(reread.secrets).toBe(0);
  await reopened.close();
});
