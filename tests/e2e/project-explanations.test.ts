import { test, expect, _electron as electron, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { denseWorkflow } from './fixtures/denseWorkflow';
import { INNER_ID, nestedSubgraphWorkflow } from './fixtures/nestedSubgraphWorkflow';
import { useEnglish } from './locale';

/**
 * Explanations travel with the project: a description written by hand on a node is saved in the project file, does
 * not appear on node 4 of another graph (New project, then the same numbers from a workflow), comes back when the
 * project is opened, and undo and redo across the open bring each graph back with its own descriptions.
 */
const NOTE = 'Renders prompt A at twenty steps.';

test.setTimeout(240_000);

test('a hand-written description is saved with the project, stays off other graphs and follows undo and redo', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'project-explanations-'));
  const projectPath = path.join(userData, 'portrait.graph-helper.json');
  const workflowPath = path.join(userData, 'dense.json');
  fs.writeFileSync(workflowPath, JSON.stringify(denseWorkflow), 'utf8');
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  try {
    const window = await app.firstWindow();
    window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
    window.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    await app.evaluate(({ dialog }, paths) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.projectPath });
      dialog.showOpenDialog = async (options: { filters?: Array<{ name: string }> } | unknown) => {
        // The project and the workflow are both .json; the dialog title tells them apart.
        const title = String((options as { title?: unknown })?.title ?? '');
        return { canceled: false, filePaths: [/project/i.test(title) ? paths.projectPath : paths.workflowPath] };
      };
    }, { projectPath, workflowPath });

    const stored = async () => window.evaluate(async () => {
      const bridge = (window as unknown as { electronAPI: { listExplanations: (request: unknown) => Promise<Array<{ text: string; provenance: string }>> } }).electronAPI;
      return bridge.listExplanations({ projectId: 'desktop', owner: { kind: 'node', id: '4', classType: 'KSampler' } });
    });
    const sampleCard = window.getByRole('region', { name: 'Description of Sample', exact: true });

    // A workflow from ComfyUI, then a description written by hand on node 4.
    await menu(window, 'File', 'Open workflow…');
    await expect(window.locator('.react-flow__node')).toHaveCount(12, { timeout: 20000 });
    await window.getByRole('button', { name: 'Read the description: Sample', exact: true }).click();
    await expect(sampleCard).toHaveAttribute('data-expanded', 'true');
    await sampleCard.getByRole('button', { name: 'Edit the description' }).focus();
    await window.keyboard.press('Enter');
    const field = sampleCard.getByRole('textbox', { name: 'Description text' });
    await field.fill(NOTE);
    await sampleCard.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sampleCard).toHaveAttribute('data-description-scope', 'node');
    await expect(sampleCard).toContainText(NOTE);

    // Save project: the description is in the file, with its source.
    await window.getByRole('button', { name: 'Save project' }).click();
    await expect(window.getByText('Project saved.')).toBeVisible();
    const file = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as { extensions: { explanations: { version: number; items: Array<{ owner: { kind: string; id: string }; text: string; provenance: string; createdBy: string }> } } };
    expect(file.extensions.explanations.version).toBe(1);
    expect(file.extensions.explanations.items).toEqual([expect.objectContaining({ owner: expect.objectContaining({ kind: 'node', id: '4' }), text: NOTE, provenance: 'user', createdBy: 'user' })]);

    // New project, then the same workflow again: node 4 of this graph has no description of its own.
    await menu(window, 'File', 'New project');
    await expect(window.locator('.react-flow__node')).toHaveCount(0, { timeout: 20000 });
    expect(await stored()).toEqual([]);
    await menu(window, 'File', 'Open workflow…');
    await expect(window.locator('.react-flow__node')).toHaveCount(12, { timeout: 20000 });
    expect(await stored()).toEqual([]);
    // What was opened on node 4 of the other graph does not travel here: this is another graph, its cards start closed.
    await expect(sampleCard).toHaveCount(0);
    await expect(window.locator('.description-card[data-description-scope="node"]')).toHaveCount(0);
    await expect(window.locator('.react-flow').getByText(NOTE)).toHaveCount(0);

    // Open the saved project: the description is back on node 4.
    await window.getByRole('button', { name: 'Open project' }).click();
    await expect(window.getByText('Project opened.')).toBeVisible();
    await expect(sampleCard).toHaveAttribute('data-description-scope', 'node', { timeout: 20000 });
    await expect(sampleCard).toContainText(NOTE);
    expect((await stored()).map((item) => [item.text, item.provenance])).toEqual([[NOTE, 'user']]);

    // Undo the open: the workflow graph comes back without it. Redo: the project's graph with it.
    await menu(window, 'Edit', 'Undo');
    await expect.poll(async () => (await stored()).length, { timeout: 20000 }).toBe(0);
    await expect(window.locator('.description-card[data-description-scope="node"]')).toHaveCount(0, { timeout: 20000 });
    await expect(window.locator('.react-flow').getByText(NOTE)).toHaveCount(0);
    await menu(window, 'Edit', 'Redo');
    await expect.poll(async () => (await stored()).length, { timeout: 20000 }).toBe(1);
    await expect(sampleCard).toHaveAttribute('data-description-scope', 'node', { timeout: 20000 });
    await expect(sampleCard).toContainText(NOTE);

    expect(errors).toEqual([]);
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

