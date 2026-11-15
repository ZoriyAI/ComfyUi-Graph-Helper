/**
 * E2E spec for Settings > Connection > Sign in against a fake OAuth + MCP server on loopback (labelled fixture, not a
 * real server; tests/fixtures/mcp/fakeOAuthMcp.ts). The system browser is replaced by the test build's stand-in
 * (NODE_ENV=test + NODEWISE_TEST_BROWSER), which GETs the authorization URL and follows its redirect to the app's
 * loopback callback. A person signs in once in their browser and never has to copy a token by hand.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { isReadOnlyCall } from '../../src/main/mcp/readOnly';
import { startFakeOAuthMcp } from '../fixtures/mcp/fakeOAuthMcp';
import { artifact } from './artifacts';

test('signs in to the MCP server through the browser and syncs without a manual token', async () => {
  const fake = await startFakeOAuthMcp({ accessTtlSeconds: 3600 });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-oauth-'));
  const env = { ...process.env, NODE_ENV: 'test', NODEWISE_TEST_BROWSER: 'follow-redirects' } as Record<string, string>;
  // No session bus, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env,
  });
  try {
    const window = await app.firstWindow();
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);

    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    let dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Connection' }).click();
    await dialog.getByRole('textbox', { name: 'MCP server address', exact: true }).fill(fake.mcpUrl);
    await dialog.getByRole('radio', { name: 'Sign in through the browser', exact: true }).check();
    await expect(dialog.getByText('First save the server address with “Save settings” below, then sign in.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toHaveCount(0);

    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    dialog = window.locator('[role="dialog"].settings-dialog');
    await dialog.getByRole('tab', { name: 'Connection' }).click();
    const signIn = dialog.locator('.mcp-sign-in');
    await expect(signIn.getByText('Not signed in.')).toBeVisible();
    await signIn.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(signIn).toHaveAttribute('data-oauth-state', 'authorized', { timeout: 30000 });
    await expect(signIn.getByText(/Signed in until .+\. Stored for this session only/)).toBeVisible();
    await expect(signIn.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(fake.hits).toContain('GET /.well-known/oauth-authorization-server/mcp');
    expect(fake.grants).toEqual(['authorization_code']);
    // The renderer never sees a token: the bridge returns status only.
    const bridged = await window.evaluate(() => (window as unknown as { electronAPI: { mcpOAuthStatus: () => Promise<unknown> } }).electronAPI.mcpOAuthStatus());
    expect(Object.keys(bridged as object).sort()).toEqual(['expiresAt', 'persisted', 'state']);
    await window.screenshot({ path: artifact('mcp-oauth-signed-in.png') }).catch(() => undefined);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    await window.getByRole('menubar').getByRole('menuitem', { name: 'Sync', exact: true }).click();
    await window.getByRole('menuitem', { name: 'Sync now' }).click();
    const indicator = window.locator('.sync-indicator');
    await expect(indicator).toHaveAttribute('data-sync-state', 'idle', { timeout: 30000 });
    await indicator.click();
    const popover = window.getByRole('dialog', { name: 'Sync' });
    const counts = await popover.locator('dd').allInnerTexts();
    // The fresh profile may already list built-in classes; the two fixture classes come on top.
    expect(Number(counts[0])).toBeGreaterThanOrEqual(2);
    expect(fake.toolCalls.map((call) => call.name)).toContain('studio_capabilities');
    await expect(popover.getByText('Not signed in and no MCP token is held', { exact: false })).toHaveCount(0);
    expect(fake.toolCalls.length).toBeGreaterThan(0);
    for (const call of fake.toolCalls) expect(isReadOnlyCall(call.name, call.args), call.name).toBe(true);
  } finally {
    await app.close();
    await fake.close();
  }
});
