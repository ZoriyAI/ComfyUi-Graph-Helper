/** Real Electron keyboard, mouse and emulated touch gestures; native serialization and Undo are read back. */
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { useEnglish } from './locale';

const workflow = {
  version: 1, state: { lastNodeId: 1, lastLinkId: 0, lastGroupId: 1 }, links: [],
  nodes: [{ id: 1, type: 'EmptyLatentImage', pos: [200, 200], size: [240, 150], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: [512, 512, 1], inputs: [], outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }] }],
  groups: [{ id: 1, title: 'Frame', bounding: [160, 120, 350, 300], color: '#335' }],
};

test('group frame resize, move, Undo, auto-fit and reload work through the visible controls', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-group-bounds-')); let app: ElectronApplication | undefined;
  try {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
    delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
    app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env: env as Record<string, string> });
    const page = await app.firstWindow(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1000 }); await useEnglish(page);
    const api = (name: string, ...args: unknown[]) => page.evaluate(async ({ name, args }) => (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args), { name, args });
    const head = await api('readProjection', 'desktop');
    expect(await api('commitCommand', { projectId: 'desktop', actionId: 'group-resize-import', expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: workflow } })).toMatchObject({ status: 'applied' });
    await page.reload(); await page.locator('.react-flow__node').waitFor(); await page.keyboard.press('Control+0');
    const snapshot = async () => (await api('readProjection', 'desktop')).snapshot;
    const bounds = async () => (await snapshot()).groups[0].bounding as number[];
    const nodeBefore = (await snapshot()).nodes;
    const resize = page.getByRole('button', { name: 'Resize group Frame', exact: true });
    await expect(resize).toBeVisible(); await resize.focus(); await resize.press('ArrowRight');
    await expect.poll(async () => (await bounds())[2]).toBe(360);
    expect((await snapshot()).nodes).toEqual(nodeBefore);
    await page.keyboard.press('Control+z'); await expect.poll(async () => (await bounds())[2]).toBe(350);
    await resize.click({ trial: true }); // Wait for the animated viewport and Undo projection to settle.
    const box = await resize.boundingBox(); expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 45, box!.y + box!.height / 2 + 30, { steps: 4 }); await page.mouse.up();
    await expect.poll(async () => (await bounds())[2]).toBeGreaterThan(350);
    expect((await snapshot()).nodes).toEqual(nodeBefore);
    const beforeTouch = await bounds(); const touchBox = await resize.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const touch = { x: touchBox!.x + touchBox!.width / 2, y: touchBox!.y + touchBox!.height / 2, radiusX: 2, radiusY: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touch, x: touch.x + 30, y: touch.y + 20 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await bounds())[2]).toBeGreaterThan(beforeTouch[2]);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await cdp.detach();
    const beforeMove = await bounds(); const title = page.locator('[data-group-title="1"]');
    await title.focus(); await title.press('ArrowRight');
    await expect.poll(async () => (await bounds())[0]).toBe(beforeMove[0] + 10);
    expect((await snapshot()).nodes[0].position.x).toBe(nodeBefore[0].position.x + 10);
    const savedBounds = await bounds(); await page.reload();
    await expect(page.locator('[data-group-bounds-mode="manual"]')).toBeVisible();
    expect(await bounds()).toEqual(savedBounds);
    await page.locator('[data-group-title="1"] button').click();
    await page.getByRole('menuitem', { name: 'Fit frame to its nodes', exact: true }).click();
    await expect(page.locator('[data-group-bounds-mode="auto"]')).toBeVisible();
    const exported = await api('exportWorkflowDocument'); expect(exported.ok).toBe(true);
    expect(exported.workflow.groups[0].flags.nodewise_bounds_mode).toBe('auto');
    expect(errors).toEqual([]);
  } finally { await app?.close(); fs.rmSync(profile, { recursive: true, force: true }); }
});
