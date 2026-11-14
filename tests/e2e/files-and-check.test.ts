import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * Files, history and the check in the real app, in Russian (the default):
 * - the import toast counts what is missing and offers the check; a node this ComfyUI does not have is marked at once;
 * - the check names what ComfyUI refuses (no output node, a value out of range, a value not in its list);
 * - a node without its own title goes by the catalog name;
 * - the unsaved mark is truthful (import, save, undo to the saved content, reload, restart); Ctrl+S saves in place,
 *   Ctrl+Shift+S asks, names come from the title; Open asks before replacing a graph that is in no file;
 * - History replay speaks human words, changes nothing while open, and can return to a version;
 * - Ctrl+Z pressed while an add is landing undoes that add; Ctrl+Y redoes;
 * - File > New project starts in workflow format 1, so Ctrl+G makes a subgraph there;
 * - a corrected number says why; the person's note is theirs; the view comes back after a restart.
 * Shots go to FILES_CHECK_SHOTS when set.
 */

type Bridge = (name: string, args?: unknown[]) => Promise<any>;
interface Ctx { app: ElectronApplication; page: Page; api: Bridge; errors: string[] }

const SHOTS = process.env.FILES_CHECK_SHOTS ?? '';

async function launch(userData: string, fake: FakeMcp, first: boolean): Promise<Ctx> {
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
  if (first) {
    const read = await api('getSettings') as { values?: Record<string, unknown> };
    expect(await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 30_000 });
    await api('syncNow').catch(() => undefined);
    await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 120_000 }).toBe('idle');
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 30_000 });
  }
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
  const result = await ctx.api('commitCommand', [{ projectId: 'desktop', actionId: `files-check-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]);
  expect(result.status, JSON.stringify(payload)).toBe('applied');
  // A change made past the page (as the bridge does here) reaches the canvas on the next read.
  await ctx.page.reload();
  await ctx.page.locator('.app-shell').waitFor({ timeout: 30_000 });
  return result;
}

const nodeCount = async (ctx: Ctx) => ((await ctx.api('readProjection', ['desktop'])).snapshot.nodes as unknown[]).length;
const chip = (page: Page) => page.locator('.project-chip');
const toast = (page: Page) => page.locator('[class*="toast"]').filter({ hasText: /\S/ });

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
}

/** Answers the next file dialogs; counts the save dialogs and keeps the name they suggested. */
async function dialogs(ctx: Ctx, open: string | null, save: string | null) {
  await ctx.app.evaluate(({ dialog }, paths) => {
    const state = globalThis as unknown as { saveAsked?: number; suggested?: string };
    state.saveAsked = state.saveAsked ?? 0;
    dialog.showOpenDialog = (async () => (paths.open ? { canceled: false, filePaths: [paths.open] } : { canceled: true, filePaths: [] })) as never;
    dialog.showSaveDialog = (async (...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as { defaultPath?: string };
      state.saveAsked = (state.saveAsked ?? 0) + 1;
      state.suggested = options?.defaultPath ?? '';
      return paths.save ? { canceled: false, filePath: paths.save } : { canceled: true, filePath: undefined };
    }) as never;
  }, { open, save });
}
const saveAsked = (ctx: Ctx) => ctx.app.evaluate(() => (globalThis as unknown as { saveAsked?: number }).saveAsked ?? 0);
const suggested = (ctx: Ctx) => ctx.app.evaluate(() => (globalThis as unknown as { suggested?: string }).suggested ?? '');

const out = (name: string, type: string, links: number[] = []) => ({ name, type, links });
const inp = (name: string, type: string, link: number | null = null) => ({ name, type, link });

/** Text to image without an output node and with steps 0: two things ComfyUI refuses. */
function brokenTxt2img() {
  const nodes = [
    { id: 1, type: 'CheckpointLoaderSimple', outputs: [out('MODEL', 'MODEL', [1]), out('CLIP', 'CLIP', [2, 3]), out('VAE', 'VAE', [8])], widgets_values: ['sd_xl_base_1.0.safetensors'] },
    { id: 2, type: 'CLIPTextEncode', inputs: [inp('clip', 'CLIP', 2)], outputs: [out('CONDITIONING', 'CONDITIONING', [4])], widgets_values: ['a fox'] },
    { id: 3, type: 'CLIPTextEncode', inputs: [inp('clip', 'CLIP', 3)], outputs: [out('CONDITIONING', 'CONDITIONING', [5])], widgets_values: ['blurry'] },
    { id: 4, type: 'EmptyLatentImage', outputs: [out('LATENT', 'LATENT', [6])], widgets_values: [1024, 1024, 1] },
    { id: 5, type: 'KSampler', inputs: [inp('model', 'MODEL', 1), inp('positive', 'CONDITIONING', 4), inp('negative', 'CONDITIONING', 5), inp('latent_image', 'LATENT', 6)], outputs: [out('LATENT', 'LATENT', [7])], widgets_values: [0, 'fixed', 0, 7, 'euler', 'normal', 1] },
    { id: 6, type: 'VAEDecode', inputs: [inp('samples', 'LATENT', 7), inp('vae', 'VAE', 8)], outputs: [out('IMAGE', 'IMAGE', [])] },
  ];
  return {
    version: 0.4, last_node_id: 6, last_link_id: 8, groups: [], config: {}, extra: {},
    links: [[1, 1, 0, 5, 0, 'MODEL'], [2, 1, 1, 2, 0, 'CLIP'], [3, 1, 1, 3, 0, 'CLIP'], [4, 2, 0, 5, 1, 'CONDITIONING'], [5, 3, 0, 5, 2, 'CONDITIONING'], [6, 4, 0, 5, 3, 'LATENT'], [7, 5, 0, 6, 0, 'LATENT'], [8, 1, 2, 6, 1, 'VAE']],
    nodes: nodes.map((node, index) => ({ pos: [index * 380, 0], size: [300, 160], flags: {}, order: index, mode: 0, properties: {}, inputs: [], outputs: [], ...node })),
  };
}

/** Four classes this ComfyUI does not have, with values saved for them. */
function unknownClasses() {
  const types = ['FancyMadeUpNode', 'AnotherMissingNode', 'ThirdMissingNode', 'FourthMissingNode'];
  return {
    version: 0.4, last_node_id: 4, last_link_id: 0, groups: [], config: {}, extra: {}, links: [],
    nodes: types.map((type, index) => ({ id: index + 1, type, pos: [index * 360, 0], size: [300, 120], flags: {}, order: index, mode: 0, properties: {}, inputs: [], outputs: [], widgets_values: [42 + index, 'hello'] })),
  };
}

test('files, history and the check behave as they say', async () => {
  test.setTimeout(900_000);
  const fake = await startFakeMcp({ video: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'files-check-'));
  const dir = path.join(userData, 'files');
  fs.mkdirSync(dir);
  let ctx = await launch(userData, fake, true);
  let { page } = ctx;
  try {
    // An empty canvas has nothing to save.
    await expect(chip(page)).toHaveAttribute('data-dirty', 'false');

    // ── Import: a count, two names, "and 2 more", and the check one click away; the nodes are marked at once.
    const unknownFile = path.join(dir, 'unknown.json');
    fs.writeFileSync(unknownFile, JSON.stringify(unknownClasses()));
    await dialogs(ctx, unknownFile, null);
    await blur(page);
    await page.keyboard.press('Control+i');
    await expect(toast(page).filter({ hasText: 'и ещё 2' })).toBeVisible({ timeout: 15_000 });
    await expect(toast(page).getByRole('button', { name: 'Открыть проверку' })).toBeVisible();
    // The card of a node this ComfyUI does not have is marked and lists the values the file saved for it.
    const madeUp = page.locator('[data-class-missing="true"]').filter({ hasText: 'FancyMadeUpNode' }).first();
    await expect(madeUp).toBeVisible({ timeout: 15_000 });
    await expect(madeUp).toContainText('42');
    await expect(chip(page)).toHaveAttribute('data-dirty', 'true');
    await shot(page, '01-import-unknown');
    await toast(page).getByRole('button', { name: 'Открыть проверку' }).click();
    await expect(page.locator('.check-panel')).toContainText('FancyMadeUpNode');

    // ── Open workflow while the graph is in no file: the app asks first.
    const brokenFile = path.join(dir, 'broken.json');
    fs.writeFileSync(brokenFile, JSON.stringify(brokenTxt2img()));
    await dialogs(ctx, brokenFile, null);
    await blur(page);
    await page.keyboard.press('Control+i');
    const ask = page.getByRole('dialog').filter({ hasText: 'Открыть workflow?' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: 'Открыть workflow' }).click();
    await expect.poll(() => nodeCount(ctx)).toBe(6);

    // ── The check says what ComfyUI refuses, by the names the library uses.
    await blur(page);
    await page.keyboard.press('Control+Shift+c');
    const panel = page.locator('.check-panel');
    await expect(panel).toContainText('Результат никуда не сохраняется', { timeout: 15_000 });
    await expect(panel).toContainText('наименьшее допустимое значение 1');
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Load Checkpoint' }).first()).toBeVisible();
    await shot(page, '02-check');

    // ── Save: the dialog suggests the title; Ctrl+S then writes in place; Ctrl+Shift+S asks again.
    await commit(ctx, { type: 'set-process', title: 'Лиса', notes: '' });
    const projectFile = path.join(dir, 'fox.graph-helper.json');
    await dialogs(ctx, null, projectFile);
    await blur(page);
    await page.keyboard.press('Control+s');
    await expect(chip(page)).toHaveAttribute('data-dirty', 'false', { timeout: 15_000 });
    expect(await saveAsked(ctx)).toBe(1);
    expect(await suggested(ctx)).toBe('Лиса.graph-helper.json');
    expect(fs.existsSync(projectFile)).toBe(true);
    await commit(ctx, { type: 'move-node', nodeId: '1', x: -80, y: 40 });
    await expect(chip(page)).toHaveAttribute('data-dirty', 'true');
    // Undo back to exactly the saved content clears the mark.
    await blur(page);
    await page.keyboard.press('Control+z');
    await expect(chip(page)).toHaveAttribute('data-dirty', 'false', { timeout: 15_000 });
    // Ctrl+Y redoes; the mark comes back.
    await page.keyboard.press('Control+y');
    await expect(chip(page)).toHaveAttribute('data-dirty', 'true', { timeout: 15_000 });
    await page.keyboard.press('Control+s');
    await expect(chip(page)).toHaveAttribute('data-dirty', 'false', { timeout: 15_000 });
    expect(await saveAsked(ctx)).toBe(1);
    await page.keyboard.press('Control+Shift+s');
    await expect.poll(() => saveAsked(ctx)).toBe(2);
    expect(await suggested(ctx)).toBe(projectFile);

    // ── The mark survives a reload.
    await commit(ctx, { type: 'move-node', nodeId: '2', x: 500, y: 300 });
    await expect(chip(page)).toHaveAttribute('data-dirty', 'true', { timeout: 15_000 });

    // ── Open project while the graph is not in its file as it stands: asked first, and Cancel keeps it.
    await dialogs(ctx, projectFile, null);
    await blur(page);
    await page.keyboard.press('Control+o');
    const askOpen = page.getByRole('dialog').filter({ hasText: 'Открыть другой проект?' });
    await expect(askOpen).toBeVisible();
    await askOpen.getByRole('button', { name: 'Отмена' }).click();
    await expect(chip(page)).toHaveAttribute('data-dirty', 'true');

    // ── A typed number that had to be corrected says why.
    await commit(ctx, { type: 'import-workflow', document: { version: 0.4, last_node_id: 1, last_link_id: 0, groups: [], config: {}, extra: {}, links: [], nodes: [{ id: 1, type: 'KSampler', pos: [0, 0], size: [300, 300], flags: {}, order: 0, mode: 0, properties: {}, inputs: [], outputs: [], widgets_values: [0, 'fixed', 20, 7, 'euler', 'normal', 1] }] } });
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 30_000 });
    await page.keyboard.press('Control+0');
    const steps = page.locator('.react-flow__node [data-field-name="steps"] input');
    await steps.click();
    await steps.fill('0');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-field-note]')).toContainText('Наименьшее допустимое значение 1');
    await shot(page, '03-number-note');
    await blur(page);

    // ── Ctrl+Z pressed while an add is still landing undoes that add.
    const before = await nodeCount(ctx);
    for (let i = 0; i < 4; i += 1) {
      await blur(page);
      await page.keyboard.press('Control+k');
      await page.keyboard.type('VAE Decode');
      await expect(page.getByRole('dialog').getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Control+z');
    }
    await page.waitForTimeout(3000);
    expect(await nodeCount(ctx)).toBe(before);

    // ── History replay: human words, read-only while open, and a way back to a version.
    await page.locator('.react-flow [role="toolbar"] button[aria-label="Просмотр истории"]').click();
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    const versions = Number(await slider.getAttribute('max'));
    await slider.fill(String(Math.max(0, versions - 3)));
    const banner = page.locator('[role="status"]').filter({ hasText: 'Только просмотр' });
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText('add-node');
    await expect(banner).not.toContainText('restore-revision');
    const during = await nodeCount(ctx);
    await page.getByPlaceholder('Поиск нод').fill('Save Image');
    await page.locator('#node-library-list').getByRole('option').filter({ hasText: 'Save Image' }).first().dblclick();
    await expect(toast(page).filter({ hasText: 'Открыт просмотр истории' })).toBeVisible();
    expect(await nodeCount(ctx)).toBe(during);
    await shot(page, '04-replay');
    const shown = await page.locator('.react-flow__node').count();
    await page.locator('[data-replay-restore]').click();
    await expect(page.locator('[data-replay="on"]')).toHaveCount(0);
    await expect.poll(() => nodeCount(ctx)).toBe(shown);
    await page.getByPlaceholder('Поиск нод').fill('');

    // ── The person's own note is badged as theirs (not as the assistant's guess).
    await blur(page);
    await page.keyboard.press('Shift+1');
    const node = page.locator('.react-flow__node').first();
    await node.click({ position: { x: 40, y: 12 }, button: 'right' });
    await page.getByRole('menu').getByRole('menuitem', { name: /Заметк|Описани/ }).first().click();
    const purpose = page.locator('textarea[id^="component-purpose-node-"]');
    await expect(purpose).toBeFocused();
    await purpose.fill('My own words about this node');
    await expect(purpose).toHaveValue('My own words about this node');
    await page.getByRole('button', { name: /Сохранить описание/ }).first().click();
    await expect(page.getByText('Записали вы').first()).toBeVisible({ timeout: 15_000 });
    const notedId = await node.getAttribute('data-id');
    await expect.poll(async () => {
      const snapshot = ((await ctx.api('readProjection', ['desktop'])) as any).snapshot;
      return snapshot.components?.find((item: any) => item.ownerKind === 'node' && item.ownerId === notedId);
    }).toMatchObject({ purpose: 'My own words about this node', author: 'user' });
    await shot(page, '05-own-note');

    // ── File > New project starts in the same format as a fresh profile: making a subgraph there works.
    await blur(page);
    await page.keyboard.press('Control+n');
    const startNew = page.getByRole('button', { name: 'Начать новый проект', exact: true });
    if (await startNew.isVisible({ timeout: 3_000 }).catch(() => false)) await startNew.click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0, { timeout: 15_000 });
    expect(((await ctx.api('readProjection', ['desktop'])).snapshot.document as { formatVersion?: number } | undefined)?.formatVersion).toBe(1);
    await commit(ctx, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
    await commit(ctx, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 420, y: 0 });
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 15_000 });
    await blur(page);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+g');
    await expect.poll(async () => ((await ctx.api('readProjection', ['desktop'])).snapshot.subgraphs as unknown[] | undefined)?.length ?? 0, { timeout: 15_000 }).toBe(1);
    await expect(toast(page).filter({ hasText: /формат/ })).toHaveCount(0);
    await shot(page, '05b-new-project-subgraph');

    // ── The view comes back after a restart; the mark is as truthful as before.
    await page.getByRole('tab', { name: 'Модели' }).click();
    await page.getByRole('radio').filter({ hasText: 'LoRA' }).first().click();
    await page.waitForTimeout(1500);
    const dirtyBefore = await chip(page).getAttribute('data-dirty');
    await ctx.app.close();
    ctx = await launch(userData, fake, false);
    page = ctx.page;
    await expect(page.getByRole('tab', { name: 'Модели' })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
    await expect(page.getByRole('radio').filter({ hasText: 'LoRA' }).first()).toHaveAttribute('aria-checked', 'true');
    await expect(chip(page)).toHaveAttribute('data-dirty', dirtyBefore ?? 'true');
    await shot(page, '06-after-restart');
    expect(ctx.errors).toEqual([]);
  } finally {
    await ctx.app.close().catch(() => undefined);
    await fake.close();
  }
});
