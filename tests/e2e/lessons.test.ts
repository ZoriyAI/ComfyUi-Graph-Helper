import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { expectSoundLayout } from './layoutProfile';
import { useEnglish } from './locale';

/**
 * The helper's "Learn" mode: the person builds a graph by hand and the app follows along.
 * - the list of lessons says which fit this ComfyUI, and why one does not;
 * - a lesson is followed on the real canvas: reading a step, adding a node by hand through "Show me where",
 *   letting the app do a step, writing a description, and the lesson is done when the graph is;
 * - where a person is in a lesson is read off the graph: deleting a node takes the lesson back;
 * - the open lesson and what was read in it are there again after a restart of the page;
 * - a whole video lesson can be carried through.
 * LESSON_SHOTS=<dir> keeps pictures of the panel for a person to look at.
 */

type Bridge = (name: string, args?: unknown[]) => Promise<any>;

async function launch(fake: FakeMcp | null): Promise<{ app: ElectronApplication; page: Page; api: Bridge; userData: string }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
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
  if (fake) {
    const read = await api('getSettings') as { values?: Record<string, unknown> };
    expect(await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
    await page.reload();
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await api('syncNow').catch(() => undefined);
    await expect.poll(async () => ((await api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
  }
  return { app, page, api, userData };
}

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.LESSON_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function openLearn(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Assistant' }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
  await expect(page.locator('.lesson-panel')).toBeVisible();
}

const panel = (page: Page) => page.locator('.lesson-panel');
const stepIs = (page: Page, id: string) => expect(panel(page).locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', id, { timeout: 15_000 });

let action = 0;
/** A change made past the page (a file chosen, a value set); the page reads the project again after it. */
async function change(page: Page, api: Bridge, payload: Record<string, unknown>): Promise<void> {
  const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
  action += 1;
  const outcome = await api('commitCommand', [{ projectId: 'desktop', actionId: `lesson-test-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload }]) as { status: string };
  expect(outcome.status, JSON.stringify(payload)).toBe('applied');
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 20_000 });
  await expect(panel(page)).toBeVisible({ timeout: 15_000 }).catch(async () => { await openLearn(page); });
}

async function nodesOf(api: Bridge): Promise<Array<{ id: string; data: { comfyType: string; parameters: Record<string, unknown> } }>> {
  return ((await api('readProjection', ['desktop'])) as { snapshot: { nodes: Array<{ id: string; data: { comfyType: string; parameters: Record<string, unknown> } }> } }).snapshot.nodes;
}

/** Presses "Do this for me" once and waits for the change to land on the canvas. False when the app offers nothing. */
async function letTheAppDo(page: Page, api: Bridge): Promise<boolean> {
  const button = panel(page).getByRole('button', { name: 'Do this for me', exact: true });
  if (await button.count() === 0) return false;
  const revision = async () => ((await api('readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
  const before = await revision();
  await button.click();
  await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
  // The panel reads the new graph in the same breath; give it a frame.
  await page.waitForTimeout(120);
  return true;
}

/** Lets the app do everything it offers in the current step. */
async function letTheAppFinishStep(page: Page, api: Bridge): Promise<void> {
  const id = await panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');
  for (let turn = 0; turn < 12; turn += 1) {
    if ((await panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step')) !== id) return;
    if (!(await letTheAppDo(page, api))) return;
  }
}

test('lessons: the list fits ComfyUI, a lesson is followed by hand, and the graph says where the person is', async () => {
  test.setTimeout(300_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await openLearn(page);
    // The list: every lesson, each fitting this ComfyUI, none started.
    await expect(panel(page)).toHaveAttribute('data-lesson', 'list');
    await expect(panel(page).locator('[data-lesson-card]')).toHaveCount(LESSONS.length);
    for (const lesson of LESSONS) await expect(panel(page).locator(`[data-lesson-card="${lesson.id}"]`)).toHaveAttribute('data-lesson-state', 'new');
    await expect(panel(page).getByText('Connect ComfyUI and read it first')).toHaveCount(0);
    // The mode says what it is, and there is no message field in it.
    await expect(page.getByText('You build; the app leads you step by step and checks.')).toBeVisible();
    await expect(page.locator('textarea[aria-label="Chat message"]')).toBeHidden();
    await shot(page, '1-list');
    await expectSoundLayout(page, 'lessons, the list');

    // A lesson: the first step explains and waits to be read.
    await panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-lesson', 'image');
    await stepIs(page, 'intro');
    await expect(panel(page).getByText('Step 1 of 11')).toBeVisible();
    await panel(page).getByRole('button', { name: 'Understood, next', exact: true }).click();

    // A step to do: it names the node the way this ComfyUI's library does, and says what is lacking.
    await stepIs(page, 'model');
    await expect(panel(page).getByRole('heading', { name: 'Load the model' })).toBeVisible();
    await expect(panel(page).getByText('There is no Load Checkpoint node on the canvas yet.')).toBeVisible();
    await shot(page, '2-step');
    await expectSoundLayout(page, 'lessons, a step to do');
    // "Show me where" opens the node search with the name typed; the person adds the node.
    await panel(page).getByRole('button', { name: 'Show me where', exact: true }).click();
    const search = page.getByRole('dialog', { name: 'Add node' }).locator('input');
    await expect(search).toHaveValue('Load Checkpoint');
    await page.getByRole('option').filter({ hasText: 'Load Checkpoint' }).first().click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    // The graph says the step is done: the lesson moves on by itself.
    await stepIs(page, 'prompts');
    await expect(panel(page).getByText('There are no CLIP Text Encode (Prompt) nodes on the canvas yet. Needed: 2.')).toBeVisible();

    // "Do this for me": one node, and the lesson says one more is needed; then the second.
    expect(await letTheAppDo(page, api)).toBe(true);
    await expect(panel(page).getByText('One more CLIP Text Encode (Prompt) node is needed.')).toBeVisible();
    await letTheAppDo(page, api);
    await stepIs(page, 'prompts-clip');
    // Two nodes of one name lack the same link: said once, with how many times.
    await expect(panel(page).locator('[class*="lacking"] li')).toHaveCount(1);
    await expect(panel(page).locator('[class*="lacking"] li')).toHaveText('The input clip of "CLIP Text Encode (Prompt)" is empty. Drag a link to it from the output CLIP of "Load Checkpoint". ×2');
    // "Show me where" for a link lights the output it starts from.
    await panel(page).getByRole('button', { name: 'Show me where', exact: true }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Load Checkpoint' })).toHaveClass(/selected/, { timeout: 5000 }).catch(() => undefined);
    await page.keyboard.press('Escape');
    await letTheAppDo(page, api);
    await expect(panel(page).locator('[class*="lacking"] li')).not.toContainText('×2');
    await letTheAppDo(page, api);

    // Words only the person can write: there is nothing the app offers to do.
    await stepIs(page, 'prompt-text');
    await expect(panel(page).getByRole('button', { name: 'Do this for me', exact: true })).toHaveCount(0);
    await expect(panel(page).locator('[class*="lacking"] li')).toContainText('Write a description in the field text');
    const prompt = page.locator('.react-flow__node').filter({ hasText: 'CLIP Text Encode' }).first().locator('textarea');
    await prompt.fill('a quiet lake at dawn, mist, soft light');
    await prompt.blur();
    await stepIs(page, 'latent');

    // The rest with the app's hand, step after step, to the end.
    for (const id of ['latent', 'sampler', 'sampler-links', 'decode', 'save']) {
      await stepIs(page, id);
      await letTheAppFinishStep(page, api);
    }
    await stepIs(page, 'run');
    await panel(page).getByRole('button', { name: 'Understood, next', exact: true }).click();
    await stepIs(page, 'end');
    await expect(panel(page).getByRole('heading', { name: 'The lesson is done' })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
    await expect(page.locator('.react-flow__edge')).toHaveCount(9);
    await shot(page, '3-done');
    await expectSoundLayout(page, 'lessons, a lesson done');
    // A step that is done can be read again, and the way back is one press.
    await panel(page).locator('[data-step="sampler"] button').click();
    await expect(panel(page).getByText('This step is done.')).toBeVisible();
    await panel(page).getByRole('button', { name: 'To the current step', exact: true }).click();
    await stepIs(page, 'end');

    // Where the person is comes from the graph: without the sampler the lesson is back at the sampler.
    const sampler = (await nodesOf(api)).find((node) => node.data.comfyType === 'KSampler')!;
    await change(page, api, { type: 'remove-node', nodeId: sampler.id });
    // The page was read again: the lesson is still the open one, and what was read is remembered.
    await expect(panel(page)).toHaveAttribute('data-lesson', 'image');
    await stepIs(page, 'sampler');
    await expect(panel(page).getByText('There is no KSampler node on the canvas yet.')).toBeVisible();
    await expect(panel(page).locator('[data-step="intro"]')).toHaveAttribute('data-step-mark', 'done');

    // Back in the list the lesson is the one in progress.
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-card="image"]')).toHaveAttribute('data-lesson-state', 'started');
    await expect(panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Go on', exact: true })).toBeVisible();

    // A question about a step goes to the conversation as an ordinary question.
    await panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Go on', exact: true }).click();
    await panel(page).getByRole('button', { name: 'Ask the helper about this step', exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('.chat-log')).toContainText('Explain a step of the lesson "A first picture from text". The step: Add the sampler.');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: a lesson that does not fit says what is missing, and before ComfyUI is read the list says so', async () => {
  test.setTimeout(180_000);
  // Before ComfyUI is read.
  const fresh = await launch(null);
  try {
    await openLearn(fresh.page);
    await expect(panel(fresh.page).getByText('Lessons are fitted to your ComfyUI')).toBeVisible();
    for (const lesson of LESSONS) await expect(panel(fresh.page).locator(`[data-lesson-card="${lesson.id}"]`).getByRole('button')).toBeDisabled();
    await panel(fresh.page).getByRole('button', { name: 'Connect ComfyUI…', exact: true }).click();
    await expect(fresh.page.locator('[role="dialog"].settings-dialog')).toBeVisible();
    await expectSoundLayout(fresh.page, 'lessons before ComfyUI is read');
    await fresh.page.keyboard.press('Escape');
    await expect(fresh.page.locator('[role="dialog"].settings-dialog')).toHaveCount(0);

    // ComfyUI is read while the list is open: the lessons fit at once, with no restart of the window.
    const late = await startFakeMcp({ extraLoras: 3, video: true });
    try {
      const read = await fresh.api('getSettings') as { values?: Record<string, unknown> };
      expect(await fresh.api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: late.url, mcpAuth: 'none' }])).toMatchObject({ ok: true });
      await fresh.api('syncNow').catch(() => undefined);
      await expect.poll(async () => ((await fresh.api('syncStatus')) as { state: string }).state, { timeout: 90_000 }).not.toBe('running');
      await expect(panel(fresh.page).getByText('Lessons are fitted to your ComfyUI')).toHaveCount(0, { timeout: 15_000 });
      for (const lesson of LESSONS) await expect(panel(fresh.page).locator(`[data-lesson-card="${lesson.id}"]`)).toHaveAttribute('data-lesson-state', 'new', { timeout: 15_000 });
      await expect(panel(fresh.page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
    } finally {
      await late.close();
    }
  } finally {
    await fresh.app.close();
    fs.rmSync(fresh.userData, { recursive: true, force: true });
  }

  // A ComfyUI without the video nodes: the picture lesson fits, the video ones name what is missing.
  const fake = await startFakeMcp({ extraLoras: 3 });
  const { app, page, userData } = await launch(fake);
  try {
    await openLearn(page);
    await expect(panel(page).locator('[data-lesson-card="image"]')).toHaveAttribute('data-lesson-state', 'new');
    const video = panel(page).locator('[data-lesson-card="video-text"]');
    await expect(video).toHaveAttribute('data-lesson-state', 'unfit');
    await expect(video).toContainText('This lesson does not fit your ComfyUI yet.');
    await expect(video).toContainText('Your ComfyUI has no EmptyHunyuanLatentVideo node.');
    await expect(video).toContainText('Your ComfyUI has no CreateVideo node.');
    await expect(video.getByRole('button')).toBeDisabled();
    // The lesson on LoRA needs no video node of its own: it fits.
    await expect(panel(page).locator('[data-lesson-card="lora"]')).toHaveAttribute('data-lesson-state', 'new');
    await expectSoundLayout(page, 'lessons, some that do not fit');
    // The menu opens the same panel.
    await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Assistant' }).click();
    await page.getByRole('menuitem', { name: /Lessons: build it yourself/ }).click();
    await expect(panel(page)).toBeVisible();
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: a video lesson is carried through, the choices that are the person\'s made by the person', async () => {
  test.setTimeout(420_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  try {
    await openLearn(page);
    await panel(page).locator('[data-lesson-card="video-text"]').getByRole('button', { name: 'Start', exact: true }).click();
    const lesson = LESSONS.find((item) => item.id === 'video-text')!;
    const current = () => panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');
    for (let guard = 0; guard < 80; guard += 1) {
      const id = await current();
      if (id === 'end') break;
      const step = lesson.steps.find((item) => item.id === id)!;
      if (step.read) {
        await panel(page).getByRole('button', { name: 'Understood, next', exact: true }).click();
        await expect.poll(current).not.toBe(id);
        continue;
      }
      if (await letTheAppDo(page, api)) continue;
      // What only the person decides: the second model file, the words of the description.
      const lack = await panel(page).locator('[class*="lacking"] li').first().innerText();
      const nodes = await nodesOf(api);
      if (/holds the same file/.test(lack)) {
        const loaders = nodes.filter((node) => node.data.comfyType === 'UNETLoader');
        await change(page, api, { type: 'set-parameter', nodeId: loaders[1].id, key: 'unet_name', value: 'z_image_turbo_bf16.safetensors' });
      } else if (/Write a description/.test(lack)) {
        const text = nodes.find((node) => node.data.comfyType === 'CLIPTextEncode')!;
        await change(page, api, { type: 'set-parameter', nodeId: text.id, key: 'text', value: 'a person walks along a beach, the camera follows from the side' });
      } else {
        throw new Error(`the lesson waits at "${id}" for: ${lack}`);
      }
    }
    await stepIs(page, 'end');
    await expect(page.locator('.react-flow__node')).toHaveCount(14);
    // The second sampler starts where the first one stops, as the lesson asks.
    const samplers = (await nodesOf(api)).filter((node) => node.data.comfyType === 'KSamplerAdvanced').map((node) => node.data.parameters);
    const first = samplers.find((item) => item.add_noise === 'enable')!;
    const second = samplers.find((item) => item.add_noise === 'disable')!;
    expect(second.start_at_step).toBe(first.end_at_step);
    expect(second.steps).toBe(first.steps);
    // The app added every node, and the graph reads the way the lesson says: each link goes from left to right.
    const built = ((await api('readProjection', ['desktop'])) as { snapshot: { nodes: Array<{ id: string; position: { x: number; y: number }; data: { comfyType: string } }>; edges: Array<{ source: string; target: string }> } }).snapshot;
    expect(built.edges.length).toBeGreaterThan(12);
    const placed = new Map(built.nodes.map((node) => [node.id, node]));
    for (const edge of built.edges) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }
    await shot(page, '4-video-done');
    await expectSoundLayout(page, 'lessons, a video lesson done');
    // The next lesson stands on this graph: most of it is already there.
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-card="video-text"]')).toContainText('Done');
    await expect(panel(page).locator('[data-lesson-card="lora"]')).toContainText('Goes on from the lesson "Video from text".');

    // The lesson on adult content stands on the same graph and asks for nothing more on the canvas. The subject
    // may come from a further-trained pair of models chosen in the two loaders, so the lesson asks for no LoRA.
    await expect(panel(page).locator('[data-lesson-card="adult"]')).toContainText('Goes on from the lesson "Video from text".');
    await panel(page).locator('[data-lesson-card="adult"]').getByRole('button', { name: 'Start', exact: true }).click();
    const adult = LESSONS.find((item) => item.id === 'adult')!;
    const readOn = async (until: string): Promise<string[]> => {
      const shown: string[] = [];
      for (let guard = 0; guard < 20; guard += 1) {
        const id = (await current())!;
        if (id === until) return shown;
        expect(adult.steps.find((item) => item.id === id)?.read, `the lesson on adult content waits at "${id}"`).toBe(true);
        shown.push(id);
        if (id === 'tuned') {
          await expect(panel(page)).toContainText('A further-trained version of Wan 2.2 usually also comes as a pair of files.');
          await shot(page, '5-adult-further-trained');
          await expectSoundLayout(page, 'lessons, a further-trained model');
        }
        await panel(page).getByRole('button', { name: 'Understood, next', exact: true }).click();
        await expect.poll(current).not.toBe(id);
      }
      throw new Error(`the lesson did not come to "${until}"`);
    };
    // No LoRA on the canvas: the step about the graph and the step about a LoRA's words hold on their own.
    expect(await readOn('end')).toEqual(['rules', 'levers', 'model', 'tuned', 'lora', 'prompt', 'defects', 'helper']);
    await expect(page.locator('.react-flow__node')).toHaveCount(14);

    // A LoRA whose file names its words is put on the canvas: now the lesson asks for them in the description.
    const withWords = 'Z-Image-Turbo-Realism-LoRA.safetensors';
    await expect.poll(async () => ((await api('modelDetail', ['loras', withWords])) as { triggerWords?: string[] } | null)?.triggerWords ?? [], { timeout: 60_000 }).toEqual(['realism', 'photo']);
    await change(page, api, { type: 'add-node', nodeType: 'LoraLoaderModelOnly', title: 'LoraLoaderModelOnly', x: 0, y: 1400 });
    const loader = (await nodesOf(api)).find((node) => node.data.comfyType === 'LoraLoaderModelOnly')!;
    await change(page, api, { type: 'set-parameter', nodeId: loader.id, key: 'lora_name', value: withWords });
    await stepIs(page, 'trigger');
    await expect(panel(page).locator('[class*="lacking"] li').first()).toContainText('has none of the words of your LoRA: realism, photo');
    await shot(page, '6-adult-words');
    const described = (await nodesOf(api)).find((node) => node.data.comfyType === 'CLIPTextEncode' && String(node.data.parameters.text ?? '').includes('beach'))!;
    await change(page, api, { type: 'set-parameter', nodeId: described.id, key: 'text', value: 'a person walks along a beach, photo, the camera follows from the side' });
    await stepIs(page, 'end');
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
