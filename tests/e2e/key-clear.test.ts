import { test, expect, _electron as electron } from '@playwright/test';
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

test('blocked secret IPC clears the field and leaves the fake marker out of sqlite files', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'key-clear-'));
  const app = await electron.launch({
    args: [
      path.join(__dirname, '../../dist/main/index.js'),
      `--user-data-dir=${userData}`,
    ],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  const input = window.locator('input[aria-label="API key"]');
  const secretNote = window.locator('.settings-strip p.provider-note').nth(1);
  await input.waitFor();
  await input.fill(FAKE_MARKER);
  await window.getByRole('button', { name: 'Save key' }).click();
  await secretNote.filter({ hasText: 'secret-storage-blocked. The key was not written.' }).waitFor();
  const field = await input.inputValue();
  console.log(`IPC_DONE note=secret-storage-blocked field_empty=${field === ''}`);
  expect(field).toBe('');
  scanSqlite(userData, 'AFTER_IPC');
  await app.close();
  scanSqlite(userData, 'AFTER_CLOSE');
});
