import { test, expect, _electron as electron } from '@playwright/test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MAIN = path.join(__dirname, '../../dist/main/index.js');

test('typing fetches no dictionary, a second start leaves at once, and the picture cache can be emptied', async () => {
  test.setTimeout(180_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-local-'));
  const app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`], env: { ...process.env, NODE_ENV: 'production' } });
  await app.evaluate(({ session }) => {
    (globalThis as any).__spell = [];
    for (const name of ['spellcheck-dictionary-download-begin', 'spellcheck-dictionary-initialized']) {
      (session.defaultSession as any).on(name, (_event: unknown, language: string) => (globalThis as any).__spell.push(`${name}:${language}`));
    }
  });
  const window = await app.firstWindow();
  await window.locator('#chat-provider').waitFor({ timeout: 90_000 });
  const box = window.locator('textarea:visible:enabled, input[type="text"]:visible:enabled, input[type="search"]:visible:enabled').first();
  await box.click();
  await box.pressSequentially('helo wrld', { delay: 20 });
  await window.waitForTimeout(3000);
  expect(await app.evaluate(() => (globalThis as any).__spell)).toEqual([]);
  const dictionaries = path.join(userData, 'Dictionaries');
  expect(fs.existsSync(dictionaries) ? fs.readdirSync(dictionaries).filter((name) => name.endsWith('.bdic')) : []).toEqual([]);
  // The database is the owner's only.
  expect(fs.statSync(path.join(userData, 'comfyui-desktop.db')).mode & 0o777).toBe(0o600);

  // A second start with the same profile hands over and leaves before writing anything.
  const logFile = path.join(userData, 'logs', 'main.log');
  const before = fs.readFileSync(logFile, 'utf8');
  const electronPath = require('electron') as unknown as string;
  const second = spawnSync(electronPath, [...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), MAIN, `--user-data-dir=${userData}`], { env: { ...process.env, NODE_ENV: 'production' }, timeout: 30_000 });
  expect(second.status).toBe(0);
  expect(fs.readFileSync(logFile, 'utf8')).toBe(before);

  // The picture cache: its size and emptying it.
  const cache = path.join(userData, 'model-previews');
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, 'x.png'), Buffer.alloc(64));
  const size = await window.evaluate(() => (window as any).electronAPI.previewCacheSize());
  expect(size).toEqual({ files: 1, bytes: 64 });
  await window.evaluate(() => (window as any).electronAPI.clearPreviewCache());
  expect(fs.readdirSync(cache)).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