const INNER_NOTE = 'Turns the words into what the sampler reads.';

test('inside a subgraph definition a description is written on the inner node, not on the main node with its number', async () => {
  const errors: string[] = [];
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'project-explanations-sg-'));
  const projectPath = path.join(userData, 'nested.graph-helper.json');
  const workflowPath = path.join(userData, 'nested.json');
  fs.writeFileSync(workflowPath, JSON.stringify(nestedSubgraphWorkflow), 'utf8');
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  try {
    const window = await app.firstWindow();
    window.on('pageerror', (error) => errors.push(error instanceof Error ? error.message : String(error)));
    window.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await window.setViewportSize({ width: 1440, height: 900 });
    await useEnglish(window);
    await app.evaluate(({ dialog }, paths) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.projectPath });
      dialog.showOpenDialog = async (options: unknown) => {
        const title = String((options as { title?: unknown })?.title ?? '');
        return { canceled: false, filePaths: [/project/i.test(title) ? paths.projectPath : paths.workflowPath] };
      };
    }, { projectPath, workflowPath });
    await menu(window, 'File', 'Open workflow…');
    await expect(window.locator('.react-flow__node')).toHaveCount(3, { timeout: 20000 });

    // Into "Prompt block", then into the nested "Encode": its node 1 is a CLIPTextEncode; node 1 of the main canvas
    // is the checkpoint loader.
    await window.locator('.react-flow__node[data-id="2"]').dblclick();
    await expect(window.locator('[data-canvas-mode="definition"]')).toBeVisible();
    await window.locator('.react-flow__node[data-id="1"]').dblclick();
    await expect(window.locator('.react-flow__node[data-id="1"]')).toContainText('CLIPTextEncode', { timeout: 20000 });
    const encodeCard = window.getByRole('region', { name: 'Description of CLIPTextEncode', exact: true });
    await window.getByRole('button', { name: 'Read the description: CLIPTextEncode', exact: true }).click();
    await expect(encodeCard).toHaveAttribute('data-expanded', 'true');
    await encodeCard.getByRole('button', { name: 'Edit the description' }).focus();
    await window.keyboard.press('Enter');
    await encodeCard.getByRole('textbox', { name: 'Description text' }).fill(INNER_NOTE);
    await encodeCard.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(encodeCard).toHaveAttribute('data-description-scope', 'node');
    await expect(encodeCard).toContainText(INNER_NOTE);

    // Back on the main canvas, node 1 (the loader) has nothing of its own.
    await window.getByRole('navigation', { name: 'Subgraph path' }).getByRole('button', { name: 'Whole graph', exact: true }).click();
    await expect(window.locator('.react-flow__node')).toHaveCount(3);
    await expect(window.locator('.react-flow').getByText(INNER_NOTE)).toHaveCount(0);
    await expect(window.locator('.description-card[data-description-scope="node"]')).toHaveCount(0);
    // The card opened on node 1 inside the subgraph is not open on node 1 of the main canvas.
    await expect(window.getByRole('region', { name: 'Description of CheckpointLoaderSimple', exact: true })).toHaveCount(0);

    // Saved with the definition it belongs to; opened again, it is back inside.
    await window.getByRole('button', { name: 'Save project' }).click();
    await expect(window.getByText('Project saved.')).toBeVisible();
    const file = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as { extensions: { explanations: { items: Array<{ owner: Record<string, unknown>; text: string }> } } };
    expect(file.extensions.explanations.items).toEqual([expect.objectContaining({ owner: expect.objectContaining({ kind: 'node', id: '1', subgraphId: INNER_ID }), text: INNER_NOTE })]);
    await menu(window, 'File', 'New project');
    await expect(window.locator('.react-flow__node')).toHaveCount(0, { timeout: 20000 });
    await window.getByRole('button', { name: 'Open project' }).click();
    await expect(window.getByText('Project opened.')).toBeVisible();
    await expect(window.locator('.react-flow__node')).toHaveCount(3, { timeout: 20000 });
    await window.locator('.react-flow__node[data-id="2"]').dblclick();
    await window.locator('.react-flow__node[data-id="1"]').dblclick();
    await expect(encodeCard).toHaveAttribute('data-description-scope', 'node', { timeout: 20000 });
    await expect(encodeCard).toContainText(INNER_NOTE);

    expect(errors).toEqual([]);
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

async function menu(window: Page, top: string, item: string): Promise<void> {
  await window.getByRole('menubar').getByRole('menuitem', { name: top, exact: true }).click();
  await window.getByRole('menu').getByRole('menuitem', { name: new RegExp(`^${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first().click();
}
