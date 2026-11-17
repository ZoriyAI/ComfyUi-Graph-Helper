/** The About button exports the exact public build catalogue, without the isolated user's graph. */
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnglish } from './locale';

test('exports the public product catalogue and opens the measured memory explanation', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-product-export-'));
  const destination = join(profile, 'public-product.json');
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`, ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : [])], env });
  try {
    const page = await app.firstWindow(); await useEnglish(page);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(async () => {
      const head = await window.electronAPI.readProjection('desktop'); if (!head) throw Error('No project');
      await window.electronAPI.commitCommand({ projectId: 'desktop', actionId: 'private-note', expectedRevisionId: head.currentRevisionId,
        actor: 'manual', runId: null, payload: { type: 'import-workflow', document: { version: 0.4, last_node_id: 1, last_link_id: 0,
          links: [], groups: [], extra: {}, config: {}, nodes: [{ id: 1, type: 'Note', pos: [0, 0], size: [240, 120], flags: {}, order: 0,
            mode: 0, properties: {}, widgets_values: ['PRIVATE-PRODUCT-EXPORT-SENTINEL'] }] } } });
    });
    await app.evaluate(({ session }, file) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(file)); }, destination);
    await page.keyboard.press('Control+,');
    const settings = page.locator('.settings-dialog'); await settings.getByRole('tab', { name: 'About', exact: true }).click();
    await settings.getByRole('button', { name: 'Export public product catalogue', exact: true }).click();
    await expect.poll(() => {
      try { return existsSync(destination) && Boolean(JSON.parse(readFileSync(destination, 'utf8')).sha256); } catch { return false; }
    }).toBe(true);
    const text = readFileSync(destination, 'utf8'), manifest = JSON.parse(text);
    expect(text).not.toContain('PRIVATE-PRODUCT-EXPORT-SENTINEL'); expect(text).not.toContain(profile);
    expect(manifest.sha256).toBe(createHash('sha256').update(JSON.stringify(manifest.payload)).digest('hex'));
    expect(manifest.payload.lessons).toHaveLength(95); expect(manifest.payload.guides).toHaveLength(50);
    expect(text).toBe(readFileSync(join(__dirname, '../../dist/product-manifest.json'), 'utf8'));
    await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0);
    await page.keyboard.press('Control+Shift+c');
    await page.getByRole('button', { name: 'How to plan memory: a measured example' }).click();
    const help = page.getByRole('dialog'); await expect(help).toContainText('5537'); await expect(help).toContainText('Graphics card memory');
    expect(errors).toEqual([]);
  } finally { await app.close(); rmSync(profile, { recursive: true, force: true }); }
});
