import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const artifactDir = '/opt/cursor/artifacts';

const typedWorkflow = {
  version: 1,
  state: { lastNodeId: 3, lastLinkId: 2 },
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [40, 80],
      size: [240, 140],
      flags: {},
      order: 0,
      mode: 0,
      properties: {},
      title: 'Checkpoint',
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [] },
        { name: 'CLIP', type: 'CLIP', links: [2] },
        { name: 'VAE', type: 'VAE', links: [] },
      ],
    },
    {
      id: 2,
      type: 'CLIPTextEncode',
      pos: [360, 40],
      size: [240, 120],
      flags: {},
      order: 1,
      mode: 0,
      properties: {},
      title: 'Positive',
      inputs: [{ name: 'clip', type: 'CLIP', link: 2 }],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
    },
    {
      id: 3,
      type: 'VAEDecode',
      pos: [360, 220],
      size: [240, 120],
      flags: {},
      order: 2,
      mode: 0,
      properties: {},
      title: 'Decode',
      inputs: [
        { name: 'samples', type: 'LATENT', link: null },
        { name: 'vae', type: 'VAE', link: null },
      ],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
    },
  ],
  links: [
    { id: 2, origin_id: 1, origin_slot: 1, target_id: 2, target_slot: 0, type: 'CLIP' },
  ],
};

async function duration(page: import('@playwright/test').Page, selector: string, property: 'animationDuration' | 'transitionDuration') {
  return page.locator(selector).first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(
    name === 'animationDuration' ? 'animation-duration' : 'transition-duration',
  ), property);
}

test('motion policy, dialog focus, and real workspace captures', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-motion-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await window.locator('#chat-provider').waitFor();
  await expect(window.getByText('The graph is empty.')).toBeVisible();
  await expect(window.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(window.getByRole('button', { name: 'ComfyUI not connected' })).toBeDisabled();
  await window.screenshot({ path: path.join(artifactDir, 'ui-empty.png') });

  const settings = window.getByRole('button', { name: 'Settings', exact: true });
  const dialog = window.locator('dialog.settings-dialog');
  await settings.click();
  await expect(dialog).toHaveJSProperty('open', true);
  await expect.poll(async () => window.evaluate(() => document.activeElement?.closest('dialog') != null)).toBe(true);
  await expect.poll(async () => dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-settings.png') });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await window.keyboard.press('Escape');
    await expect(dialog).toHaveJSProperty('open', false);
    await settings.click();
    await expect(dialog).toHaveJSProperty('open', true);
  }
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveJSProperty('open', false);
  const hit = await window.evaluate(() => document.elementFromPoint(24, 80)?.closest('dialog') ? 'dialog' : 'page');
  expect(hit).toBe('page');

  await settings.click();
  await window.getByLabel('Motion').selectOption('off');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(window.getByText('Non-secret settings saved.')).toBeVisible();
  const storedOff = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { getSettings: () => Promise<{ source: string; values?: { motion: string } }> } }).electronAPI;
    return bridge.getSettings();
  });
  expect(storedOff.values?.motion).toBe('off');
  await expect.poll(async () => duration(window, 'dialog.settings-dialog', 'animationDuration')).toBe('0s');
  expect(await window.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-shift').trim())).toBe('0px');

  await window.getByLabel('Motion').selectOption('reduced');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(async () => duration(window, 'dialog.settings-dialog', 'animationDuration')).toBe('0.06s');
  expect(await window.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-shift').trim())).toBe('0px');

  await window.getByLabel('Motion').selectOption('on');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(async () => duration(window, 'dialog.settings-dialog', 'animationDuration')).toBe('0.2s');
  const prefersReduce = await window.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(await duration(window, 'dialog.settings-dialog', 'animationDuration')).toBe('0.2s');
  console.log(`PREFERS_REDUCE ${prefersReduce}`);
  await window.keyboard.press('Escape');

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (payload) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string; projection: unknown }> } }).electronAPI;
    return bridge.commitCommand(payload);
  }, {
    projectId: 'desktop',
    actionId: 'import-motion-shot',
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: typedWorkflow },
  });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
  await window.locator('.react-flow__controls-fitview').click();
  await expect.poll(async () => window.locator('.graph-node').first().evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-typed-ports.png') });

  await window.locator('.react-flow__node').first().click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('CheckpointLoaderSimple');
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('MODEL');
  await window.screenshot({ path: path.join(artifactDir, 'ui-inspector.png') });

  await window.locator('#chat-provider').selectOption('openai');
  await expect(window.getByText('OpenAI is selected with no key.')).toBeVisible();
  await window.locator('input[aria-label="Chat message"]').fill('Add a node');
  await window.getByRole('button', { name: 'Send' }).click();
  await expect(window.locator('.message-body', { hasText: 'Error' }).first()).toBeVisible();
  await window.screenshot({ path: path.join(artifactDir, 'ui-error.png') });
  await electronApp.close();
});
