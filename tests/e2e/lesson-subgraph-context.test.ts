/** Isolated Electron profile + fixture catalog. Actual UI and restart proof, not a GPU execution claim. */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startFakeMcp } from '../fixtures/mcp/fakeMcpServer';
import { useEnglish } from './locale';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';

test('lessons follow each nested copy and retain its progress after an application restart', async () => {
  test.setTimeout(150000);
  const fake = await startFakeMcp();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-lesson-copy-'));
  let app: ElectronApplication | undefined;
  const errors: string[] = [];
  const launch = async () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
    delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
    app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env: env as Record<string, string> });
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await useEnglish(page);
    return page;
  };
  const api = (page: Page, name: string, ...args: unknown[]) => page.evaluate(async ({ name, args }) => {
    return (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args);
  }, { name, args });
  const enter = async (page: Page, copy: string) => {
    await page.locator(`.react-flow__node[data-id="${copy}"]`).getByRole('button', { name: 'Open subgraph Prompt block', exact: true }).click();
    await page.locator('.react-flow__node[data-id="1"]').getByRole('button', { name: 'Open subgraph Encode', exact: true }).click();
    await expect(page.locator('[data-lesson-context]')).toContainText(`copy #${copy}`);
  };
  try {
    let page = await launch();
    const settings = await api(page, 'getSettings');
    expect(await api(page, 'saveSettings', { ...settings.values, mcpUrl: fake.url, mcpAuth: 'none' })).toMatchObject({ ok: true });
    await api(page, 'syncNow');
    const workflow: any = structuredClone(nestedSubgraphWorkflow);
    workflow.nodes[1].properties.proxyWidgets = [['1', '1::text']];
    workflow.nodes[1].widgets_values = ['first copy'];
    workflow.nodes.push({ ...structuredClone(workflow.nodes[1]), id: 4, pos: [360, 420], widgets_values: ['second copy'], inputs: [], outputs: [] });
    workflow.state.lastNodeId = 4;
    workflow.definitions.subgraphs[0].nodes[0].properties.proxyWidgets = [['1', 'text']];
    workflow.definitions.subgraphs[0].nodes[0].widgets_values = ['shared default'];
    const head = await api(page, 'readProjection', 'desktop');
    expect(await api(page, 'commitCommand', { projectId: 'desktop', actionId: 'lesson-context-import', expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: workflow } })).toMatchObject({ status: 'applied' });
    await page.reload();
    await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
    await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Learn', exact: true }).click();
    await page.locator('[data-lesson-card="image"]').getByRole('button', { name: 'Start', exact: true }).click();
    await enter(page, '2');
    await expect(page.locator('.react-flow__node[data-id="1"] textarea')).toHaveValue('first copy');
    await expect(page.locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'intro');
    await page.locator('.lesson-panel').getByRole('button', { name: 'Got it, next', exact: true }).click();
    await expect(page.locator('[data-lesson-step]')).not.toHaveAttribute('data-lesson-step', 'intro');
    const afterIntro = await page.locator('[data-lesson-step]').getAttribute('data-lesson-step');
    await page.getByRole('button', { name: 'Return to the main canvas', exact: true }).click();
    await enter(page, '4');
    await expect(page.locator('.react-flow__node[data-id="1"] textarea')).toHaveValue('second copy');
    await expect(page.locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'intro');
    await page.getByRole('button', { name: 'Return to the main canvas', exact: true }).click();
    await enter(page, '2');
    await expect(page.locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', afterIntro!);
    // The lesson's action adds only to this shared inner definition; it must not escape to the root.
    const before = await api(page, 'readProjection', 'desktop');
    await page.locator('.lesson-panel').getByRole('button', { name: 'Do this for me', exact: true }).click();
    await expect.poll(async () => (await api(page, 'readProjection', 'desktop')).currentRevisionId).not.toBe(before.currentRevisionId);
    const after = await api(page, 'readProjection', 'desktop');
    expect(after.snapshot.nodes).toEqual(before.snapshot.nodes);
    expect(after.snapshot.subgraphs.find((item: any) => item.id === INNER_ID).nodes.length).toBe(before.snapshot.subgraphs.find((item: any) => item.id === INNER_ID).nodes.length + 1);
    expect(after.snapshot.subgraphs.find((item: any) => item.id === OUTER_ID)).toEqual(before.snapshot.subgraphs.find((item: any) => item.id === OUTER_ID));
    await app!.close(); app = undefined;
    page = await launch();
    await expect(page.locator('.lesson-panel')).toBeVisible();
    await enter(page, '2');
    await expect(page.locator('[data-lesson-step]')).not.toHaveAttribute('data-lesson-step', 'intro');
    await page.getByRole('button', { name: 'Return to the main canvas', exact: true }).click();
    await enter(page, '4');
    await expect(page.locator('[data-lesson-step]')).toHaveAttribute('data-lesson-step', 'intro');
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    await fake.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
