import { test, expect, _electron as electron } from '@playwright/test';
import { useEnglish } from './locale';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const FAKE_MARKER = 'fake-marker-not-a-key';
const SQLITE_NAMES = [
  'comfyui-desktop.db',
  'comfyui-desktop.db-wal',
  'comfyui-desktop.db-shm',
  'comfyui-desktop.db-journal',
];

function scanSqlite(userData: string, phase: string): void {
  const marker = Buffer.from(FAKE_MARKER);
  let sawDatabase = false;
  for (const name of SQLITE_NAMES) {
    const file = path.join(userData, name);
    if (!fs.existsSync(file)) {
      console.log(`SCAN_${phase} ${name} MISSING`);
      continue;
    }
    if (name === 'comfyui-desktop.db') sawDatabase = true;
    const bytes = fs.readFileSync(file);
    const present = bytes.includes(marker);
    console.log(`SCAN_${phase} ${name} bytes=${bytes.length} marker=${present ? 'PRESENT' : 'ABSENT'}`);
    expect(present).toBe(false);
  }
  expect(sawDatabase).toBe(true);
}

test('blocked secret IPC leaves the disabled key controls empty and the marker out of sqlite', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'key-clear-'));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({
    args: [
      path.join(__dirname, '../../dist/main/index.js'),
      `--user-data-dir=${userData}`,
    ],
    env,
  });
  const window = await app.firstWindow();
  await useEnglish(window);
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  // Keys live in Settings ▸ Models & keys (they were on the Connection section).
  await window.locator('[role="dialog"].settings-dialog').getByRole('tab', { name: 'Models & keys' }).click();
  const input = window.locator('input[aria-label="API key"]');
  await expect(input).toBeDisabled();
  await expect(window.getByRole('button', { name: 'Save key' })).toBeDisabled();
  const keyReason = 'Key storage is not available. The key is not written. Cancel does not store a key.';
  await expect(window.getByRole('tabpanel', { name: 'Models & keys' }).getByText(keyReason)).toBeVisible();
  await expect(window.getByRole('contentinfo').getByText(keyReason)).toBeVisible();
  const result = await window.evaluate(async (marker) => {
    const bridge = (window as unknown as { electronAPI: { saveSecret: (value: string) => Promise<{ status: string }> } }).electronAPI;
    return bridge.saveSecret(marker);
  }, FAKE_MARKER);
  expect(result).toEqual({ status: 'secret-storage-blocked' });
  expect(await input.inputValue()).toBe('');
  expect(await input.isDisabled()).toBe(true);
  console.log('IPC_DONE status=secret-storage-blocked field_disabled=true');
  scanSqlite(userData, 'AFTER_IPC');
  await app.close();
  scanSqlite(userData, 'AFTER_CLOSE');
});
