import { test, expect, _electron as electron } from '@playwright/test';
import { pickOption } from './pickOption';
import { useEnglish } from './locale';
import { attachRuntimeWatch, finishRuntime, logLocalFont, readLocalFont } from './runtimeWatch';
import { typedWorkflow } from './fixtures/typedWorkflow';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ARTIFACT_DIR } from './artifacts';

const artifactDir = ARTIFACT_DIR;

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

async function showMotion(page: ElectronPage) {
  await page.getByRole('tab', { name: 'Appearance & Motion' }).click();
}

async function armExit(page: ElectronPage) {
  await page.evaluate(() => {
    const root = document.querySelector('.settings-dialog');
    (window as unknown as { __exitDuration: Promise<string> }).__exitDuration = new Promise((resolve) => {
      if (!root) {
        resolve('missing');
        return;
      }
      const observer = new MutationObserver(() => {
        if (root.getAttribute('data-state') === 'closed') {
          observer.disconnect();
          resolve(getComputedStyle(root).transitionDuration);
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ['data-state'] });
    });
  });
}

async function readExit(page: ElectronPage) {
  return page.evaluate(() => (window as unknown as { __exitDuration: Promise<string> }).__exitDuration);
}

async function armEnter(page: ElectronPage) {
  await page.evaluate(() => {
    (window as unknown as { __enterTimes: Promise<number[]> }).__enterTimes = new Promise((resolve) => {
      const samples: number[] = [];
      const start = performance.now();
      const tick = () => {
        const node = document.querySelector('.settings-dialog');
        if (node) {
          const times = node.getAnimations().flatMap((anim) => typeof anim.currentTime === 'number' ? [anim.currentTime] : []);
          if (times.length > 0) samples.push(Math.max(...times));
        }
        if (performance.now() - start < 1500) requestAnimationFrame(tick);
        else resolve(samples);
      };
      requestAnimationFrame(tick);
    });
  });
}

async function readEnter(page: ElectronPage) {
  return page.evaluate(() => (window as unknown as { __enterTimes: Promise<number[]> }).__enterTimes);
}

test('motion policy, dialog focus, and real workspace captures', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-motion-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  const runtimeWatch = await attachRuntimeWatch(electronApp, window);
  await window.locator('#chat-provider').waitFor();
  await expect(window.getByText('The graph is empty.')).toBeVisible();
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  const route: string[] = [];
  // The library rail sits between the toolbar and the canvas; its stops count as 'other'.
  const zones = ['shell', 'toolbar', 'canvas', 'dock'];
  for (let step = 0; step < 60 && !zones.every((zone) => route.includes(zone)); step += 1) {
    await window.keyboard.press('Tab');
    route.push(await window.evaluate(() => {
      const element = document.activeElement;
      if (element?.closest('.document-bar')) return 'shell';
      if (element?.closest('.workspace-toolbar')) return 'toolbar';
      if (element?.closest('.react-flow')) return 'canvas';
      if (element?.closest('#tool-dock')) return 'dock';
      return 'other';
    }));
  }
  console.log(`KEYBOARD_ROUTE ${route.join('>')}`);
  expect(route.indexOf('shell')).toBeGreaterThanOrEqual(0);
  expect(route.indexOf('toolbar')).toBeGreaterThan(route.indexOf('shell'));
  expect(route.indexOf('canvas')).toBeGreaterThan(route.indexOf('toolbar'));
  expect(route.indexOf('dock')).toBeGreaterThan(route.indexOf('canvas'));
  for (let step = 0; step < 40; step += 1) {
    const onSettings = await window.evaluate(() => (
      document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
    ));
    if (onSettings) break;
    await window.keyboard.press('Tab');
  }
  await window.keyboard.press('Enter');
  const routeDialog = window.locator('[role="dialog"].settings-dialog');
  await expect(routeDialog).toHaveAttribute('data-state', 'open');
  await window.keyboard.press('Shift+Tab');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Connection');
  // The section list is Assistant · Connection · Sync · Canvas · Appearance & Motion · …
  await window.keyboard.press('ArrowUp');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Assistant');
  for (const label of ['Connection', 'Sync', 'Canvas', 'Appearance & Motion']) {
    await window.keyboard.press('ArrowDown');
    await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe(label);
  }
  await window.keyboard.press('Tab');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).toBe('Motion');
  await window.keyboard.press('Enter');
  await expect(window.getByRole('option', { name: 'System', exact: true })).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(window.locator('.select-content')).toHaveCount(0);
  await expect(routeDialog).toHaveAttribute('data-state', 'open');
  console.log('NESTED_ESCAPE one-press list-closed dialog-open');
  await window.keyboard.press('Escape');
  await expect(routeDialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  console.log('KEYBOARD_ROUTE settings>nested-select>escape>restore');
  const separator = window.getByRole('separator', { name: 'Resize tools' });
  const dockMin = await separator.getAttribute('aria-valuemin');
  const dockMax = await separator.getAttribute('aria-valuemax');
  await expect(separator).toHaveAttribute('aria-controls', 'tool-dock');
  await separator.focus();
  await window.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow', dockMax || '');
  await window.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', dockMin || '');
  const grown = String(Math.min(Number(dockMax), Number(dockMin) + 16));
  await window.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', grown);
  await window.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', dockMin || '');
  await window.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', grown);
  console.log(`DOCK_RANGE ${dockMin} ${dockMax}`);
  await window.getByRole('tab', { name: 'Assistant' }).click();
  const draft = window.locator('textarea[aria-label="Chat message"]');
  await draft.fill(Array.from({ length: 20 }, (_, index) => `draft ${index}`).join('\n'));
  await draft.evaluate((element) => {
    element.scrollTop = 36;
  });
  const draftScroll = await draft.evaluate((element) => element.scrollTop);
  await window.getByRole('tab', { name: 'Properties' }).click();
  const widthBeforeHide = await separator.getAttribute('aria-valuenow');
  expect(widthBeforeHide).toBe(grown);
  await window.getByRole('button', { name: 'Hide tools' }).click();
  await expect(window.getByRole('tab', { name: 'Properties' })).toHaveCount(0);
  await window.getByRole('button', { name: 'Show tools' }).click();
  await expect(separator).toHaveAttribute('aria-valuenow', widthBeforeHide || '');
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await expect(draft).toHaveValue(/draft 19/);
  expect(await draft.evaluate((element) => element.scrollTop)).toBe(draftScroll);
  await draft.press('Shift+Enter');
  await expect(draft).toHaveValue(/\n$/);
  await expect(window.locator('.message-row')).toHaveCount(0);
  await draft.fill('composing');
  await draft.evaluate((element) => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isComposing', { value: true });
    element.dispatchEvent(event);
  });
  await expect(draft).toHaveValue('composing');
  await expect(window.locator('.message-row')).toHaveCount(0);
  await draft.fill('');
  await window.getByRole('tab', { name: 'Properties' }).click();
  const showBoth = window.getByRole('button', { name: 'Show both' });
  if (await showBoth.isEnabled()) {
    await showBoth.click();
    await expect(window.getByRole('region', { name: 'Properties' })).toBeVisible();
    await expect(window.getByRole('textbox', { name: 'Chat message' })).toBeVisible();
    await window.getByRole('button', { name: 'Properties', exact: true }).click();
  } else {
    await expect(showBoth).toBeDisabled();
  }
  await expect(window.getByRole('tab', { name: 'Properties' })).toHaveAttribute('data-state', 'active');
  await expect(window.getByRole('button', { name: 'Undo' })).toBeDisabled();
  // The sync indicator replaced the old disabled "ComfyUI not connected" chip.
  await expect(window.locator('.document-bar .sync-indicator')).toHaveAttribute('data-sync-state', /^(never|idle|error)$/);
  await window.screenshot({ path: path.join(artifactDir, 'ui-empty.png') });

  const settings = window.getByRole('button', { name: 'Settings', exact: true });
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await settings.click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect(window.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  const backgroundInert = await window.evaluate(() => {
    let node = document.querySelector('.document-bar');
    while (node) {
      if (node.getAttribute('aria-hidden') === 'true') return true;
      node = node.parentElement;
    }
    return false;
  });
  expect(backgroundInert).toBe(true);
  const focusables = await window.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    return [...dialog.querySelectorAll<HTMLElement>('button, input, textarea, select, [role="tab"], [role="combobox"]')]
      .filter((element) => !element.closest('[hidden]') && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true' && element.tabIndex >= 0 && element.getClientRects().length > 0)
      .map((element) => element.getAttribute('aria-label') || element.textContent || '');
  });
  expect(focusables.length).toBeGreaterThan(1);
  const focusMarker = () => window.evaluate(() => {
    const element = document.activeElement;
    return element?.getAttribute('aria-label') || element?.textContent?.trim() || '';
  });
  await window.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const items = [...dialog!.querySelectorAll<HTMLElement>('button, input, textarea, select, [role="tab"], [role="combobox"]')]
      .filter((element) => !element.closest('[hidden]') && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true' && element.tabIndex >= 0 && element.getClientRects().length > 0);
    items[0].focus();
  });
  const firstMarker = await focusMarker();
  const lastMarker = focusables[focusables.length - 1].trim();
  await window.keyboard.press('Shift+Tab');
  await expect.poll(focusMarker).toBe(lastMarker);
  expect(lastMarker).not.toBe(firstMarker);
  await window.keyboard.press('Tab');
  await expect.poll(focusMarker).toBe(firstMarker);
  const columns: string[] = [];
  const controls: number[] = [];
  for (const label of ['Connection', 'Assistant', 'Appearance & Motion']) {
    await dialog.getByRole('tab', { name: label }).click();
    const sample = await dialog.locator('.settings-panel[data-state="active"]').evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      const dialogBox = panel.closest('[role="dialog"]')!.getBoundingClientRect();
      const inactive = [...panel.parentElement!.querySelectorAll('.settings-panel')].filter((item) => item !== panel);
      const control = panel.querySelector('input, [role="combobox"]');
      const controlBox = control?.getBoundingClientRect();
      return {
        x: Math.round(box.x),
        width: Math.round(box.width),
        // The section list is 224px wide; the panel takes the rest of the dialog.
        floor: Math.round(dialogBox.width - 224 - 16),
        controlWidth: controlBox ? Math.round(controlBox.width) : 0,
        inactiveHidden: inactive.every((item) => getComputedStyle(item).display === 'none'),
      };
    });
    expect(sample.inactiveHidden).toBe(true);
    expect(sample.width).toBeGreaterThanOrEqual(sample.floor);
    expect(sample.controlWidth).toBeGreaterThanOrEqual(420);
    // One measure for every settings column (--measure-form, 640px).
    expect(sample.controlWidth).toBeLessThanOrEqual(640);
    expect(sample.controlWidth).toBeLessThan(sample.width - 48);
    // Every section starts at the same place and has the same width. A field may sit inside a group (the key
    // panel), so its own width is only held within the measure above.
    columns.push(`${sample.x}:${sample.width}`);
    controls.push(sample.controlWidth);
  }
  expect(new Set(columns).size).toBe(1);
  console.log(`SETTINGS_COLUMNS ${columns[0]} controls=${controls.join(',')}`);
  await expect.poll(async () => dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-settings.png') });

  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  await expect.poll(() => topHit(window)).toBe('page');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await settings.click();
    await expect(dialog).toHaveAttribute('data-state', 'open');
    await window.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  await expect.poll(() => topHit(window)).toBe('page');

  await settings.click();
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await settings.click();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect.poll(async () => dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.keyboard.press('Escape');
  await expect.poll(() => topHit(window)).toBe('page');

  await settings.click();
  await showMotion(window);
  const motion = window.getByRole('combobox', { name: 'Motion', exact: true });
  await motion.click();
  await expect(window.getByRole('option', { name: 'Off', exact: true })).toBeVisible();
  await window.keyboard.press('ArrowDown');
  await window.keyboard.press('End');
  await expect(window.locator('.select-item[data-highlighted]')).toContainText('Off');
  await window.keyboard.press('Home');
  await expect(window.locator('.select-item[data-highlighted]')).toContainText('System');
  await window.keyboard.press('Escape');
  await expect(window.getByRole('option', { name: 'Off', exact: true })).toHaveCount(0);
  await expect(window.locator('.select-content')).toHaveCount(0);
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);

  await settings.click();
  await showMotion(window);
  await pickOption(window, 'Motion', 'Off');
  expect(await activeMotion(window)).toBe('system');
  await window.getByRole('button', { name: 'Cancel' }).click();
  // A changed draft is not thrown away without a question.
  await window.getByRole('button', { name: 'Close without saving', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await storedMotion(window)).toBe('system');
  expect(await activeMotion(window)).toBe('system');
  await settings.click();
  await showMotion(window);
  await expect(window.getByRole('combobox', { name: 'Motion', exact: true })).toHaveAttribute('data-value', 'system');

  await pickOption(window, 'Motion', 'Reduced');
  expect(await activeMotion(window)).toBe('system');
  await expect(window.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  expect(await storedMotion(window)).toBe('reduced');
  expect(await activeMotion(window)).toBe('reduced');
  expect(await shift(window)).toBe('0px');
  await settings.click();
  await showMotion(window);
  await expect(window.getByRole('combobox', { name: 'Motion', exact: true })).toHaveAttribute('data-value', 'reduced');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.06s');

  await pickOption(window, 'Motion', 'On');
  expect(await activeMotion(window)).toBe('reduced');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await storedMotion(window)).toBe('on');
  expect(await activeMotion(window)).toBe('on');
  expect(await shift(window)).toBe('8px');
  await settings.click();
  await showMotion(window);
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  await armExit(window);
  await window.keyboard.press('Escape');
  const onExit = await readExit(window);
  expect(durationParts(onExit).every((part) => part === '0.12s')).toBe(true);
  console.log(`ON_EXIT ${onExit}`);
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => topHit(window)).toBe('page');
  await armEnter(window);
  await settings.click();
  const onFrames = await readEnter(window);
  console.log(`ON_ENTER_FRAMES ${onFrames.join(',')}`);
  expect(onFrames.length).toBeGreaterThan(1);
  expect(onFrames[onFrames.length - 1]).toBeGreaterThan(onFrames[0]);
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect.poll(() => activeMotion(window)).toBe('on');
  expect(await storedMotion(window)).toBe('on');
  await settings.click();
  await showMotion(window);
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');

  await window.emulateMedia({ reducedMotion: 'reduce' });
  expect(await activeMotion(window)).toBe('on');
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  expect(await shift(window)).toBe('8px');
  console.log('ON_PLUS_OS_REDUCE 0.16s 8px');

  await pickOption(window, 'Motion', 'System');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await storedMotion(window)).toBe('system');
  expect(await activeMotion(window)).toBe('system');
  expect(await shift(window)).toBe('0px');
  await settings.click();
  await showMotion(window);
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.06s');
  console.log('SYSTEM_PLUS_OS_REDUCE 0.06s 0px');

  await window.emulateMedia({ reducedMotion: 'no-preference' });
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0.16s');
  expect(await shift(window)).toBe('8px');

  await pickOption(window, 'Motion', 'Off');
  await window.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await storedMotion(window)).toBe('off');
  expect(await activeMotion(window)).toBe('off');
  await expectDuration(window, '.ghost-button', 'transitionDuration', '0s');
  await settings.click();
  await showMotion(window);
  await expectDuration(window, '.settings-dialog', 'transitionDuration', '0s');
  await armExit(window);
  await window.keyboard.press('Escape');
  const offExit = (await readExit(window)) || '';
  const offExitToken = await window.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-exit').trim());
  expect(offExitToken).toBe('0s');
  await expect(dialog).toHaveCount(0);
  if (offExit.trim() === '') {
    expect(offExit).toBe('');
  } else {
    const offExitParts = durationParts(offExit);
    expect(offExitParts.length).toBeGreaterThan(0);
    expect(offExitParts.every((part) => part === '0s')).toBe(true);
  }
  console.log(`OFF_EXIT measured=${offExit || 'unmounted-immediately'} token=${offExitToken}`);
  await expect.poll(() => topHit(window)).toBe('page');
  await armEnter(window);
  await settings.click();
  const offFrames = await readEnter(window);
  console.log(`OFF_ENTER_FRAMES ${offFrames.join(',')}`);
  const offAdvance = offFrames.length > 1 ? offFrames[offFrames.length - 1] - offFrames[0] : 0;
  expect(offAdvance).toBe(0);
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

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
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await expect(window.getByText('Say what to change or what to explain, for example “why is KSampler here?”.')).toBeVisible();
  await expectDuration(window, '.graph-node', 'animationDuration', '0s');
  await expectDuration(window, '.ghost-button', 'transitionDuration', '0s');
  const dash = await window.evaluate(async () => {
    const edge = document.createElement('div');
    edge.className = 'react-flow__edge animated';
    edge.innerHTML = '<svg><path class="probe-dash" /></svg>';
    document.body.append(edge);
    const path = edge.querySelector('path') as Element;
    const offName = getComputedStyle(path).animationName;
    document.documentElement.dataset.motion = 'on';
    const onName = getComputedStyle(path).animationName;
    const before = getComputedStyle(path).strokeDashoffset;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const after = getComputedStyle(path).strokeDashoffset;
    document.documentElement.dataset.motion = 'off';
    const offBefore = getComputedStyle(path).strokeDashoffset;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const offAfter = getComputedStyle(path).strokeDashoffset;
    edge.remove();
    return { offName, onName, before, after, offBefore, offAfter };
  });
  expect(dash.offName).toBe('none');
  expect(dash.onName).toBe('dashdraw');
  expect(dash.before).not.toBe(dash.after);
  expect(dash.offBefore).toBe(dash.offAfter);
  console.log(`DASH ${dash.offName} ${dash.onName} on ${dash.before}->${dash.after} off ${dash.offBefore}`);
  await expect(window.locator('.graph-canvas')).toHaveAttribute('data-fit-duration', '0');
  await window.evaluate(() => { document.documentElement.dataset.motion = 'on'; });
  await expect(window.locator('.graph-canvas')).toHaveAttribute('data-fit-duration', '200');
  await window.evaluate(() => { document.documentElement.dataset.motion = 'off'; });
  await expect(window.locator('.graph-canvas')).toHaveAttribute('data-fit-duration', '0');
  console.log('FIT_DURATION 0/200/0');
  const ports = await window.locator('.port-list li[data-port-side="input"]').first().evaluate((row) => {
    const handle = row.querySelector('.react-flow__handle')?.getBoundingClientRect();
    const name = row.querySelector('.port-name')?.getBoundingClientRect();
    const type = row.getAttribute('data-port-type') || '';
    if (!handle || !name) return { hit: false, typeShown: false, overlaps: true, swatch: true };
    const overlaps = handle.right > name.left + 0.5 && name.right > handle.left + 0.5 && handle.bottom > name.top + 0.5 && name.bottom > handle.top + 0.5;
    return {
      hit: handle.width >= 24 && handle.height >= 24,
      typeShown: (row.textContent || '').toLowerCase().includes(type.toLowerCase()),
      overlaps,
      swatch: row.querySelector('.port-swatch') != null,
    };
  });
  expect(ports.swatch).toBe(false);
  expect(ports.hit).toBe(true);
  expect(ports.typeShown).toBe(true);
  expect(ports.overlaps).toBe(false);
  await window.locator('.react-flow__controls-fitview').click();
  await expect.poll(async () => window.locator('.graph-node').first().evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await window.screenshot({ path: path.join(artifactDir, 'ui-typed-ports.png') });

  await window.getByRole('tab', { name: 'Properties' }).click();
  await window.locator('.react-flow__node').first().click();
  await expect(window.locator('.status-bar')).toContainText(/Zoom \d+%/);
  await expect(window.getByRole('region', { name: 'Properties' })).toContainText('CheckpointLoaderSimple');
  await expect(window.getByRole('region', { name: 'Properties' })).toContainText('MODEL');
  await window.screenshot({ path: path.join(artifactDir, 'ui-inspector.png') });

  await pickOption(window, 'Choose the assistant', 'OpenAI');
  await expect(window.getByText('OpenAI is chosen, but there is no key.')).toBeVisible();
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await window.locator('textarea[aria-label="Chat message"]').fill('Add a node');
  await window.getByRole('button', { name: 'Send' }).click();
  // A failed answer is one plain sentence with what to do next, not the word "Error".
  const failed = window.locator('.message-diagnostic').first();
  await expect(failed).toBeVisible();
  await expect(failed).toHaveAttribute('data-turn-error', 'no-key');
  await expect(failed).toHaveText('The cloud assistant has no key. Add the key in the assistant settings.');
  await window.screenshot({ path: path.join(artifactDir, 'ui-error.png') });
  logLocalFont(await readLocalFont(window));
  await finishRuntime(electronApp, window, runtimeWatch, {
    console: [{
      text: '[ChatService] Error: no-key: Cloud model has no key for this session.',
      reason: 'OpenAI is selected with no session key. The send stops in the main process before any provider request.',
    }],
    remotePrefix: [{
      prefix: 'https://api.openai.com/',
      reason: 'A cloud send with a session key would use the main-process provider client. This run has no key, so that request is not expected.',
    }],
  });
  await electronApp.close();
});
