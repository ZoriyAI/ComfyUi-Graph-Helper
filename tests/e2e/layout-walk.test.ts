import { test, expect, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranslator } from '../../src/shared/i18n';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';
import { auditLayout, describeIssues, type LayoutIssue } from './layoutAudit';
import { APP_AUDIT } from './layoutProfile';

/**
 * Walks the whole app the way a person meets it and, at every stop and every window size, asks the page what
 * sticks out of its box, is cut by a panel, leaves the window, lies on another control or is squeezed to nothing
 * (layoutAudit.ts). A person once saw buttons sticking out of their cards; nobody had looked at every screen at
 * every size, so this does.
 *
 * The profile is a real-sized one: a fake MCP server on loopback with 300 extra LoRAs and long file names, a helper
 * with a long model name, a long project name, a helper that builds a graph (TEST transport, not a live model).
 * Every stop is reached again at every size, the way a person would open it in a window of that size: a resize
 * alone folds the library and closes what floats.
 *
 * LAYOUT_LANG=en walks in English (default: Russian, the longer texts).
 * LAYOUT_SIZES=800x560,1440x900 picks the window sizes; LAYOUT_FULL=1 walks every size from the list below.
 * LAYOUT_ONLY=canvas,helper walks only those parts (their set-up still runs).
 * LAYOUT_OUT=<dir> keeps a report and a screenshot of every stop that has something to say; LAYOUT_SHOTS=all keeps
 * a screenshot of every stop. LAYOUT_REPORT=1 only reports and does not fail.
 */

const LANG = process.env.LAYOUT_LANG === 'en' ? 'en' : 'ru';
const OUT = process.env.LAYOUT_OUT ?? '';
const ALL_SHOTS = process.env.LAYOUT_SHOTS === 'all';
const REPORT_ONLY = process.env.LAYOUT_REPORT === '1';
const ONLY = (process.env.LAYOUT_ONLY ?? '').split(',').map((part) => part.trim()).filter(Boolean);
const T = createTranslator(LANG);

interface Size { width: number; height: number }
/** From the smallest window the app allows, through the size it opens at, to a large monitor. */
const EVERY_SIZE: Size[] = [
  { width: 800, height: 560 },
  { width: 1024, height: 700 },
  { width: 1280, height: 800 },
  { width: 1400, height: 860 },
  { width: 1920, height: 1080 },
];
/** The everyday run: the smallest window, a laptop, the size the app opens at, a large monitor. */
const USUAL_SIZES: Size[] = [EVERY_SIZE[0], EVERY_SIZE[1], EVERY_SIZE[3], EVERY_SIZE[4]];
const SIZES: Size[] = process.env.LAYOUT_SIZES
  ? process.env.LAYOUT_SIZES.split(',').map((part) => part.trim().split('x').map(Number)).map(([width, height]) => ({ width, height }))
  : process.env.LAYOUT_FULL === '1' ? EVERY_SIZE : USUAL_SIZES;
const HOME: Size = { width: 1440, height: 900 };

const LONG_MODEL = 'hf.co/bartowski/Qwen2.5-Coder-32B-Instruct-abliterated-GGUF:Q4_K_M';
const LONG_PROJECT = LANG === 'ru' ? 'Портрет в стиле аниме с тремя LoRA и апскейлом, вариант 14' : 'Anime portrait with three LoRAs and an upscale, take 14';
const LONG_QUESTION = `explain this https://example.com/a/very/long/address/without/any/spaces/${'x'.repeat(90)} and wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors`;

const MODEL_ANSWER = [
  LANG === 'ru' ? '## Что делает KSampler' : '## What KSampler does',
  '',
  LANG === 'ru' ? 'Он убирает шум **шаг за шагом**, следуя модели и *обоим* промптам. Главные поля:' : 'It removes noise **step by step**, guided by the model and *both* prompts. The main fields:',
  '',
  LANG === 'ru' ? '| Поле | Значение | Зачем |' : '| Field | Value | Why |',
  '|---|---|---|',
  LANG === 'ru' ? '| steps | 20 | больше шагов — чище картинка, но дольше |' : '| steps | 20 | more steps give a cleaner picture, and take longer |',
  LANG === 'ru' ? '| sampler_name | dpmpp_2m_sde_gpu | алгоритм, которым убирается шум |' : '| sampler_name | dpmpp_2m_sde_gpu | the algorithm that removes the noise |',
  '| scheduler | sgm_uniform | wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors |',
  '',
  LANG === 'ru' ? '> Совет: начните с 20 шагов и cfg 7–8.' : '> Tip: start with 20 steps and cfg 7–8.',
  '',
  '```',
  'python main.py --listen 0.0.0.0 --port 28188 --preview-method auto --use-split-cross-attention --output-directory /mnt/storage/comfy/output',
  '```',
  '',
  '---',
  LANG === 'ru' ? 'Подробнее: [документация по KSampler](https://docs.comfy.org/built-in-nodes/KSampler).' : 'More: [the KSampler documentation](https://docs.comfy.org/built-in-nodes/KSampler).',
].join('\n');

