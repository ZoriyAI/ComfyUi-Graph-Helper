import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { CLASSES } from '../fixtures/mcp/fakeMcpServer';
import { READ_ROUTE, startFakeComfy, type FakeComfy } from '../fixtures/comfy/fakeComfy';

/**
 * The main path for anyone: a plain ComfyUI and no MCP server. Welcome card → Settings ▸ Connection → "Find on this
 * computer" → "Check ComfyUI" → Save → read → the library fills → a lesson is offered → a restart keeps it all.
 * The ComfyUI is a labelled fixture on 127.0.0.1 (tests/fixtures/comfy/fakeComfy.ts). When port 8188 is taken on
 * this machine, the address is typed instead of found, and the spec says so.
 */
async function launch(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1440, height: 900 });
  return { app, window };
}

test('first run with only a ComfyUI address: find, check, read, library, lesson, restart', async () => {
  test.setTimeout(240_000);
  let fake: FakeComfy;
  let found = true;
  try {
    fake = await startFakeComfy({ manager: true, port: 8188 });
  } catch {
    found = false;
    fake = await startFakeComfy({ manager: true });
    test.info().annotations.push({ type: 'note', description: 'Port 8188 is taken here: the address was typed, not found.' });
  }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-only-'));
  const errors: string[] = [];
  let { app, window } = await launch(userData);
  try {
    window.on('pageerror', (error) => errors.push(error.message));
    await useEnglish(window);

    // The welcome card asks for ComfyUI itself, not for a server next to it.
    const welcome = window.locator('.canvas-empty');
    await expect(welcome.locator('[data-step="connect"]')).toContainText('the address you open it at in the browser');
    await welcome.getByRole('button', { name: 'Connect…' }).click();
    const dialog = window.locator('[role="dialog"].settings-dialog');
    const address = dialog.getByRole('textbox', { name: 'ComfyUI address', exact: true });
    await expect(address).toBeVisible();
    // The MCP server is a second, optional section.
    await expect(dialog.getByRole('region', { name: 'MCP server (optional)' })).toBeVisible();

    if (found) {
      await dialog.getByRole('button', { name: 'Find on this computer', exact: true }).click();
      await expect(dialog.getByText(`ComfyUI answers on this computer: ${fake.url}.`)).toBeVisible({ timeout: 15_000 });
      await expect(address).toHaveValue(fake.url);
    } else {
      await address.fill(fake.url.replace('http://', ''));
    }
    await dialog.getByRole('button', { name: 'Check ComfyUI', exact: true }).click();
    await expect(dialog.getByText('ComfyUI 0.45.0 answers at this address. Save the settings, and the app reads it.')).toBeVisible({ timeout: 15_000 });
    await expect(address).toHaveValue(fake.url);
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    // Step 1 now offers the read; it fills the library.
    const connect = welcome.locator('[data-step="connect"]');
    await connect.getByRole('button', { name: 'Read ComfyUI' }).click();
    const indicator = window.locator('.sync-indicator');
    await expect(indicator).toHaveAttribute('data-sync-state', 'idle', { timeout: 60_000 });
    await expect(connect).toHaveAttribute('data-state', 'done');
    await indicator.click();
    const popover = window.getByRole('dialog', { name: 'Sync' });
    await expect(popover.getByText(`Read from ComfyUI at ${new URL(fake.url).host}.`)).toBeVisible();
    await expect(popover.getByText(/no description files next to models/)).toBeVisible();
    await indicator.click();

    const rail = window.locator('#library-rail');
    await rail.getByRole('tab', { name: 'Nodes' }).click();
    await expect(window.getByText(`${CLASSES.length} nodes`, { exact: true })).toBeVisible();

    // The lessons fit this ComfyUI: none asks to connect first.
    await window.getByRole('tab', { name: 'Assistant' }).click();
    await window.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
    const lessons = window.locator('.lesson-panel');
    await expect(lessons).toBeVisible();
    await expect(lessons.getByText('Connect ComfyUI and read it first')).toHaveCount(0);
    await expect(lessons.locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true })).toBeVisible();

    // Nothing but GETs of the read routes reached ComfyUI.
    for (const hit of fake.hits) expect(hit, hit).toMatch(READ_ROUTE);

    // A restart keeps it all: the library, the welcome card's first step, the indicator.
    await app.close();
    ({ app, window } = await launch(userData));
    window.on('pageerror', (error) => errors.push(error.message));
    await window.locator('.app-shell').waitFor({ timeout: 20_000 });
    await expect(window.locator('.sync-indicator')).toHaveAttribute('data-sync-state', 'idle', { timeout: 20_000 });
    await expect(window.locator('.canvas-empty [data-step="connect"]')).toHaveAttribute('data-state', 'done');
    await expect(window.locator('.canvas-empty [data-step="connect"]')).toContainText(`Read: ${CLASSES.length} node types`);
    // The library rail may come back folded; the catalog behind it is the one read before the restart.
    const counts = await window.evaluate(async () => (await (window as unknown as { electronAPI: { syncStatus: () => Promise<{ counts: { nodeClasses: number }; librarySource?: string } > } }).electronAPI.syncStatus()));
    expect(counts).toMatchObject({ counts: { nodeClasses: CLASSES.length }, librarySource: 'comfy' });
    expect(errors).toEqual([]);
  } finally {
    await app.close().catch(() => undefined);
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
