import { test, expect, _electron as electron, type CDPSession, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { pseudoText } from '../../src/shared/i18n/pseudo';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranslator } from '../../src/shared/i18n';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';
import { auditLayout, describeIssues, type LayoutIssue } from './layoutAudit';
import { APP_AUDIT, attachmentIssues } from './layoutProfile';

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
 * LAYOUT_ONLY=canvas,helper walks only those parts (their set-up still runs). The parts: fresh, paused, settings,
 * reading, library, lessons, names, canvas, helper, windows, subgraph.
 * LAYOUT_OUT=<dir> keeps a report and a screenshot of every stop that has something to say; LAYOUT_SHOTS=all keeps
 * a screenshot of every stop. LAYOUT_REPORT=1 only reports and does not fail.
 *
 * Three more switches for what differs between this machine and a person's desktop:
 * LAYOUT_FONTS=hinted draws text the way a desktop does (fixtures/fonts-hinted.conf): every label a little wider.
 * LAYOUT_TEXT=wide spaces all letters out by two hundredths of their size (about four percent more width): what
 * fits only to the pixel does not fit then, whatever the reason on a real machine (hinting, another font version).
 * LAYOUT_DPR=1.5 draws at a screen scale of 150 % (the sizes above stay in the app's own pixels).
 * LAYOUT_BREAK=cards breaks description cards on purpose; the walk must fail then.
 */

const LANG = process.env.LAYOUT_LANG === 'en' ? 'en' : 'ru';
const OUT = process.env.LAYOUT_OUT ?? '';
const ALL_SHOTS = process.env.LAYOUT_SHOTS === 'all';
const REPORT_ONLY = process.env.LAYOUT_REPORT === '1';
const ONLY = (process.env.LAYOUT_ONLY ?? '').split(',').map((part) => part.trim()).filter(Boolean);
const HINTED_FONTS = process.env.LAYOUT_FONTS === 'hinted';
const WIDE_TEXT = process.env.LAYOUT_TEXT === 'wide';
/**
 * LAYOUT_TEXT=pseudo draws every text of the app about 40 % longer, with accented letters (the pseudo-translation of
 * src/shared/i18n/pseudo.ts): a longer language is tried before it is written. LAYOUT_NAMES=wide adds node titles and
 * file names in Chinese, Japanese, Korean and long German to the catalog the walk reads.
 */
const PSEUDO_TEXT = process.env.LAYOUT_TEXT === 'pseudo';
const WIDE_NAMES = process.env.LAYOUT_NAMES === 'wide';
const DPR = Number(process.env.LAYOUT_DPR ?? '') || 0;
const PLAIN_T = createTranslator(LANG);
/** The walk finds controls by their names on screen: under LAYOUT_TEXT=pseudo those are the stretched texts too. */
const T: typeof PLAIN_T = (key, options) => (process.env.LAYOUT_TEXT === 'pseudo' ? pseudoText(PLAIN_T(key, options)) : PLAIN_T(key, options));

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
  'python main.py --listen 0.0.0.0 --port 18188 --preview-method auto --use-split-cross-attention --output-directory /mnt/storage/comfy/output',
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

/** How wide the menus are drawn: the proof, in the report, that the fonts and the letter spacing asked for are on. */
const menuWidths: number[] = [];
async function noteMenuWidth(page: Page): Promise<void> {
  const width = await page.evaluate(() => {
    const menus = Array.from(document.querySelectorAll('.document-bar [role="menuitem"]'));
    return Math.round(menus.reduce((sum, menu) => sum + menu.getBoundingClientRect().width, 0) * 100) / 100;
  }).catch(() => 0);
  menuWidths.push(width);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9а-я]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function shot(page: Page, stop: string, size: Size): Promise<void> {
  if (!OUT) return;
  shotIndex += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotIndex).padStart(3, '0')}-${slug(stop)}-${size.width}x${size.height}.png`) }).catch(() => undefined);
}

async function auditNow(page: Page, stop: string, size: Size, extra: LayoutIssue[] = []): Promise<void> {
  const issues = [...await auditLayout(page, AUDIT), ...await attachmentIssues(page), ...extra];
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
      await resize(page, size);
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
  await resize(page, HOME);
  await page.waitForTimeout(120);
}

/** A stop with a panel that scrolls: every part of it passes through view at every size. */
async function visitScrolling(page: Page, stop: string, reach: (size: Size) => Promise<void>, scroller: () => Locator, leave: () => Promise<void> = async () => undefined): Promise<void> {
  for (const size of SIZES) {
    try {
      await resize(page, size);
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
  await resize(page, HOME);
  await page.waitForTimeout(120);
}

async function launch(userData: string): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  if (HINTED_FONTS) env.FONTCONFIG_FILE = path.join(__dirname, 'fixtures/fonts-hinted.conf');
  if (PSEUDO_TEXT) env.NODEWISE_PSEUDO_LOCALE = '1';
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror ${error.message}`));
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await resize(page, HOME);
  await dressPage(page);
  return { app, page };
}

