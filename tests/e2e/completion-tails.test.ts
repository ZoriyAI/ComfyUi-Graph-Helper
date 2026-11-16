/** Real desktop and paired touch-browser journeys for direct agent edits, guided recovery and model release. */
import { test, expect, _electron as electron, chromium, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { useEnglish } from './locale';
import type { SubgraphDefinition } from '../../src/shared/graph/subgraphs';
import { startFakeComfy } from '../fixtures/comfy/fakeComfy';
import { startFakeLlm, FAKE_MODEL } from '../fixtures/llm/fakeLlmServer';

const snapshot = (page: Page) => page.evaluate(async () => {
  const data = (await window.electronAPI.readProjection('desktop'))!.snapshot;
  return { nodes: data.nodes as Array<{ data: { title?: string } }>, subgraphs: (data.subgraphs ?? []) as SubgraphDefinition[] };
});
const ask = async (page: Page, words: string) => {
  const input = page.getByRole('textbox', { name: 'Chat message', exact: true });
  await input.fill(words); await input.press('Enter');
};

test('normal requests control existing and nested graphs, with history and scoped unload through the UI and quit', async () => {
  test.setTimeout(90_000);
  const llm = await startFakeLlm(); llm.state.loaded.add('another-app:7b');
  const comfy = await startFakeComfy();
  const profile = mkdtempSync(join(tmpdir(), 'nw-tails-'));
  const env: Record<string, string> = { ...process.env, NODE_ENV: 'production' };
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`, '--ozone-platform=x11'], env });
  let closed = false;
  try {
    const page = await app.firstWindow(); const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 }); await useEnglish(page);
    await page.evaluate(async ({ base, model, comfyOrigin }) => {
      const read = await window.electronAPI.getSettings();
      if (read.source === 'corrupt') throw new Error('Test settings are corrupt');
      const save = await window.electronAPI.saveSettings({ ...read.values, provider: 'local', baseURL: `${base}/v1`, model, comfyOrigin });
      if (!save.ok) throw new Error('Test provider was not saved');
      const sync = await window.electronAPI.syncNow();
      if (sync.state === 'error') throw new Error('Fixture catalog was not synchronized');
      const now = await window.electronAPI.readProjection('desktop');
      await window.electronAPI.commitCommand({ projectId: 'desktop', actionId: 'before-clear', expectedRevisionId: now!.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'add-node', nodeType: 'KSampler', title: 'Original work' } });
    }, { base: llm.origin, model: FAKE_MODEL, comfyOrigin: comfy.url });
    await page.reload(); await expect(page.locator('.app-shell')).toBeVisible();
    await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Assistant', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await ask(page, 'Please clear the canvas and create two canvas variants');
    await expect(page.getByText('Created two editable size studies; they need generation and output nodes before execution.', { exact: true })).toBeVisible({ timeout: 35_000 });
    await expect(page.locator('.pause-button')).toHaveCount(0);
    const made = await snapshot(page);
    expect(made.nodes).toHaveLength(2); expect(made.subgraphs).toHaveLength(2);
    expect(made.subgraphs.map(g => g.nodes.length)).toEqual([1, 1]);
    expect(made.nodes.some(n => n.data.title === 'Original work')).toBe(false);
    const first = made.subgraphs.find(g => g.name === 'Variant A')!;
    expect(first.raw.widgets).toHaveLength(1);
    await ask(page, `edit previous ${first.id} ${first.nodes[0].id}`);
    await expect(page.getByText('Updated the existing inner node.', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await snapshot(page)).subgraphs.find(g => g.id === first.id)!.nodes[0].data.parameters.width).toBe(768);
    await page.locator('.react-flow__pane').click({ position: { x: 15, y: 450 } });
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await snapshot(page)).subgraphs.find(g => g.id === first.id)!.nodes[0].data.parameters.width).toBe(512);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await snapshot(page)).nodes.map(n => n.data.title)).toEqual(['Original work']);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(async () => (await snapshot(page)).subgraphs.length).toBe(2);
    await expect(page.locator('[data-tool-status="error"]')).toHaveCount(0);
    // A completed answer must not pull focus away from the person's next action.
    await ask(page, 'brief delayed answer');
    const search = page.getByRole('searchbox', { name: 'Search nodes', exact: true });
    await search.focus(); await search.fill('latent');
    await expect(page.getByText('The delayed answer is complete.', { exact: true })).toBeVisible();
    await expect(search).toBeFocused();
    await page.locator('.toolbar-settings').click();
    const settings = page.locator('[role="dialog"].settings-dialog');
    await settings.getByRole('tab', { name: 'Assistant', exact: true }).click();
    const memory = settings.getByRole('region', { name: 'Make room for ComfyUI', exact: true });
    await memory.getByRole('button', { name: 'Free memory for ComfyUI', exact: true }).click();
    await expect(memory.getByRole('status')).toContainText('server confirms', { timeout: 20_000 });
    expect(llm.state.loaded.has(FAKE_MODEL)).toBe(false);
    expect(llm.state.loaded.has('another-app:7b')).toBe(true);
    await memory.getByRole('button', { name: 'Resume assistant', exact: true }).click();
    await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
    await ask(page, 'hello after memory release');
    await expect(page.getByText('A plain answer: the sampler removes noise.', { exact: true })).toBeVisible();
    expect(llm.state.loaded.has(FAKE_MODEL)).toBe(true);
    await page.screenshot({ path: 'test-results/completion-desktop.png' });
    expect(errors).toEqual([]);
    await app.close(); closed = true;
    expect(llm.state.loaded.has(FAKE_MODEL)).toBe(false);
    expect(llm.state.loaded.has('another-app:7b')).toBe(true);
    expect(llm.state.unloaded.filter(name => name === FAKE_MODEL)).toHaveLength(2);
  } finally {
    if (!closed) await app.close();
    await llm.close(); await comfy.close(); rmSync(profile, { recursive: true, force: true });
  }
});

test('a paired phone completes guide navigation, opens its file picker and leaves the host running when closed', async () => {
  test.setTimeout(90_000);
  const profile = mkdtempSync(join(tmpdir(), 'nw-guide-phone-'));
  const allocator = createServer(); await new Promise<void>(done => allocator.listen(0, '127.0.0.1', done));
  const port = (allocator.address() as { port: number }).port; await new Promise<void>(done => allocator.close(() => done()));
  const env: Record<string, string> = { ...process.env, NODE_ENV: 'production' }; delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`, '--ozone-platform=x11'], env });
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const pc = await app.firstWindow(); await pc.setViewportSize({ width: 1440, height: 900 }); await useEnglish(pc);
    await pc.locator('.toolbar-settings').click();
    const settings = pc.locator('[role="dialog"].settings-dialog');
    await settings.getByRole('tab', { name: 'Browser access', exact: true }).click();
    await settings.getByRole('switch', { name: 'Allow access from a browser' }).click();
    await settings.getByLabel('Network interface', { exact: true }).click();
    await pc.getByRole('option', { name: /127\.0\.0\.1/ }).click();
    await settings.getByLabel('Port', { exact: true }).fill(String(port)); await settings.locator('.settings-save').click();
    await expect(settings).toBeHidden(); await pc.locator('.toolbar-settings').click();
    await settings.getByRole('tab', { name: 'Browser access', exact: true }).click();
    await settings.getByRole('button', { name: 'Connect a device', exact: true }).click();
    const code = await settings.getByTestId('browser-pair-code').innerText();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const phone = await context.newPage(); const errors: string[] = []; phone.on('pageerror', e => errors.push(e.message));
    phone.setDefaultTimeout(10_000);
    await phone.goto(`http://127.0.0.1:${port}`);
    await phone.getByLabel('Code on the computer').fill(code); await phone.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(phone.locator('.app-shell')).toBeVisible();
    await phone.getByRole('button', { name: 'Go to the canvas', exact: true }).click();
    await expect(phone.getByRole('region', { name: 'Welcome', exact: true })).toBeHidden();
    await phone.reload();
    await phone.getByRole('button', { name: 'Show the welcome screen', exact: true }).click();
    await phone.getByRole('button', { name: 'Go to the canvas', exact: true }).click();
    await phone.getByRole('toolbar', { name: 'Canvas tools' }).getByRole('button', { name: 'Solve a problem', exact: true }).click();
    const guide = phone.getByRole('dialog');
    await guide.getByRole('searchbox').fill('Missing nodes');
    await guide.getByRole('button', { name: /Missing nodes in an imported workflow/ }).click();
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(guide.getByRole('button', { name: 'Check this graph', exact: true })).toBeVisible();
    await guide.getByRole('button', { name: 'Next', exact: true }).click();
    await guide.getByRole('button', { name: 'Check the current result', exact: true }).click();
    await expect(guide.getByRole('status')).toContainText('not enough current data');
    await expect(guide.getByRole('button', { name: 'It worked: finish', exact: true })).toBeDisabled();
    await phone.screenshot({ path: 'test-results/completion-phone-guide.png' });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await guide.getByRole('button', { name: 'Close guide', exact: true }).click();
    const picker = phone.waitForEvent('filechooser');
    await phone.getByRole('button', { name: 'Image', exact: true }).first().click();
    expect((await picker).isMultiple()).toBe(false);
    await context.close();
    expect((await pc.evaluate(() => window.electronAPI.readProjection('desktop')))?.projectId).toBe('desktop');
    expect(errors).toEqual([]);
  } finally { await browser.close(); await app.close(); rmSync(profile, { recursive: true, force: true }); }
});
