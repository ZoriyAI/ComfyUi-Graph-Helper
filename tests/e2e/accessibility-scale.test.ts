/** Real Electron zoom, Russian labels and keyboard focus at 1080p/200% and 4K/100%. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

test('enlarged interface keeps dialogs and keyboard-added nodes reachable', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-a11y-scale-'));
  const fake = await startFakeMcp();
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`, ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : [])], env });
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('.app-shell').waitFor();
    await page.evaluate(async url => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Unreadable settings');
      await window.electronAPI.saveSettings({ ...read.values, language: 'ru', mcpUrl: url, mcpAuth: 'none' });
      await window.electronAPI.syncNow();
    }, fake.url);
    for (const size of [{ width: 1920, height: 1080, scale: 200 }, { width: 3840, height: 2160, scale: 100 }]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), size);
      await page.evaluate(scale => window.electronAPI.savePreferencesPatch({ appearance: { interfaceScale: scale } }), size.scale);
      await page.reload(); await page.locator('.app-shell').waitFor();
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(size.width * 100 / size.scale);
      await expect.poll(() => page.evaluate(() => innerHeight)).toBe(size.height * 100 / size.scale);
      await page.keyboard.press('Control+k');
      const search = page.getByRole('textbox', { name: 'Тип ноды', exact: true });
      await expect(search).toBeFocused(); await search.fill('KSampler');
      await expect(page.locator('#canvas-add-node-results [role="option"]').first()).toContainText('KSampler');
      await search.press('Enter');
      await expect.poll(() => page.evaluate(() => {
        const active = document.activeElement;
        return active?.classList.contains('react-flow__node') && active.getAttribute('aria-label')?.includes('KSampler');
      })).toBe(true).catch(async error => {
        console.log('Focus after add', await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 450),
          dialogs: Array.from(document.querySelectorAll('[role="dialog"], [role="menu"]')).map(e => [e.getAttribute('aria-label'), e.getAttribute('data-state'), e.getBoundingClientRect().width]),
          cards: Array.from(document.querySelectorAll('.react-flow__node')).map(e => ({ id: e.getAttribute('data-id'), cls: e.className })) })));
        throw error;
      });
      await page.keyboard.press('Enter');
      const selected = page.locator('.react-flow__node.selected');
      await expect(selected).toHaveCount(1);
      await expect.poll(() => selected.evaluate(node => {
        const toolbar = document.querySelector('[data-canvas-toolbar]')!.getBoundingClientRect();
        return node.getBoundingClientRect().top >= toolbar.bottom;
      })).toBe(true);
      const capture = async (part: string) => {
        // Electron's compositor capture respects native zoom; the CDP page clip can crop a zoomed window.
        const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
        writeFileSync(`test-results/accessibility-${size.width}-${size.scale}-${part}.png`, Buffer.from(png, 'base64'));
      };
      await capture('canvas');
      await page.keyboard.press('Shift+F10');
      await expect(page.getByRole('menu').last()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await page.keyboard.press('Control+,');
      const dialog = page.locator('.settings-dialog'); await expect(dialog).toBeVisible();
      const geometry = await dialog.evaluate(element => {
        const r = element.getBoundingClientRect();
        return { inside: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
          bodyFits: document.documentElement.scrollWidth <= innerWidth + 1 };
      });
      expect(geometry).toEqual({ inside: true, bodyFits: true });
      for (let i = 0; i < 20; i += 1) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-dialog')))).toBe(true);
      }
      await capture('settings');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
      await page.keyboard.press('Control+z');
    }
    expect(errors).toEqual([]);
  } finally { await app.close(); await fake.close(); rmSync(profile, { recursive: true, force: true }); }
});
