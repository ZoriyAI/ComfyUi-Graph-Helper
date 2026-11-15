/**
 * The screenshots of the public README and its gallery (docs/screenshots/en|ru/NN-name.png). Run by
 * `npm run shots:public` after `npm run build`; skipped in an ordinary e2e run because it rewrites tracked files.
 * Every state is reached the way a person reaches it, against fake servers only (the test MCP server and a showcase
 * model server): no real server, no real person's data. A state that cannot be reached fails the run with its name,
 * so a picture is never silently missing or half-empty. Reduced motion, fixed window 1440x900 at scale 1.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranslator } from '../../../src/shared/i18n';
import { startFakeComfy, type FakeComfy } from '../../fixtures/comfy/fakeComfy';
import { nestedSubgraphWorkflow } from '../fixtures/nestedSubgraphWorkflow';
import { startShowcaseLlm, SHOWCASE_MODEL, SHOWCASE_QUESTIONS, type ShowcaseLanguage, type ShowcaseLlm } from './showcaseLlm';
import { PUBLIC_SHOTS } from './shotList';
import { textToPictureWorkflow, unfinishedWorkflow, largeWorkflow } from './workflows';

const ENABLED = process.env.PUBLIC_SHOTS === '1';
const ROOT = path.join(__dirname, '../../../docs/screenshots');
const LANGUAGES: ShowcaseLanguage[] = (process.env.PUBLIC_SHOTS_LANG ?? 'en,ru').split(',').map((part) => part.trim() as ShowcaseLanguage);
const WINDOW = { width: 1440, height: 900 };
/** The card of a made-up setup that the lesson "Install and a first run" asks the person to keep beside the graph. */
const SETUP_CARD: Record<ShowcaseLanguage, string> = {
  en: 'Linux, a graphics card with 12 GB, ComfyUI 0.45.0, a manual install, models in the models folder, pictures in output.',
  ru: 'Linux, видеокарта на 12 ГБ, ComfyUI 0.45.0, ручная установка, модели в папке models, картинки в output.',
};

type Bridge = Record<string, (...args: unknown[]) => Promise<any>>;
const api = (page: Page, name: string, args: unknown[] = []) => page.evaluate(async ({ name, args }) => {
  const bridge = (window as unknown as { electronAPI: Bridge }).electronAPI;
  return bridge[name](...args);
}, { name, args });

/** Waits until the window is still: fonts loaded, no running animation, no toast on screen. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // A toast is a passing message: the person would close it or wait; the picture waits too.
  for (let turn = 0; turn < 3 && await page.locator('.app-toast').count() > 0; turn += 1) {
    await page.locator('.app-toast button[aria-label]').last().click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.app-toast'), 'a toast is still on screen').toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity).length), { timeout: 10_000 }).toBe(0);
  // The mouse rests in the status bar corner, so no hover state or tooltip lands in the picture by chance.
  await page.mouse.move(WINDOW.width - 4, WINDOW.height - 4);
  await page.waitForTimeout(500);
}

async function shoot(page: Page, language: ShowcaseLanguage, name: string): Promise<void> {
  if (!PUBLIC_SHOTS.includes(name)) throw new Error(`${name} is not in the shot list`);
  await settle(page);
  const file = path.join(ROOT, language, `${name}.png`);
  await page.screenshot({ path: file, scale: 'css' });
  const size = fs.statSync(file).size;
  expect(size, `${name} is larger than 500 KB`).toBeLessThan(500 * 1024);
}

/** One named state; a failure names the picture that could not be made. */
async function state(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    throw new Error(`public screenshot ${name} could not be made: ${String((error as Error).message).split('\n').slice(0, 4).join(' | ')}`);
  }
}

test.describe.configure({ mode: 'serial' });

