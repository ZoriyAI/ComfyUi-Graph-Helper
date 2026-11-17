/** Real Electron/SQLite/HTTP loop; the model is an explicit fixture, not an intelligence benchmark. */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { useEnglish } from './locale';
import { startFakeLlm, FAKE_MODEL } from '../fixtures/llm/fakeLlmServer';

test('paused tasks survive app restart; continuation checks the graph and Stop is durable', async () => {
  const llm = await startFakeLlm(); const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-task-recovery-'));
  let app: ElectronApplication | undefined; const errors: string[] = [];
  const api = (page: Page, name: string, ...args: unknown[]) => page.evaluate(async ({ name, args }) => (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args), { name, args });
  const launch = async () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
    delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
    app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env: env as Record<string, string> });
    const page = await app.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 }); await useEnglish(page);
    await page.getByRole('tab', { name: 'Assistant', exact: true }).click(); return page;
  };
  const ask = async (page: Page) => {
    const input = page.locator('textarea[aria-label="Chat message"]'); await input.fill('checkpoint recovery'); await input.press('Enter');
    await expect(page.locator('.turn-checkpoint[data-state="open"]')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => (await api(page, 'loadChatHistory', 'desktop')).filter((row: any) => row.checkpoint?.state === 'open').length).toBe(1);
  };
  try {
    let page = await launch(); const settings = await api(page, 'getSettings');
    expect(await api(page, 'saveSettings', { ...settings.values, provider: 'local', model: FAKE_MODEL, baseURL: `${llm.origin}/v1` })).toMatchObject({ ok: true });
    await page.reload(); await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
    await ask(page); const before = await api(page, 'readProjection', 'desktop');
    expect(before.snapshot.nodes).toHaveLength(1);
    await app!.close(); app = undefined; page = await launch();
    const recovered = page.locator('.turn-checkpoint[data-state="open"]');
    await expect(recovered).toContainText('This task was saved before the app closed');
    await recovered.getByRole('button', { name: 'Check and continue', exact: true }).click();
    await expect(page.getByText('Recovery fixture: checked the current graph; the existing node stays.', { exact: true })).toBeVisible({ timeout: 30000 });
    expect((await api(page, 'readProjection', 'desktop')).snapshot).toEqual(before.snapshot);
    await expect(page.locator('.turn-checkpoint[data-state="continued"]')).toHaveCount(1);
    await ask(page); await page.locator('.turn-checkpoint[data-state="open"] .checkpoint-stop').click();
    await expect.poll(async () => (await api(page, 'loadChatHistory', 'desktop')).filter((row: any) => row.checkpoint?.state === 'stopped').length).toBe(1);
    await app!.close(); app = undefined; page = await launch();
    await expect(page.locator('.turn-checkpoint[data-state="open"]')).toHaveCount(0);
    await expect(page.locator('.turn-checkpoint[data-state="stopped"]')).toHaveCount(1);
    // Same IPC privacy gate as ordinary chat: a paused task cannot bypass opting out of storage.
    expect(await api(page, 'savePreferencesPatch', { privacy: { saveChatHistory: false } })).toMatchObject({ ok: true });
    const stored = await api(page, 'loadChatHistory', 'desktop');
    expect(await api(page, 'saveChatMessage', { ...stored.find((row: any) => row.checkpoint), id: 'privacy-task' })).toMatchObject({ ok: true });
    expect((await api(page, 'loadChatHistory', 'desktop')).some((row: any) => row.id === 'privacy-task')).toBe(false);
    expect(errors).toEqual([]);
  } finally { await app?.close(); await llm.close(); fs.rmSync(profile, { recursive: true, force: true }); }
});
