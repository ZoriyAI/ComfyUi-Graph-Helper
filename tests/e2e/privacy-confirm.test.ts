import { test, expect, _electron as electron } from '@playwright/test';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

const MAIN = path.join(__dirname, '../../dist/main/index.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_BINARY = require('electron') as unknown as string;

test('Forget all and Clear chat history ask first, say what goes, and are off when there is nothing', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-confirm-'));
  const app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  const window = await app.firstWindow();
  await useEnglish(window);
  await window.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await dialog.getByRole('tab', { name: 'Privacy' }).click();
  const forget = dialog.getByRole('button', { name: 'Forget all keys and tokens' });
  await expect(forget).toBeDisabled();
  await expect(dialog.getByText('No key, token or sign-in is kept here, so there is nothing to forget.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Clear chat history' })).toBeDisabled();
  await expect(dialog.getByText('There is no chat history to clear.')).toBeVisible();

  // A key for this session (fake, never sent: held only) and a server token.
  await window.evaluate(async () => {
    const api = (window as unknown as { electronAPI: { llmSetSessionKey: (p: string, v: string) => Promise<unknown>; mcpSetToken: (v: string, u?: string) => Promise<unknown> } }).electronAPI;
    await api.llmSetSessionKey('google', 'fake-google-key-not-real-000');
    await api.mcpSetToken('fake-token-not-real-000', 'http://127.0.0.1:9/mcp');
  });
  // Coming back to the section reads the new state.
  await dialog.getByRole('tab', { name: 'Assistant' }).click();
  await dialog.getByRole('tab', { name: 'Privacy' }).click();
  await expect(forget).toBeEnabled();
  await forget.click();
  const confirm = window.locator('[role="dialog"].forget-all-dialog');
  await expect(confirm.getByText('model keys: Google')).toBeVisible();
  await expect(confirm.getByText('server access tokens: 1')).toBeVisible();
  // Cancel removes nothing.
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toHaveCount(0);
  const kept = await window.evaluate(() => (window as unknown as { electronAPI: { secretInventory: () => Promise<unknown> } }).electronAPI.secretInventory());
  expect(kept).toEqual({ providers: ['google'], serverTokens: 1, signIns: 0 });
  await forget.click();
  await confirm.getByRole('button', { name: 'Forget', exact: true }).click();
  await expect(dialog.getByText('Removed: model keys: Google; server access tokens: 1.')).toBeVisible();
  await expect(forget).toBeDisabled();
  const gone = await window.evaluate(() => (window as unknown as { electronAPI: { secretInventory: () => Promise<unknown> } }).electronAPI.secretInventory());
  expect(gone).toEqual({ providers: [], serverTokens: 0, signIns: 0 });
  await app.close();
});

test('a second start on the same profile hands over to the first window and exits', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'single-instance-'));
  const app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  const window = await app.firstWindow();
  await window.locator('.app-shell').waitFor({ timeout: 20000 });
  // Xvfb has no window manager, so minimising cannot be observed; the hand-over itself is: the first process hears
  // the second start (the app's handler then restores, shows and focuses its window).
  await app.evaluate(({ app: electronApp }) => {
    electronApp.on('second-instance', () => { (globalThis as { secondSeen?: boolean }).secondSeen = true; });
  });

  // Match Playwright's actual Linux test launch flags, including on non-root Ubuntu runners.
  // Packaged application defaults and BrowserWindow sandbox settings stay untouched.
  const harnessFlags = app.process().spawnargs.includes('--no-sandbox') ? ['--no-sandbox'] : [];
  const second = spawn(ELECTRON_BINARY, [...harnessFlags, MAIN, `--user-data-dir=${userData}`], {
    env: { ...process.env }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  second.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; second.kill(); }, 30_000);
    second.once('error', (error) => { clearTimeout(timer); reject(error); });
    second.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut }); });
  });
  // A signal/crash is a failure, even if the first process received the hand-over.
  expect(result, stderr).toEqual({ code: 0, signal: null, timedOut: false });
  await expect.poll(() => app.evaluate(() => (globalThis as { secondSeen?: boolean }).secondSeen === true)).toBe(true);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await app.close();
});
