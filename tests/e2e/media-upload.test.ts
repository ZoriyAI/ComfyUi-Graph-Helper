/** One scoped desktop/phone journey for loader file selection, shared values and library group controls. */
import { test, expect, _electron as electron, chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnglish } from './locale';

const picture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
const info = {
  LoadImage: { display_name: 'Load Image', category: 'image', input: { required: { image: [['previous.png'], { image_upload: true }] } }, output: ['IMAGE', 'MASK'] },
  LoadAudio: { display_name: 'Load Audio', category: 'audio', input: { required: { audio: [['previous.wav']] } }, output: ['AUDIO'] },
  KSampler: { display_name: 'KSampler', category: 'sampling', input: { required: { model: ['MODEL'], seed: ['INT', { default: 0 }], steps: ['INT', { default: 20, min: 1, max: 10000 }] } }, output: ['LATENT'] },
};

test('choose media from desktop and phone, retain failed selection, and fold all library groups', async () => {
  test.setTimeout(90_000);
  const uploaded: { name: string; data: Buffer }[] = [];
  const server = createServer((req, res) => { void (async () => {
    if (req.method === 'GET') {
      const value = req.url === '/object_info' ? info : req.url === '/system_stats' ? { system: { comfyui_version: '0.45.0', os: 'posix' }, devices: [] } : req.url === '/models' || req.url === '/experiment/models' ? [] : null;
      res.writeHead(value === null ? 404 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); return;
    }
    if (req.url !== '/upload/image') { res.writeHead(404); res.end(); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type']! } }).formData();
    const file = form.get('image') as File;
    expect(form.get('type')).toBe('input'); expect(form.get('overwrite')).toBe('false');
    uploaded.push({ name: file.name, data: Buffer.from(await file.arrayBuffer()) });
    if (file.name === 'refuse.png') { res.writeHead(500); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: `uploaded-${file.name}`, subfolder: '', type: 'input' }));
  })().catch((error) => { res.writeHead(500); res.end(String(error)); }); });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const allocator = createServer(); await new Promise<void>((done) => allocator.listen(0, '127.0.0.1', done));
  const port = (allocator.address() as { port: number }).port; await new Promise<void>((done) => allocator.close(() => done()));
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-media-'));
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env });
  const browser = await chromium.launch({ channel: 'chromium' });
  const errors: string[] = [];
  const choose = async (page: Page, name: string) => {
    const field = page.locator('.react-flow__node .node-field[data-field="image"]');
    const next = page.waitForEvent('filechooser');
    await field.getByRole('button', { name: 'Choose file…', exact: true }).click();
    await (await next).setFiles({ name, mimeType: 'image/png', buffer: picture });
    return field;
  };
  try {
    const pc = await app.firstWindow(); pc.on('pageerror', (e) => errors.push(e.message));
    await pc.setViewportSize({ width: 1440, height: 900 }); await useEnglish(pc);
    await pc.evaluate(async (comfyOrigin) => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Fresh settings unreadable');
      await window.electronAPI.saveSettings({ ...read.values, comfyOrigin, mcpUrl: '' });
      const status = await window.electronAPI.syncNow(); if (status.state === 'error') throw Error(status.lastError ?? 'Sync failed');
    }, origin);
    const rail = pc.locator('#library-rail'); await rail.getByRole('tab', { name: 'Nodes', exact: true }).click();
    // The three fixture categories plus the app's two editor-node categories.
    await expect(pc.locator('#node-library-list [data-collapsed]')).toHaveCount(5);
    await rail.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await expect(pc.locator('#node-library-list [data-collapsed="true"]')).toHaveCount(5);
    await rail.getByRole('button', { name: 'Expand all', exact: true }).click();
    await expect(pc.locator('#node-library-list [data-collapsed="false"]')).toHaveCount(5);
    const search = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
    await search.fill('LoadImage');
    await pc.locator('#node-library-list').getByRole('option').filter({ hasText: 'Load Image' }).first().dblclick();
    await pc.getByRole('button', { name: 'Fit to view', exact: true }).first().click();
    const field = await choose(pc, 'desktop.png');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-desktop.png');
    expect(uploaded[0]).toEqual({ name: 'desktop.png', data: picture });
    await choose(pc, 'refuse.png');
    await expect(field.getByRole('alert')).toContainText('could not be uploaded');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-desktop.png');
    await pc.evaluate(async (port) => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Settings unreadable');
      await window.electronAPI.saveSettings({ ...read.values, preferences: { browserAccess: { enabled: true, address: '127.0.0.1', port } } });
    }, port);
    await expect.poll(() => pc.evaluate(async () => (await window.electronAPI.browserAccessStatus()).state)).toBe('listening');
    const code = await pc.evaluate(async () => (await window.electronAPI.browserPairingCode()).code);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const host = `http://127.0.0.1:${port}`;
    expect((await context.request.post(`${host}/browser/pair`, { headers: { Origin: host }, data: { code } })).status()).toBe(200);
    const phone = await context.newPage(); phone.on('pageerror', (e) => errors.push(e.message)); await phone.goto(host);
    await phone.getByRole('button', { name: 'Canvas', exact: true }).click();
    await phone.getByRole('button', { name: 'Fit to view', exact: true }).first().click();
    const mobileField = await choose(phone, 'phone.png');
    await expect(mobileField.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-phone.png');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-phone.png');
    await expect(field.getByRole('alert')).toHaveCount(0);
    expect(uploaded[2]).toEqual({ name: 'phone.png', data: picture });
    await phone.screenshot({ path: 'test-results/media-upload-phone.png' });
    await pc.screenshot({ path: 'test-results/media-upload-desktop.png' });
    expect(errors).toEqual([]);
  } finally {
    await browser.close(); await app.close();
    await new Promise<void>((done) => { server.close(() => done()); server.closeAllConnections(); });
    rmSync(profile, { recursive: true, force: true });
  }
});
