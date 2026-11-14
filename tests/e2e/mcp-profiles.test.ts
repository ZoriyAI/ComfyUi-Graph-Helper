import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeComfy } from '../fixtures/comfy/fakeComfy';
import { startPublicMcp } from '../fixtures/mcp/fakePublicMcp';

/**
 * MCP servers other than the catalog one (labelled fixtures on 127.0.0.1, tests/fixtures/mcp/fakePublicMcp.ts):
 * one the app does not know gets an exact sentence and is never shown as connected; one of a known public kind
 * gives its model list while the nodes come from the ComfyUI address.
 */
async function launch(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(window);
  return { app, window };
}

async function openConnection(window: Page) {
  await window.locator('.canvas-empty').getByRole('button', { name: 'Connect…' }).click();
  return window.locator('[role="dialog"].settings-dialog');
}

const UNKNOWN = 'The app does not know the tools of this MCP server and reads nothing through it. The ComfyUI address above is enough.';

test('an MCP server the app does not know: an exact sentence, never "connected", and the way forward', async () => {
  test.setTimeout(180_000);
  const server = await startPublicMcp('foreign');
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-foreign-'));
  const { app, window } = await launch(userData);
  try {
    const dialog = await openConnection(window);
    const mcp = dialog.getByRole('textbox', { name: 'MCP server URL', exact: true });
    await mcp.fill(server.url);
    await dialog.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(dialog.getByText(UNKNOWN)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    await window.locator('.canvas-empty [data-step="connect"]').getByRole('button', { name: 'Read ComfyUI' }).click();
    const indicator = window.locator('.sync-indicator');
    await expect(indicator).toHaveAttribute('data-sync-state', 'error', { timeout: 60_000 });
    await expect(window.locator('.canvas-empty [data-step="connect"]')).toContainText('the app does not know its tools, so nothing was read from it');
    expect(server.calls.filter((call) => call.method === 'tools/call')).toEqual([]);
  } finally {
    await app.close().catch(() => undefined);
    await server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('a server that lists models only: recognised, its list read, the nodes from ComfyUI', async () => {
  test.setTimeout(180_000);
  const server = await startPublicMcp('modelList');
  const comfy = await startFakeComfy();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-model-list-'));
  const { app, window } = await launch(userData);
  try {
    const dialog = await openConnection(window);
    await dialog.getByRole('textbox', { name: 'ComfyUI address', exact: true }).fill(comfy.url);
    await dialog.getByRole('textbox', { name: 'MCP server URL', exact: true }).fill(server.url);
    await dialog.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(dialog.getByText(/This MCP server lists models only\. The nodes come from the ComfyUI address above\./)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    await window.locator('.canvas-empty [data-step="connect"]').getByRole('button', { name: 'Read ComfyUI' }).click();
    const indicator = window.locator('.sync-indicator');
    await expect(indicator).toHaveAttribute('data-sync-state', 'idle', { timeout: 60_000 });
    await indicator.click();
    await expect(window.getByRole('dialog', { name: 'Sync' }).getByText(`Models read through the MCP server, nodes from ComfyUI at ${new URL(comfy.url).host}.`)).toBeVisible();
    const calls = server.calls.filter((call) => call.method === 'tools/call');
    expect(calls.map((call) => [call.tool, call.args])).toEqual([['list_local_models', { action: 'list' }]]);
  } finally {
    await app.close().catch(() => undefined);
    await server.close();
    await comfy.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
