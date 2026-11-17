/**
 * E2E spec for privacy controls that need consent: Forget all and Clear chat history ask first, say what goes, and are
 * off when there is nothing to remove; adult content is turned on only through the content rules and "I am 18 or
 * older", and off at once; a second start on the same profile hands over to the first window and exits.
 * A person must not lose data by one stray click or see adult content without choosing to.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

const MAIN = path.join(__dirname, '../../dist/main/index.js');
// Required, not imported: the electron package's main export is the path of its binary, used to start a second app.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ELECTRON_BINARY = require('electron') as unknown as string;

test('failed secret files give a partial result and a retry removes the remainder', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-partial-'));
  const app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  try {
    const window = await app.firstWindow();
    await useEnglish(window);
    const call = (name: string, args: unknown[] = []) => window.evaluate(({ name, args }) => (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args), { name, args });
    await call('llmSetSessionKey', ['google', 'fixture-google-key']);
    expect(await call('saveSecretFile', ['google'])).toEqual({ status: 'stored' });
    await call('mcpSetToken', ['fixture-token', 'http://127.0.0.1:9/mcp']);
    expect(await call('mcpSaveTokenFile', ['http://127.0.0.1:9/mcp'])).toEqual({ status: 'stored' });
    await app.evaluate((_electron, targets) => {
      const native = process.getBuiltinModule('fs')!;
      const mutable = native as { unlinkSync: typeof native.unlinkSync; openSync: typeof native.openSync };
      const unlink = native.unlinkSync;
      const open = native.openSync;
      const blocked = new Set(targets);
      mutable.unlinkSync = (file) => { if (blocked.has(String(file))) throw Object.assign(new Error('fixture-denied'), { code: 'EACCES' }); return unlink(file); };
      mutable.openSync = (file, flags, mode) => { if (blocked.has(String(file)) && flags !== 'r' && flags !== 0) throw Object.assign(new Error('fixture-denied'), { code: 'EACCES' }); return open(file, flags, mode); };
      (globalThis as unknown as { restoreSecretFs: () => void }).restoreSecretFs = () => { mutable.unlinkSync = unlink; mutable.openSync = open; };
    }, [path.join(userData, 'model-key.json'), path.join(userData, 'mcp-token.json')]);
    expect(await call('forgetSecret', ['google'])).toEqual({ status: 'partial' });
    expect(await call('mcpForgetToken')).toEqual({ status: 'partial' });
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Privacy' }).click();
    const forget = dialog.getByRole('button', { name: 'Forget all keys and tokens' });
    await forget.click();
    const confirm = window.locator('[role="dialog"].forget-all-dialog');
    await confirm.getByRole('button', { name: 'Forget', exact: true }).click();
    await expect(dialog.getByText('Some keys or storage copies remain unverified:', { exact: false })).toBeVisible();
    await expect(forget).toBeEnabled();
    expect(await call('secretInventory')).toEqual({ providers: ['google'], serverTokens: 1, signIns: 0 });
    await app.evaluate(() => (globalThis as unknown as { restoreSecretFs: () => void }).restoreSecretFs());
    await forget.click();
    await confirm.getByRole('button', { name: 'Forget', exact: true }).click();
    await expect(dialog.getByText('Removed: model keys: Google; server access tokens: 1.')).toBeVisible();
    await expect(forget).toBeDisabled();
    expect(await call('secretInventory')).toEqual({ providers: [], serverTokens: 0, signIns: 0 });
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

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

test('adult content is turned on only through the rules and "I am 18 or older", and off at once', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'adult-content-'));
  const app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  const window = await app.firstWindow();
  await useEnglish(window);
  const stored = () => window.evaluate(async () => (window as unknown as {
    electronAPI: { getSettings: () => Promise<{ preferences?: { privacy: { showMarkedPreviews: boolean } } }> };
  }).electronAPI.getSettings().then((read) => read.preferences?.privacy.showMarkedPreviews));
  try {
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Privacy' }).click();
    const adult = dialog.getByRole('switch', { name: 'Adult content (18+)' });
    // Off in a new profile.
    await expect(adult).toHaveAttribute('aria-checked', 'false');
    const confirm = window.locator('[role="dialog"].adult-content-dialog');
    // "Leave it off" changes nothing.
    await adult.click();
    await expect(confirm.getByRole('listitem')).toHaveCount(5);
    await expect(confirm).toContainText('What you make and where you post it is your responsibility');
    await confirm.getByRole('button', { name: 'Leave it off', exact: true }).click();
    await expect(confirm).toHaveCount(0);
    await expect(adult).toHaveAttribute('aria-checked', 'false');
    // The whole page of rules opens from the question, over it, and closes back to it.
    await adult.click();
    await confirm.getByRole('button', { name: 'Read the content rules', exact: true }).click();
    const reader = window.locator('.help-reader-dialog');
    await expect(reader).toHaveAttribute('data-help-page', 'trust/Content-Rules');
    await expect(reader.getByRole('heading', { name: 'Reporting a problem with content' })).toBeVisible();
    await reader.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(reader).toHaveCount(0);
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'I am 18 or older', exact: true }).click();
    await expect(adult).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect.poll(stored).toBe(true);
    // Off asks nothing.
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    await dialog.getByRole('tab', { name: 'Privacy' }).click();
    await adult.click();
    await expect(confirm).toHaveCount(0);
    await expect(adult).toHaveAttribute('aria-checked', 'false');
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect.poll(stored).toBe(false);
  } finally {
    await app.close();
  }
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
