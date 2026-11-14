import { test, expect, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * Editing on the canvas with the mouse and the keyboard, in Russian (the default), in the real app:
 * - several nodes deleted, dragged or nudged are one history step (one Ctrl+Z brings them back);
 * - copy, paste and duplicate: new nodes, offset, inner links kept, the result selected;
 * - a new node is selected and in view;
 * - a link dropped on empty canvas offers only nodes that fit and connects the chosen one; a wrong drop says why;
 * - a group moves with its nodes; Shift+click adds to the selection; nodes can be pinned;
 * - the minimap and the arrow keys move the view.
 * Shots go to CANVAS_EDITING_SHOTS when set.
 */

type Bridge = (name: string, args?: unknown[]) => Promise<any>;
interface Ctx { app: ElectronApplication; page: Page; api: Bridge; errors: string[] }
const SHOTS = process.env.CANVAS_EDITING_SHOTS ?? '';

async function launch(fake: FakeMcp): Promise<Ctx> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-editing-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.app-shell').waitFor({ timeout: 30_000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  const api: Bridge = (name, args = []) => page.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  const read = await api('getSettings') as { values?: Record<string, unknown> };
  expect(await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 30_000 });
  await api('syncNow').catch(() => undefined);
  await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 120_000 }).toBe('idle');
  return { app, page, api, errors };
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

