/** A person changes native dynamic modes, edits child fields and reloads an isolated desktop project. */
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { useEnglish } from './locale';
import { loadNodeList } from './fileMenu';
import { dynamicObjectInfo, dynamicWorkflow } from './fixtures/dynamicInputs';

test('native modes show their actual fields, retain branch edits, undo, reload and export', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-dynamic-inputs-')); let app: ElectronApplication | undefined;
  try {
    const catalog = path.join(profile, 'object_info.json'); fs.writeFileSync(catalog, JSON.stringify(dynamicObjectInfo));
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'production' };
    delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
    app = await electron.launch({ args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env: env as Record<string, string> });
    const page = await app.firstWindow(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1000 }); await useEnglish(page);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, catalog);
    await loadNodeList(page); await expect(page.getByText(/Node list loaded/)).toBeVisible();
    const api = (name: string, ...args: unknown[]) => page.evaluate(async ({ name, args }) => (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<any>> }).electronAPI[name](...args), { name, args });
    const head = await api('readProjection', 'desktop');
    expect(await api('commitCommand', { projectId: 'desktop', actionId: 'dynamic-import', expectedRevisionId: head.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: dynamicWorkflow } })).toMatchObject({ status: 'applied' });
    await page.reload(); await page.locator('.react-flow__node').first().waitFor(); await page.keyboard.press('Control+0');
    const node = page.locator('.react-flow__node[data-id="2"]');
    const mode = node.getByRole('combobox', { name: 'mode', exact: true });
    await expect(mode).toHaveAttribute('data-value', 'multiplier');
    await expect(node.getByRole('spinbutton', { name: 'multiplier', exact: true })).toHaveValue('4');
    await expect(page.locator('[data-list-port]')).toHaveCount(2);
    await mode.click(); await page.getByRole('option', { name: 'dimensions', exact: true }).click();
    const width = node.getByRole('spinbutton', { name: 'width', exact: true }); await expect(width).toHaveValue('512');
    await expect(node.getByRole('spinbutton', { name: 'multiplier', exact: true })).toHaveCount(0);
    await width.fill('1024'); await width.press('Enter');
    await mode.click(); await page.getByRole('option', { name: 'multiplier', exact: true }).click();
    await expect(node.getByRole('spinbutton', { name: 'multiplier', exact: true })).toHaveValue('4');
    await mode.click(); await page.getByRole('option', { name: 'dimensions', exact: true }).click();
    await expect(width).toHaveValue('1024');
    await node.focus(); await page.keyboard.press('Control+z'); await expect(mode).toHaveAttribute('data-value', 'multiplier');
    await page.keyboard.press('Control+Shift+z'); await expect(mode).toHaveAttribute('data-value', 'dimensions');
    await page.reload(); await expect(mode).toHaveAttribute('data-value', 'dimensions'); await expect(width).toHaveValue('1024');
    const saved = await api('exportWorkflowDocument'); expect(saved.ok).toBe(true);
    expect(saved.workflow.nodes[1].widgets_values).toEqual(['dimensions', 1024, 768, 'imported tail']);
    expect(saved.workflow.nodes[1].widgets_values_named).toEqual({ mode: 'dimensions', 'mode.width': 1024, 'mode.height': 768, after: 'imported tail', future_widget: { keep: true } });
    expect(saved.workflow.links).toHaveLength(2); expect(saved.workflow.nodes[1].inputs[0].futureInput).toBe('keep');
    expect(errors).toEqual([]);
  } finally { await app?.close(); fs.rmSync(profile, { recursive: true, force: true }); }
});