const AUDIT = APP_AUDIT;

interface Finding { stop: string; size: string; issues: LayoutIssue[] }

const findings: Finding[] = [];
const unreached: string[] = [];
const consoleErrors: string[] = [];
const visited: string[] = [];
let shotIndex = 0;

const wants = (part: string) => ONLY.length === 0 || ONLY.includes(part);

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9а-я]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function shot(page: Page, stop: string, size: Size): Promise<void> {
  if (!OUT) return;
  shotIndex += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotIndex).padStart(3, '0')}-${slug(stop)}-${size.width}x${size.height}.png`) }).catch(() => undefined);
}

async function auditNow(page: Page, stop: string, size: Size, extra: LayoutIssue[] = []): Promise<void> {
  const issues = [...await auditLayout(page, AUDIT), ...extra];
  visited.push(`${stop} @ ${size.width}x${size.height}`);
  if (issues.length > 0) findings.push({ stop, size: `${size.width}x${size.height}`, issues });
  if (issues.length > 0 || ALL_SHOTS) await shot(page, stop, size);
}

/**
 * One stop at every size: the window takes the size first, then the stop is reached the way a person would in a
 * window of that size, looked at, and left.
 */
async function visit(page: Page, stop: string, reach: (size: Size) => Promise<void> = async () => undefined, leave: () => Promise<void> = async () => undefined): Promise<void> {
  for (const size of SIZES) {
    try {
      await page.setViewportSize(size);
      await page.waitForTimeout(180);
      await reach(size);
      await page.waitForTimeout(240);
      await auditNow(page, stop, size);
    } catch (error) {
      unreached.push(`${stop} at ${size.width}x${size.height}: ${String((error as Error).message).split('\n')[0]}`);
      await shot(page, `unreached ${stop}`, size);
    } finally {
      await leave().catch(() => undefined);
    }
  }
  await page.setViewportSize(HOME);
  await page.waitForTimeout(120);
}

/** A stop with a panel that scrolls: every part of it passes through view at every size. */
async function visitScrolling(page: Page, stop: string, reach: (size: Size) => Promise<void>, scroller: () => Locator, leave: () => Promise<void> = async () => undefined): Promise<void> {
  for (const size of SIZES) {
    try {
      await page.setViewportSize(size);
      await page.waitForTimeout(180);
      await reach(size);
      await page.waitForTimeout(240);
      const target = scroller();
      await target.evaluate((el) => { el.scrollTop = 0; }).catch(() => undefined);
      await auditNow(page, stop, size);
      const steps = await target.evaluate((el) => Math.ceil((el.scrollHeight - el.clientHeight) / Math.max(160, el.clientHeight * 0.8))).catch(() => 0);
      for (let step = 1; step <= Math.min(steps, 8); step += 1) {
        await target.evaluate((el, index) => { el.scrollTop = index * Math.max(160, el.clientHeight * 0.8); }, step).catch(() => undefined);
        await page.waitForTimeout(90);
        await auditNow(page, `${stop} (scrolled ${step})`, size);
      }
      await target.evaluate((el) => { el.scrollTop = 0; }).catch(() => undefined);
    } catch (error) {
      unreached.push(`${stop} at ${size.width}x${size.height}: ${String((error as Error).message).split('\n')[0]}`);
      await shot(page, `unreached ${stop}`, size);
    } finally {
      await leave().catch(() => undefined);
    }
  }
  await page.setViewportSize(HOME);
  await page.waitForTimeout(120);
}

async function launch(userData: string): Promise<{ app: ElectronApplication; page: Page }> {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env });
  const page = await app.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror ${error.message}`));
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.setViewportSize(HOME);
  return { app, page };
}

function bridge(page: Page) {
  return (name: string, args: unknown[] = []) => page.evaluate(async ({ name, args }) => {
    const api = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return api[name](...args);
  }, { name, args });
}

