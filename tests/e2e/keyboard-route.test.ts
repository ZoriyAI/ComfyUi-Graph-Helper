import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { useEnglish } from './locale';

function zoneOf(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element?.closest('.react-flow__handle')) return 'port';
    if (element?.closest('.react-flow__node')) return 'node';
    if (element?.closest('.document-bar')) return 'shell';
    if (element?.closest('.workspace-toolbar')) return 'toolbar';
    if (element?.closest('.react-flow')) return 'canvas';
    if (element?.closest('#tool-dock')) return 'dock';
    return 'other';
  });
}

test('keyboard route reaches a node and keeps graph shortcuts out of fields', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'keyboard-route-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  window.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  window.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  const absent = await window.evaluate(() => ({
    menu: document.querySelector('[role="menu"]') == null,
    checkbox: document.querySelector('[role="checkbox"], input[type="checkbox"]') == null,
    radio: document.querySelector('[role="radio"], input[type="radio"]') == null,
    switch: document.querySelector('[role="switch"]') == null,
    titlebar: document.querySelector('.titlebar, .window-controls') == null,
  }));
  expect(absent).toEqual({ menu: true, checkbox: true, radio: true, switch: true, titlebar: true });
  console.log('CONTROL_AT_REST menu checkbox radio switch custom-titlebar absent; menus, check and radio items exist only while a menu-bar menu is open');

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (payload) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string }> } }).electronAPI;
    return bridge.commitCommand(payload);
  }, {
    projectId: 'desktop',
    actionId: 'keyboard-route-graph',
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: denseWorkflow },
  });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(12);
  await window.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

  const route: string[] = [];
  let selectedOnRoute = false;
  for (let step = 0; step < 160; step += 1) {
    await window.keyboard.press('Tab');
    const zone = await zoneOf(window);
    route.push(zone);
    if (!selectedOnRoute && zone === 'node') {
      await window.keyboard.press('Enter');
      await expect.poll(async () => window.locator('.graph-node.is-selected').count()).toBeGreaterThanOrEqual(1);
      selectedOnRoute = true;
    }
    const seen = new Set(route);
    if (seen.has('shell') && seen.has('toolbar') && selectedOnRoute && seen.has('dock')) break;
  }
  expect(selectedOnRoute).toBe(true);
  const first = (name: string) => route.indexOf(name);
  const nodeHit = [first('node'), first('port')].filter((index) => index >= 0);
  expect(first('shell')).toBeGreaterThanOrEqual(0);
  expect(first('toolbar')).toBeGreaterThan(first('shell'));
  expect(nodeHit.length).toBeGreaterThan(0);
  expect(Math.min(...nodeHit)).toBeGreaterThan(first('toolbar'));
  expect(first('dock')).toBeGreaterThan(Math.min(...nodeHit));

  for (let step = 0; step < 40; step += 1) {
    const onSettings = await window.evaluate(() => (
      document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
    ));
    if (onSettings) break;
    await window.keyboard.press('Tab');
  }
  await window.keyboard.press('Enter');
  const dialog = window.locator('[role="dialog"].settings-dialog');
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await window.keyboard.press('Shift+Tab');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Connection');
  // The section list is Assistant · Models & keys · Connection · Sync · Canvas · Appearance & Motion · …
  await window.keyboard.press('ArrowUp');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Models & keys');
  await window.keyboard.press('ArrowUp');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Assistant');
  for (const label of ['Models & keys', 'Connection', 'Sync', 'Canvas', 'Appearance & Motion']) {
    await window.keyboard.press('ArrowDown');
    await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe(label);
  }
  await window.keyboard.press('Tab');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).toBe('Motion');
  await window.keyboard.press('Enter');
  await expect(window.getByRole('option', { name: 'System', exact: true })).toBeVisible();
  const portal = await window.evaluate(() => {
    const content = document.querySelector('.select-content');
    if (!content) return { missing: true, clipped: true, top: 0, bottom: 0, left: 0, right: 0 };
    const box = content.getBoundingClientRect();
    let clipped = box.top < -1 || box.left < -1 || box.bottom > window.innerHeight + 1 || box.right > window.innerWidth + 1;
    let node = content.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      if (/(auto|hidden|scroll|clip)/.test(overflow)) {
        const parent = node.getBoundingClientRect();
        if (box.top < parent.top - 1 || box.bottom > parent.bottom + 1 || box.left < parent.left - 1 || box.right > parent.right + 1) clipped = true;
      }
      node = node.parentElement;
    }
    return { missing: false, clipped, top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right) };
  });
  expect(portal.missing).toBe(false);
  expect(portal.clipped).toBe(false);
  console.log(`SELECT_PORTAL clipped=false top=${portal.top} bottom=${portal.bottom} left=${portal.left} right=${portal.right}`);
  const nodeCount = async () => window.locator('.react-flow__node').count();
  const selectedCount = async () => window.locator('.graph-node.is-selected').count();
  const expectKept = async (count: number) => {
    const started = Date.now();
    await expect.poll(async () => {
      const current = await nodeCount();
      const selected = await selectedCount();
      if (current !== count) return `count=${current} selected=${selected}`;
      if (selected < 1) return `count=${current} selected=${selected}`;
      return Date.now() - started >= 1500 ? 'kept' : 'pending';
    }).toBe('kept');
  };
  const beforeMenu = await nodeCount();
  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  const menuSelected = await selectedCount();
  await window.keyboard.press('Backspace');
  await expectKept(beforeMenu);
  await window.keyboard.press('Escape');
  await expect(window.locator('.select-content')).toHaveCount(0);
  await expect(dialog).toHaveAttribute('data-state', 'open');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).toBe('Motion');
  const controlTag = await window.evaluate(() => document.activeElement?.tagName ?? '');
  expect(controlTag).not.toBe('INPUT');
  expect(controlTag).not.toBe('TEXTAREA');
  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  const beforeControl = await nodeCount();
  await window.keyboard.press('Backspace');
  await expectKept(beforeControl);
  await window.keyboard.press('Shift+Tab');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Appearance & Motion');
  // Assistant is the first section now: Home reaches it.
  await window.keyboard.press('Home');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Assistant');
  for (let step = 0; step < 6; step += 1) {
    await window.keyboard.press('Tab');
    const label = await window.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    if (label === 'Model') break;
  }
  await expect.poll(async () => window.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).toBe('Model');
  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  const beforeFieldDialog = await nodeCount();
  await window.keyboard.press('Backspace');
  await expectKept(beforeFieldDialog);
  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  await window.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  console.log(`KEYBOARD_FULL ${route.filter((item, index) => index === 0 || item !== route[index - 1]).join('>')}>settings>select>escape>restore`);

  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  await expectKept(beforeMenu);
  await window.locator('.react-flow__node').first().click();
  await expect(window.locator('.graph-node.is-selected')).toHaveCount(1);
  const beforeField = await nodeCount();
  const transformBefore = await window.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform);
  const draft = window.locator('textarea[aria-label="Chat message"]');
  await window.getByRole('tab', { name: 'Assistant' }).click();
  await draft.focus();
  await draft.fill('guard');
  await draft.press('Backspace');
  await draft.press('Delete');
  await expectKept(beforeField);
  await expect(draft).toHaveValue('guar');
  await draft.press('Shift+Enter');
  await expect(draft).toHaveValue(/guar\n$/);
  await expect(window.locator('.message-row')).toHaveCount(0);
  await draft.fill('composing');
  await draft.evaluate((element) => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'isComposing', { value: true });
    element.dispatchEvent(event);
  });
  await expect(draft).toHaveValue('composing');
  await expect(window.locator('.message-row')).toHaveCount(0);
  await draft.press('Space');
  await expect(draft).toHaveValue(/composing $/);
  const transformAfter = await window.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform);
  expect(transformAfter).toBe(transformBefore);
  await expectKept(beforeField);
  console.log(`SHORTCUT_GUARD field=kept menu(select-listbox)=kept dialog-control=kept dialog-field=kept selected=${menuSelected}`);
  console.log('INPUT_KEYS ime=held shift-enter=newline space=no-pan');
  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  let focusedGraph = false;
  for (let step = 0; step < 40; step += 1) {
    await window.keyboard.press('Tab');
    const zone = await zoneOf(window);
    if (zone === 'node' || zone === 'canvas') {
      focusedGraph = true;
      break;
    }
  }
  expect(focusedGraph).toBe(true);
  const beforeDelete = await nodeCount();
  await window.keyboard.press('Backspace');
  await expect.poll(nodeCount).toBe(beforeDelete - 1);
  console.log(`CANVAS_DELETE removed=1 via=remove-node count=${beforeDelete}->${beforeDelete - 1}`);
  expect(errors).toEqual([]);
  await electronApp.close();
});
