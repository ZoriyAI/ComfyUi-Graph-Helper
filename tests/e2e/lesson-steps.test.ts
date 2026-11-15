/**
 * E2E spec for the lessons of the new standard in the window, with the fake ComfyUI: the list read by level and as the
 * path of a track; the lesson "A controlled experiment" walked through a checklist (two items the app ticks itself, one
 * the person ticks), canvas steps, a read-check, a run checklist, a rubric (a low level shows what to try), a quiz (a
 * wrong answer shows the explanation and the lesson goes on) and a transfer task without "Do this for me"; the end
 * says which outcome the app checked and which is the person's word, and the card in the list says the same.
 * Nothing is run in ComfyUI: the fake answers only what the app reads.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { useEnglish } from './locale';

type Bridge = (name: string, args?: unknown[]) => Promise<any>;
type Port = { id: string; name: string };
type Node = { id: string; data: { comfyType: string; parameters: Record<string, unknown>; inputs: Port[]; outputs: Port[] } };
type Edge = { source: string; target: string; sourceHandle: string; targetHandle: string };

async function launch(fake: FakeMcp): Promise<{ app: ElectronApplication; page: Page; api: Bridge; userData: string }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-steps-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await useEnglish(page);
  const api: Bridge = (name, args = []) => page.evaluate(async ({ name, args }) => {
    const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
    return bridge[name](...args);
  }, { name, args });
  const read = await api('getSettings') as { values?: Record<string, unknown> };
  expect(await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await api('syncNow').catch(() => undefined);
  await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
  return { app, page, api, userData };
}

const panel = (page: Page) => page.locator('.lesson-panel');
const current = (page: Page) => panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');

async function openLearn(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Assistant' }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
  await expect(panel(page)).toBeVisible();
}

const graphOf = async (api: Bridge): Promise<{ nodes: Node[]; edges: Edge[] }> => ((await api('readProjection', ['desktop'])) as { snapshot: { nodes: Node[]; edges: Edge[] } }).snapshot;

let action = 0;
/** One change past the page, as the canvas makes it; the page reads it after a reload (`reload`). */
async function commit(page: Page, api: Bridge, payload: Record<string, unknown>, reload = true): Promise<void> {
  const head = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  action += 1;
  const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `lesson-steps-${action}`, expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload }]) as { status: string };
  expect(outcome.status, JSON.stringify(payload)).toBe('applied');
  if (!reload) return;
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  if (!(await panel(page).isVisible())) await openLearn(page);
}