async function reloaded(page: Page): Promise<void> {
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

async function saveSettings(page: Page, change: Record<string, unknown>): Promise<void> {
  const api = bridge(page);
  const read = await api('getSettings') as { values?: Record<string, unknown> };
  const saved = await api('saveSettings', [{ ...(read.values ?? {}), ...change }]) as { ok?: boolean };
  expect(saved, `settings ${JSON.stringify(change)}`).toMatchObject({ ok: true });
  await reloaded(page);
}

async function commit(page: Page, payload: Record<string, unknown>): Promise<void> {
  const api = bridge(page);
  const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  await api('commitCommand', [{ projectId: 'desktop', actionId: `layout-walk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]);
}

const settingsDialog = (page: Page): Locator => page.locator('[role="dialog"].settings-dialog');
const settingsPanel = (page: Page): Locator => settingsDialog(page).locator('[role="tabpanel"]:visible').first();
const dockPanel = (page: Page): Locator => page.locator('.dock-panel:visible').first();

/** Opens a library tab whether the library is a full panel or, in a narrow window, a strip of icons. */
async function railTab(page: Page, index: number): Promise<void> {
  const rail = page.locator('#library-rail');
  if ((await rail.getAttribute('data-open')) === 'true') {
    await rail.getByRole('tab').nth(index).click();
  } else {
    // The strip: the expand button first, then one button per tab.
    await rail.locator('button').nth(index + 1).click();
  }
  await expect(rail).toHaveAttribute('data-open', 'true');
  await page.waitForTimeout(420);
}

/** Opens a tab of the right panel, whether it is a full panel or a strip of icons. */
async function dockTab(page: Page, index: number): Promise<void> {
  const strip = page.locator('.dock-strip');
  if (await strip.count() > 0 && await strip.isVisible()) {
    await strip.locator('button').nth(index + 1).click();
  } else {
    await page.locator('.dock-tab').nth(index).click();
  }
  await expect(page.locator('.dock-tab').nth(index)).toHaveAttribute('data-state', 'active');
  await page.waitForTimeout(380);
}

async function openSettings(page: Page, section: number): Promise<Locator> {
  const dialog = settingsDialog(page);
  if (await dialog.count() === 0) {
    await page.keyboard.press('Control+,');
    await dialog.waitFor({ timeout: 10_000 });
  }
  await dialog.locator('.settings-tab').nth(section).click();
  await page.waitForTimeout(220);
  return dialog;
}

async function closeSettings(page: Page): Promise<void> {
  const dialog = settingsDialog(page);
  if (await dialog.count() === 0) return;
  await dialog.getByRole('button', { name: T('settings.cancel'), exact: true }).click().catch(async () => {
    await page.keyboard.press('Escape');
  });
  await expect(dialog).toHaveCount(0);
}

async function escape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
}

async function addFromLibrary(page: Page, classType: string): Promise<void> {
  await railTab(page, 0);
  const rail = page.locator('#library-rail');
  await rail.locator('input').first().fill(classType);
  await page.waitForTimeout(260);
  await page.locator('#node-library-list').getByRole('option').filter({ hasText: classType }).first().dblclick();
  await page.waitForTimeout(320);
}

/** Two boxes of the canvas's own making must not lie on each other: the app put both where they are. */
function overlapOf(a: { x: number; y: number; width: number; height: number } | null, b: { x: number; y: number; width: number; height: number } | null): number {
  if (!a || !b) return 0;
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 2 && y > 2 ? Math.round(y) : 0;
}

test('nothing sticks out, is cut or overlaps on any screen at any window size', async () => {
  test.setTimeout(2_400_000);
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const fake: FakeMcp = await startFakeMcp({ extraLoras: 300 });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-walk-'));
  const { app, page } = await launch(userData);
  const api = bridge(page);
  const started = Date.now();
  try {
    await saveSettings(page, { language: LANG });
    const rail = page.locator('#library-rail');
    const composer = page.locator('.composer-field textarea');
    const menus = page.locator('.document-bar [role="menuitem"]');
    const nodes = page.locator('.react-flow__node');

    // ---------- A fresh profile ----------
    if (wants('fresh')) {
      await visit(page, 'first screen');
      for (let index = 0; index < 3; index += 1) {
        await visit(page, `library tab ${index + 1}, nothing read yet`, async () => { await railTab(page, index); });
      }
      for (let index = 0; index < 4; index += 1) {
        await visit(page, `right panel tab ${index + 1}, empty`, async () => { await dockTab(page, index); });
      }
      await visit(page, 'both side panels folded', async () => {
        if ((await rail.getAttribute('data-open')) === 'true') await page.keyboard.press('Control+b');
        if (await page.locator('.dock-strip').count() === 0) await page.keyboard.press('Control+j');
        await page.waitForTimeout(350);
      });
      await dockTab(page, 0);
      const menuCount = await menus.count();
      for (let index = 0; index < menuCount; index += 1) {
        await visit(page, `menu ${index + 1}`, async () => { await menus.nth(index).click(); await page.getByRole('menu').first().waitFor(); }, async () => { await escape(page); });
      }
      await visit(page, 'helper choice in the top bar', async () => { await page.locator('#chat-provider').click(); await page.getByRole('listbox').waitFor(); }, async () => { await escape(page); });
    }

    // ---------- A run paused at its step limit: the card in the chat, the run and its buttons in the status bar ----------
    // Before ComfyUI is read: the TEST helper builds from a made-up node, which a read catalog would refuse.
    if (wants('paused')) {
      await page.locator('#chat-provider').click();
      await page.getByRole('option', { name: /TEST/ }).first().click();
      await page.waitForTimeout(500);
      await dockTab(page, 0);
      await page.getByRole('button', { name: T('chat.intentBuild'), exact: true }).click();
      await composer.fill('Build a long chain');
      await composer.press('Enter');
      await expect(page.locator('.turn-checkpoint')).toHaveCount(1, { timeout: 120_000 });
      // Sixty steps wait to be shown one by one; a person in a hurry presses "Show all now".
      await page.locator('[data-live-build] button').last().click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await visit(page, 'a run paused at its step limit', async () => {
        await dockTab(page, 0);
        await page.locator('.turn-checkpoint').scrollIntoViewIfNeeded();
      });
      await page.locator('.status-bar').getByRole('button', { name: T('status.cancelRun') }).click();
      await expect(page.locator('.status-bar [role="status"]')).toHaveCount(0, { timeout: 15_000 });
      await visit(page, 'chat after a run was ended', async () => { await dockTab(page, 0); });
      // A new project: the question is a screen too, and the rest of the walk starts from an empty canvas.
      await visit(page, 'new project question', async () => {
        await page.keyboard.press('Control+n');
        await page.getByRole('dialog', { name: T('menu.newProjectTitle') }).waitFor();
      }, async () => { await escape(page); });
      await page.keyboard.press('Control+n');
      await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
      await expect(nodes).toHaveCount(0, { timeout: 15_000 });
      await page.waitForTimeout(500);
    }

    // ---------- Settings, every section as a newcomer finds it ----------
    if (wants('settings')) {
      for (let section = 0; section < 8; section += 1) {
        await visitScrolling(page, `settings section ${section + 1}, default`, async () => { await openSettings(page, section); }, () => settingsPanel(page));
      }
      // Helper: every choice, with and without a key.
      const assistant = await openSettings(page, 0);
      const providerCount = await assistant.getByRole('radio').count();
      for (let index = 0; index < providerCount; index += 1) {
        await assistant.getByRole('radio').nth(index).click();
        await page.waitForTimeout(450);
        await visitScrolling(page, `settings helper, choice ${index + 1}`, async () => { await openSettings(page, 0); }, () => settingsPanel(page));
        const key = assistant.locator('input[type="password"]').first();
        if (await key.count() > 0 && await key.isVisible()) {
          await key.fill('sk-layout-walk-not-a-real-key-0123456789abcdef');
          await page.waitForTimeout(2500);
          await visitScrolling(page, `settings helper, choice ${index + 1}, key pasted`, async () => { await openSettings(page, 0); }, () => settingsPanel(page));
        }
      }
      await closeSettings(page);
      // Connection: a real address typed in, every way in.
      const connection = await openSettings(page, 1);
      await connection.getByRole('textbox', { name: T('settings.mcpUrl'), exact: true }).fill(fake.url);
      await page.waitForTimeout(300);
      const accessCount = await connection.getByRole('radio').count();
      for (let index = 0; index < accessCount; index += 1) {
        await connection.getByRole('radio').nth(index).click();
        await page.waitForTimeout(320);
        await visitScrolling(page, `settings connection, access ${index + 1}`, async () => { await openSettings(page, 1); }, () => settingsPanel(page));
      }
      await closeSettings(page);
    }

    // ---------- ComfyUI is read: while it runs, and with 300 LoRAs waiting for their metadata ----------
    await saveSettings(page, { mcpUrl: fake.url, mcpAuth: 'none' });
    const sync = api('syncNow');
    await page.waitForTimeout(250);
    if (wants('reading')) {
      await visit(page, 'top bar while ComfyUI is read');
      await visit(page, 'sync indicator while ComfyUI is read', async () => { await page.locator('.sync-indicator').click(); await page.getByRole('dialog').first().waitFor(); }, async () => { await escape(page); });
      await visitScrolling(page, 'settings connection while model metadata is read', async () => { await openSettings(page, 1); }, () => settingsPanel(page));
      // The line a person reported: the state must read with its numbers, never with a placeholder.
      expect(await settingsPanel(page).innerText()).not.toContain('{{');
      await visitScrolling(page, 'settings sync while model metadata is read', async () => { await openSettings(page, 2); }, () => settingsPanel(page));
      await closeSettings(page);
    }
    await sync.catch(() => undefined);
    await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
    await page.waitForTimeout(600);
    await escape(page);
    if (wants('reading')) {
      await visit(page, 'first screen, ComfyUI read');
      await visit(page, 'sync indicator after reading', async () => { await page.locator('.sync-indicator').click(); await page.getByRole('dialog').first().waitFor(); }, async () => { await escape(page); });
    }

    // ---------- The library with a real catalog ----------
    if (wants('library')) {
      await visitScrolling(page, 'library nodes', async () => { await railTab(page, 0); await rail.locator('input').first().fill(''); }, () => page.locator('#node-library-list'));
      await visit(page, 'library nodes, search', async () => { await railTab(page, 0); await rail.locator('input').first().fill('lora'); await page.waitForTimeout(250); });
      await railTab(page, 0);
      await rail.locator('input').first().fill('');
      await visitScrolling(page, 'library models', async () => { await railTab(page, 1); await rail.locator('input').first().fill(''); }, () => page.locator('#model-library-list'));
      const modelRow = (text: string) => page.locator('#model-library-list').getByRole('option').filter({ hasText: text }).first();
      for (const [label, query] of [['a LoRA with a long name', 'wan2.2_i2v_A14b_high'], ['a checkpoint', 'juggernaut'], ['a file nothing is known about', 'mystery_style']] as const) {
        await visitScrolling(page, `model card, ${label}`, async () => {
          await railTab(page, 1);
          await rail.locator('input').first().fill(query);
          await page.waitForTimeout(300);
          if (await page.getByRole('dialog').count() === 0) await modelRow(query).click();
          await page.getByRole('dialog').first().waitFor();
          await page.waitForTimeout(450);
        }, () => page.getByRole('dialog').first(), async () => { await escape(page); });
      }
      await visit(page, 'library models, a row menu', async () => {
        await railTab(page, 1);
        await rail.locator('input').first().fill('wan2.2');
        await page.waitForTimeout(300);
        await modelRow('wan2.2').click({ button: 'right' });
        await page.getByRole('menu').first().waitFor();
      }, async () => { await escape(page); });
      await railTab(page, 1);
      await rail.locator('input').first().fill('');
      await visit(page, 'library subgraphs, none yet', async () => { await railTab(page, 2); });
      await railTab(page, 0);
    }

    // ---------- A helper with a long name, a project with a long name ----------
    await saveSettings(page, { provider: 'local', model: LONG_MODEL, baseURL: 'http://127.0.0.1:9' });
    await commit(page, { type: 'set-process', title: LONG_PROJECT, notes: '' });
    // The page learns of a commit made past it when it reads the project again.
    await reloaded(page);
    if (wants('names')) {
      await visit(page, 'top bar with long names');
      await visit(page, 'helper choice with a long model name', async () => { await page.locator('#chat-provider').click(); await page.getByRole('listbox').waitFor(); }, async () => { await escape(page); });
      await visit(page, 'first screen, everything set up');
      await visitScrolling(page, 'settings helper, own model with a long name', async () => { await openSettings(page, 0); }, () => settingsPanel(page));
      await closeSettings(page);
    }

    // ---------- The canvas: nodes with fields, pickers, properties ----------
    for (const name of ['CheckpointLoaderSimple', 'LoraLoader', 'CLIPTextEncode', 'KSampler']) await addFromLibrary(page, name);
    await rail.locator('input').first().fill('');
    await expect(nodes, 'four nodes from the library').toHaveCount(4);
    await page.keyboard.press('Control+Shift+L');
    await page.waitForTimeout(900);
    if (wants('canvas')) {
      const fit = async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); };
      await visit(page, 'canvas with four nodes, fitted', fit);
      await visit(page, 'canvas with four nodes, 100 %', async () => { await fit(); await page.keyboard.press('Control+0'); await page.waitForTimeout(450); });
      await visit(page, 'canvas with every description shown', async () => {
        const toggle = page.getByRole('button', { name: T('canvas.descriptions'), exact: true });
        for (let turn = 0; turn < 3 && (await toggle.getAttribute('data-descriptions-mode')) !== 'all'; turn += 1) await toggle.click();
        await fit();
      });
      const count = await nodes.count();
      for (let index = 0; index < count; index += 1) {
        await visitScrolling(page, `properties of node ${index + 1}`, async () => {
          await page.locator('.react-flow__controls-fitview').click();
          await page.waitForTimeout(350);
          await nodes.nth(index).locator('.graph-node-title').click();
          await dockTab(page, 2);
        }, () => dockPanel(page));
      }
      const lora = nodes.filter({ hasText: 'LoraLoader' }).first();
      const sampler = nodes.filter({ hasText: 'latent_image' }).first();
      await visit(page, 'a list of files in properties', async () => {
        await fit();
        await lora.locator('.graph-node-title').click();
        await dockTab(page, 2);
        await dockPanel(page).getByRole('combobox').first().click();
        await page.getByRole('listbox').first().waitFor();
        await page.waitForTimeout(500);
      }, async () => { await escape(page); });
      await visit(page, 'a list of values in properties', async () => {
        await fit();
        await sampler.locator('.graph-node-title').click();
        await dockTab(page, 2);
        await dockPanel(page).getByRole('combobox').last().click();
        await page.getByRole('listbox').first().waitFor();
      }, async () => { await escape(page); });
      const closeUp = async (node: Locator) => {
        await fit();
        await node.locator('.graph-node-title').click();
        const box = await node.boundingBox();
        if (!box) throw new Error('the node is not on screen');
        await page.mouse.move(box.x + box.width / 2, box.y + 12);
        for (let turn = 0; turn < 8 && await node.getByRole('combobox').count() === 0; turn += 1) {
          await page.mouse.wheel(0, -240);
          await page.waitForTimeout(160);
        }
        await page.waitForTimeout(300);
      };
      await visit(page, 'a list of files on a node', async () => {
        await closeUp(lora);
        await lora.getByRole('combobox').first().click();
        await page.getByRole('listbox').first().waitFor();
        await page.waitForTimeout(500);
      }, async () => { await escape(page); });
      await visit(page, 'a list of values on a node', async () => {
        await closeUp(sampler);
        await sampler.getByRole('combobox').first().click();
        await page.getByRole('listbox').first().waitFor();
      }, async () => { await escape(page); });
      await visit(page, 'right-click on a node', async () => {
        await fit();
        await sampler.locator('.graph-node-title').click({ button: 'right' });
        await page.getByRole('menu').first().waitFor();
      }, async () => { await escape(page); });
      await visit(page, 'right-click on the canvas', async () => {
        await fit();
        const pane = await page.locator('.react-flow__pane').boundingBox();
        if (!pane) throw new Error('no canvas');
        await page.mouse.click(pane.x + 24, pane.y + pane.height - 24, { button: 'right' });
        await page.getByRole('menu').first().waitFor();
      }, async () => { await escape(page); });
      await visit(page, 'add node search', async () => {
        await page.locator('[data-canvas-add-node]').click();
        const search = page.getByRole('dialog', { name: T('canvas.addNode') });
        await search.waitFor();
        await search.locator('input').fill('loader');
        await page.waitForTimeout(250);
      }, async () => { await escape(page); });
      await visit(page, 'tour of the graph', async () => {
        await fit();
        await page.getByRole('button', { name: T('canvas.tourStart'), exact: true }).click();
        await page.locator('[data-tour-step]').waitFor();
        await page.waitForTimeout(900);
      }, async () => { await escape(page); await page.waitForTimeout(200); });
    }

    // ---------- The helper: answers, suggestions, a build ----------
    // What a live model writes: a heading, a table, a quote, a long command, a link. Put into the chat history,
    // since the TEST helper answers in plain sentences.
    const now = Date.now();
    await api('saveChatMessage', [{ id: `layout-walk-q-${now}`, projectId: 'desktop', role: 'user', content: LONG_QUESTION, timestamp: now, graphRevisionId: null, toolCalls: null }]);
    await api('saveChatMessage', [{ id: `layout-walk-a-${now}`, projectId: 'desktop', role: 'assistant', content: MODEL_ANSWER, timestamp: now + 1, graphRevisionId: null, toolCalls: null }]);
    await reloaded(page);
    if (wants('helper')) {
      await visitScrolling(page, 'helper, an answer the way a model writes it', async () => { await dockTab(page, 0); }, () => page.locator('.chat-log'));
    }
    await page.locator('#chat-provider').click();
    await page.getByRole('option', { name: /TEST/ }).first().click();
    await page.waitForTimeout(500);
    if (wants('helper')) {
      await visit(page, 'helper, empty chat', async () => { await dockTab(page, 0); });
      await dockTab(page, 0);
      for (const question of [LONG_QUESTION, 'propose a sampler']) {
        await composer.fill(question);
        await composer.press('Enter');
        await page.waitForTimeout(4500);
      }
      await visitScrolling(page, 'helper, answers and a suggestion', async () => { await dockTab(page, 0); }, () => page.locator('.chat-log'));
      await visit(page, 'canvas with a suggested node', async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); });
    }
    await dockTab(page, 0);
    await page.getByRole('button', { name: T('chat.intentBuild'), exact: true }).click();
    await composer.fill('build a text to image graph');
    await composer.press('Enter');
    if (wants('helper')) {
      // The camera follows the build: at every size the step's bubble must stand clear of the strip and the toolbar.
      const bubble = page.locator('[data-build-callout]');
      const strip = page.locator('[data-live-build]');
      for (const size of SIZES) {
        try {
          await page.setViewportSize(size);
          const before = await bubble.getAttribute('data-build-callout', { timeout: 20_000 }).catch(() => null);
          // The next step centres for the window as it is now.
          await expect.poll(async () => bubble.getAttribute('data-build-callout').catch(() => null), { timeout: 12_000 }).not.toBe(before);
          await page.waitForTimeout(1100);
          const extra: LayoutIssue[] = [];
          const bubbleBox = await bubble.boundingBox().catch(() => null);
          const under = overlapOf(bubbleBox, await strip.boundingBox().catch(() => null)) || overlapOf(bubbleBox, await page.getByRole('toolbar', { name: T('canvas.toolbar') }).boundingBox().catch(() => null));
          if (under > 0) extra.push({ kind: 'overlap', where: 'the build bubble', text: (await bubble.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 70), detail: `under the build strip or the canvas toolbar by ${under}px` });
          await auditNow(page, 'helper, a build in progress', size, extra);
        } catch (error) {
          unreached.push(`helper, a build in progress at ${size.width}x${size.height}: ${String((error as Error).message).split('\n')[0]}`);
        }
      }
      await page.setViewportSize(HOME);
    }
    await expect(page.locator('.build-summary, [data-build-summary]').first()).toBeVisible({ timeout: 120_000 }).catch(() => undefined);
    await page.waitForTimeout(3200);
    if (wants('helper')) {
      await visitScrolling(page, 'helper, a finished build', async () => { await dockTab(page, 0); }, () => page.locator('.chat-log'));
      await visit(page, 'canvas after a build', async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); });
      await visitScrolling(page, 'explanations', async () => { await dockTab(page, 1); }, () => dockPanel(page));
      await visit(page, 'check panel, before a check', async () => { await dockTab(page, 3); });
      await dockTab(page, 3);
      await dockPanel(page).getByRole('button').first().click();
      await page.waitForTimeout(1500);
      await visitScrolling(page, 'check panel, findings', async () => { await dockTab(page, 3); }, () => dockPanel(page));
      // From 1280 px the window holds Properties and the helper side by side.
      const both = page.getByRole('button', { name: T('dock.showBoth'), exact: true });
      await visit(page, 'both right panels side by side', async (size) => {
        await dockTab(page, 0);
        if (size.width >= 1280) await both.click();
        await page.waitForTimeout(400);
      }, async () => {
        // Leaving the pair returns the tabs, which the next stop clicks.
        if (await both.count() > 0 && (await both.getAttribute('aria-pressed')) === 'true') await both.click();
        await page.waitForTimeout(300);
      });
    }

    // ---------- A build that could not be made: the helper asked for a node this ComfyUI does not have ----------
    if (wants('helper')) {
      await dockTab(page, 0);
      await page.getByRole('button', { name: T('chat.intentBuild'), exact: true }).click();
      await composer.fill('Build a long chain');
      await composer.press('Enter');
      await page.waitForTimeout(5000);
      await visitScrolling(page, 'helper, a build that failed', async () => {
        await dockTab(page, 0);
        await page.locator('.chat-log').evaluate((el) => { el.scrollTop = el.scrollHeight; });
      }, () => page.locator('.chat-log'));
    }

    // ---------- Windows that open over the app ----------
    if (wants('windows')) {
      await visit(page, 'keyboard shortcuts', async () => { await page.keyboard.press('F1'); await page.getByRole('dialog').first().waitFor(); }, async () => { await escape(page); });
      await visitScrolling(page, 'conversation log', async () => {
        if (await page.locator('.model-log-dialog').count() === 0) {
          await menus.last().click();
          await page.getByRole('menuitem', { name: T('modelLog.menu') }).click();
          await page.locator('.model-log-dialog').waitFor();
        }
      }, () => page.locator('.model-log-dialog ul').first(), async () => { await escape(page); });
      await visit(page, 'about', async () => {
        await menus.last().click();
        await page.getByRole('menu').getByRole('menuitem').last().click();
        await page.getByRole('dialog').first().waitFor();
      }, async () => { await escape(page); });
    }

    // ---------- A subgraph and a group ----------
    await commit(page, { type: 'import-workflow', document: nestedSubgraphWorkflow });
    await reloaded(page);
    if (wants('subgraph')) {
      await visit(page, 'canvas with a subgraph and a group', async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); });
      await visit(page, 'library subgraphs', async () => { await railTab(page, 2); });
      await visitScrolling(page, 'properties of a subgraph node', async () => {
        await page.locator('.react-flow__controls-fitview').click();
        await page.waitForTimeout(350);
        await nodes.filter({ hasText: 'Prompt block' }).first().locator('.graph-node-title').click();
        await dockTab(page, 2);
      }, () => dockPanel(page));
      await nodes.filter({ hasText: 'Prompt block' }).first().getByRole('button', { name: T('node.enterLabel', { name: 'Prompt block' }) }).click();
      await page.waitForTimeout(800);
      await visit(page, 'inside a subgraph', async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); });
      await visitScrolling(page, 'properties of a node inside a subgraph', async () => {
        await page.locator('.react-flow__controls-fitview').click();
        await page.waitForTimeout(350);
        await page.locator('.react-flow__node .graph-node-title').first().click();
        await dockTab(page, 2);
      }, () => dockPanel(page));
    }
  } catch (error) {
    // The walk itself lost its way: said in the report, with everything it found up to there.
    unreached.push(`the walk stopped: ${String((error as Error).message).split('\n').slice(0, 4).join(' | ')}`);
    await shot(page, 'the walk stopped', HOME);
  } finally {
    await app.close().catch(() => undefined);
    await fake.close().catch(() => undefined);
  }

  // ---------- The verdict ----------
  const byKind = new Map<string, number>();
  for (const finding of findings) for (const issue of finding.issues) byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1);
  // Each fault once, with every stop and size it shows at.
  const grouped = new Map<string, { issue: LayoutIssue; at: string[] }>();
  for (const finding of findings) {
    for (const issue of finding.issues) {
      const key = `${issue.kind}|${issue.where}|${issue.text}`;
      const entry = grouped.get(key) ?? { issue, at: [] };
      entry.at.push(`${finding.stop} @ ${finding.size}`);
      grouped.set(key, entry);
    }
  }
  const summary = [...grouped.values()]
    .sort((a, b) => a.issue.kind.localeCompare(b.issue.kind) || b.at.length - a.at.length)
    .map((entry) => `[${entry.issue.kind}] ${entry.issue.where}\n    "${entry.issue.text}"\n    ${entry.issue.detail}\n    seen ${entry.at.length}×, e.g. ${entry.at.slice(0, 4).join('; ')}`);
  const i18nErrors = [...new Set(consoleErrors.filter((line) => line.includes('[i18n]')))];
  const text = [
    `language ${LANG}; sizes ${SIZES.map((size) => `${size.width}x${size.height}`).join(', ')}; looked at ${visited.length} screens in ${Math.round((Date.now() - started) / 1000)} s; with something to say: ${findings.length}; distinct faults: ${grouped.size}; by kind: ${JSON.stringify([...byKind])}`,
    unreached.length ? `not reached:\n${unreached.map((line) => `  ${line}`).join('\n')}` : 'every stop was reached',
    consoleErrors.length ? `console errors:\n${[...new Set(consoleErrors)].map((line) => `  ${line.slice(0, 300)}`).join('\n')}` : 'no console errors',
    '==== distinct faults ====',
    ...summary,
    '==== by stop ====',
    ...findings.map((finding) => `${finding.stop} @ ${finding.size}\n${describeIssues(finding.issues)}`),
  ].join('\n\n');
  if (OUT) fs.writeFileSync(path.join(OUT, `report-${LANG}.txt`), text);
  if (REPORT_ONLY) {
    console.log(text.slice(0, 6000));
    return;
  }
  const short = [`language ${LANG}`, ...summary].join('\n\n');
  expect(unreached, short).toEqual([]);
  expect(i18nErrors, short).toEqual([]);
  expect(summary.join('\n\n'), 'faults of layout').toBe('');
});
