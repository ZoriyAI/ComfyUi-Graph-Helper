/**
 * E2E spec for an API key when the system has no password store: the secret channel is blocked, the key controls stay
 * disabled and empty, the reason is shown under the key field and in Privacy, and a key-shaped marker sent anyway
 * never reaches the SQLite files of the profile (database, WAL, SHM, journal). A key must never sit in plain text on
 * the person's disk.
 */
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

/** Fails when the marker bytes are in any of the database files; the main database file must exist. */
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
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
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
  // The key lives under the provider choice in Assistant; without a password store nothing can be remembered.
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await dialog.getByRole('tab', { name: 'Assistant' }).click();
  await dialog.getByRole('radio', { name: 'OpenAI', exact: true }).click();
  const input = dialog.getByRole('textbox', { name: 'OpenAI key', exact: true });
  await expect(input).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Remember on this computer' })).toHaveCount(0);
  const keyReason = 'The system keychain is not available on this computer, so keys live only until the app closes.';
  // The note stands under the key field (with a link to Privacy) and in Privacy, never in the dialog's footer.
  const shownNote = dialog.locator('.key-store-note', { hasText: keyReason }).locator('visible=true');
  await expect(shownNote).toHaveCount(1);
  await expect(window.getByRole('contentinfo').getByText(keyReason)).toHaveCount(0);
  await dialog.getByRole('tab', { name: /^Appearance/ }).click();
  await expect(shownNote).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'Privacy' }).click();
  await expect(shownNote).toHaveCount(1);
  await dialog.getByRole('tab', { name: 'Assistant' }).click();
  const result = await window.evaluate(async (marker) => {
    const bridge = (window as unknown as { electronAPI: { saveSecret: (provider: string, value: string) => Promise<{ status: string }> } }).electronAPI;
    return bridge.saveSecret('openai', marker);
  }, FAKE_MARKER);
  expect(result).toEqual({ status: 'secret-storage-blocked' });
  expect(await input.inputValue()).toBe('');
  console.log('IPC_DONE status=secret-storage-blocked field_disabled=true');
  scanSqlite(userData, 'AFTER_IPC');
  await app.close();
  scanSqlite(userData, 'AFTER_CLOSE');
});
