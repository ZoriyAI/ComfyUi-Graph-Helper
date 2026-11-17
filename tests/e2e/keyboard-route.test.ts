/**
 * E2E spec for keyboard and screen reader use: Tab and F6 move between the zones of the window (shell, toolbar,
 * canvas, node, port, dock), graph shortcuts never fire while a field has focus, focus lands somewhere sensible after
 * an action, controls have names, the library card works by keyboard, and the interface size setting applies.
 * A person who cannot use a mouse must still be able to build a graph.
 */
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { useEnglish } from './locale';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';

/** Which zone of the window holds the focus now, by the closest known container of the active element. */
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
  // The section list is Assistant · Connection · Sync · Canvas · Appearance & Motion · …
  await window.keyboard.press('Home');
  await expect.poll(async () => window.evaluate(() => document.activeElement?.textContent?.trim() ?? '')).toBe('Assistant');
  for (const label of ['Services', 'Connection', 'Browser access', 'Sync', 'Canvas', 'Appearance & Motion']) {
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
    let clipped = box.top < -1 || box.left < -1 || box.bottom > globalThis.innerHeight + 1 || box.right > globalThis.innerWidth + 1;
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
  // The model field appears once a helper is chosen: Tab to the provider cards, arrow to the next one.
  await window.keyboard.press('Tab');
  await window.keyboard.press('ArrowRight');
  await window.keyboard.press('Enter');
  await expect(dialog.getByRole('radio', { name: 'OpenAI', exact: true })).toHaveAttribute('aria-checked', 'true');
  for (let step = 0; step < 8; step += 1) {
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
  // The draft was changed (another assistant chosen), so closing asks first.
  await window.getByRole('button', { name: 'Close without saving', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => window.evaluate(() => (
    document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent === 'Settings'
  ))).toBe(true);
  console.log(`KEYBOARD_FULL ${route.filter((item, index) => index === 0 || item !== route[index - 1]).join('>')}>settings>select>escape>restore`);

  await expect.poll(selectedCount).toBeGreaterThanOrEqual(1);
  await expectKept(beforeMenu);
  // Keyboard traversal now reveals every focused card. Bring the first card back before pointer selection.
  await window.keyboard.press('Tab');
  await window.locator('.react-flow__node').first().focus();
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

/**
 * Accessibility of the main window, with the keyboard only: what a screen reader is told about nodes and links,
 * where focus lands after an action (never the page body), F6 between areas, the library card, the menu bar
 * after Alt and the interface size. The accessibility tree of the main areas has no unnamed control and no
 * English React Flow names.
 */
test('keyboard and screen reader: names, focus after actions, F6, library card, interface size', async () => {
  test.setTimeout(180_000);
  const fake = await startFakeMcp();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'keyboard-a11y-'));
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
  // No session bus, so Electron does not talk to the desktop's keyring during the run.
  delete env.DBUS_SESSION_BUS_ADDRESS;
  const app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`], env: env as Record<string, string> });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(page);
    const api = (name: string, args: unknown[] = []) => page.evaluate(async ({ name, args }) => {
      const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<unknown>> }).electronAPI;
      return bridge[name](...args);
    }, { name, args });
    const read = await api('getSettings') as { values?: Record<string, unknown> };
    await api('saveSettings', [{ ...(read.values ?? {}), mcpUrl: fake.url, mcpAuth: 'none' }]);
    const current = await api('readProjection', ['desktop']) as { currentRevisionId: string };
    await api('commitCommand', [{ projectId: 'desktop', actionId: 'keyboard-a11y-graph', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: denseWorkflow } }]);
    await page.reload();
    await page.locator('.app-shell').waitFor();
    await api('syncNow').catch(() => undefined);
    await expect(page.locator('.react-flow__node')).toHaveCount(12);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
    const active = () => page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return 'BODY';
      return `${element.className && typeof element.className === 'string' ? element.className.split(' ')[0] : element.tagName}|${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30)}`;
    });

    // Names: a node says its title and inputs, in a translated role; no link keeps React Flow's English id name.
    const first = page.locator('.react-flow__node').first();
    await expect(first).toHaveAttribute('aria-label', /^Checkpoint A, CheckpointLoaderSimple/);
    await expect(first).toHaveAttribute('aria-roledescription', 'node');
    expect(await page.locator('.react-flow__edge[aria-label^="Edge from"]').count()).toBe(0);
    await expect(page.locator('.react-flow__edge').first()).toHaveAttribute('aria-label', /^Link from .+ · .+ to .+ · .+, type /);
    // Links are not Tab stops until a node beside them is selected.
    expect(await page.locator('.react-flow__edge[tabindex="0"]').count()).toBe(0);
    await first.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => page.locator('.react-flow__edge[tabindex="0"]').count()).toBeGreaterThan(0);

    // The tree of the main areas: every control has a name.
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], a[href], input, textarea, .react-flow__node, .react-flow__edge'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || element.closest('[aria-hidden="true"]')) return false;
        const id = element.id;
        const label = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim() || element.getAttribute('title')
          || (id && document.querySelector(`label[for="${id}"]`)) || element.closest('label');
        return !label;
      }).map((element) => element.outerHTML.slice(0, 120)));
    expect(unnamed).toEqual([]);
    console.log('A11Y_TREE names=all nodes=named edges=named-not-english');

    // F1 opens Keyboard shortcuts; Escape closes it and focus comes back to the node, not the page body.
    await first.focus();
    await page.keyboard.press('F1');
    await expect(page.locator('.shortcuts-dialog')).toBeVisible();
    await expect(page.locator('.shortcuts-dialog')).toContainText('F6');
    // The dialog holds the focus once it is ready for keys (Radix moves it in when it mounts); Escape is sent then.
    await expect.poll(async () => page.evaluate(() => document.activeElement?.closest('.shortcuts-dialog') != null)).toBe(true);
    await page.keyboard.press('Escape');
    // Radix gives Escape to the newest layer only: should the dialog stay, the message names what was open with it.
    await expect(page.locator('.shortcuts-dialog')).toHaveCount(0).catch(async (error: Error) => {
      const layers = await page.evaluate(() => [
        `focus=${document.activeElement?.tagName}.${String(document.activeElement?.className).slice(0, 60)}`,
        ...Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], .app-toast, [data-radix-popper-content-wrapper]'))
          .map((element) => `${element.getAttribute('role') ?? element.className}: ${element.getAttribute('data-state') ?? ''} ${element.textContent?.trim().slice(0, 60)}`),
      ]).catch(() => []);
      throw new Error(`${error.message}\nOpen layers after Escape:\n${layers.join('\n')}`);
    });
    await expect.poll(active).toMatch(/^react-flow__node\|Checkpoint A/);

    // F6 visits the areas; Shift+F6 goes back to the canvas.
    await page.keyboard.press('F6');
    await expect.poll(async () => page.evaluate(() => document.activeElement?.closest('#tool-dock') != null)).toBe(true);
    await page.keyboard.press('Shift+F6');
    await expect.poll(async () => page.evaluate(() => document.activeElement?.closest('.react-flow') != null)).toBe(true);

    // Delete the selected node: focus goes to the nearest node, never to the page body.
    const target = page.locator('.react-flow__node', { hasText: 'Decode C' });
    await target.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Delete');
    await expect(page.locator('.react-flow__node')).toHaveCount(11);
    await expect.poll(active).toMatch(/^react-flow__node\|/);
    // Undo brings it back; focus stays on the canvas.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(12);
    await expect.poll(active).not.toBe('BODY');
    console.log('FOCUS_AFTER f1-close=node delete=nearest-node undo=kept f6=areas');

    // Alt puts focus on the menu bar with a visible mark.
    await page.keyboard.press('Alt');
    await expect(page.locator('[role="menubar"] [data-keyboard-focus]')).toHaveCount(1);
    await page.keyboard.press('Escape');

    // The library: Space opens a node's card and moves focus into it; Escape gives focus back to the list.
    await page.getByRole('searchbox').first().focus();
    await page.keyboard.type('KSampler');
    // The search runs a moment after the last key (a short pause, then main); the rows must be its answer before the
    // arrows pick one, or Space opens the card of a row of the list before it and the answer then closes that card.
    // Its answer starts with the category header, then the KSampler rows; the second arrow lands on the first of them.
    await expect(page.locator('#node-library-list [role="option"]').nth(1)).toContainText('KSampler');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(page.locator('.node-card')).toBeVisible();
    await expect(page.locator('.node-card')).toHaveAttribute('data-node-class', /KSampler/);
    await expect.poll(async () => page.evaluate(() => document.activeElement?.closest('.node-card') != null)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.node-card')).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => document.activeElement?.id)).toBe('node-library-list');
    console.log('LIBRARY_CARD space=card-focused escape=list');

    // Interface size: Ctrl+Alt+= makes everything larger (fewer CSS pixels across), Ctrl+Alt+0 restores it.
    const width = () => page.evaluate(() => window.innerWidth);
    const before = await width();
    await page.locator('.react-flow__node').first().focus();
    await page.keyboard.press('Control+Alt+Equal');
    await expect.poll(width).toBeLessThan(before);
    await page.keyboard.press('Control+Alt+Digit0');
    await expect.poll(width).toBe(before);
    console.log(`INTERFACE_SIZE width ${before} -> smaller -> ${before}`);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fake.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