/**
 * The window takes a size in the app's own pixels. With LAYOUT_DPR the screen scale is set too, the way a desktop
 * at 125 % or 150 % has it. The scale lives as long as the session that set it, so one session serves the whole
 * walk (a session opened and closed for each resize dropped the scale at once, and the walk went on in a plain
 * window without saying so). Whatever the way, the window is then asked what it is: a walk in a window of
 * another size or scale than the one named in the report is worth nothing.
 */
let metrics: CDPSession | null = null;
async function resize(page: Page, size: Size): Promise<void> {
  if (DPR > 0) {
    metrics ??= await page.context().newCDPSession(page);
    await metrics.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: DPR, mobile: false });
  } else {
    await page.setViewportSize(size);
  }
  const wanted = `${size.width}x${size.height} at ${DPR > 0 ? DPR : 1}`;
  let actual = '';
  for (let turn = 0; turn < 20; turn += 1) {
    actual = await page.evaluate(() => `${window.innerWidth}x${window.innerHeight} at ${window.devicePixelRatio}`);
    if (actual === wanted) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`the window is ${actual} where ${wanted} was asked for`);
}

/**
 * LAYOUT_TEXT=wide: every letter a little further from the next, on every page the walk loads.
 * LAYOUT_BREAK=cards breaks the app on purpose (description cards stop following the canvas zoom): the walk must
 * then fail. It is how to see that a clean walk is not a blind one.
 */
