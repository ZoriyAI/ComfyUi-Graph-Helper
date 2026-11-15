/**
 * E2E spec for opening and saving ComfyUI workflows: an import puts the workflow on the canvas and the export keeps
 * fields the app does not know (vendor keys, custom group and node fields); the Import and Export buttons use the file
 * dialogs, and a cancelled dialog changes nothing. A person's workflow must come back to ComfyUI with nothing lost.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import { useEnglish } from './locale';
import { exportPastGuard } from './exportGuard';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Fields the app has no use for (vendor, custom, customFlag) are here to prove the export keeps them.
const workflow = {
  version: 1,
  state: { lastNodeId: 1, lastLinkId: 0 },
  vendor: { keep: true },
  groups: [{ title: 'Imported', bounding: [0, 0, 10, 10], custom: 'keep-group' }],
  nodes: [{
    id: 7,
    type: 'CheckpointLoaderSimple',
    pos: [12, 24],
    size: [200, 80],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    title: 'Loaded checkpoint',
    widgets_values: { ckpt_name: 'local.safetensors' },
    customFlag: 'keep-node',
  }],
  links: [],
};

test('import projects a workflow onto the canvas and export keeps unknown fields', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-codec-'));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await expect(window.getByRole('button', { name: 'Open workflow…', exact: true })).toBeEnabled();
  await expect(window.getByRole('button', { name: 'Save workflow for ComfyUI…', exact: true })).toBeEnabled();

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (document) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (input: unknown) => Promise<{ status: string; result: { missingNodes: string[] } }> } }).electronAPI;
    return bridge.commitCommand({
      projectId: 'desktop',
      actionId: 'import-e2e',
      expectedRevisionId: (document as { expected: string }).expected,
      actor: 'manual',
      runId: null,
      payload: { type: 'import-workflow', document: (document as { workflow: unknown }).workflow },
    });
  }, { expected: current.currentRevisionId, workflow });
  expect(imported.status).toBe('applied');
  expect(imported.result.missingNodes).toEqual([]);

  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  // The check runs on its own after an import, so the name also appears in the Check panel: look at the node.
  await expect(window.locator('.react-flow__node').getByText('Loaded checkpoint')).toBeVisible();

  const exported = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { exportWorkflowDocument: () => Promise<{ ok: boolean; workflow: Record<string, unknown> }> } }).electronAPI;
    return bridge.exportWorkflowDocument();
  });
  expect(exported.ok).toBe(true);
  expect(exported.workflow.vendor).toEqual({ keep: true });
  expect(exported.workflow.groups).toEqual(workflow.groups);
  expect((exported.workflow.nodes as Array<Record<string, unknown>>)[0].customFlag).toBe('keep-node');
  expect((exported.workflow.nodes as Array<Record<string, unknown>>)[0].pos).toEqual([12, 24]);
  await electronApp.close();
});

test('Import and Export buttons use the file dialogs, and cancel does not change the graph', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-dialog-'));
  const source = path.join(userData, 'in.json');
  const saved = path.join(userData, 'out.json');
  fs.writeFileSync(source, JSON.stringify(workflow));
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.source] });
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.saved });
  }, { source, saved });
  await window.getByRole('button', { name: 'Open workflow…', exact: true }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  await exportPastGuard(window);
  const written = JSON.parse(fs.readFileSync(saved, 'utf8')) as { vendor?: { keep?: boolean } };
  expect(written.vendor).toEqual({ keep: true });
  await electronApp.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await window.getByRole('button', { name: 'Open workflow…', exact: true }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  await electronApp.close();
});
