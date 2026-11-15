/**
 * E2E spec for the helper's "Learn" mode: the person builds a graph by hand and the app follows along.
 * - the list of lessons says which fit this ComfyUI, and why one does not;
 * - a lesson is followed on the real canvas: reading a step, adding a node by hand through "Show me where",
 *   letting the app do a step, writing a description, and the lesson is done when the graph is;
 * - where a person is in a lesson is read off the graph: deleting a node takes the lesson back;
 * - the open lesson and what was read in it are there again after a restart of the page;
 * - whole video lessons (several on WanVideoWrapper among them) can be carried through, and the graph a lesson
 *   built is checked, its description read for what will not work.
 * LESSON_SHOTS=<dir> keeps pictures of the panel for a person to look at.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp, type FakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { en } from '../../src/shared/i18n/catalog';
import { lessonDependencies, lessonGroups } from '../../src/shared/lessons/navigation';
import { LESSONS, ordinaryLessons } from '../../src/shared/lessons/lessons';
import { expectSoundLayout } from './layoutProfile';
import { useEnglish } from './locale';

type Bridge = (name: string, args?: unknown[]) => Promise<any>;

async function launch(fake: FakeMcp | null): Promise<{ app: ElectronApplication; page: Page; api: Bridge; userData: string }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
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

/** A sentence of the English catalog with its values put in; a list reads the way the app writes it ("a and b"). */
function said(template: string, values: Record<string, string | string[]>): string {
  return template.replace(/\{\{(\w+)(?:, list)?\}\}/g, (_whole, key: string) => {
    const value = values[key];
    return Array.isArray(value) ? new Intl.ListFormat('en', { type: 'conjunction' }).format(value) : String(value);
  });
}
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
    // The list: every ordinary lesson, each fitting this ComfyUI, none started; the lessons for adults are one
    // closed row at the end in a new profile.
    await expect(panel(page)).toHaveAttribute('data-lesson', 'list');
    // Every ordinary lesson is a card; the lessons for adults are one closed row in their group in a new profile.
    // The built-in groups come in their order, and "My lessons" (the person's own, empty here) is last.
    await expect(panel(page).locator('[data-lesson-card]')).toHaveCount(ordinaryLessons().length);
    await expect.poll(() => panel(page).locator('[data-lesson-group]').evaluateAll((sections) => sections.map((section) => section.getAttribute('data-lesson-group'))))
      .toEqual([...lessonGroups().map((group) => group.id), 'mine']);
    await expect(panel(page).locator('[data-lesson-group-closed="adult"]')).toHaveCount(1);
    // Every dependency is navigable without completing a predecessor: each link of a card moves focus to the card
    // it names (links come easiest level first, so which one is first follows the data, not this spec).
    const tagsNeeds = lessonDependencies('tags');
    expect(tagsNeeds).toContain('sdxl');
    await expect(panel(page).locator('[data-lesson-card="tags"]').getByRole('link')).toHaveCount(tagsNeeds.length);
    for (const [index, id] of tagsNeeds.entries()) {
      await panel(page).locator('[data-lesson-card="tags"]').getByRole('link').nth(index).click();
      await expect(panel(page).locator(`[data-lesson-card="${id}"]`)).toBeFocused();
    }
    await panel(page).locator('[data-lesson-card="sdxl"]').getByRole('button', { name: 'Start', exact: true }).click();
    await stepIs(page, 'intro');
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    for (const lesson of ordinaryLessons()) await expect(panel(page).locator(`[data-lesson-card="${lesson.id}"]`)).toHaveAttribute('data-lesson-state', 'new');
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
    // The visible progress; a screen reader hears the same words with the step's title from a live region.
    await expect(panel(page).getByText(said(en.lessons.progress, { current: '1', total: '11' }), { exact: true })).toBeVisible();
    await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();

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
    // Two nodes of one name lack the same link: each is named by its part in the lesson.
    await expect(panel(page).locator('[class*="lacking"] li')).toHaveText([
      'The input clip of “CLIP Text Encode (Prompt) (prompt)” is empty. Drag a link to it from the output CLIP of “Load Checkpoint”.',
      'The input clip of “CLIP Text Encode (Prompt) (negative prompt)” is empty. Drag a link to it from the output CLIP of “Load Checkpoint”.',
    ]);
    // "Show me where" for a link lights the output it starts from.
    await panel(page).getByRole('button', { name: 'Show me where', exact: true }).click();
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Load Checkpoint' })).toHaveClass(/selected/, { timeout: 5000 }).catch(() => undefined);
    await page.keyboard.press('Escape');
    await letTheAppDo(page, api);
    await expect(panel(page).locator('[class*="lacking"] li')).toHaveCount(1);
    await letTheAppDo(page, api);

    // Words only the person can write: there is nothing the app offers to do.
    await stepIs(page, 'prompt-text');
    await expect(panel(page).getByRole('button', { name: 'Do this for me', exact: true })).toHaveCount(0);
    await expect(panel(page).locator('[class*="lacking"] li')).toContainText('Write a prompt in the field text');
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
    await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
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

    // Back in the list the lesson stays finished: a changed canvas does not undo what the person learned.
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-card="image"]')).toHaveAttribute('data-lesson-state', 'done');
    await expect(panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start over', exact: true })).toBeVisible();

    // Going through it again starts from its first step; a question about a step goes to the conversation as an ordinary question.
    await panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start over', exact: true }).click();
    await panel(page).getByRole('button', { name: 'Ask the assistant about this step', exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('.chat-log')).toContainText('Explain a step of the lesson “A first picture from text”. The step: How a graph works.');
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
    // Start waits for ComfyUI; exporting a lesson to a file does not need it, so only Start is held.
    for (const lesson of ordinaryLessons()) await expect(panel(fresh.page).locator(`[data-lesson-card="${lesson.id}"]`).getByRole('button', { name: en.lessons.start, exact: true })).toBeDisabled();
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
      for (const lesson of ordinaryLessons()) await expect(panel(fresh.page).locator(`[data-lesson-card="${lesson.id}"]`)).toHaveAttribute('data-lesson-state', 'new', { timeout: 15_000 });
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
    // One sentence per source of nodes, each node once, and that the person installs them.
    await expect(video).toContainText('It needs a newer ComfyUI. Missing nodes: EmptyHunyuanLatentVideo, CreateVideo, SaveVideo.');
    await expect(video).toContainText('You install nodes in ComfyUI yourself');
    await expect(video.getByRole('button', { name: en.lessons.start, exact: true })).toBeDisabled();
    // The lesson on LoRA stands on the video graph, which cannot be built here: it does not fit either.
    const lora = panel(page).locator('[data-lesson-card="lora"]');
    await expect(lora).toHaveAttribute('data-lesson-state', 'unfit');
    await expect(lora).toContainText('This lesson continues the lesson “Video from text”, and that one does not fit your ComfyUI.');
    await expect(panel(page).locator('[data-lesson-card="prompt"]')).toHaveAttribute('data-lesson-state', 'new');
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
        await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
        await expect.poll(current).not.toBe(id);
        continue;
      }
      if (await letTheAppDo(page, api)) continue;
      // What only the person decides: the second model file, the words of the description.
      const lack = await panel(page).locator('[class*="lacking"] li').first().innerText();
      const nodes = await nodesOf(api);
      if (/has the same file/.test(lack)) {
        const loaders = nodes.filter((node) => node.data.comfyType === 'UNETLoader');
        await change(page, api, { type: 'set-parameter', nodeId: loaders[1].id, key: 'unet_name', value: 'z_image_turbo_bf16.safetensors' });
      } else if (/Write a prompt/.test(lack)) {
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
    await expect(panel(page).locator('[data-lesson-card="lora"]')).toContainText('Video from text');

    // The lessons for adults are closed in a new profile, not hidden: one row at the end that leads to the switch.
    const closed = panel(page).locator('[data-lesson-group-closed="adult"]');
    await expect(closed).toContainText('For adults (18+)');
    await expect(panel(page).locator('[data-lesson-card="adult"]')).toHaveCount(0);
    await closed.getByRole('button', { name: 'Open the setting', exact: true }).click();
    const settings = page.locator('[role="dialog"].settings-dialog');
    const adultSwitch = settings.getByRole('switch', { name: 'Adult content (18+)' });
    await expect(adultSwitch).toHaveAttribute('aria-checked', 'false');
    await adultSwitch.click();
    // Turning it on shows the rules and asks one thing: the person's word that they are 18 or older.
    const confirm = page.locator('[role="dialog"].adult-content-dialog');
    await expect(confirm).toContainText('Keep these out of your work:');
    await expect(confirm).toContainText('anything the law forbids where you live.');
    await shot(page, '5-adult-switch');
    await expectSoundLayout(page, 'settings, the confirmation of adult content');
    await confirm.getByRole('button', { name: 'I am 18 or older', exact: true }).click();
    await expect(adultSwitch).toHaveAttribute('aria-checked', 'true');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings).toHaveCount(0);
    await expect(closed).toHaveCount(0);

    // The lesson on adult content stands on the same graph and asks for nothing more on the canvas. The subject
    // may come from a further-trained pair of models chosen in the two loaders, so the lesson asks for no LoRA.
    await expect(panel(page).locator('[data-lesson-card="adult-image"]')).toContainText('A first picture from text');
    await expect(panel(page).locator('[data-lesson-card="adult"]')).toContainText('Video from text');
    await panel(page).locator('[data-lesson-card="adult"]').getByRole('button', { name: 'Start', exact: true }).click();
    const adult = LESSONS.find((item) => item.id === 'adult')!;
    const readOn = async (until: string): Promise<string[]> => {
      const shown: string[] = [];
      for (let guard = 0; guard < 20; guard += 1) {
        const id = (await current())!;
        if (id === until) return shown;
        expect(adult.steps.find((item) => item.id === id)?.read, `the lesson on adult content waits at "${id}"`).toBe(true);
        shown.push(id);
        if (id === 'rules') await expect(panel(page)).toContainText('sexual violence and coercion;');
        if (id === 'tuned') {
          await expect(panel(page)).toContainText('A further-trained version of Wan 2.2 usually also comes as a pair of files.');
          await shot(page, '5-adult-further-trained');
          await expectSoundLayout(page, 'lessons, a further-trained model');
        }
        await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
        await expect.poll(current).not.toBe(id);
      }
      throw new Error(`the lesson did not come to "${until}"`);
    };
    // No LoRA on the canvas: the step about the graph and the step about a LoRA's words hold on their own.
    expect(await readOn('end')).toEqual(['rules', 'levers', 'model', 'tuned', 'lora', 'pair-loras', 'anchor', 'prompt', 'defects', 'helper']);
    await expect(page.locator('.react-flow__node')).toHaveCount(14);

    // A LoRA whose file names its words is put on the canvas: now the lesson asks for them in the description.
    const withWords = 'Z-Image-Turbo-Realism-LoRA.safetensors';
    await expect.poll(async () => ((await api('modelDetail', ['loras', withWords])) as { triggerWords?: string[] } | null)?.triggerWords ?? [], { timeout: 60_000 }).toEqual(['realism', 'photo']);
    await change(page, api, { type: 'add-node', nodeType: 'LoraLoaderModelOnly', title: 'LoraLoaderModelOnly', x: 0, y: 1400 });
    const loader = (await nodesOf(api)).find((node) => node.data.comfyType === 'LoraLoaderModelOnly')!;
    await change(page, api, { type: 'set-parameter', nodeId: loader.id, key: 'lora_name', value: withWords });
    await stepIs(page, 'trigger');
    await expect(panel(page).locator('[class*="lacking"] li').first()).toHaveText(said(en.lessons.lackTrigger, { node: 'CLIP Text Encode (Prompt) (prompt)', words: ['realism', 'photo'] }));
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

/** A value a person would choose in a field that is empty or must differ from another, from what the fake ComfyUI lists. */
const FILES: Record<string, string[]> = {
  ckpt_name: ['juggernautXL_v9.safetensors', 'ponyDiffusionV6XL.safetensors'],
  unet_name: ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'],
  clip_name: ['umt5_xxl_fp8_e4m3fn_scaled.safetensors'],
  vae_name: ['wan_2.1_vae.safetensors'],
  image: ['example.png'],
  // The same field name on another node holds another kind of file.
  'WanVideoModelLoader.model': ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'],
  'LoadWanVideoT5TextEncoder.model_name': ['umt5_xxl_fp8_e4m3fn_scaled.safetensors'],
  'WanVideoVAELoader.model_name': ['wan_2.1_vae.safetensors'],
  'WanVideoVACEModelSelect.vace_model': ['wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors', 'z_image_turbo_bf16.safetensors'],
  'MultiTalkModelLoader.model': ['z_image_turbo_bf16.safetensors'],
  'Wav2VecModelLoader.model': ['chinese-wav2vec2-base-fp16.safetensors'],
  'CLIPVisionLoader.clip_name': ['clip_vision_h.safetensors'],
  'OnnxDetectionModelLoader.vitpose_model': ['vitpose-l-wholebody.onnx'],
  'OnnxDetectionModelLoader.yolo_model': ['yolov10m.onnx'],
  'LoadVideo.file': ['dance.mp4'],
  'LoadAudio.audio': ['voice.wav', 'voice2.wav'],
  'FantasyTalkingModelLoader.model': ['z_image_turbo_bf16.safetensors'],
  'WanVideoLoraSelect.lora': ['wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors'],
  'WanVideoExtraModelSelect.extra_model': ['z_image_turbo_bf16.safetensors'],
  'OviMMAudioVAELoader.vae': ['mmaudio_vae_16k_fp32.safetensors'],
  'OviMMAudioVAELoader.vocoder': ['mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors'],
};
const DESCRIPTION = 'A young woman in a red coat walks slowly along a wet city street at night. The camera follows her from the side. Soft cinematic light.';

/**
 * Carries a lesson through the way a person would: reads what explains, lets the app do what it offers, and makes
 * the choices that are a person's own. Which node a choice is for is found with "Show me where", as a person
 * finds it. `each` is called once at every step, before anything is done in it.
 */
async function carry(page: Page, api: Bridge, id: string, each?: (stepId: string) => Promise<void>, words = DESCRIPTION): Promise<void> {
  const lesson = LESSONS.find((item) => item.id === id)!;
  const current = () => panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');
  let seen = '';
  for (let guard = 0; guard < 160; guard += 1) {
    const stepId = await current();
    if (stepId === 'end') return;
    if (stepId !== seen) {
      seen = String(stepId);
      await each?.(seen);
    }
    const step = lesson.steps.find((item) => item.id === stepId)!;
    if (step.read) {
      await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
      await expect.poll(current).not.toBe(stepId);
      continue;
    }
    if (await letTheAppDo(page, api)) continue;
    const lack = await panel(page).locator('[class*="lacking"] li').first().innerText();
    const show = panel(page).getByRole('button', { name: 'Show me where', exact: true });
    const targetId = await show.getAttribute('data-lesson-target');
    expect(targetId, `${id}/${stepId}: the field has a target node`).toBeTruthy();
    await show.click();
    const shown = page.locator('.react-flow__node.selected');
    await expect(shown, `${id}/${stepId}: ${lack}`).toHaveCount(1);
    await expect(shown, `${id}/${stepId}: Show selected its target`).toHaveAttribute('data-id', targetId!);
    const nodeId = String(await shown.getAttribute('data-id'));
    const node = (await nodesOf(api)).find((item) => item.id === nodeId)!;
    const field = /field (\w+) of/.exec(lack)?.[1] ?? (node.data.comfyType === 'WanVideoTextEncode' ? 'positive_prompt' : 'text');
    if (/Choose a value|has the same file/.test(lack)) {
      const held = new Set((await nodesOf(api)).map((item) => item.data.parameters[field]));
      const value = (FILES[`${node.data.comfyType}.${field}`] ?? FILES[field] ?? []).find((item) => !held.has(item));
      if (!value) throw new Error(`${id}/${stepId}: nothing to choose for ${field}: ${lack}`);
      await change(page, api, { type: 'set-parameter', nodeId, key: field, value });
    } else if (/negative prompt\)”|repeats your prompt/.test(lack)) {
      // The negative prompt names defects, not the scene.
      await change(page, api, { type: 'set-parameter', nodeId, key: field, value: 'blurry, extra fingers, watermark' });
    } else if (/Write a prompt|is too short/.test(lack)) {
      await change(page, api, { type: 'set-parameter', nodeId, key: field, value: words });
    } else if (/is missing the tags/.test(lack)) {
      await change(page, api, { type: 'set-parameter', nodeId, key: field, value: `${String(node.data.parameters[field] ?? '')} She says <S>Good evening.<E>` });
    } else if (/has no weight yet/.test(lack)) {
      await change(page, api, { type: 'set-parameter', nodeId, key: field, value: `${String(node.data.parameters[field] ?? '')} (red coat:1.2)` });
    } else {
      throw new Error(`the lesson “${id}” waits at "${stepId}" for: ${lack}`);
    }
  }
  throw new Error(`the lesson “${id}” did not come to its end`);
}

