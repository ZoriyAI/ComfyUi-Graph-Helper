/** Rendered service controls use the real IPC/controller with a labelled injected systemd transport. */
import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { useEnglish } from './locale';

test('service settings: verified actions, confirmation, phone layout and named sync profiles', async () => {
  const root = path.resolve(__dirname, '../..');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-services-'));
  const app = await electron.launch({ args: [path.join(root, 'dist/main/index.js'), `--user-data-dir=${profile}`], env: { ...process.env, NODE_ENV: 'production' } });
  const errors: string[] = [];
  try {
    // Inject before opening Settings. No production-only environment switch or unguarded IPC is introduced.
    await app.evaluate((_electron, rootPath) => {
      const require = process.getBuiltinModule('module').createRequire(`${rootPath}/package.json`);
      const controller = require(`${rootPath}/dist/main/services/systemd.js`).serviceController;
      const state = { active: 'inactive', pid: '0', actions: [] as string[] };
      (globalThis as any).__servicesFixture = state;
      controller.host = 'Fixture workstation';
      controller.run = async (file: string, args: string[]) => {
        if (file !== '/usr/bin/systemctl') throw Error('Privileged command forbidden in fixture');
        if (args.some(arg => ['list-units', 'list-unit-files'].includes(arg))) return { ok: true, stdout: args.includes('--user') ? 'comfyui-mcp-fixture.service enabled' : '' };
        if (args.includes('show')) return { ok: true, stdout: `Id=comfyui-mcp-fixture.service\nLoadState=loaded\nActiveState=${state.active}\nSubState=${state.active === 'active' ? 'running' : 'dead'}\nMainPID=${state.pid}\nMemoryCurrent=268435456\nCanStart=yes\nCanStop=yes\nExecStart=/fixture/reader\n` };
        const action = args.find(arg => ['start', 'stop', 'restart'].includes(arg));
        if (!action) throw Error('Unexpected fixture command');
        state.actions.push(action); state.active = action === 'stop' ? 'inactive' : 'active'; state.pid = action === 'stop' ? '0' : String(Number(state.pid) + 1);
        return { ok: true, stdout: '' };
      };
    }, root);
    const window = await app.firstWindow(); window.on('pageerror', error => errors.push(error.message));
    await window.setViewportSize({ width: 1400, height: 900 });
    await useEnglish(window);
    await window.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = window.locator('.settings-dialog');
    await settings.getByRole('tab', { name: 'Services', exact: true }).click();
    const card = settings.locator('[data-service="user:comfyui-mcp-fixture.service"]');
    await expect(card.getByText('Stopped', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(card.getByText('Process is running', { exact: true })).toBeVisible();
    await expect(settings.getByText('The requested service state is confirmed.')).toBeVisible();
    await card.getByRole('button', { name: 'Restart', exact: true }).click();
    const confirm = window.locator('.service-confirm');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await app.evaluate(() => (globalThis as any).__servicesFixture.actions)).toEqual(['start']);
    await card.getByRole('button', { name: 'Restart', exact: true }).click();
    await confirm.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(settings.getByText('The requested service state is confirmed.')).toBeVisible();
    await window.screenshot({ path: 'test-results/services-desktop.png' });
    await window.setViewportSize({ width: 390, height: 844 });
    await card.getByRole('button', { name: 'Stop', exact: true }).click();
    await confirm.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(card.getByText('Stopped', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
    expect(await card.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
    await window.screenshot({ path: 'test-results/services-phone.png' });
    expect(await app.evaluate(() => (globalThis as any).__servicesFixture.actions)).toEqual(['start', 'restart', 'stop']);
    await settings.getByRole('tab', { name: 'Sync', exact: true }).click();
    const speed = settings.getByRole('combobox', { name: 'Model reading speed' });
    await speed.click();
    await window.getByRole('option', { name: 'Gentle — keep the computer responsive' }).click();
    await expect(settings.getByText('Read small batches with longer pauses.', { exact: false })).toBeVisible();
    await settings.locator('.sync-advanced summary').click();
    await window.screenshot({ path: 'test-results/sync-profiles-phone.png' });
    await settings.getByRole('button', { name: 'Save settings', exact: true }).click();
    const saved = await window.evaluate(() => (window as any).electronAPI.getSettings());
    expect(saved.preferences.sync).toMatchObject({ enrichPerRun: 10, enrichPauseMs: 3000 });
    expect(errors).toEqual([]);
  } finally { await app.close(); fs.rmSync(profile, { recursive: true, force: true }); }
});
