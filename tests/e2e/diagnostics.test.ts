import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

const FAKE_KEY = 'sk-proj-E2EFAKEKEY0123456789abcd';

test('diagnostics: log file, Help menu copy and open, no key in the report, window state kept', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostics-'));
  const launch = () => electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  let electronApp = await launch();
  let window = await electronApp.firstWindow();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  window.on('pageerror', (error) => pageErrors.push(error.message));
  window.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await useEnglish(window);

  // The main log exists and records the start.
  const logFile = path.join(userData, 'logs', 'main.log');
  await expect.poll(() => fs.existsSync(logFile)).toBe(true);
  expect(fs.readFileSync(logFile, 'utf8')).toContain('[App] Start ComfyUI Graph Helper');

  // A key held this session and a key-shaped renderer error never reach the report or the log.
  await window.evaluate(async (key) => {
    const api = (window as unknown as { electronAPI: { llmSetSessionKey: (v: string) => Promise<unknown>; reportRendererError: (r: unknown) => Promise<unknown> } }).electronAPI;
    await api.llmSetSessionKey(key);
    await api.reportRendererError({ kind: 'error', message: `probe failure ${key}` });
  }, FAKE_KEY);
  const report = await window.evaluate(() => (window as unknown as { electronAPI: { collectDiagnostics: () => Promise<string> } }).electronAPI.collectDiagnostics());
  expect(report).toContain('# ComfyUI Graph Helper diagnostics');
  expect(report).toContain('provider key held: yes');
  expect(report).toContain('[Renderer] error: probe failure');
  expect(report).not.toContain(FAKE_KEY);
  expect(fs.readFileSync(logFile, 'utf8')).not.toContain(FAKE_KEY);

  // Help ▸ Open logs folder reaches shell.openPath with the log folder (stubbed).
  await electronApp.evaluate(({ shell }) => {
    const state = globalThis as unknown as { __opened: string[] };
    state.__opened = [];
    shell.openPath = async (target: string) => {
      state.__opened.push(target);
      return '';
    };
  });
  const bar = window.locator('.document-bar');
  await bar.getByRole('menuitem', { name: 'Help', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Open logs folder' }).click();
  await expect.poll(() => electronApp.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened)).toEqual([path.join(userData, 'logs')]);

  // Help ▸ Copy diagnostics puts the report on the clipboard and says so.
  await bar.getByRole('menuitem', { name: 'Help', exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: 'Copy diagnostics' }).click();
  await expect(window.getByText('Diagnostics copied')).toBeVisible();
  const clipboard = await electronApp.evaluate(({ clipboard }) => clipboard.readText());
  expect(clipboard).toContain('# ComfyUI Graph Helper diagnostics');
  expect(clipboard).not.toContain(FAKE_KEY);

  // Window bounds are remembered across launches.
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 30, width: 1000, height: 700 });
  });
  await window.waitForTimeout(800);
  await electronApp.close();
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'window-state.json'), 'utf8'));
  expect(saved).toMatchObject({ width: 1000, height: 700, maximized: false });

  electronApp = await launch();
  window = await electronApp.firstWindow();
  await window.locator('.app-shell').waitFor({ timeout: 20000 });
  const bounds = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  expect(bounds.width).toBe(1000);
  expect(bounds.height).toBe(700);
  await electronApp.close();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
