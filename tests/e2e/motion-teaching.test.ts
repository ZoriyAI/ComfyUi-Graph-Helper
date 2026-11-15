import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/**
 * Teaching motion on the real canvas (motion package):
 * - a lesson step done with "Do this for me" flashes what closed it, and the step's place stands out while the
 *   rest of the graph steps back;
 * - «Проверить граф» / "Check the graph" runs a wave over the nodes it marked;
 * - the history shows what a version changed and keeps the links drawn between versions;
 * - with motion reduced nothing loops or travels: after the marks settle no animation is left running.
 */
type Bridge = (name: string, args?: unknown[]) => Promise<any>;

const panel = (page: Page) => page.locator('.lesson-panel');

async function letTheAppDo(page: Page, api: Bridge): Promise<boolean> {
  const button = panel(page).getByRole('button', { name: 'Do this for me', exact: true });
  if (await button.count() === 0) return false;
  const revision = async () => ((await api('readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
  const before = await revision();
  await button.click();
  await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
  return true;
}

test('lesson flashes and focus, check wave, history changes, reduced motion at rest', async () => {
  test.setTimeout(240_000);
  const fake = await startFakeMcp({});
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-teaching-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  try {
    const page = await app.firstWindow();
    await page.locator('.app-shell').waitFor({ timeout: 30_000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(page);
    const api: Bridge = (name, args = []) => page.evaluate(async ({ name, args }) => {
      const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
      return bridge[name](...args);
    }, { name, args });
    const read = await api('getSettings') as { values?: Record<string, unknown> };
    await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }]);
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await api('syncNow').catch(() => undefined);
    await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
    await page.evaluate(() => { document.documentElement.dataset.motion = 'on'; });

    // A lesson: the app adds the model; the node it added flashes.
    await page.getByRole('tab', { name: 'Assistant' }).click();
    await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true }).click();
    await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'model', { timeout: 15_000 });
    expect(await letTheAppDo(page, api)).toBe(true);
    await expect(page.locator('.react-flow__node [data-flash]').first()).toBeAttached({ timeout: 5_000 });
    // The two prompts, then a link step: its two ends stand out, every other node steps back.
    for (let turn = 0; turn < 8; turn += 1) {
      const step = await panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');
      if (step === 'prompts-clip') break;
      await letTheAppDo(page, api);
      await page.waitForTimeout(300);
    }
    await expect(panel(page).locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'prompts-clip', { timeout: 15_000 });
    // One more node on the canvas that the step is not about, so something is out of focus.
    const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
    await api('commitCommand', [{ projectId: 'desktop', actionId: 'motion-extra', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'add-node', nodeType: 'EmptyLatentImage', x: 900, y: 600 } }]);
    // A change made past the page: the page reads the project again (as the lesson tests do).
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await page.evaluate(() => { document.documentElement.dataset.motion = 'on'; });
    if (!(await panel(page).isVisible())) {
      await page.getByRole('tab', { name: 'Assistant' }).click();
      await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
    }
    await expect(panel(page).locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'prompts-clip', { timeout: 15_000 });
    await expect.poll(async () => page.locator('.react-flow__node .graph-node[class*="unfocused"]').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    const focused = await page.locator('.react-flow__node .graph-node:not([class*="unfocused"])').count();
    expect(focused).toBeGreaterThanOrEqual(2);

    // The check: a wave over the marked nodes (the empty clip inputs are marked).
    await expect(page.locator('.react-flow__node [data-flash]')).toHaveCount(0, { timeout: 5_000 });
    await page.evaluate(() => (document.querySelector('[data-command="graph.check"]') as HTMLElement | null)?.click());
    await expect(page.locator('.react-flow__node [data-flash]').first()).toBeAttached({ timeout: 10_000 });

    // Two links, so the last versions of the history have links to keep.
    for (let turn = 0; turn < 2; turn += 1) {
      const projection = await api('readProjection', ['desktop']) as { currentRevisionId: string; snapshot: { nodes: Array<{ id: string; data: { comfyType: string; inputs: Array<{ id: string; name: string }>; outputs: Array<{ id: string; name: string }> } }>; edges: Array<{ target: string }> } };
      const nodes = projection.snapshot.nodes;
      const loader = nodes.find((item) => item.data.comfyType === 'CheckpointLoaderSimple')!;
      const encoder = nodes.filter((item) => item.data.comfyType === 'CLIPTextEncode').find((item) => !projection.snapshot.edges.some((link) => link.target === item.id))!;
      const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `motion-link-${turn}`, expectedRevisionId: projection.currentRevisionId, actor: 'manual', runId: null, payload: {
        type: 'connect',
        source: loader.id,
        sourceHandle: loader.data.outputs.find((port) => port.name === 'CLIP')!.id,
        target: encoder.id,
        targetHandle: encoder.data.inputs.find((port) => port.name === 'clip')!.id,
      } }]);
      expect((outcome as { status: string }).status).toBe('applied');
    }
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await page.evaluate(() => { document.documentElement.dataset.motion = 'on'; });
    await expect.poll(async () => page.locator('.react-flow__edge').count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    // The history: stepping from one version to the next keeps the links drawn and marks what changed.
    await page.getByRole('button', { name: 'Replay history', exact: true }).first().click();
    const slider = page.locator('[data-replay="on"] input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 10_000 });
    const max = Number(await slider.getAttribute('max'));
    await slider.fill(String(max - 1));
    await page.waitForTimeout(800);
    const edgesBefore = await page.locator('.react-flow__edge').count();
    expect(edgesBefore).toBeGreaterThan(0);
    // Sample every frame across the step: the edge count never drops to zero while the next version comes in.
    const sampled = page.evaluate(async () => {
      const seen: number[] = [];
      const until = performance.now() + 1500;
      await new Promise<void>((done) => {
        const tick = () => {
          seen.push(document.querySelectorAll('.react-flow__edge').length);
          if (performance.now() < until) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      return seen;
    });
    await slider.fill(String(max));
    const counts = await sampled;
    expect(Math.min(...counts)).toBeGreaterThan(0);
    // One toolbar row while a version is shown.
    const rows = await page.locator('[role="toolbar"][data-replaying="true"]').evaluate((bar) => {
      const tops = new Set(Array.from(bar.children).map((child) => Math.round((child as HTMLElement).getBoundingClientRect().top)));
      return tops.size;
    });
    expect(rows).toBe(1);
    await page.keyboard.press('Escape');

    // Reduced: after the marks settle, nothing is left running.
    await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; });
    await page.waitForTimeout(2_000);
    const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target as Element | null;
      return `${(animation as CSSAnimation).animationName ?? 'script'} ${target?.className ?? ''}`.slice(0, 120);
    }));
    expect(running).toEqual([]);
  } finally {
    await app.close();
    await fake.close().catch(() => undefined);
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