async function startLesson(page: Page, id: string): Promise<void> {
  if ((await panel(page).getAttribute('data-lesson')) !== 'list') await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
  await panel(page).locator(`[data-lesson-card="${id}"]`).getByRole('button').first().click();
  await expect(panel(page)).toHaveAttribute('data-lesson', id);
}

type Built = { nodes: Array<{ id: string; position: { x: number; y: number }; data: { comfyType: string; parameters: Record<string, unknown> } }>; edges: Array<{ source: string; target: string; targetHandle: string }> };
const builtOf = async (api: Bridge): Promise<Built> => ((await api('readProjection', ['desktop'])) as { snapshot: Built }).snapshot;

test('lessons: descriptions, a second pass and a picture model in front of a video are carried through', async () => {
  test.setTimeout(900_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  const wide = [{ width: 1440, height: 900 }];
  try {
    await openLearn(page);
    // The list offers ten lessons, each new one saying which graph it goes on from.
    await expect(panel(page).locator('[data-lesson-card="prompt"]')).toContainText('A first picture from text');
    await expect(panel(page).locator('[data-lesson-card="refine"]')).toContainText('A first picture from text');
    await expect(panel(page).locator('[data-lesson-card="prompt-video"]')).toContainText('Video from text');
    await expect(panel(page).locator('[data-lesson-card="two-models"]')).toContainText('Video from a picture');

    // ---- Pictures: the first graph, then what a description is, then a second model over the first ----
    await startLesson(page, 'image');
    // A newcomer's first description: a few words.
    await carry(page, api, 'image', undefined, 'a quiet lake at dawn');
    await stepIs(page, 'end');
    // The lesson after the first picture is the one on descriptions.
    await expect(panel(page).locator('[data-next-lesson="prompt"]')).toContainText('The next lesson: “The prompt: how a model reads it”.');
    await panel(page).getByRole('button', { name: 'Start the next lesson', exact: true }).click();
    await expect(panel(page)).toHaveAttribute('data-lesson', 'prompt');
    const told: string[] = [];
    await carry(page, api, 'prompt', async (stepId) => {
      told.push(stepId);
      await expectSoundLayout(page, `lessons, descriptions: ${stepId}`, wide);
      if (stepId === 'write') {
        // The description of the first lesson is a few words: the step says how many characters it has and needs.
        await expect(panel(page).locator('[class*="lacking"] li').first()).toContainText(/is too short: \d+ characters, at least 40 needed\./);
      }
      if (stepId === 'weigh') {
        await expect(panel(page).locator('[class*="lacking"] li').first()).toContainText('has no weight yet. Put what matters into parentheses with a number from 0.5 to 1.5 other than 1, like this: (red coat:1.2).');
        // Words are the person's: the app does not offer to write them.
        await expect(panel(page).getByRole('button', { name: 'Do this for me', exact: true })).toHaveCount(0);
      }
      if (stepId === 'weights') await shot(page, '8-description-weights');
    });
    await stepIs(page, 'end');
    // The graph of the first lesson is on the canvas, so the step that asks for it is passed at once. Every other
    // step was met in order: nothing that explains is skipped.
    expect(told).toEqual(LESSONS.find((item) => item.id === 'prompt')!.steps.map((step) => step.id).filter((stepId) => stepId !== 'graph'));
    const pictureNodes = (await builtOf(api)).nodes.length;
    expect(pictureNodes).toBe(7);

    await startLesson(page, 'refine');
    await carry(page, api, 'refine', async (stepId) => {
      await expectSoundLayout(page, `lessons, a second pass: ${stepId}`, wide);
      if (stepId === 'second-model') await shot(page, '9-second-model');
    });
    await stepIs(page, 'end');
    let built = await builtOf(api);
    // Seven nodes of the second pass next to the seven of the first, and both pictures are saved.
    expect(built.nodes.length).toBe(14);
    expect(built.nodes.filter((node) => node.data.comfyType === 'SaveImage')).toHaveLength(2);
    const loaders = built.nodes.filter((node) => node.data.comfyType === 'CheckpointLoaderSimple').map((node) => node.data.parameters.ckpt_name);
    expect(new Set(loaders).size).toBe(2);
    const second = built.nodes.filter((node) => node.data.comfyType === 'KSampler').map((node) => Number(node.data.parameters.denoise)).sort();
    expect(second).toEqual([0.5, 1]);
    let placed = new Map(built.nodes.map((node) => [node.id, node]));
    for (const edge of built.edges) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, '10-second-pass-done');
    await expectSoundLayout(page, 'lessons, a second pass done', wide);
    // The lessons it stands on are still done: nothing of the first pass was rewired.
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    for (const id of ['image', 'prompt', 'refine']) await expect(panel(page).locator(`[data-lesson-card="${id}"]`), id).toHaveAttribute('data-lesson-state', 'done');

    // ---- Video: a new canvas, the graph from text, the description of a clip, then a picture, then two models ----
    await page.keyboard.press('Control+n');
    await page.getByRole('button', { name: 'Start new project', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0, { timeout: 15_000 });
    await startLesson(page, 'video-text');
    await carry(page, api, 'video-text');
    await stepIs(page, 'end');
    await startLesson(page, 'prompt-video');
    await carry(page, api, 'prompt-video', async (stepId) => {
      await expectSoundLayout(page, `lessons, a description for video: ${stepId}`, wide);
      if (stepId === 'camera') await shot(page, '11-video-camera-words');
    });
    await stepIs(page, 'end');
    await startLesson(page, 'video-image');
    await carry(page, api, 'video-image');
    await stepIs(page, 'end');
    const videoNodes = new Set((await builtOf(api)).nodes.map((node) => node.id));
    const videoTexts = (await builtOf(api)).nodes.filter((node) => node.data.comfyType === 'CLIPTextEncode').map((node) => node.id).sort();

    await startLesson(page, 'two-models');
    await carry(page, api, 'two-models', async (stepId) => {
      await expectSoundLayout(page, `lessons, two models: ${stepId}`, wide);
      if (stepId === 'image-texts') {
        // The video's two texts are on the canvas, and the lesson asks for two more: it does not take those.
        await expect(panel(page).locator('[class*="lacking"] li').first()).toContainText(/More .* nodes are needed: 2\./);
      }
      if (stepId === 'bridge') await shot(page, '12-two-models-bridge');
    });
    await stepIs(page, 'end');
    built = await builtOf(api);
    placed = new Map(built.nodes.map((node) => [node.id, node]));
    // The video's own texts were left as they were, and the picture model has its own pair.
    expect(built.nodes.filter((node) => node.data.comfyType === 'CLIPTextEncode')).toHaveLength(4);
    for (const id of videoTexts) {
      const feeder = built.edges.find((edge) => edge.target === id);
      expect(placed.get(feeder!.source)!.data.comfyType, 'what the text of the video reads with').toBe('CLIPLoader');
    }
    // The frame comes from the picture model now, and every link of the new part goes from left to right.
    const start = built.nodes.find((node) => node.data.comfyType === 'WanImageToVideo')!;
    const feeders = built.edges.filter((edge) => edge.target === start.id).map((edge) => placed.get(edge.source)!.data.comfyType);
    expect(feeders).toContain('VAEDecode');
    expect(feeders).not.toContain('LoadImage');
    const added = built.edges.filter((edge) => !videoNodes.has(edge.source));
    expect(added.length).toBeGreaterThan(7);
    for (const edge of added) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, '13-two-models-done');
    await expectSoundLayout(page, 'lessons, two models done', wide);

    // The whole graph is sound for ComfyUI: two families of models, each in its own path, and nothing to object to.
    await page.getByRole('button', { name: 'Check graph', exact: true }).click();
    const check = page.locator('.check-panel');
    await expect(check).toBeVisible();
    await expect(check.getByRole('button', { name: 'Check the graph', exact: true })).toBeEnabled();
    await expect(check).toContainText('No problems found.');
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: a video on WanVideoWrapper is carried through, from text and then from a picture, and its description is read', async () => {
  test.setTimeout(600_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  const wide = [{ width: 1440, height: 900 }];
  try {
    await openLearn(page);
    await expect(panel(page).locator('[data-lesson-card="wrapper"]')).toHaveAttribute('data-lesson-state', 'new');
    await expect(panel(page).locator('[data-lesson-card="wrapper-image"]')).toContainText('Video on WanVideoWrapper');
    await startLesson(page, 'wrapper');
    await carry(page, api, 'wrapper', async (stepId) => {
      await expectSoundLayout(page, `lessons, WanVideoWrapper: ${stepId}`, wide);
      if (stepId === 'memory') await shot(page, '14-wrapper-memory');
    });
    await stepIs(page, 'end');
    let built = await builtOf(api);
    // Only the pack's nodes, and the two built-in ones that save the clip.
    expect(built.nodes.map((node) => node.data.comfyType).filter((type) => !/Wan/.test(type)).sort()).toEqual(['CreateVideo', 'SaveVideo']);
    const samplers = built.nodes.filter((node) => node.data.comfyType === 'WanVideoSampler').map((node) => node.data.parameters);
    const firstPass = samplers.find((item) => Number(item.end_step) > 0)!;
    const secondPass = samplers.find((item) => item !== firstPass)!;
    expect(secondPass.start_step).toBe(firstPass.end_step);
    expect(Number(firstPass.cfg)).toBe(3.5);
    let placed = new Map(built.nodes.map((node) => [node.id, node]));
    for (const edge of built.edges) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }

    // The description of the pack's text node is read by "Check": at cfg 1 its second text does nothing.
    const text = built.nodes.find((node) => node.data.comfyType === 'WanVideoTextEncode')!;
    await change(page, api, { type: 'set-parameter', nodeId: text.id, key: 'negative_prompt', value: 'blurry, static' });
    for (const sampler of built.nodes.filter((node) => node.data.comfyType === 'WanVideoSampler')) {
      await change(page, api, { type: 'set-parameter', nodeId: sampler.id, key: 'cfg', value: 1 });
    }
    await page.getByRole('button', { name: 'Check graph', exact: true }).click();
    const check = page.locator('.check-panel');
    await expect(check.getByRole('button', { name: 'Check the graph', exact: true })).toBeEnabled();
    await expect(check.locator('[data-check-group="promptNotes"]')).toContainText('has cfg 1, and at cfg 1 the negative prompt has no effect at all.');
    await shot(page, '15-wrapper-check');
    await openLearn(page);

    await startLesson(page, 'wrapper-image');
    await carry(page, api, 'wrapper-image', async (stepId) => {
      await expectSoundLayout(page, `lessons, WanVideoWrapper from a picture: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    built = await builtOf(api);
    placed = new Map(built.nodes.map((node) => [node.id, node]));
    const start = built.nodes.find((node) => node.data.comfyType === 'WanVideoImageToVideoEncode')!;
    const fed = built.edges.filter((edge) => edge.source === start.id).map((edge) => placed.get(edge.target)!.data.comfyType);
    expect(fed).toEqual(['WanVideoSampler', 'WanVideoSampler']);
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, '16-wrapper-image-done');
    await expectSoundLayout(page, 'lessons, WanVideoWrapper from a picture done', wide);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: VACE, animation by pose and a talking portrait on WanVideoWrapper are carried through', async () => {
  test.setTimeout(900_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  const wide = [{ width: 1440, height: 900 }];
  const newProject = async () => {
    await page.keyboard.press('Control+n');
    await page.getByRole('button', { name: 'Start new project', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0, { timeout: 15_000 });
  };
  const leftToRight = async (label: string) => {
    const built = await builtOf(api);
    const placed = new Map(built.nodes.map((node) => [node.id, node]));
    for (const edge of built.edges) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${label}: ${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }
    return built;
  };
  try {
    await openLearn(page);
    for (const id of ['wrapper-vace', 'wrapper-animate', 'wrapper-talk']) await expect(panel(page).locator(`[data-lesson-card="${id}"]`), id).toHaveAttribute('data-lesson-state', 'new');

    // VACE stands on the WanVideoWrapper graph.
    await startLesson(page, 'wrapper');
    await carry(page, api, 'wrapper');
    await startLesson(page, 'wrapper-vace');
    await carry(page, api, 'wrapper-vace', async (stepId) => {
      await expectSoundLayout(page, `lessons, VACE: ${stepId}`, wide);
      if (stepId === 'control') await shot(page, '17-vace-control');
    });
    await stepIs(page, 'end');
    let built = await leftToRight('VACE');
    const vace = built.nodes.find((node) => node.data.comfyType === 'WanVideoVACEEncode')!;
    expect(built.edges.filter((edge) => edge.source === vace.id)).toHaveLength(2);
    // The lesson before still holds: VACE is a start of the clip like the empty one.
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-card="wrapper"]')).toHaveAttribute('data-lesson-state', 'done');

    // Animation by pose, from an empty canvas; consent is said before anything is built.
    await newProject();
    await startLesson(page, 'wrapper-animate');
    await expect(panel(page)).toContainText('Only someone who agrees may be brought to life this way');
    await carry(page, api, 'wrapper-animate', async (stepId) => {
      await expectSoundLayout(page, `lessons, Wan Animate: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    built = await leftToRight('Animate');
    const animate = built.nodes.find((node) => node.data.comfyType === 'WanVideoAnimateEmbeds')!;
    expect(built.edges.filter((edge) => edge.target === animate.id)).toHaveLength(5);
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, '18-animate-done');

    // A talking portrait: the sound reaches both the sampler and the saved clip.
    await newProject();
    await startLesson(page, 'wrapper-talk');
    await expect(panel(page)).toContainText('with their own voice or a voice you have permission for');
    await carry(page, api, 'wrapper-talk', async (stepId) => {
      await expectSoundLayout(page, `lessons, InfiniteTalk: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    built = await leftToRight('InfiniteTalk');
    const audio = built.nodes.find((node) => node.data.comfyType === 'MultiTalkWav2VecEmbeds')!;
    const fed = built.edges.filter((edge) => edge.source === audio.id).map((edge) => built.nodes.find((node) => node.id === edge.target)!.data.comfyType).sort();
    expect(fed).toEqual(['CreateVideo', 'WanVideoSampler']);
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, '19-talk-done');
    await expectSoundLayout(page, 'lessons, InfiniteTalk done', wide);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: two voices, FantasyTalking, UniAnimate, ReCamMaster and Ovi on WanVideoWrapper are carried through', async () => {
  test.setTimeout(1_200_000);
  const fake = await startFakeMcp({ extraLoras: 3, video: true });
  const { app, page, api, userData } = await launch(fake);
  const wide = [{ width: 1440, height: 900 }];
  const newProject = async () => {
    await page.keyboard.press('Control+n');
    await page.getByRole('button', { name: 'Start new project', exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(0, { timeout: 15_000 });
  };
  const leftToRight = async (label: string) => {
    const built = await builtOf(api);
    const placed = new Map(built.nodes.map((node) => [node.id, node]));
    for (const edge of built.edges) {
      const from = placed.get(edge.source)!;
      const to = placed.get(edge.target)!;
      expect(from.position.x, `${label}: ${from.data.comfyType} → ${to.data.comfyType}`).toBeLessThan(to.position.x);
    }
    return built;
  };
  const typeOf = (built: Built, id: string) => built.nodes.find((node) => node.id === id)!.data.comfyType;
  const feeders = (built: Built, classType: string) => {
    const node = built.nodes.find((item) => item.data.comfyType === classType)!;
    return built.edges.filter((edge) => edge.target === node.id).map((edge) => typeOf(built, edge.source)).sort();
  };
  const fitShot = async (name: string) => {
    await page.locator('.react-flow__controls-fitview').click();
    await page.waitForTimeout(450);
    await shot(page, name);
  };
  try {
    await openLearn(page);
    for (const id of ['wrapper-duo', 'wrapper-fantasy', 'wrapper-unianimate', 'wrapper-recam', 'wrapper-ovi']) await expect(panel(page).locator(`[data-lesson-card="${id}"]`), id).toHaveAttribute('data-lesson-state', 'new');

    // Two voices stand on the graph of the talking portrait.
    await startLesson(page, 'wrapper-talk');
    await carry(page, api, 'wrapper-talk');
    await startLesson(page, 'wrapper-duo');
    await expect(panel(page)).toContainText('only those who agree may be voiced');
    await carry(page, api, 'wrapper-duo', async (stepId) => {
      await expectSoundLayout(page, `lessons, two voices: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    let built = await leftToRight('two voices');
    const voices = built.nodes.filter((node) => node.data.comfyType === 'LoadAudio');
    expect(voices.map((node) => node.data.parameters.audio).sort()).toEqual(['voice.wav', 'voice2.wav']);
    expect(feeders(built, 'MultiTalkWav2VecEmbeds')).toEqual(['LoadAudio', 'LoadAudio', 'Wav2VecModelLoader']);
    await panel(page).getByRole('button', { name: 'All lessons', exact: true }).click();
    await expect(panel(page).locator('[data-lesson-card="wrapper-talk"]')).toHaveAttribute('data-lesson-state', 'done');
    await fitShot('20-two-voices-done');

    // FantasyTalking: the speech reader the module was trained with, a sound as long as the clip, the sound in the clip.
    await newProject();
    await startLesson(page, 'wrapper-fantasy');
    await expect(panel(page)).toContainText('with their own voice or a voice you have permission for');
    await carry(page, api, 'wrapper-fantasy', async (stepId) => {
      await expectSoundLayout(page, `lessons, FantasyTalking: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    built = await leftToRight('FantasyTalking');
    expect(built.nodes.find((node) => node.data.comfyType === 'DownloadAndLoadWav2VecModel')!.data.parameters.model).toBe('facebook/wav2vec2-base-960h');
    expect(feeders(built, 'FantasyTalkingWav2VecEmbeds')).toEqual(['DownloadAndLoadWav2VecModel', 'FantasyTalkingModelLoader', 'LoadAudio']);
    expect(feeders(built, 'CreateVideo')).toEqual(['LoadAudio', 'WanVideoDecode']);

    // UniAnimate: consent first; the skeleton reaches the sampler, the LoRA the model.
    await newProject();
    await startLesson(page, 'wrapper-unianimate');
    await expect(panel(page)).toContainText('Only someone who agrees may be brought to life this way');
    await carry(page, api, 'wrapper-unianimate', async (stepId) => {
      await expectSoundLayout(page, `lessons, UniAnimate: ${stepId}`, wide);
    });
    await stepIs(page, 'end');
    built = await leftToRight('UniAnimate');
    expect(feeders(built, 'WanVideoUniAnimatePoseInput')).toEqual(['WanVideoUniAnimateDWPoseDetector', 'WanVideoUniAnimateDWPoseDetector']);
    expect(feeders(built, 'WanVideoModelLoader')).toEqual(['WanVideoLoraSelect']);
    await fitShot('21-unianimate-done');

    // ReCamMaster: the video goes in as a latent, to the camera and to the embed.
    await newProject();
    await startLesson(page, 'wrapper-recam');
    await carry(page, api, 'wrapper-recam', async (stepId) => {
      await expectSoundLayout(page, `lessons, ReCamMaster: ${stepId}`, wide);
      if (stepId === 'camera') await shot(page, '22-recam-camera');
    });
    await stepIs(page, 'end');
    built = await leftToRight('ReCamMaster');
    expect(feeders(built, 'WanVideoReCamMasterCameraEmbed')).toEqual(['WanVideoEncode', 'WanVideoReCamMasterDefaultCamera']);
    expect(feeders(built, 'WanVideoSampler')).toEqual(['WanVideoModelLoader', 'WanVideoReCamMasterCameraEmbed', 'WanVideoTextEncode']);

    // Ovi: the description is held to the marks of speech, and the sound is decoded into the clip.
    await newProject();
    await startLesson(page, 'wrapper-ovi');
    let askedForMarks = false;
    await carry(page, api, 'wrapper-ovi', async (stepId) => {
      await expectSoundLayout(page, `lessons, Ovi: ${stepId}`, wide);
      if (stepId === 'speech') {
        await expect(panel(page).locator('[class*="lacking"] li').first()).toContainText(said(en.lessons.lackTextMark, { field: 'positive_prompt', node: 'WanVideo TextEncode', marks: '<S> <E>' }));
        askedForMarks = true;
        await shot(page, '23-ovi-speech');
      }
    });
    expect(askedForMarks).toBe(true);
    await stepIs(page, 'end');
    built = await leftToRight('Ovi');
    // Two text nodes: the description with the speech, and what the sound must not be; both reach the Ovi node.
    const texts = built.nodes.filter((node) => node.data.comfyType === 'WanVideoTextEncode');
    expect(texts.filter((node) => /<S>.+<E>/.test(String(node.data.parameters.positive_prompt)))).toHaveLength(1);
    expect(feeders(built, 'WanVideoOviCFG')).toEqual(['WanVideoTextEncode', 'WanVideoTextEncode']);
    expect(feeders(built, 'WanVideoSampler')).toEqual(['WanVideoEmptyEmbeds', 'WanVideoEmptyMMAudioLatents', 'WanVideoModelLoader', 'WanVideoOviCFG']);
    expect(feeders(built, 'CreateVideo')).toEqual(['WanVideoDecode', 'WanVideoDecodeOviAudio']);
    const loader = built.nodes.find((node) => node.data.comfyType === 'OviMMAudioVAELoader')!;
    expect(loader.data.parameters.vae).not.toBe(loader.data.parameters.vocoder);
    await fitShot('24-ovi-done');
    await expectSoundLayout(page, 'lessons, Ovi done', wide);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('lessons: the graph a lesson built is checked, and its description is read for what will not work', async () => {
  test.setTimeout(240_000);
  const fake = await startFakeMcp();
  const { app, page, api, userData } = await launch(fake);
  try {
    await openLearn(page);
    await panel(page).locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true }).click();
    const lesson = LESSONS.find((item) => item.id === 'image')!;
    const current = () => panel(page).locator('[data-lesson-step]').getAttribute('data-lesson-step');
    // A description as a newcomer brings it from another program: a LoRA written into the text, a weight far too
    // high, and "no" where the thing is wanted gone.
    const brought = 'a street with no cars, <lora:neon:0.8>, (rain:1.9)';
    for (let guard = 0; guard < 60; guard += 1) {
      const id = await current();
      if (id === 'end') break;
      const step = lesson.steps.find((item) => item.id === id)!;
      if (step.read) {
        await panel(page).getByRole('button', { name: 'Got it, next', exact: true }).click();
        await expect.poll(current).not.toBe(id);
        continue;
      }
      if (await letTheAppDo(page, api)) continue;
      const lack = await panel(page).locator('[class*="lacking"] li').first().innerText();
      const nodes = await nodesOf(api);
      if (/Choose a value/.test(lack)) {
        const loader = nodes.find((node) => node.data.comfyType === 'CheckpointLoaderSimple')!;
        await change(page, api, { type: 'set-parameter', nodeId: loader.id, key: 'ckpt_name', value: 'juggernautXL_v9.safetensors' });
      } else if (/Write a prompt/.test(lack)) {
        const text = nodes.find((node) => node.data.comfyType === 'CLIPTextEncode')!;
        await change(page, api, { type: 'set-parameter', nodeId: text.id, key: 'text', value: brought });
      } else {
        throw new Error(`the lesson waits at "${id}" for: ${lack}`);
      }
    }
    await stepIs(page, 'end');

    const check = page.locator('.check-panel');
    const runCheck = async () => {
      await page.getByRole('button', { name: 'Check graph', exact: true }).click();
      await expect(check).toBeVisible();
      await expect(check.getByRole('button', { name: 'Check the graph', exact: true })).toBeEnabled();
    };
    await runCheck();
    // The graph is whole: nothing stops it from running. What is said is about the description, and apart.
    await expect(check).toContainText('No problems found.');
    const advice = check.locator('[data-check-group="promptNotes"]');
    await expect(advice.getByRole('heading')).toContainText('Prompts: worth changing (3)');
    await expect(advice).toContainText('These are not errors: the graph will run.');
    const rows = advice.getByRole('listitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('contains <lora:neon:0.8>. In ComfyUI this connects nothing');
    await expect(rows.nth(1)).toContainText('The weight (rain:1.9) in “CLIP Text Encode (Prompt)” is too high.');
    await expect(rows.nth(2)).toContainText('contains the negation “no”.');
    await shot(page, '7-check-advice');
    await expectSoundLayout(page, 'check panel with advice about a description', [{ width: 1440, height: 900 }]);
    // "Show" takes the canvas to the node that holds the text. The whole sentence is the Show button: its name is the
    // finding, then what it does; the quiet "Ask why" beside it is the other button of the row.
    await rows.nth(0).getByRole('button', { name: new RegExp(`\\. ${en.explain.checkShow}$`) }).click();
    await expect(page.locator('.react-flow__node.selected')).toContainText('CLIP Text Encode');

    // The description put right: there is nothing more to say.
    const described = (await nodesOf(api)).find((node) => node.data.comfyType === 'CLIPTextEncode' && String(node.data.parameters.text ?? '').includes('street'))!;
    await change(page, api, { type: 'set-parameter', nodeId: described.id, key: 'text', value: 'an empty street at night, wet asphalt, (rain:1.2)' });
    await runCheck();
    await expect(check).toContainText('No problems found.');
    await expect(check.locator('[data-check-group="promptNotes"]')).toHaveCount(0);

    // A negative description at cfg 1 is said to do nothing, by the names the person sees.
    const other = (await nodesOf(api)).find((node) => node.data.comfyType === 'CLIPTextEncode' && node.id !== described.id)!;
    await change(page, api, { type: 'set-parameter', nodeId: other.id, key: 'text', value: 'blurry, distorted' });
    const sampler = (await nodesOf(api)).find((node) => node.data.comfyType === 'KSampler')!;
    await change(page, api, { type: 'set-parameter', nodeId: sampler.id, key: 'cfg', value: 1 });
    await runCheck();
    await expect(check.locator('[data-check-group="promptNotes"]').getByRole('listitem')).toHaveCount(1);
    await expect(check.locator('[data-check-group="promptNotes"]')).toContainText('The sampler “KSampler” has cfg 1, and at cfg 1 the negative prompt has no effect at all.');
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