for (const language of LANGUAGES) {
  test(`public screenshots, ${language}`, async () => {
    test.skip(!ENABLED, 'only with PUBLIC_SHOTS=1 (npm run shots:public)');
    test.setTimeout(600_000);
    const T = createTranslator(language);
    const t = (key: string, values?: Record<string, unknown>) => String(T(key, values as never));
    fs.mkdirSync(path.join(ROOT, language), { recursive: true });
    // A ComfyUI with the nodes the built-in lessons use, on 8188 when that port is free, so "Find on this computer"
    // finds it. With every lesson's nodes there, the lesson list shows the lessons as a person who has them sees them.
    let comfy: FakeComfy;
    let found = true;
    try {
      comfy = await startFakeComfy({ manager: true, video: true, port: 8188 });
    } catch {
      found = false;
      comfy = await startFakeComfy({ manager: true, video: true });
    }
    const llm: ShowcaseLlm = await startShowcaseLlm(language);
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'public-shots-'));
    // The providers of an installed app (runMode.ts scriptedProviderAllowed): no TEST card in Settings ▸ Assistant.
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production', NODEWISE_PACKAGED_PROVIDERS: '1' };
    // No session bus and no keyring daemon, so Electron does not talk to the desktop's keyring during the run.
    delete env.DBUS_SESSION_BUS_ADDRESS;
    delete env.GNOME_KEYRING_CONTROL;
    let app: ElectronApplication | null = null;
    try {
      app = await electron.launch({ args: [path.join(__dirname, '../../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
      const page = await app.firstWindow();
      await page.locator('.app-shell').waitFor({ timeout: 30_000 });
      await page.setViewportSize(WINDOW);
      const reload = async () => {
        await page.reload();
        await page.locator('.app-shell').waitFor({ timeout: 30_000 });
        await page.waitForTimeout(800);
      };
      const saveSettings = async (change: Record<string, unknown>) => {
        const read = await api(page, 'getSettings') as { values?: Record<string, unknown> };
        const saved = await api(page, 'saveSettings', [{ ...(read.values ?? {}), ...change }]) as { ok?: boolean };
        expect(saved, `settings ${Object.keys(change).join(', ')}`).toMatchObject({ ok: true });
        await reload();
      };
      // The way a file lands from Open workflow: the same command the dialog commits, then the stored project is read.
      const openWorkflow = async (document: unknown) => {
        const current = await api(page, 'readProjection', ['desktop']) as { currentRevisionId: string };
        const result = await api(page, 'commitCommand', [{ projectId: 'desktop', actionId: `public-${Date.now()}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document } }]) as { status?: string };
        expect(result.status, 'the workflow opened').toBe('applied');
        await reload();
        // A wide window opens with the library; the canvas pictures want the room, so it is folded as a person would.
        await railOpen(false);
      };
      const fit = async () => { await page.locator('.react-flow__controls-fitview').click(); await page.waitForTimeout(600); };
      const nodes = page.locator('.react-flow__node');
      const dockTab = async (index: number) => {
        await page.locator('.dock-tab').nth(index).click();
        await expect(page.locator('.dock-tab').nth(index)).toHaveAttribute('data-state', 'active');
      };
      const railOpen = async (open: boolean) => {
        const rail = page.locator('#library-rail');
        // The rail's own button is pressed, not Ctrl+B: after a search the app hands focus back to the search field,
        // and a field that holds focus keeps the key to itself.
        if (((await rail.getAttribute('data-open')) === 'true') !== open) await page.locator('button[aria-controls="library-rail"]').first().click();
        await expect(rail).toHaveAttribute('data-open', String(open));
        await page.waitForTimeout(400);
      };
      // Frames the real nodes and the grey drafts together: a fit frames only real nodes, so the view zooms out a
      // step at a time until both fit, then is dragged by an empty corner until they sit in the middle.
      const showDrafts = async () => {
        const measure = () => page.evaluate(() => {
          const pane = document.querySelector('.react-flow')!.getBoundingClientRect();
          const boxes = Array.from(document.querySelectorAll('.react-flow__node, [data-ghost]')).map((item) => item.getBoundingClientRect());
          const left = Math.min(...boxes.map((box) => box.left));
          const right = Math.max(...boxes.map((box) => box.right));
          const top = Math.min(...boxes.map((box) => box.top));
          const bottom = Math.max(...boxes.map((box) => box.bottom));
          return { pane: { left: pane.left, top: pane.top, width: pane.width, height: pane.height }, left, right, top, bottom };
        });
        for (let turn = 0; ; turn += 1) {
          const m = await measure();
          if (m.right - m.left < m.pane.width - 120 && m.bottom - m.top < m.pane.height - 200) break;
          if (turn >= 8) throw new Error('the grey drafts did not fit on the canvas');
          await page.locator('.react-flow__controls-zoomout').click();
          await page.waitForTimeout(350);
        }
        const m = await measure();
        const dx = m.pane.left + m.pane.width / 2 - (m.left + m.right) / 2;
        const dy = m.pane.top + m.pane.height / 2 + 20 - (m.top + m.bottom) / 2;
        const from = { x: m.pane.left + 24, y: m.pane.top + m.pane.height - 24 };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
      };
      const composer = page.locator('.composer-field textarea');
      const ask = async (text: string) => { await composer.fill(text); await composer.press('Enter'); };
      const newProject = async () => {
        await page.keyboard.press('Control+n');
        const confirm = page.getByRole('button', { name: t('menu.newProjectConfirm'), exact: true });
        if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
        await expect(nodes).toHaveCount(0, { timeout: 10_000 });
      };
      const lessons = page.locator('.lesson-panel');
      const learn = async () => {
        await dockTab(0);
        if (await lessons.count() === 0) await page.locator('[data-intent="learn"]').click();
        await lessons.waitFor();
      };

      await saveSettings({ language, motion: 'reduced' });

      await state('01-first-start', async () => {
        await expect(page.locator('[data-step="connect"]')).toBeVisible();
        await shoot(page, language, '01-first-start');
      });

      // The first-start path a person takes: Connect… on the welcome card, find ComfyUI, check it, save, read it.
      const settings = page.locator('[role="dialog"].settings-dialog');
      await state('11-settings-connection', async () => {
        await page.locator('[data-step="connect"]').getByRole('button', { name: t('canvas.onboardConnect') }).click();
        await settings.waitFor({ timeout: 10_000 });
        const address = settings.getByRole('textbox', { name: t('settings.comfyOrigin'), exact: true });
        if (found) {
          await settings.getByRole('button', { name: t('settings.comfyFind'), exact: true }).click();
          await expect(address).toHaveValue(comfy.url, { timeout: 15_000 });
        } else {
          // Port 8188 is taken on this machine: the address is typed, as a person would after reading the hint.
          await address.fill(comfy.url);
        }
        await settings.getByRole('button', { name: t('settings.comfyCheck'), exact: true }).click();
        await expect(settings.getByText(/0\.45\.0/)).toBeVisible({ timeout: 15_000 });
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await shoot(page, language, '11-settings-connection');
        await settings.getByRole('button', { name: t('settings.save'), exact: true }).click();
        await expect(settings).toHaveCount(0);
      });
      await page.locator('[data-step="connect"]').getByRole('button', { name: t('canvas.onboardRead') }).click();
      await expect(page.locator('.sync-indicator')).toHaveAttribute('data-sync-state', 'idle', { timeout: 90_000 });
      // The assistant: a model server on this computer (the showcase server stands in for it).
      await saveSettings({ provider: 'local', baseURL: `${llm.origin}/v1`, model: SHOWCASE_MODEL });

      await state('02-canvas-explained', async () => {
        await openWorkflow(textToPictureWorkflow(language));
        await railOpen(false);
        await fit();
        const sampler = nodes.filter({ hasText: 'KSampler' }).first();
        await sampler.locator('.graph-node-title').click();
        await dockTab(2);
        await expect(page.locator('.dock-panel:visible').first()).toContainText('KSampler');
        // One step closer, so the node reads at a glance; the card under it opens to its full description.
        await page.locator('.react-flow__controls-zoomin').click();
        await page.waitForTimeout(350);
        const sampleId = await sampler.getAttribute('data-id');
        const card = page.locator(`.description-card[data-description-node="${sampleId}"]`);
        // Selecting a node opens its card; an older build left it closed, so it is opened only when it is.
        const closed = card.locator('[aria-expanded="false"]').first();
        if (await closed.isVisible().catch(() => false)) await closed.click();
        await expect(card.locator('[aria-expanded="true"]').first()).toBeVisible();
        await shoot(page, language, '02-canvas-explained');
      });

      await state('03-library', async () => {
        await page.keyboard.press('Escape');
        await page.locator('.react-flow__pane').click({ position: { x: 30, y: 760 } });
        const rail = page.locator('#library-rail');
        await railOpen(true);
        // The search finds nodes by any part of their name; the card says what the node is for before it is added.
        await rail.getByRole('tab').nth(0).click();
        await rail.locator('input').first().fill('sampler');
        // The list fills as the search settles; the plain KSampler row (not WanVideo Sampler, not Advanced) is picked.
        const option = page.locator('#node-library-list').getByRole('option').filter({ hasText: /^\s*KSampler\s*KSampler\s*$/ });
        await expect(option).toHaveCount(1);
        await page.waitForTimeout(400);
        await option.click();
        await expect(page.getByRole('button', { name: t('library.card.add') }).first()).toBeVisible({ timeout: 10_000 });
        await shoot(page, language, '03-library');
        await page.keyboard.press('Escape');
        await rail.locator('input').first().fill('');
        await railOpen(false);
      });

      // The build comes first: its conversation starts clean, and the question for drafts follows it.
      await state('05-assistant-build', async () => {
        await railOpen(false);
        await newProject();
        await dockTab(0);
        await page.locator('[data-intent="build"]').click();
        await ask(SHOWCASE_QUESTIONS[language].build);
        await expect.poll(async () => ((await api(page, 'readProjection', ['desktop'])) as { snapshot: { nodes: unknown[] } }).snapshot.nodes.length, { timeout: 60_000 }).toBe(7);
        await expect(composer).toBeEnabled({ timeout: 60_000 });
        // The canvas replays the build one step at a time; the picture shows the finished graph with its steps.
        await expect(page.locator('[data-live-build]')).toHaveCount(0, { timeout: 120_000 });
        await expect(page.locator('[data-build-callout]'), 'the build callout went away').toHaveCount(0, { timeout: 30_000 });
        // The steps land where the assistant put them; Arrange lays them out left to right, as a person would.
        await page.getByRole('button', { name: t('canvas.arrangeGraph') }).or(page.getByRole('button', { name: t('canvas.arrange'), exact: true })).first().click();
        await page.waitForTimeout(800);
        await page.getByRole('button', { name: t('chat.buildWhyShow') }).last().click();
        await fit();
        await shoot(page, language, '05-assistant-build');
      });

      await state('04-assistant-ask', async () => {
        await openWorkflow(unfinishedWorkflow({}, language));
        await fit();
        await dockTab(0);
        await page.locator('[data-intent="ask"]').click();
        await ask(SHOWCASE_QUESTIONS[language].drafts);
        await expect(page.locator('[data-ghost]')).toHaveCount(3, { timeout: 30_000 });
        await expect(composer).toBeEnabled({ timeout: 30_000 });
        await fit();
        await showDrafts();
        await shoot(page, language, '04-assistant-ask');
      });

      await state('06-lessons', async () => {
        await railOpen(false);
        await newProject();
        await learn();
        await expect(lessons).toHaveAttribute('data-lesson', 'list');
        await shoot(page, language, '06-lessons');
      });

      await state('07-lesson-step', async () => {
        await lessons.locator('[data-lesson-card="image"]').getByRole('button').first().click();
        await expect(lessons).toHaveAttribute('data-lesson', 'image');
        const stepNow = () => lessons.locator('[data-lesson-step]').getAttribute('data-lesson-step');
        const revision = async () => ((await api(page, 'readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
        // Carried the way a person carries it: read what explains, let the app do what it offers, until the step
        // that asks for a link, which the app lights on the canvas.
        for (let guard = 0; guard < 40 && (await stepNow()) !== 'prompts-clip'; guard += 1) {
          const doIt = lessons.getByRole('button', { name: t('lessons.doIt'), exact: true });
          const read = lessons.getByRole('button', { name: t('lessons.understood'), exact: true });
          if (await doIt.count() > 0) {
            const before = await revision();
            await doIt.click();
            await expect.poll(revision, { timeout: 15_000 }).not.toBe(before);
          } else if (await read.count() > 0) {
            const before = await stepNow();
            await read.click();
            await expect.poll(stepNow).not.toBe(before);
          } else {
            throw new Error(`the lesson stopped at step ${await stepNow()}`);
          }
        }
        expect(await stepNow(), 'the lesson reached the step with a link').toBe('prompts-clip');
        await lessons.getByRole('button', { name: t('lessons.show'), exact: true }).click();
        await page.waitForTimeout(900);
        await shoot(page, language, '07-lesson-step');
      });

      await state('08-check', async () => {
        await dockTab(0);
        await page.locator('[data-intent="ask"]').click();
        await openWorkflow(unfinishedWorkflow({ sampler: true }, language));
        await fit();
        await dockTab(3);
        await page.locator('.dock-panel:visible').first().getByRole('button').first().click();
        await expect(page.locator('.dock-panel:visible').first()).not.toContainText(t('explain.checkNotRun'), { timeout: 20_000 });
        await page.waitForTimeout(800);
        await shoot(page, language, '08-check');
      });

      await state('09-subgraph', async () => {
        await openWorkflow(nestedSubgraphWorkflow);
        await fit();
        await nodes.filter({ hasText: 'Prompt block' }).first().getByRole('button', { name: t('node.enterLabel', { name: 'Prompt block' }) }).click();
        await page.waitForTimeout(800);
        await fit();
        await shoot(page, language, '09-subgraph');
      });

      await state('10-large-workflow', async () => {
        await openWorkflow(largeWorkflow(language));
        await dockTab(2);
        await fit();
        await expect.poll(async () => nodes.count(), { timeout: 10_000 }).toBeGreaterThan(40);
        await shoot(page, language, '10-large-workflow');
      });

      const section = async (index: number) => {
        if (await settings.count() === 0) {
          await page.keyboard.press('Control+,');
          await settings.waitFor({ timeout: 10_000 });
        }
        await settings.locator('.settings-tab').nth(index).click();
        await page.waitForTimeout(300);
        // The section is shown as it opens, without a focus ring the keyboard did not ask for.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      };
      await state('12-settings-assistant', async () => { await section(0); await shoot(page, language, '12-settings-assistant'); });
      await page.keyboard.press('Escape');
      await expect(settings).toHaveCount(0);

      await state('13-help', async () => {
        await page.locator('.document-bar').getByRole('menuitem', { name: t('menu.help'), exact: true }).click();
        await page.getByRole('menu').getByRole('menuitem', { name: t('helpReader.guide') }).click();
        await expect(page.getByRole('dialog').first()).toBeVisible();
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await shoot(page, language, '13-help');
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // The lessons of version 1.1: the list read as a path, a step the person answers, and the end of a lesson.
      await state('14-lesson-path', async () => {
        await newProject();
        await learn();
        // The image lesson of 07 is still open: back to the list, as a person would.
        // The mouse leaves the dock tab first, so its tooltip does not cover the back button.
        await page.mouse.move(WINDOW.width - 4, WINDOW.height - 4);
        if ((await lessons.getAttribute('data-lesson')) !== 'list') await lessons.getByRole('button', { name: t('lessons.back'), exact: true }).first().click();
        await expect(lessons).toHaveAttribute('data-lesson', 'list');
        await lessons.getByRole('radio', { name: t('lessons.view.path'), exact: true }).click();
        await expect(lessons.locator('[data-lesson-view="path"]')).toBeVisible();
        await shoot(page, language, '14-lesson-path');
      });

      const stepNow = () => lessons.locator('[data-lesson-step]').getAttribute('data-lesson-step');
      const revision = async () => ((await api(page, 'readProjection', ['desktop'])) as { currentRevisionId: string }).currentRevisionId;
      /**
       * One move in a lesson, the way a person makes it: read and go on, let the app do what it offers, tick what
       * was done, choose a level or an answer, or say "I checked it myself" where the app cannot tell.
       */
      const lessonMove = async () => {
        const before = await stepNow();
        const read = lessons.getByRole('button', { name: t('lessons.understood'), exact: true });
        const doIt = lessons.getByRole('button', { name: t('lessons.doIt'), exact: true });
        const self = lessons.getByRole('button', { name: t('lessons.person.selfCheck'), exact: true });
        const ticks = lessons.locator('[data-person-step="checklist"] input[type="checkbox"]:not(:checked):not(:disabled)');
        const choices = lessons.locator('[data-person-step="rubric"] fieldset, [data-person-step="quiz"] fieldset');
        if (await read.count() > 0) {
          await read.click();
        } else if (await doIt.count() > 0) {
          const was = await revision();
          await doIt.click();
          await expect.poll(revision, { timeout: 15_000 }).not.toBe(was);
          return;
        } else if (await self.count() > 0) {
          await self.click();
        } else if (await ticks.count() > 0) {
          while (await ticks.count() > 0) await ticks.first().click();
        } else if (await choices.count() > 0) {
          // The label is what a person clicks; the round mark inside it is drawn over the input.
          for (let index = 0; index < await choices.count(); index += 1) await choices.nth(index).locator('label').last().click();
        } else {
          // A text the lesson asks the person to write in a node: typed into the field on the canvas.
          const field = page.locator('.react-flow__node textarea').last();
          if (await field.count() === 0) throw new Error(`the lesson stopped at step ${before}`);
          await field.fill(SETUP_CARD[language]);
          await field.blur();
        }
        await expect.poll(stepNow, { timeout: 15_000 }).not.toBe(before);
      };

      await state('15-lesson-checklist', async () => {
        await lessons.getByRole('radio', { name: t('lessons.view.groups'), exact: true }).click();
        await lessons.locator('[data-lesson-card="first-run"]').getByRole('button', { name: t('lessons.start'), exact: true }).click();
        await expect(lessons).toHaveAttribute('data-lesson', 'first-run');
        for (let guard = 0; guard < 20 && (await stepNow()) !== 'run'; guard += 1) await lessonMove();
        expect(await stepNow(), 'the lesson reached the step with a checklist').toBe('run');
        // One thing the app sees (the model file), one the person ticks (the template), two still to do.
        await lessons.locator('[data-item="template"] input[type="checkbox"]').check();
        await expect(lessons.locator('[data-item="file"]')).toHaveAttribute('data-item-state', 'app');
        await expect(lessons.locator('[data-item="template"]')).toHaveAttribute('data-item-state', 'self');
        // When the checklist runs past the panel (the Russian words are longer), the panel is scrolled the way a
        // person scrolls it: just far enough that the last item shows whole.
        await lessons.evaluate((panel) => {
          const list = panel.querySelector('[data-person-step="checklist"]');
          if (!list) return;
          const below = list.getBoundingClientRect().bottom + 6 - panel.getBoundingClientRect().bottom;
          if (below > 0) panel.scrollTop += below;
        });
        await shoot(page, language, '15-lesson-checklist');
      });

      await state('16-lesson-outcomes', async () => {
        for (let guard = 0; guard < 40 && (await stepNow()) !== 'end'; guard += 1) await lessonMove();
        expect(await stepNow(), 'the lesson reached its end').toBe('end');
        await expect(lessons.locator('[data-lesson-outcomes] [data-outcome]')).toHaveCount(3);
        await lessons.locator('[data-lesson-outcomes]').scrollIntoViewIfNeeded();
        await shoot(page, language, '16-lesson-outcomes');
      });
    } finally {
      await app?.close().catch(() => undefined);
      await llm.close();
      await comfy.close();
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });
}

