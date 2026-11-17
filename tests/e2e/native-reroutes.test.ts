/** Native point gestures in a real isolated Electron renderer; graph execution links must stay intact. */
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { useEnglish } from './locale';
import { typedWorkflow } from './fixtures/typedWorkflow';

test('native routing points support mouse, touch, keyboard, menu, Undo and saved reload', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-native-reroutes-')); let app: ElectronApplication | undefined;
  try {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
    delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
    app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env: env as Record<string, string> });
    const page = await app.firstWindow(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1000 }); await useEnglish(page);
    const api = (name: string, ...args: unknown[]) => page.evaluate(async ({ name, args }) => (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args), { name, args });
    const workflow: any = structuredClone(typedWorkflow);
    workflow.nodes[1].pos = [700, 50]; workflow.nodes[2].pos = [700, 420];
    workflow.reroutes = [{ id: 1, pos: [450, 320], linkIds: [2], future: 'kept' }]; workflow.links[0].parentId = 1;
    const head = await api('readProjection', 'desktop');
    expect(await api('commitCommand', { projectId: 'desktop', actionId: 'reroute-import', expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: workflow } })).toMatchObject({ status: 'applied' });
    await page.reload(); await page.locator('.react-flow__node').first().waitFor(); await page.keyboard.press('Control+0');
    const snapshot = async () => (await api('readProjection', 'desktop')).snapshot;
    const points = async () => (await snapshot()).document.raw.reroutes as Array<{ id: number; pos: number[] }>;
    const before = await snapshot();
    const point = page.getByRole('button', { name: 'Routing point 1', exact: true });
    await expect(point).toBeVisible(); await point.focus(); await point.press('ArrowRight');
    await expect.poll(async () => (await points())[0].pos).toEqual([460, 320]);
    await page.keyboard.press('Control+z'); await expect.poll(async () => (await points())[0].pos).toEqual([450, 320]);
    await point.click({ trial: true }); const box = (await point.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 4 }); await page.mouse.up();
    await expect.poll(async () => (await points())[0].pos[0]).toBeGreaterThan(450);
    const beforeTouch = (await points())[0].pos;
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const touchBox = (await point.boundingBox())!;
    const touch = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2, radiusX: 2, radiusY: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touch, x: touch.x + 30, y: touch.y + 20 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await points())[0].pos[0]).toBeGreaterThan(beforeTouch[0]);
    expect((await snapshot()).nodes).toEqual(before.nodes); expect((await snapshot()).edges).toEqual(before.edges);
    const tapBox = (await point.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tapBox.x + tapBox.width / 2, y: tapBox.y + tapBox.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.getByRole('menuitem', { name: 'Remove point, keep links', exact: true }).click();
    await expect.poll(async () => (await points()).length).toBe(0);
    expect((await snapshot()).edges).toHaveLength(1);
    await page.keyboard.press('Control+z'); await expect(point).toBeVisible();
    const edge = page.locator('.react-flow__edge[data-id="link-2"]');
    const edgeTap = await edge.locator('.react-flow__edge-path').evaluate(element => {
      const path = element as SVGPathElement; const p = path.getPointAtLength(path.getTotalLength() * .25);
      const at = p.matrixTransform(path.getScreenCTM()!); return { x: at.x, y: at.y };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [edgeTap] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('menuitem', { name: 'Add routing point', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await cdp.detach();
    // The canvas exposes adjacent links in the Tab order after a node is selected.
    const sourceNode = page.locator('.react-flow__node[data-id="1"]'); await sourceNode.focus(); await sourceNode.press('Enter');
    await expect(edge).toHaveAttribute('tabindex', '0');
    await edge.focus(); await expect(edge).toBeFocused(); await edge.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Add routing point', exact: true }).click();
    await expect.poll(async () => (await points()).length).toBe(2);
    const saved = await points(); await page.reload();
    await expect(page.locator('[data-native-reroute]')).toHaveCount(2); expect(await points()).toEqual(saved);
    const exported = await api('exportWorkflowDocument'); expect(exported.ok).toBe(true);
    expect(exported.workflow.reroutes[0].future).toBe('kept'); expect(exported.workflow.links[0].parentId).toBe(2);
    expect(errors).toEqual([]);
  } finally { await app?.close(); fs.rmSync(profile, { recursive: true, force: true }); }
});