async function dressPage(page: Page): Promise<void> {
  if (WIDE_TEXT) await page.addStyleTag({ content: '*, *::before, *::after { letter-spacing: 0.02em !important; }' });
  if (process.env.LAYOUT_BREAK === 'cards') await page.addStyleTag({ content: '.description-scale { transform: none !important; }' });
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
  await dressPage(page);
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
  const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `layout-walk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]);
  expect(outcome, `layout mutation ${JSON.stringify(payload)}`).toMatchObject({ status: 'applied' });
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
  // A changed draft asks before it is thrown away; the walk throws it away.
  const discard = page.locator('[role="dialog"].settings-discard');
  if (await discard.isVisible().catch(() => false)) {
    await discard.getByRole('button', { name: T('settings.discardConfirm'), exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
}

const lessonPanel = (page: Page): Locator => page.locator('.lesson-panel');

/** The helper panel in its "Learn" mode, whether the panel is a full one or a strip of icons. */
async function learnMode(page: Page): Promise<void> {
  await dockTab(page, 0);
  if (await lessonPanel(page).count() === 0) await page.locator('[data-intent="learn"]').click();
  await lessonPanel(page).waitFor();
  await page.waitForTimeout(200);
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

async function nodePositions(page: Page): Promise<string> {
  const projection = await bridge(page)('readProjection', ['desktop']) as { snapshot: { nodes: Array<{ id: string; position: { x: number; y: number } }> } };
  return projection.snapshot.nodes.map((node) => `${node.id}:${Math.round(node.position.x)},${Math.round(node.position.y)}`).join(' ');
}

async function descriptionsMode(page: Page): Promise<'all' | 'own' | 'off'> {
  const mode = await page.getByRole('button', { name: T('canvas.descriptions'), exact: true }).getAttribute('data-descriptions-mode');
  return mode === 'all' || mode === 'off' ? mode : 'own';
}

/** Two boxes of the canvas's own making must not lie on each other: the app put both where they are. */
function overlapOf(a: { x: number; y: number; width: number; height: number } | null, b: { x: number; y: number; width: number; height: number } | null): number {
  if (!a || !b) return 0;
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 2 && y > 2 ? Math.round(y) : 0;
}

test('nothing sticks out, is cut or overlaps on any screen at any window size', async () => {
  test.setTimeout(5_400_000);
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  // With ComfyUI's video nodes, so every lesson fits and is walked.
  const fake: FakeMcp = await startFakeMcp({ extraLoras: 300, video: true, wideNames: WIDE_NAMES });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-walk-'));
  const { app, page } = await launch(userData);
  const api = bridge(page);
  const started = Date.now();
  try {
    await saveSettings(page, { language: LANG });
    await noteMenuWidth(page);
    const rail = page.locator('#library-rail');
    const composer = page.locator('.composer-field textarea');
    const menus = page.locator('.document-bar [role="menuitem"]');
    const nodes = page.locator('.react-flow__node');

    // ---------- A fresh profile ----------
    if (wants('fresh')) {
      await visit(page, 'first screen');
      await visitScrolling(page, 'lessons before ComfyUI is read', async () => { await learnMode(page); }, () => lessonPanel(page));
      await page.locator('[data-intent="ask"]').click();
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
      // The connection failed: the first step says why and offers its longest button ("open the connection
      // settings"), which once ran out of its card over the next one.
      await saveSettings(page, { mcpUrl: 'http://127.0.0.1:9/mcp', mcpAuth: 'none' });
      await api('syncNow').catch(() => undefined);
      await expect(page.locator('[data-step="connect"][data-state="problem"]')).toHaveCount(1, { timeout: 60_000 });
      await visit(page, 'first screen, the connection failed');
      await saveSettings(page, { mcpUrl: '' });
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
        if (await key.count() > 0 && await key.isVisible() && await key.isEnabled()) {
          await key.fill('sk-layout-walk-not-a-real-key-0123456789abcdef');
          await page.waitForTimeout(2500);
          await visitScrolling(page, `settings helper, choice ${index + 1}, key pasted`, async () => { await openSettings(page, 0); }, () => settingsPanel(page));
        }
      }
      // The settings window is resized by its corner: at its smallest and at its largest every section still fits it.
      const resizeSettings = async (width: string, height: string) => {
        await settingsDialog(page).evaluate((el, size) => { (el as HTMLElement).style.width = size.width; (el as HTMLElement).style.height = size.height; }, { width, height });
        await page.waitForTimeout(200);
      };
      for (const [label, width, height] of [['smallest', '1px', '1px'], ['largest', '4000px', '4000px']] as const) {
        for (let section = 0; section < 8; section += 1) {
          await visitScrolling(page, `settings section ${section + 1}, window at its ${label}`, async () => { await openSettings(page, section); await resizeSettings(width, height); }, () => settingsPanel(page));
        }
      }
      await resizeSettings('', '');
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
      // Privacy: turning on adult content first shows the rules and asks for one word; Escape leaves it off.
      const adultDialog = page.locator('[role="dialog"].adult-content-dialog');
      await visit(page, 'settings privacy, the rules before adult content', async () => {
        const privacy = await openSettings(page, 6);
        if (await adultDialog.count() === 0) await privacy.getByRole('switch', { name: T('preferences.adultContent') }).click();
        await adultDialog.waitFor();
      }, async () => { await escape(page); });
      await closeSettings(page);
    }

    // ---------- ComfyUI is read: while it runs, and with 300 LoRAs waiting for their metadata ----------
    await saveSettings(page, { mcpUrl: fake.url, mcpAuth: 'none' });
    const sync = api('syncNow');
    await page.waitForTimeout(250);
    if (wants('reading')) {
      await visit(page, 'top bar while ComfyUI is read');
      await visitScrolling(page, 'sync indicator while ComfyUI is read', async () => { await page.locator('.sync-indicator').click(); await page.getByRole('dialog').first().waitFor(); }, () => page.getByRole('dialog', { name: T('settings.sync'), exact: true }).locator(':scope > div').first(), async () => { await escape(page); });
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
      await visitScrolling(page, 'sync indicator after reading', async () => { await page.locator('.sync-indicator').click(); await page.getByRole('dialog').first().waitFor(); }, () => page.getByRole('dialog', { name: T('settings.sync'), exact: true }).locator(':scope > div').first(), async () => { await escape(page); });
    }

    // ---------- The library with a real catalog ----------
    if (wants('library')) {
      await visitScrolling(page, 'library nodes', async () => { await railTab(page, 0); await rail.locator('input').first().fill(''); }, () => page.locator('#node-library-list'));
      await visit(page, 'library nodes, search', async () => { await railTab(page, 0); await rail.locator('input').first().fill('lora'); await page.waitForTimeout(250); });
      // A node's card: what it is for, what goes in, what each setting takes, what comes out.
      for (const [label, query, classType] of [
        ['a node of ComfyUI itself, with what the app knows of it', 'KSampler', 'KSampler'],
        ['a node from a pack, described by its author', 'Color Match', 'ColorMatch'],
        ['a node nobody described', 'Get Image Size', 'GetImageSizeAndCount'],
      ] as const) {
        await visitScrolling(page, `node card, ${label}`, async () => {
          await railTab(page, 0);
          await rail.locator('input').first().fill(query);
          await page.waitForTimeout(300);
          if (await page.locator('.node-card').count() === 0) await page.locator(`#node-library-list [data-node-class="${classType}"]`).click();
          await page.locator('.node-card').waitFor();
          await page.waitForTimeout(450);
        }, () => page.locator('.node-card'), async () => { await escape(page); });
      }
      await railTab(page, 0);
      await rail.locator('input').first().fill('');
      await visitScrolling(page, 'library models', async () => { await railTab(page, 1); await rail.locator('input').first().fill(''); }, () => page.locator('#model-library-list'));
      // By its file name: a row may be headed by the name the file's author gave it.
      const modelRow = (text: string) => page.locator(`#model-library-list [data-model*="${text}"]`).first();
      // What a model manager keeps next to the files is read in the background after the listing: a card is
      // looked at with it, so the walk waits for the description of the file it reads last.
      await expect.poll(async () => ((await api('modelDetail', ['checkpoints', 'juggernautXL_v9.safetensors'])) as { title?: string } | null)?.title ?? '', { timeout: 120_000 }).toBe('Juggernaut XL');
      for (const [label, query] of [
        ['a LoRA with a long name and a clip for a preview', 'wan2.2_i2v_A14b_high'],
        ['a checkpoint with a picture and its author\'s name', 'juggernaut'],
        ['a LoRA with a picture, tags, usage and examples', 'pixel-art-xl'],
        ['a file its author marked as adult content', 'flux_realism'],
        ['a file nothing is known about', 'mystery_style'],
      ] as const) {
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

    // ---------- Lessons: the list, a step that explains, a step to do, the search a lesson opens, a lesson done ----------
    if (wants('lessons')) {
      const lessons = lessonPanel(page);
      const startLesson = async (id: string) => {
        await learnMode(page);
        if ((await lessons.getAttribute('data-lesson')) === id) return;
        if ((await lessons.getAttribute('data-lesson')) !== 'list') await lessons.getByRole('button', { name: T('lessons.back'), exact: true }).click();
        await lessons.locator(`[data-lesson-card="${id}"]`).getByRole('button').first().click();
        await expect(lessons).toHaveAttribute('data-lesson', id);
      };
      const toList = async () => {
        await learnMode(page);
        if ((await lessons.getAttribute('data-lesson')) !== 'list') await lessons.getByRole('button', { name: T('lessons.back'), exact: true }).click();
        await expect(lessons).toHaveAttribute('data-lesson', 'list');
      };
      // In a new profile the lessons for adults are one closed row at the end; the walk then opens them.
      await visitScrolling(page, 'lessons, the list', toList, () => lessons);
      await saveSettings(page, { preferences: { privacy: { showMarkedPreviews: true } } });
      await visitScrolling(page, 'lessons, the list with the lessons for adults', toList, () => lessons);
      // A lesson that is all words first: the rules, said before anything else.
      await visitScrolling(page, 'lessons, a step that explains', async () => { await startLesson('adult'); }, () => lessons);
      await visitScrolling(page, 'lessons, the first step of a video lesson', async () => { await startLesson('video-text'); }, () => lessons);
      // A step to do: what it lacks, and the two things the app offers.
      await startLesson('image');
      await lessons.getByRole('button', { name: T('lessons.understood'), exact: true }).click();
      await expect(lessons.locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'model');
      await visitScrolling(page, 'lessons, a step to do', async () => { await startLesson('image'); }, () => lessons);
      await visit(page, 'lessons, the node search a lesson opens', async () => {
        await startLesson('image');
        await lessons.getByRole('button', { name: T('lessons.show'), exact: true }).click();
        await page.getByRole('dialog', { name: T('canvas.addNode') }).waitFor();
      }, async () => { await escape(page); });
      // The lesson carried through: the app does what it can, the person writes the description.
      await resize(page, HOME);
      await startLesson('image');
      const stepNow = () => lessons.locator('[data-lesson-step]').getAttribute('data-lesson-step');
      const revision = async () => ((await api('readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
      let linkShown = false;
      for (let guard = 0; guard < 60 && (await stepNow()) !== 'end'; guard += 1) {
        const doIt = lessons.getByRole('button', { name: T('lessons.doIt'), exact: true });
        const read = lessons.getByRole('button', { name: T('lessons.understood'), exact: true });
        if (!linkShown && (await stepNow()) === 'prompts-clip') {
          // A link to make: "show me where" lights the output it starts from and everything it can go into.
          linkShown = true;
          await visit(page, 'lessons, a link a lesson lights on the canvas', async () => {
            await startLesson('image');
            await lessons.getByRole('button', { name: T('lessons.show'), exact: true }).click();
            await page.waitForTimeout(700);
          });
          await resize(page, HOME);
          await startLesson('image');
          continue;
        }
        if (await doIt.count() > 0) {
          const before = await revision();
          await doIt.click();
          await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
          await page.waitForTimeout(150);
        } else if (await read.count() > 0) {
          const before = await stepNow();
          await read.click();
          await expect.poll(stepNow).not.toBe(before);
        } else {
          const field = page.locator('.react-flow__node textarea').first();
          await field.fill(LANG === 'ru' ? 'тихое озеро на рассвете, туман' : 'a quiet lake at dawn, mist');
          await field.blur();
          await expect.poll(stepNow, { timeout: 15_000 }).not.toBe('prompt-text');
        }
      }
      await expect(lessons.locator('[data-lesson-step]'), 'the picture lesson came to its end').toHaveAttribute('data-lesson-step', 'end');
      await visitScrolling(page, 'lessons, a lesson done', async () => { await startLesson('image'); }, () => lessons);
      await visitScrolling(page, 'lessons, the list with a lesson done', toList, () => lessons);
      // The canvas the lesson left: seven nodes where the app put them, a card under each.
      const fitView = async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); };
      await visit(page, 'canvas after a lesson', fitView);

      // The lessons that are mostly words (how a description is read, how models are combined): every step of
      // each, at every size. A lesson is carried the way a person carries it: what explains is read, the app does
      // what it offers, and a file or a description is the person's choice.
      type Held = { id: string; data: { comfyType: string; parameters: Record<string, unknown> } };
      const held = async () => ((await api('readProjection', ['desktop'])) as { snapshot: { nodes: Held[] } }).snapshot.nodes;
      const FILE_FIELD: Record<string, { key: string; values: string[] }> = {
        CheckpointLoaderSimple: { key: 'ckpt_name', values: ['juggernautXL_v9.safetensors', 'ponyDiffusionV6XL.safetensors'] },
        UNETLoader: { key: 'unet_name', values: ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'] },
        CLIPLoader: { key: 'clip_name', values: ['umt5_xxl_fp8_e4m3fn_scaled.safetensors'] },
        VAELoader: { key: 'vae_name', values: ['wan_2.1_vae.safetensors'] },
        LoadImage: { key: 'image', values: ['example.png'] },
        WanVideoModelLoader: { key: 'model', values: ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'] },
        LoadWanVideoT5TextEncoder: { key: 'model_name', values: ['umt5_xxl_fp8_e4m3fn_scaled.safetensors'] },
        WanVideoVAELoader: { key: 'model_name', values: ['wan_2.1_vae.safetensors'] },
        WanVideoVACEModelSelect: { key: 'vace_model', values: ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'] },
        MultiTalkModelLoader: { key: 'model', values: ['z_image_turbo_bf16.safetensors'] },
        Wav2VecModelLoader: { key: 'model', values: ['chinese-wav2vec2-base-fp16.safetensors'] },
        CLIPVisionLoader: { key: 'clip_name', values: ['clip_vision_h.safetensors'] },
        LoadVideo: { key: 'file', values: ['dance.mp4'] },
        LoadAudio: { key: 'audio', values: ['voice.wav', 'voice2.wav'] },
        FantasyTalkingModelLoader: { key: 'model', values: ['z_image_turbo_bf16.safetensors'] },
        WanVideoLoraSelect: { key: 'lora', values: ['wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors'] },
        WanVideoExtraModelSelect: { key: 'extra_model', values: ['z_image_turbo_bf16.safetensors'] },
        // Two files on one node, as with the pose finder below.
        OviMMAudioVAELoader: { key: 'vae', values: ['mmaudio_vae_16k_fp32.safetensors', 'mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors'] },
        // Two files on one node: the field the step asks for is read off what it says is missing.
        OnnxDetectionModelLoader: { key: 'vitpose_model', values: ['vitpose-l-wholebody.onnx', 'yolov10m.onnx'] },
      };
      const WORDS = 'A young woman in a red coat walks slowly along a wet city street at night. The camera follows her from the side. Soft cinematic light.';
      const carryLesson = async (id: string, label: string | null) => {
        const lesson = LESSONS.find((item) => item.id === id)!;
        await resize(page, HOME);
        await startLesson(id);
        let seen = '';
        for (let guard = 0; guard < 200 && (await stepNow()) !== 'end'; guard += 1) {
          const stepId = String(await stepNow());
          if (label && stepId !== seen) {
            seen = stepId;
            await visitScrolling(page, `${label}: ${stepId}`, async () => { await startLesson(id); }, () => lessons);
            await startLesson(id);
          }
          const doIt = lessons.getByRole('button', { name: T('lessons.doIt'), exact: true });
          const read = lessons.getByRole('button', { name: T('lessons.understood'), exact: true });
          if (lesson.steps.find((item) => item.id === stepId)?.read) {
            await read.click();
            await expect.poll(stepNow).not.toBe(stepId);
          } else if (await doIt.count() > 0) {
            const before = await revision();
            await doIt.click();
            await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
            await page.waitForTimeout(150);
          } else {
            // A choice that is the person's. "Show me where" says which node it is on.
            const show = lessons.getByRole('button', { name: T('lessons.show'), exact: true });
            const targetId = await show.getAttribute('data-lesson-target');
            expect(targetId, `${id}/${stepId}: the field has a target node`).toBeTruthy();
            await show.click();
            const shown = page.locator('.react-flow__node.selected');
            await expect(shown, `${id}/${stepId}: the node the step speaks of`).toHaveCount(1);
            // Show selects on the next animation frame; an earlier selection may already have count 1.
            await expect(shown, `${id}/${stepId}: Show selected its target`).toHaveAttribute('data-id', targetId!);
            const nodeId = String(await shown.getAttribute('data-id'));
            const all = await held();
            const node = all.find((item) => item.id === nodeId)!;
            const file = FILE_FIELD[node.data.comfyType];
            const before = await revision();
            if (file) {
              const lackLine = await lessons.locator('[class*="lacking"] li').first().innerText().catch(() => '');
              const named = /(?:field|поле|поля|полях?)\s+([a-z_0-9]+)/i.exec(lackLine)?.[1];
              const key = named && named in node.data.parameters ? named : file.key;
              const taken = new Set(all.map((item) => item.data.parameters[key]));
              await commit(page, { type: 'set-parameter', nodeId, key, value: file.values.find((item) => !taken.has(item) && !Object.values(node.data.parameters).includes(item)) ?? file.values[0] });
            } else {
              const key = node.data.comfyType === 'WanVideoTextEncode' ? 'positive_prompt' : 'text';
              const text = String(node.data.parameters[key] ?? '');
              await commit(page, { type: 'set-parameter', nodeId, key, value: stepId === 'weigh' ? `${text} (red coat:1.2)` : stepId === 'speech' ? `${WORDS} She says <S>Good evening.<E>` : WORDS });
            }
            await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
            await reloaded(page);
            await startLesson(id);
          }
        }
        await expect(lessons.locator('[data-lesson-step]'), `the lesson ${id} came to its end`).toHaveAttribute('data-lesson-step', 'end');
      };
      await carryLesson('prompt', 'lessons, descriptions');
      await carryLesson('refine', 'lessons, a second pass');
      await visit(page, 'canvas after a second pass', fitView);
      await visitScrolling(page, 'lessons, the list with three lessons done', toList, () => lessons);
      await page.keyboard.press('Control+n');
      await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
      await expect(nodes).toHaveCount(0, { timeout: 15_000 });
      await reloaded(page);
      await carryLesson('video-text', null);
      await carryLesson('prompt-video', 'lessons, a description for video');
      await carryLesson('video-image', null);
      await carryLesson('two-models', 'lessons, two models');
      await visit(page, 'canvas with two models', fitView);
      // The same video on the nodes of WanVideoWrapper, from text and then from a picture.
      await page.keyboard.press('Control+n');
      await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
      await expect(nodes).toHaveCount(0, { timeout: 15_000 });
      await reloaded(page);
      await carryLesson('wrapper', 'lessons, WanVideoWrapper');
      await carryLesson('wrapper-image', 'lessons, WanVideoWrapper from a picture');
      await visit(page, 'canvas with a WanVideoWrapper graph', fitView);
      await carryLesson('wrapper-vace', 'lessons, VACE');
      for (const [id, label] of [['wrapper-animate', 'lessons, Wan Animate'], ['wrapper-talk', 'lessons, InfiniteTalk']] as const) {
        await page.keyboard.press('Control+n');
        await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
        await expect(nodes).toHaveCount(0, { timeout: 15_000 });
        await reloaded(page);
        await carryLesson(id, label);
      }
      await visit(page, 'canvas with a talking portrait graph', fitView);
      // A second voice on that graph, then the pack's other ways to make a clip, each from an empty canvas.
      await carryLesson('wrapper-duo', 'lessons, two voices');
      for (const [id, label] of [
        ['wrapper-fantasy', 'lessons, FantasyTalking'], ['wrapper-unianimate', 'lessons, UniAnimate'], ['wrapper-recam', 'lessons, ReCamMaster'], ['wrapper-ovi', 'lessons, Ovi'],
      ] as const) {
        await page.keyboard.press('Control+n');
        await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
        await expect(nodes).toHaveCount(0, { timeout: 15_000 });
        await reloaded(page);
        await carryLesson(id, label);
      }
      await visit(page, 'canvas with an Ovi graph', fitView);

      // The rest of the walk starts from an empty canvas and from the conversation.
      await page.keyboard.press('Control+n');
      await page.getByRole('button', { name: T('menu.newProjectConfirm'), exact: true }).click();
      await expect(nodes).toHaveCount(0, { timeout: 15_000 });
      await reloaded(page);
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
    const fit = async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); };
    const descriptions = async (mode: 'all' | 'own' | 'off') => {
      const toggle = page.getByRole('button', { name: T('canvas.descriptions'), exact: true });
      for (let turn = 0; turn < 3 && (await toggle.getAttribute('data-descriptions-mode')) !== mode; turn += 1) await toggle.click();
    };
    if (wants('canvas')) {
      // Where the app itself put four nodes added one after another: each clear of the others, cards and all.
      const before = await descriptionsMode(page);
      await visit(page, 'canvas with four nodes where the app put them', fit);
      await visit(page, 'canvas with four nodes where the app put them, every description', async () => { await descriptions('all'); await fit(); });
      await visit(page, 'canvas with four nodes where the app put them, every description, 100 %', async () => { await descriptions('all'); await fit(); await page.keyboard.press('Control+0'); await page.waitForTimeout(450); });
      await descriptions(before);
    }
    // «Разложить граф» from the keyboard; the search field of the library must not swallow it.
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
    const placedBefore = await nodePositions(page);
    await page.keyboard.press('Control+Shift+L');
    await page.waitForTimeout(900);
    expect(await nodePositions(page), 'the arrange shortcut moved the nodes').not.toEqual(placedBefore);
    if (wants('canvas')) {
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
      for (const size of SIZES) {
        try {
          await resize(page, size);
          const before = await bubble.getAttribute('data-build-callout', { timeout: 20_000 }).catch(() => null);
          // The next step centres for the window as it is now.
          await expect.poll(async () => bubble.getAttribute('data-build-callout').catch(() => null), { timeout: 12_000 }).not.toBe(before);
          // A step is looked at once the camera has arrived at it (--motion-tour, 600 ms) and before it gives way
          // to the next one: the same step at both ends of the wait, and its place read in the same look.
          const look = () => page.evaluate(() => {
            const box = (element: Element | null) => {
              const rect = element?.getBoundingClientRect();
              return rect && rect.width > 0 ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null;
            };
            const el = document.querySelector<HTMLElement>('[data-build-callout]');
            return {
              step: el?.getAttribute('data-build-callout') ?? null,
              words: (el?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 70),
              bubble: box(el),
              strip: box(document.querySelector('[data-live-build]')),
              toolbar: box(document.querySelector('.react-flow [role="toolbar"]')),
              canvas: box(document.querySelector('.react-flow')),
            };
          });
          let seen = await look();
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const first = seen.step;
            await page.waitForTimeout(950);
            seen = await look();
            if (first && seen.step === first) break;
          }
          const extra: LayoutIssue[] = [];
          const bubbleBox = seen.bubble;
          const under = overlapOf(bubbleBox, seen.strip) || overlapOf(bubbleBox, seen.toolbar);
          const words = seen.words;
          if (under > 0) extra.push({ kind: 'overlap', where: 'the build bubble', text: words, detail: `under the build strip or the canvas toolbar by ${under}px` });
          // The camera follows the build: the step's bubble is on the canvas, whole.
          const canvasBox = seen.canvas;
          const inside = bubbleBox && canvasBox
            && bubbleBox.x >= canvasBox.x - 1 && bubbleBox.x + bubbleBox.width <= canvasBox.x + canvasBox.width + 1
            && bubbleBox.y >= canvasBox.y - 1 && bubbleBox.y + bubbleBox.height <= canvasBox.y + canvasBox.height + 1;
          if (!inside) extra.push({ kind: 'detached', where: 'the build bubble', text: words, detail: 'is not whole on the canvas: the camera did not bring the step into view' });
          await auditNow(page, 'helper, a build in progress', size, extra);
        } catch (error) {
          unreached.push(`helper, a build in progress at ${size.width}x${size.height}: ${String((error as Error).message).split('\n')[0]}`);
        }
      }
      await resize(page, HOME);
    }
    await expect(page.locator('.build-summary, [data-build-summary]').first()).toBeVisible({ timeout: 120_000 }).catch(() => undefined);
    await page.waitForTimeout(3200);
    if (wants('helper')) {
      await visitScrolling(page, 'helper, a finished build', async () => { await dockTab(page, 0); }, () => page.locator('.chat-log'));
      await visit(page, 'canvas after a build', async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(450); });
      // The same graph larger and smaller: what travels with a node (its description) keeps its place and its
      // share of the node at every zoom, down to the map of blocks.
      const descriptions = page.getByRole('button', { name: T('canvas.descriptions'), exact: true });
      for (let turn = 0; turn < 3 && (await descriptions.getAttribute('data-descriptions-mode')) !== 'all'; turn += 1) await descriptions.click();
      const zoomTo = async (steps: number) => {
        await page.locator('.react-flow__controls-fitview').click();
        await page.waitForTimeout(350);
        const button = page.locator(steps > 0 ? '.react-flow__controls-zoomin' : '.react-flow__controls-zoomout');
        for (let step = 0; step < Math.abs(steps); step += 1) {
          await button.click();
          await page.waitForTimeout(260);
        }
        await page.waitForTimeout(300);
      };
      for (const [label, steps] of [['fitted', 0], ['one step closer', 1], ['three steps closer', 3], ['five steps closer', 5], ['one step away', -1], ['three steps away', -3]] as const) {
        await visit(page, `built graph with every description, ${label}`, async () => { await zoomTo(steps); });
      }
      await visit(page, 'built graph, a node picked while zoomed out', async () => {
        await zoomTo(0);
        await page.locator('.react-flow__node').filter({ hasText: 'latent_image' }).first().locator('.graph-node-title').click();
        await page.waitForTimeout(500);
      }, async () => { await escape(page); });
      for (let turn = 0; turn < 3 && (await descriptions.getAttribute('data-descriptions-mode')) !== 'own'; turn += 1) await descriptions.click();
      await page.locator('.react-flow__controls-fitview').click();
      await page.waitForTimeout(350);
      await visitScrolling(page, 'explanations', async () => { await dockTab(page, 1); }, () => dockPanel(page));
      await visit(page, 'check panel, before a check', async () => { await dockTab(page, 3); });
      await dockTab(page, 3);
      await dockPanel(page).getByRole('button').first().click();
      await page.waitForTimeout(1500);
      await visitScrolling(page, 'check panel, findings', async () => { await dockTab(page, 3); }, () => dockPanel(page));
      // The right panel as wide as the window lets it be, and back to its narrowest: every tab follows its width.
      const splitter = page.locator('.tool-separator');
      const dockTo = async (key: 'End' | 'Home') => {
        await splitter.focus();
        await page.keyboard.press(key);
        await page.waitForTimeout(350);
      };
      for (let index = 0; index < 4; index += 1) {
        await visitScrolling(page, `right panel tab ${index + 1} at its widest`, async () => { await dockTab(page, index); await dockTo('End'); }, () => (index === 0 ? page.locator('.chat-log') : dockPanel(page)));
      }
      await visit(page, 'right panel at its narrowest', async () => { await dockTab(page, 0); await dockTo('Home'); });
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
      // From the Help menu: after the failed build above the focus is in the message field, which keeps F1 to itself.
      await visit(page, 'keyboard shortcuts', async () => {
        await menus.last().click();
        await page.getByRole('menuitem', { name: new RegExp(`^${T('menu.shortcuts')}`) }).click();
        await page.getByRole('dialog').first().waitFor();
      }, async () => { await escape(page); });
      await visitScrolling(page, 'conversation log', async () => {
        if (await page.locator('.model-log-dialog').count() === 0) {
          await menus.last().click();
          await page.getByRole('menuitem', { name: T('modelLog.menu') }).click();
          await page.locator('.model-log-dialog').waitFor();
        }
      }, () => page.locator('.model-log-dialog ul').first(), async () => { await escape(page); });
      for (const [name, key] of [['user guide', 'helpReader.guide'], ['troubleshooting', 'helpReader.troubleshooting'], ['what is new', 'helpReader.whatsNew'], ['content rules', 'helpReader.content']] as const) {
        await visit(page, name, async () => {
          await menus.last().click();
          await page.getByRole('menuitem', { name: T(key) }).click();
          await page.locator('.help-reader-dialog').waitFor();
        }, async () => { await escape(page); });
      }
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
    await noteMenuWidth(page);
  } catch (error) {
    // The walk itself lost its way: said in the report, with everything it found up to there.
    unreached.push(`the walk stopped: ${(error as Error).stack ?? String(error)}`);
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
    `language ${LANG}; fonts ${HINTED_FONTS ? 'hinted' : 'plain'}${WIDE_TEXT ? ', letters spaced out' : ''}${PSEUDO_TEXT ? ', texts 40 % longer' : ''}${WIDE_NAMES ? ', CJK and long names' : ''}${DPR ? `, screen scale ${DPR}` : ''}; menus ${menuWidths.join(' → ')} px wide; sizes ${SIZES.map((size) => `${size.width}x${size.height}`).join(', ')}; looked at ${visited.length} screens in ${Math.round((Date.now() - started) / 1000)} s; with something to say: ${findings.length}; distinct faults: ${grouped.size}; by kind: ${JSON.stringify([...byKind])}`,
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