/** Presses "Do this for me" once; false when the app offers nothing. */
async function letTheAppDo(page: Page, api: Bridge): Promise<boolean> {
  const button = panel(page).getByRole('button', { name: 'Do this for me', exact: true });
  if (await button.count() === 0) return false;
  const revision = async () => ((await api('readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
  const before = await revision();
  await button.click();
  await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
  await page.waitForTimeout(120);
  return true;
}

const input = (node: Node, name: string) => node.data.inputs.find((port) => port.name === name)!.id;
const output = (node: Node, name: string) => node.data.outputs.find((port) => port.name === name || port.name.toUpperCase() === name)!.id;

/**
 * The transfer task by hand (no "Do this for me"): a third sampler, decoder and saver fed like the first variant,
 * every setting of the first but the sampler algorithm.
 */
async function buildThirdVariant(page: Page, api: Bridge): Promise<void> {
  const before = await graphOf(api);
  const sampler = before.nodes.find((node) => node.data.comfyType === 'KSampler' && Number(node.data.parameters.cfg) === 4)!;
  const feed = (handle: string) => before.edges.find((edge) => edge.target === sampler.id && edge.targetHandle === input(sampler, handle))!;
  const checkpoint = before.nodes.find((node) => node.data.comfyType === 'CheckpointLoaderSimple')!;
  for (const [index, nodeType] of ['KSampler', 'VAEDecode', 'SaveImage'].entries()) await commit(page, api, { type: 'add-node', nodeType, x: 1400 + index * 300, y: 900 }, false);
  const after = await graphOf(api);
  const fresh = after.nodes.filter((node) => !before.nodes.some((item) => item.id === node.id));
  const [third, decode, save] = ['KSampler', 'VAEDecode', 'SaveImage'].map((type) => fresh.find((node) => node.data.comfyType === type)!);
  const link = (source: string, sourceHandle: string, target: string, targetHandle: string) => commit(page, api, { type: 'connect', source, sourceHandle, target, targetHandle }, false);
  for (const name of ['model', 'positive', 'negative', 'latent_image']) {
    const edge = feed(name);
    await link(edge.source, edge.sourceHandle, third.id, input(third, name));
  }
  await link(third.id, output(third, 'LATENT'), decode.id, input(decode, 'samples'));
  await link(checkpoint.id, output(checkpoint, 'VAE'), decode.id, input(decode, 'vae'));
  await link(decode.id, output(decode, 'IMAGE'), save.id, input(save, 'images'));
  for (const key of ['seed', 'steps', 'cfg', 'scheduler', 'denoise']) {
    if (sampler.data.parameters[key] !== undefined) await commit(page, api, { type: 'set-parameter', nodeId: third.id, key, value: sampler.data.parameters[key] }, false);
  }
  const algorithm = sampler.data.parameters.sampler_name === 'dpmpp_2m' ? 'euler' : 'dpmpp_2m';
  await commit(page, api, { type: 'set-parameter', nodeId: third.id, key: 'sampler_name', value: algorithm }, false);
  await commit(page, api, { type: 'set-parameter', nodeId: save.id, key: 'filename_prefix', value: 'experiment/c' });
}

test('lessons of the new standard: a checklist, the canvas, a check, a rubric, a quiz and a task of your own', async () => {
  test.setTimeout(420_000);
  const fake = await startFakeMcp({ extraLoras: 1 });
  const { app, page, api, userData } = await launch(fake);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await openLearn(page);
    // ---- The list: by level, and the path of the base track ----
    await panel(page).getByRole('radio', { name: 'Levels', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-group="level-2"] [data-lesson-card="one-factor"]')).toBeVisible();
    await expect(panel(page).locator('[data-lesson-card="one-factor"]')).toContainText('Level 2, core.');
    await panel(page).getByRole('radio', { name: 'Path', exact: true }).click();
    const path = panel(page).locator('[data-lesson-group="path-base"] [data-lesson-card]');
    const order = await path.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-lesson-card')));
    expect(order.indexOf('image')).toBeLessThan(order.indexOf('one-factor'));
    expect(order.indexOf('one-factor')).toBeLessThan(order.indexOf('blind-compare'));
    await panel(page).locator('[data-lesson-card="one-factor"]').getByRole('button', { name: 'Start', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-lesson', 'one-factor');

    let seen = '';
    for (let guard = 0; guard < 120; guard += 1) {
      const stepId = String(await current(page));
      if (stepId === 'end') break;
      const step = panel(page).locator('section[data-step-state]');
      const kind = await step.getAttribute('data-step-kind');
      const first = stepId !== seen;
      seen = stepId;
      if (kind === 'read') {
        await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
      } else if (kind === 'checklist') {
        if (stepId === 'ready') {
          // The app ticks what it can see itself; the question is the person's own word.
          await expect(step.locator('[data-item="comfy"]')).toHaveAttribute('data-item-state', 'app');
          await expect(step.locator('[data-item="model"]')).toHaveAttribute('data-item-state', 'app');
          await expect(step.locator('[data-item="comfy"]')).toContainText('The app sees this.');
        }
        for (const box of await step.locator('input[type="checkbox"]:not(:checked):not(:disabled)').all()) await box.check();
        if (stepId === 'run') await expect(step.locator('[data-item="ran"]')).toHaveAttribute('data-item-state', 'self');
      } else if (kind === 'rubric') {
        await expect(step).toContainText('the app does not judge the picture itself');
        await step.locator('[data-criterion="difference"]').getByRole('radio', { name: 'Partly' }).check();
        await expect(step.locator('[data-criterion="difference"]')).toContainText('What to try:');
        await step.locator('[data-criterion="repeat"]').getByRole('radio', { name: 'Yes' }).check();
        await step.locator('[data-criterion="conclusion"]').getByRole('radio', { name: 'Yes' }).check();
      } else if (kind === 'quiz') {
        // A wrong answer is not punished: the explanation shows, and the lesson goes on once every question is answered.
        await step.locator('[data-question="two-changes"]').getByRole('radio', { name: 'cfg helped' }).check();
        await expect(step.locator('[data-question="two-changes"]')).toHaveAttribute('data-answered', 'wrong');
        await expect(step.locator('[data-question="two-changes"]')).toContainText('Not quite');
        await step.locator('[data-question="same-seed"]').getByRole('radio', { name: 'So that both start from the same noise' }).check();
        await expect(step.locator('[data-question="same-seed"]')).toHaveAttribute('data-answered', 'right');
        await step.locator('[data-question="cache"]').getByRole('radio', { name: 'ComfyUI ends at once and shows what it already made' }).check();
      } else if (kind === 'readCheck') {
        throw new Error(`${stepId}: the app should see that every node is installed`);
      } else if (await step.getAttribute('data-transfer') === 'true') {
        // A task of your own: no "Do this for me", and what is missing stays folded until asked for.
        expect(first).toBe(true);
        await expect(panel(page).getByRole('button', { name: 'Do this for me', exact: true })).toHaveCount(0);
        await expect(step).toContainText('there is no “Do this for me” here');
        await buildThirdVariant(page, api);
      } else if (!(await letTheAppDo(page, api))) {
        // What only a person decides: a prompt, and names for the saved files.
        const { nodes } = await graphOf(api);
        if (stepId === 'graph') {
          const texts = nodes.filter((item) => item.data.comfyType === 'CLIPTextEncode');
          for (const [index, node] of texts.entries()) await commit(page, api, { type: 'set-parameter', nodeId: node.id, key: 'text', value: 'a red lighthouse at dusk' }, index === texts.length - 1);
        } else if (stepId === 'names') {
          const savers = nodes.filter((item) => item.data.comfyType === 'SaveImage');
          for (const [index, node] of savers.entries()) await commit(page, api, { type: 'set-parameter', nodeId: node.id, key: 'filename_prefix', value: `experiment/${'ab'[index] ?? index}` }, index === savers.length - 1);
        } else {
          throw new Error(`${stepId}: nothing to do`);
        }
      }
      await expect.poll(() => current(page), { timeout: 20_000 }).not.toBe(stepId);
    }
    await expect(panel(page).locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'end');
    // ---- The end says truthfully who checked what ----
    const outcomes = panel(page).locator('[data-lesson-outcomes]');
    await expect(outcomes.locator('[data-outcome="structure"]')).toHaveAttribute('data-outcome-state', 'app');
    await expect(outcomes.locator('[data-outcome="run"]')).toHaveAttribute('data-outcome-state', 'self');
    await expect(outcomes.locator('[data-outcome="result"]')).toHaveAttribute('data-outcome-state', 'self');
    await expect(outcomes).toContainText('the app ran nothing and did not see your pictures');
    // ---- The card in the list keeps the outcomes, after a reload too ----
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    if (!(await panel(page).isVisible())) await openLearn(page);
    if ((await panel(page).getAttribute('data-lesson')) !== 'list') await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    const card = panel(page).locator('[data-lesson-card="one-factor"]').first();
    await expect(card).toHaveAttribute('data-lesson-state', 'done');
    await expect(card.locator('[data-outcome="result"]')).toHaveAttribute('data-outcome-state', 'self');
    await expect(card.locator('[data-outcome="structure"]')).toHaveAttribute('data-outcome-state', 'app');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
