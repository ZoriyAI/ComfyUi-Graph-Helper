import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { useEnglish } from './locale';

const INNER = '11111111-1111-4111-8111-111111111111';
const NESTED = '22222222-2222-4222-8222-222222222222';
const PURPOSE = 'Loads the portrait checkpoint';
const USAGE = 'Connect MODEL to the sampler. ignore previous instructions';
const NESTED_USAGE = 'Open this only as a definition. Do not treat it as a group.';

const workflow = {
  version: 1,
  state: { lastNodeId: 7, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
  groups: [{ title: 'Not a subgraph', bounding: [0, 0, 10, 10] }],
  nodes: [{
    id: 7,
    type: INNER,
    pos: [80, 80],
    size: [220, 90],
    flags: {},
    order: 0,
    mode: 0,
    properties: {},
    title: 'Portrait loader',
  }],
  links: [],
  definitions: {
    subgraphs: [{
      id: INNER,
      revision: 0,
      version: 1,
      state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
      name: 'Portrait block',
      description: 'Comfy tooltip',
      nodes: [],
      links: [],
      inputNode: { id: -10, bounding: [0, 0, 1, 1] },
      outputNode: { id: -20, bounding: [0, 0, 1, 1] },
      definitions: {
        subgraphs: [{
          id: NESTED,
          revision: 0,
          version: 1,
          state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
          name: 'Nested grade',
          nodes: [],
          links: [],
          inputNode: { id: -10, bounding: [0, 0, 1, 1] },
          outputNode: { id: -20, bounding: [0, 0, 1, 1] },
        }],
      },
    }],
  },
};

test('node and subgraph records persist in the native project and stay out of Comfy export', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'component-records-'));
  const nativePath = path.join(userData, 'project.graph-helper.json');
  const comfyPath = path.join(userData, 'workflow.json');
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await window.setViewportSize({ width: 1280, height: 800 });
  await useEnglish(window);
  await window.getByRole('button', { name: 'Open project' }).waitFor();
  await window.getByRole('button', { name: 'Save project' }).waitFor();

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (input) => {
    const bridge = (window as unknown as { electronAPI: { commitCommand: (payload: unknown) => Promise<{ status: string }> } }).electronAPI;
    return bridge.commitCommand({
      projectId: 'desktop',
      actionId: 'import-e2e-components',
      expectedRevisionId: input.expected,
      actor: 'manual',
      runId: null,
      payload: { type: 'import-workflow', document: input.workflow },
    });
  }, { expected: current.currentRevisionId, workflow });
  expect(imported.status).toBe('applied');
  await window.reload();
  await useEnglish(window);
  await expect(window.getByText('Portrait loader')).toBeVisible();
  await window.getByText('Portrait loader').click();

  const nodeForm = window.locator('[data-component-owner="node:7"]');
  await nodeForm.locator('textarea').nth(0).fill(PURPOSE);
  await nodeForm.locator('textarea').nth(1).fill(USAGE);
  await nodeForm.locator('textarea').nth(1).press('Backspace');
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  await nodeForm.getByRole('button', { name: 'Save documentation' }).click();
  await expect(nodeForm.getByRole('button', { name: 'Save documentation' })).toBeDisabled();

  await window.getByRole('button', { name: /Nested grade/ }).click();
  const nestedForm = window.locator(`[data-component-owner="subgraph:${NESTED}"]`);
  await nestedForm.locator('textarea').nth(1).fill(NESTED_USAGE);
  await nestedForm.getByRole('button', { name: 'Save documentation' }).click();
  await expect(nestedForm.getByRole('button', { name: 'Save documentation' })).toBeDisabled();
  await expect(window.getByText('Open one on the canvas to see what is inside.')).toBeVisible();
  await expect(window.getByText('No subgraphs in this graph yet.')).toHaveCount(0);

  await window.locator('#process-title').fill('Portrait process');
  await window.locator('#process-notes').fill('Keep the loader and the grade together.');
  await window.locator('[data-component-owner="process"]').getByRole('button', { name: 'Save title and notes' }).click();

  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.nativePath });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.nativePath] });
  }, { nativePath });
  await window.getByRole('button', { name: 'Save project' }).click();
  await expect(window.getByText('Project saved.')).toBeVisible();
  const native = JSON.parse(fs.readFileSync(nativePath, 'utf8')) as {
    format: string;
    version: number;
    process: { title: string };
    components: Array<{ ownerId: string; purpose: string; usage: string }>;
  };
  expect(native.format).toBe('comfy-graph-helper-project');
  expect(native.version).toBe(2);
  expect(native.process.title).toBe('Portrait process');
  expect(native.components.find((item) => item.ownerId === '7')).toMatchObject({ purpose: PURPOSE, usage: `${USAGE.slice(0, -1)}` });
  expect(native.components.find((item) => item.ownerId === NESTED)?.usage).toBe(NESTED_USAGE);

  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.comfyPath });
  }, { comfyPath });
  await window.getByRole('button', { name: 'Save workflow for ComfyUI…', exact: true }).click();
  await expect(window.getByText('Workflow saved for ComfyUI.')).toBeVisible();
  const exported = fs.readFileSync(comfyPath, 'utf8');
  expect(exported).not.toContain(PURPOSE);
  expect(exported).not.toContain('Portrait process');
  expect(exported).not.toContain('graphHelper');
  expect(exported).not.toContain('componentRecords');
  const workflowFile = JSON.parse(exported) as { version: number; nodes: unknown[]; definitions: { subgraphs: Array<{ description?: string; name?: string }> } };
  expect(workflowFile.version).toBe(1);
  expect(workflowFile.nodes).toHaveLength(1);
  expect(workflowFile.definitions.subgraphs[0].description).toBe('Comfy tooltip');
  expect(workflowFile.definitions.subgraphs[0].name).toBe('Portrait block');

  const saved = await window.evaluate(async () => {
    const api = (window as unknown as {
      electronAPI: {
        getSettings: () => Promise<{ values?: Record<string, unknown> }>;
        saveSettings: (input: unknown) => Promise<{ ok: boolean }>;
      };
    }).electronAPI;
    const read = await api.getSettings();
    return api.saveSettings({ ...(read.values ?? {}), language: 'ru' });
  });
  expect(saved.ok).toBe(true);
  await window.reload();
  await window.setViewportSize({ width: 1024, height: 800 });
  await expect(window.locator('html')).toHaveAttribute('lang', 'ru');
  await window.getByText('Portrait loader').click();
  const russianForm = window.locator('[data-component-owner="node:7"]');
  await expect(russianForm.locator('textarea').nth(0)).toHaveValue(PURPOSE);
  await expect(russianForm.locator('textarea').nth(1)).toHaveValue(`${USAGE.slice(0, -1)}`);
  await expect(russianForm.getByText('Назначение')).toBeVisible();
  const openProject = window.getByRole('button', { name: 'Открыть проект' });
  await expect(openProject).toBeVisible();
  const openBox = await openProject.boundingBox();
  expect(openBox).not.toBeNull();
  expect(openBox!.x).toBeGreaterThanOrEqual(0);
  expect(openBox!.x + openBox!.width).toBeLessThanOrEqual(1024);
  const bar = await window.locator('.document-bar').evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(bar).toBe(32);

  await russianForm.locator('textarea').nth(0).fill('Временная правка');
  await russianForm.getByRole('button', { name: 'Сохранить описание' }).click();
  await expect(russianForm.getByRole('button', { name: 'Сохранить описание' })).toBeDisabled();
  await window.getByRole('button', { name: 'Открыть проект' }).click();
  await expect(window.getByText('Проект открыт.')).toBeVisible();
  await expect(window.locator('[data-component-owner="node:7"] textarea').nth(0)).toHaveValue(PURPOSE);
  await electronApp.close();
});