let action = 0;
async function commit(ctx: Ctx, payload: Record<string, unknown>) {
  const current = await ctx.api('readProjection', ['desktop']) as { currentRevisionId: string };
  action += 1;
  const result = await ctx.api('commitCommand', [{ projectId: 'desktop', actionId: `canvas-editing-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]);
  expect(result.status, JSON.stringify(payload)).toBe('applied');
}

async function reload(ctx: Ctx) {
  await ctx.page.reload();
  await ctx.page.locator('.app-shell').waitFor({ timeout: 30_000 });
  await ctx.page.waitForTimeout(800);
}

const snap = async (ctx: Ctx) => (await ctx.api('readProjection', ['desktop'])).snapshot as { nodes: Array<{ id: string; position: { x: number; y: number }; data: { comfyType: string } }>; edges: Array<{ source: string; target: string }> };
const revSeq = async (ctx: Ctx) => (await ctx.api('readProjection', ['desktop'])).revSeq as number;
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const title = (page: Page, id: string) => node(page, id).locator('.graph-node-title');
/** Clears the selection with a click on empty canvas (bottom left, away from the toolbar and the nodes). */
async function clearSelection(page: Page) {
  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.click(pane.x + 12, pane.y + pane.height - 60);
}
const selected = (page: Page) => page.locator('.react-flow__node.selected').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')).sort());

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
}

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(from.x + ((to.x - from.x) * step) / 10, from.y + ((to.y - from.y) * step) / 10);
  await page.mouse.up();
}

async function undoOnce(ctx: Ctx) {
  const before = await revSeq(ctx);
  await blur(ctx.page);
  await ctx.page.keyboard.press('Control+z');
  await expect.poll(() => revSeq(ctx)).toBe(before + 1);
  // The nodes glide back to their places; clicks after that land where the nodes are.
  await ctx.page.waitForTimeout(900);
}

test('editing on the canvas: one step per action, copy and paste, link guidance, groups, pin, view', async () => {
  test.setTimeout(900_000);
  const fake = await startFakeMcp({ video: true });
  const ctx = await launch(fake);
  const { page } = ctx;
  try {
    const add = (nodeType: string, x: number, y: number) => commit(ctx, { type: 'add-node', nodeType, x, y });
    await add('CheckpointLoaderSimple', 0, 0); // 1
    await add('CLIPTextEncode', 420, 0); // 2
    await add('KSampler', 840, 0); // 3
    await add('EmptyLatentImage', 0, 420); // 4
    await add('VAEDecode', 420, 420); // 5
    await commit(ctx, { type: 'connect', source: '1', sourceHandle: 'out-1', target: '2', targetHandle: 'in-0' });
    await commit(ctx, { type: 'connect', source: '2', sourceHandle: 'out-0', target: '3', targetHandle: 'in-1' });
    await commit(ctx, { type: 'add-group', title: 'Prompt', nodeIds: ['1', '2'] });
    await reload(ctx);

    // ── Shift+click adds to the selection.
    await title(page, '1').click();
    await page.keyboard.down('Shift');
    await title(page, '2').click();
    await page.keyboard.up('Shift');
    expect(await selected(page)).toEqual(['1', '2']);

    // ── A drag of two nodes is one step; one Ctrl+Z puts both back.
    const start = (await snap(ctx)).nodes.filter((item) => ['1', '2'].includes(item.id)).map((item) => item.position);
    const before = await revSeq(ctx);
    const from = await centre(title(page, '2'));
    await drag(page, from, { x: from.x + 60, y: from.y + 50 });
    await expect.poll(() => revSeq(ctx)).toBe(before + 1);
    await page.waitForTimeout(600);
    expect(await revSeq(ctx)).toBe(before + 1);
    await undoOnce(ctx);
    expect((await snap(ctx)).nodes.filter((item) => ['1', '2'].includes(item.id)).map((item) => item.position)).toEqual(start);

    // ── Five arrow presses with two nodes selected: one step.
    await clearSelection(page);
    await title(page, '1').click();
    await page.keyboard.down('Control');
    await title(page, '2').click();
    await page.keyboard.up('Control');
    await shot(page, '00-before-nudge');
    expect(await selected(page)).toEqual(['1', '2']);
    const nudgeFrom = await revSeq(ctx);
    for (let press = 0; press < 5; press += 1) await page.keyboard.press('ArrowRight');
    await expect.poll(() => revSeq(ctx), { timeout: 5000 }).toBe(nudgeFrom + 1);
    await page.waitForTimeout(800);
    expect(await revSeq(ctx)).toBe(nudgeFrom + 1);
    await undoOnce(ctx);

    // ── Copy and paste: new nodes 40 px down and right, their link kept, the pasted ones selected; one step.
    await clearSelection(page);
    await title(page, '1').click();
    await page.keyboard.down('Control');
    await title(page, '2').click();
    await page.keyboard.up('Control');
    await page.keyboard.press('Control+c');
    const pasteFrom = await revSeq(ctx);
    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await snap(ctx)).nodes.length).toBe(7);
    expect(await revSeq(ctx)).toBe(pasteFrom + 1);
    const graph = await snap(ctx);
    const pasted = graph.nodes.filter((item) => ['6', '7'].includes(item.id));
    const originals = graph.nodes.filter((item) => ['1', '2'].includes(item.id));
    expect(pasted.map((item) => [item.data.comfyType, item.position.x - originals.find((o) => o.data.comfyType === item.data.comfyType)!.position.x])).toEqual([['CheckpointLoaderSimple', 40], ['CLIPTextEncode', 40]]);
    expect(graph.edges.some((edge) => edge.source === '6' && edge.target === '7')).toBe(true);
    await expect.poll(() => selected(page)).toEqual(['6', '7']);
    await shot(page, '01-pasted');
    // Duplicate: one step again; then Delete removes the two duplicates in one step.
    await page.keyboard.press('Control+d');
    await expect.poll(async () => (await snap(ctx)).nodes.length).toBe(9);
    await expect.poll(() => selected(page)).toEqual(['8', '9']);
    const deleteFrom = await revSeq(ctx);
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await snap(ctx)).nodes.length).toBe(7);
    await page.waitForTimeout(500);
    expect(await revSeq(ctx)).toBe(deleteFrom + 1);
    await undoOnce(ctx);
    expect((await snap(ctx)).nodes.length).toBe(9);

    // ── The Edit menu lists them with their keys.
    await page.getByRole('menubar').getByRole('menuitem', { name: 'Правка', exact: true }).click();
    for (const name of ['Вырезать', 'Копировать', 'Вставить', 'Дублировать']) await expect(page.getByRole('menu').getByRole('menuitem', { name: new RegExp(name) })).toBeVisible();
    await page.keyboard.press('Escape');

    // ── A link dropped on empty canvas: only nodes that take it, and the chosen one is connected.
    await commit(ctx, { type: 'import-workflow', document: { version: 0.4, last_node_id: 0, last_link_id: 0, groups: [], config: {}, extra: {}, links: [], nodes: [] } });
    await commit(ctx, { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    await reload(ctx);
    const latentOut = node(page, '1').locator('.react-flow__handle[data-handleid="out-0"]');
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    const out = await centre(latentOut);
    await page.mouse.move(out.x, out.y);
    await page.mouse.down();
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(out.x + step * 22, out.y + step * 8);
    await shot(page, '02-link-drag');
    await page.mouse.up();
    const search = page.getByRole('dialog').filter({ has: page.locator('input') }).first();
    await expect(search).toBeVisible();
    await expect(search.getByRole('option').first()).toBeVisible();
    const offered = await search.getByRole('option').allInnerTexts();
    expect(offered.some((text) => text.includes('VAE Decode'))).toBe(true);
    expect(offered.some((text) => text.includes('Load Checkpoint'))).toBe(false);
    await shot(page, '03-link-search');
    await search.getByRole('option').filter({ hasText: 'VAE Decode' }).first().click();
    await expect.poll(async () => (await snap(ctx)).edges.length).toBe(1);
    const linked = await snap(ctx);
    expect(linked.edges[0]).toMatchObject({ source: '1', target: '2' });
    expect(await selected(page)).toEqual(['2']);
    expect(pane.width).toBeGreaterThan(0);

    // ── A drop on a port that does not fit says why.
    const vaeIn = node(page, '2').locator('.react-flow__handle[data-handleid="in-1"]');
    // Node reveal moves the camera after selection. Locator actions wait for stable screen coordinates.
    await latentOut.hover();
    await vaeIn.hover();
    const beforeRefusedLink = (await snap(ctx)).edges;
    const latent = await centre(latentOut);
    await drag(page, latent, await centre(vaeIn));
    await expect(page.locator('[class*="toast"]').filter({ hasText: 'нельзя подать на вход' })).toBeVisible();
    expect((await snap(ctx)).edges).toEqual(beforeRefusedLink);

    // ── Pin nodes: a drag moves nothing, the chip says so and unpins.
    await page.getByRole('menubar').getByRole('menuitem', { name: 'Вид', exact: true }).click();
    await page.getByRole('menu').getByRole('menuitemcheckbox', { name: /Закрепить ноды/ }).click();
    await expect(page.locator('[data-pinned-chip]')).toBeVisible();
    const pinnedAt = (await snap(ctx)).nodes.find((item) => item.id === '2')!.position;
    const head = await centre(title(page, '2'));
    await drag(page, head, { x: head.x + 80, y: head.y + 40 });
    await page.waitForTimeout(800);
    expect((await snap(ctx)).nodes.find((item) => item.id === '2')!.position).toEqual(pinnedAt);
    await shot(page, '04-pinned');
    await page.locator('[data-pinned-chip]').getByRole('button').click();
    await expect(page.locator('[data-pinned-chip]')).toHaveCount(0);

    // ── Arrow keys move the view when nothing is selected; a click on the minimap moves it too.
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: pane.height - 40 } });
    const viewport = () => page.evaluate(() => document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? '');
    const v0 = await viewport();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(viewport).not.toBe(v0);
    const minimap = page.locator('.react-flow__minimap');
    const v1 = await viewport();
    const mb = (await minimap.boundingBox())!;
    await page.mouse.click(mb.x + 8, mb.y + 8);
    await expect.poll(viewport).not.toBe(v1);

    // ── A group moves with its nodes, as one step.
    await commit(ctx, { type: 'add-group', title: 'Pair', nodeIds: ['1', '2'] });
    await reload(ctx);
    const groupTitle = page.locator('[data-group-id] > div[data-group-id]').first();
    const members = (await snap(ctx)).nodes.filter((item) => ['1', '2'].includes(item.id)).map((item) => item.position);
    const groupFrom = await revSeq(ctx);
    const gt = await centre(groupTitle);
    await drag(page, gt, { x: gt.x + 120, y: gt.y + 60 });
    await expect.poll(() => revSeq(ctx)).toBe(groupFrom + 1);
    const movedMembers = (await snap(ctx)).nodes.filter((item) => ['1', '2'].includes(item.id)).map((item) => item.position);
    expect(movedMembers[0].x - members[0].x).toBeGreaterThan(20);
    expect(movedMembers[1].x - members[1].x).toBeCloseTo(movedMembers[0].x - members[0].x, 0);
    await shot(page, '05-group-moved');

    // ── A node added from the search is selected and in view.
    await blur(page);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('Save Image');
    await expect(page.getByRole('dialog').getByRole('option').filter({ hasText: 'Save Image' }).first()).toBeVisible();
    await page.getByRole('dialog').getByRole('option').filter({ hasText: 'Save Image' }).first().click();
    await expect.poll(async () => (await snap(ctx)).nodes.length).toBe(3);
    await expect.poll(() => selected(page)).toEqual(['3']);
    await page.waitForTimeout(800);
    const added = (await node(page, '3').boundingBox())!;
    const view = (await page.locator('.react-flow__pane').boundingBox())!;
    expect(added.x >= view.x && added.y >= view.y && added.x + added.width <= view.x + view.width && added.y + added.height <= view.y + view.height).toBe(true);
    await shot(page, '06-added-in-view');
    expect(ctx.errors).toEqual([]);
  } finally {
    await ctx.app.close().catch(() => undefined);
    await fake.close();
  }
});
