/**
 * E2E spec for what stays on the machine: typing in a field downloads no spellcheck dictionary, the database file is
 * readable by its owner only, a second start with the same profile leaves at once, and the picture cache shows its size
 * and can be emptied. These keep a person's text and files from leaving the computer or being read by other users.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { spawn } from 'child_process';
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
  // The second start gets what the first got, minus Playwright's own hooks (inspector, loader): Playwright adds
  // --no-sandbox to every Electron it starts on Linux, as root or not. Without it, a non-root user whose system does
  // not let Electron build its sandbox (Ubuntu 24.04 runners: unprivileged user namespaces restricted, chrome-sandbox
  // in node_modules not SUID root) aborts with SIGTRAP before the lock is even asked for. The installed app is not
  // affected: the packages install chrome-sandbox SUID root (forge.config.js). Playwright also drops NODE_OPTIONS.
  const harnessFlags = app.process().spawnargs.includes('--no-sandbox') ? ['--no-sandbox'] : [];
  const secondEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' };
  delete secondEnv.NODE_OPTIONS;
  // Asynchronous, so this test process keeps reading the first instance's output pipes meanwhile: a blocked reader
  // would let a full pipe stall the first instance before it answers the hand-over.
  const second = spawn(electronPath, [...harnessFlags, MAIN, `--user-data-dir=${userData}`], { env: secondEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  second.stdout.on('data', (chunk) => { output += chunk.toString(); });
  second.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const started = Date.now();
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; second.kill('SIGKILL'); }, 30_000);
    second.once('error', (error) => { clearTimeout(timer); reject(error); });
    second.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut }); });
  });
  // On failure the message tells a timeout from a crash and carries the second process's own output (the profile is a
  // throw-away folder; the app writes no key or token to its terminal).
  const report = `second start: flags=${JSON.stringify(harnessFlags)} uid=${process.getuid?.()} after ${Date.now() - started} ms\n${output.slice(-4000)}`;
  expect(result, report).toEqual({ code: 0, signal: null, timedOut: false });
  // The first instance keeps running and may add its own lines meanwhile (a window that did not respond, a child
  // process gone, a console line routed to the log; a slow machine makes these likelier). The second start must add
  // none: an instance that went on would write its "[App] Start" and "[App] Paths" lines first (main/index.ts).
  const after = fs.readFileSync(logFile, 'utf8');
  expect(after.startsWith(before)).toBe(true);
  expect(after.slice(before.length)).not.toMatch(/\[App\] (Start|Paths) |\[Database\] Opening /);

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
