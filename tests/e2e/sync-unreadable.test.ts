/**
 * E2E spec for the report of what a sync could not read, against the fake MCP server on loopback (labelled fixture,
 * not a live server) where one LoRA file closes the connection every time it is asked for. A sync started by hand
 * ends as done (not "Sync failed"), its toast says one file could not be read and opens Settings ▸ Sync, where the
 * row names the file with its folder, says why and what to do; "Try again now" reads it again and says it failed
 * again; "Skip this file" moves it to skipped; "Copy report" copies. Protects the owner's demand: show what is
 * broken and what to do, skip it, read everything else.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

const BROKEN = 'pixel-art-xl.safetensors';

test('a file that breaks the connection is skipped, listed with its reason, retried and skipped on request', async () => {
  const fake = await startFakeMcp({ metadataBreak: { name: BROKEN, mode: 'dropSocket' } });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-unreadable-'));
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  // No session bus, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  try {
    const window = await app.firstWindow();
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    // The MCP address, with "No sign-in": the fake takes connections without credentials.
    const saved = await window.evaluate(async (url) => {
      const api = (window as unknown as {
        electronAPI: { getSettings: () => Promise<{ values?: Record<string, unknown> }>; saveSettings: (input: unknown) => Promise<{ ok: boolean }> };
      }).electronAPI;
      const read = await api.getSettings();
      return api.saveSettings({ ...(read.values ?? {}), mcpUrl: url, mcpAuth: 'none' });
    }, fake.url);
    expect(saved.ok).toBe(true);

    await window.getByRole('menubar').getByRole('menuitem', { name: 'Sync', exact: true }).click();
    await window.getByRole('menuitem', { name: 'Sync now' }).click();
    const indicator = window.locator('.sync-indicator');
    // Done, not failed: the broken file does not stop the sync.
    await expect(indicator).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
    await expect(indicator).not.toHaveAttribute('data-sync-enriching', 'true', { timeout: 30000 });
    const toast = window.getByText('Sync done. Could not be read: 1. See the list.');
    await expect(toast).toBeVisible();
    await window.getByRole('button', { name: 'Show the list' }).click();

    const dialog = window.locator('[role="dialog"].settings-dialog');
    const report = dialog.getByTestId('sync-unreadable');
    await expect(report).toBeVisible();
    await expect(report.getByRole('status').first()).toHaveText(/^Model files read: \d+ of \d+; could not be read: 1; skipped: 0\.$/);
    const row = report.locator('li').filter({ hasText: `“${BROKEN}” in the folder “loras”` });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('The server dropped the connection while reading this file, also on a new connection.');
    await expect(row).toContainText('The file may be damaged');

    // "Try again now": the file is asked again at once, and fails again.
    const before = fake.calls.filter((call) => call.tool === 'model_metadata' && call.args?.name === BROKEN).length;
    await row.getByRole('button', { name: `Try again now: ${BROKEN}` }).click();
    await expect(report.getByText(`“${BROKEN}” could not be read again.`)).toBeVisible();
    expect(fake.calls.filter((call) => call.tool === 'model_metadata' && call.args?.name === BROKEN).length).toBe(before + 1);

    // The cancelled outcome has its own words; source cancellation itself is covered with held reads in unit tests.
    const retryStatus = await window.evaluate(() => (window as unknown as { electronAPI: { syncStatus: () => Promise<unknown> } }).electronAPI.syncStatus());
    await app.evaluate(({ ipcMain }, status) => {
      ipcMain.removeHandler('sync:retry-item');
      ipcMain.handle('sync:retry-item', () => ({ status, outcome: 'cancelled' }));
    }, retryStatus);
    await row.getByRole('button', { name: `Try again now: ${BROKEN}` }).click();
    await expect(report.getByText(`Reading “${BROKEN}” was canceled because the connection or file changed. Try again.`)).toBeVisible();

    // "Skip this file": the row stays, marked skipped, and is no longer counted as a failure.
    await row.getByRole('switch', { name: `Skip this file: ${BROKEN}` }).click();
    await expect(row).toContainText('Skipped: not read until you turn the switch off.');
    await expect(report.getByRole('status').first()).toHaveText(/could not be read: 0; skipped: 1\.$/);
    await expect(row.getByRole('button', { name: `Try again now: ${BROKEN}` })).toHaveCount(0);

    await report.getByRole('button', { name: 'Copy report' }).click();
    await expect(report.getByText('The report is copied.')).toBeVisible();
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
