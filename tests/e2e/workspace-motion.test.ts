import { test, expect, _electron as electron } from '@playwright/test';
import { pickOption } from './pickOption';
import { typedWorkflow } from './fixtures/typedWorkflow';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const artifactDir = '/opt/cursor/artifacts';

type ElectronPage = import('@playwright/test').Page;

function durationParts(raw: string) {
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

async function duration(page: ElectronPage, selector: string, property: 'animationDuration' | 'transitionDuration') {
  return page.locator(selector).first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(
    name === 'animationDuration' ? 'animation-duration' : 'transition-duration',
  ), property);
}

async function expectDuration(page: ElectronPage, selector: string, property: 'animationDuration' | 'transitionDuration', expected: string) {
  await expect.poll(async () => {
    const parts = durationParts(await duration(page, selector, property));
    return parts.length > 0 && parts.every((part) => part === expected);
  }).toBe(true);
}

async function storedMotion(page: ElectronPage) {
  return page.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { getSettings: () => Promise<{ values?: { motion: string } }> } }).electronAPI;
    const read = await bridge.getSettings();
    return read.values?.motion ?? '';
  });
}

async function activeMotion(page: ElectronPage) {
  return page.evaluate(() => document.documentElement.dataset.motion ?? '');
}

async function shift(page: ElectronPage) {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-shift').trim());
}

async function topHit(page: ElectronPage) {
  return page.evaluate(() => {
    const node = document.elementFromPoint(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
    return node?.closest('[role="dialog"]') ? 'dialog' : 'page';
  });
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
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await settings.click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null)).toBe(true);
  await expect.poll(async () => dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-settings.png') });

  await window.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('data-state', 'closed');
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  await expect.poll(() => topHit(window)).toBe('page');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await settings.click();
    await expect(dialog).toHaveAttribute('data-state', 'open');
    await window.keyboard.press('Escape');
    await expect(dialog).toHaveAttribute('data-state', 'closed');
  }
  await expect.poll(() => topHit(window)).toBe('page');

  await settings.click();
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('data-state', 'closed');
  await settings.click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect.poll(async () => dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.keyboard.press('Escape');
  await expect.poll(() => topHit(window)).toBe('page');

  await settings.click();
  await pickOption(window, 'Motion', 'Off');
  expect(await activeMotion(window)).toBe('system');
  await window.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveAttribute('data-state', 'closed');
  expect(await storedMotion(window)).toBe('system');
  expect(await activeMotion(window)).toBe('system');
  await settings.click();
  await expect(window.getByRole('combobox', { name: 'Motion', exact: true })).toHaveAttribute('data-value', 'system');

  await pickOption(window, 'Motion', 'Reduced');
  expect(await activeMotion(window)).toBe('system');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(window.getByText('Non-secret settings saved.')).toBeVisible();
  expect(await storedMotion(window)).toBe('reduced');
  expect(await activeMotion(window)).toBe('reduced');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.06s');
  expect(await shift(window)).toBe('0px');

  await pickOption(window, 'Motion', 'On');
  expect(await activeMotion(window)).toBe('reduced');
  await window.getByRole('button', { name: 'Save settings' }).click();
  expect(await storedMotion(window)).toBe('on');
  expect(await activeMotion(window)).toBe('on');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  expect(await shift(window)).toBe('8px');
  await window.keyboard.press('Escape');
  const onExit = await dialog.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(durationParts(onExit).every((part) => part === '0.12s')).toBe(true);
  console.log(`ON_EXIT ${onExit}`);
  await expect.poll(() => topHit(window)).toBe('page');

  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect.poll(() => activeMotion(window)).toBe('on');
  expect(await storedMotion(window)).toBe('on');
  await settings.click();
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');

  await window.emulateMedia({ reducedMotion: 'reduce' });
  expect(await activeMotion(window)).toBe('on');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  expect(await shift(window)).toBe('8px');
  console.log('ON_PLUS_OS_REDUCE 0.16s 8px');

  await pickOption(window, 'Motion', 'System');
  await window.getByRole('button', { name: 'Save settings' }).click();
  expect(await storedMotion(window)).toBe('system');
  expect(await activeMotion(window)).toBe('system');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.06s');
  expect(await shift(window)).toBe('0px');
  console.log('SYSTEM_PLUS_OS_REDUCE 0.06s 0px');

  await window.emulateMedia({ reducedMotion: 'no-preference' });
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  expect(await shift(window)).toBe('8px');

  await pickOption(window, 'Motion', 'Off');
  await window.getByRole('button', { name: 'Save settings' }).click();
  expect(await storedMotion(window)).toBe('off');
  expect(await activeMotion(window)).toBe('off');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0s');
  await expectDuration(window, '.ghost-button', 'transitionDuration', '0s');
  await window.keyboard.press('Escape');
  const offExit = await dialog.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(durationParts(offExit).every((part) => part === '0s')).toBe(true);
  console.log(`OFF_EXIT ${offExit}`);
  await expect.poll(() => topHit(window)).toBe('page');

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
  await expect.poll(() => activeMotion(window)).toBe('off');
  expect(await storedMotion(window)).toBe('off');
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
  await expect(window.getByText('The graph is empty.')).toHaveCount(0);
  await expect(window.getByText('Describe a change. TEST fixture replies are scripted and are not a live model.')).toBeVisible();
  await expectDuration(window, '.graph-node', 'animationDuration', '0s');
  await expectDuration(window, '.ghost-button', 'transitionDuration', '0s');
  const dash = await window.evaluate(() => {
    const edge = document.createElement('div');
    edge.className = 'react-flow__edge animated';
    edge.innerHTML = '<svg><path class="probe-dash" /></svg>';
    document.body.append(edge);
    const offName = getComputedStyle(edge.querySelector('path') as Element).animationName;
    document.documentElement.dataset.motion = 'on';
    const onName = getComputedStyle(edge.querySelector('path') as Element).animationName;
    document.documentElement.dataset.motion = 'off';
    edge.remove();
    return { offName, onName };
  });
  expect(dash.offName).toBe('none');
  expect(dash.onName).toBe('dashdraw');
  console.log(`DASH ${dash.offName} ${dash.onName}`);
  const overlap = await window.locator('.port-list li[data-port-side="input"]').first().evaluate((row) => {
    const handle = row.querySelector('.react-flow__handle')?.getBoundingClientRect();
    const swatch = row.querySelector('.port-swatch')?.getBoundingClientRect();
    if (!handle || !swatch) return true;
    const separated = handle.right <= swatch.left || swatch.right <= handle.left;
    return !separated;
  });
  expect(overlap).toBe(false);
  await window.locator('.react-flow__controls-fitview').click();
  await expect.poll(async () => window.locator('.graph-node').first().evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-typed-ports.png') });

  await window.locator('.react-flow__node').first().click();
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('CheckpointLoaderSimple');
  await expect(window.getByRole('region', { name: 'Inspector' })).toContainText('MODEL');
  await window.screenshot({ path: path.join(artifactDir, 'ui-inspector.png') });

  await pickOption(window, 'Chat provider', 'OpenAI session');
  await expect(window.getByText('OpenAI is selected with no key.')).toBeVisible();
  await window.locator('input[aria-label="Chat message"]').fill('Add a node');
  await window.getByRole('button', { name: 'Send' }).click();
  await expect(window.locator('.message-body', { hasText: 'Error' }).first()).toBeVisible();
  await window.screenshot({ path: path.join(artifactDir, 'ui-error.png') });
  await electronApp.close();
});
