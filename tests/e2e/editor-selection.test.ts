import { test, expect, _electron as electron } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { useEnglish } from './locale';
import { typedWorkflow } from './fixtures/typedWorkflow';

async function launch() {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-selection-'));
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  return { app, window };
}

async function importFixture(window: Page): Promise<void> {
  const current = await window.evaluate(() => (window as unknown as {
    electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> };
  }).electronAPI.readProjection('desktop'));
  const imported = await window.evaluate(async (input) => (window as unknown as {
    electronAPI: { commitCommand: (request: unknown) => Promise<{ status: string }> };
  }).electronAPI.commitCommand({
    projectId: 'desktop',
    actionId: 'import-editor-selection',
    expectedRevisionId: input.expected,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document: input.workflow },
  }), { expected: current.currentRevisionId, workflow: typedWorkflow });
  expect(imported.status).toBe('applied');
  await window.reload();
  await window.locator('#chat-provider').waitFor();
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
}

async function selectFirstTwo(window: Page): Promise<void> {
  await window.locator('.react-flow__node[data-id="1"]').click();
  await window.keyboard.down('Control');
  await window.locator('.react-flow__node[data-id="2"]').click();
  await window.keyboard.up('Control');
}

async function exportDocument(window: Page): Promise<Record<string, any>> {
  const exported = await window.evaluate(() => (window as unknown as {
    electronAPI: { exportWorkflowDocument: () => Promise<{ ok: boolean; workflow: Record<string, unknown> }> };
  }).electronAPI.exportWorkflowDocument());
  expect(exported.ok).toBe(true);
  return exported.workflow as Record<string, any>;
}

test('duplicate, paste and multi-delete are one undo step each', async () => {
  const { app, window } = await launch();
  await importFixture(window);
  await selectFirstTwo(window);

  await window.keyboard.press('Control+d');
  await expect(window.locator('.react-flow__node')).toHaveCount(5);
  let workflow = await exportDocument(window);
  expect(workflow.nodes).toHaveLength(5);
  expect(workflow.links).toHaveLength(2);
  expect(new Set(workflow.nodes.map((node: { id: number }) => node.id)).size).toBe(5);
  await window.keyboard.press('Control+z');
  await expect(window.locator('.react-flow__node')).toHaveCount(3);

  await selectFirstTwo(window);
  await window.keyboard.press('Control+c');
  await window.keyboard.press('Control+v');
  await expect(window.locator('.react-flow__node')).toHaveCount(5);
  workflow = await exportDocument(window);
  expect(workflow.nodes).toHaveLength(5);
  expect(workflow.links).toHaveLength(2);
  await window.keyboard.press('Control+z');
  await expect(window.locator('.react-flow__node')).toHaveCount(3);

  await selectFirstTwo(window);
  await window.locator('.react-flow__node[data-id="2"]').focus();
  await window.keyboard.press('Delete');
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  await window.keyboard.press('Control+z');
  await expect(window.locator('.react-flow__node')).toHaveCount(3);
  await app.close();
});

test('a subgraph can be created immediately after New project', async () => {
  const { app, window } = await launch();
  await importFixture(window);
  await window.keyboard.press('Control+n');
  await window.getByRole('button', { name: 'Start new project', exact: true }).click();
  await expect(window.locator('.react-flow__node')).toHaveCount(0);

  await window.locator('[data-canvas-add-node]').click();
  const search = window.getByRole('dialog', { name: 'Add node' });
  await search.locator('input').fill('CheckpointLoaderSimple');
  await window.keyboard.press('Enter');
  await expect(window.locator('.react-flow__node')).toHaveCount(1);
  await window.locator('.react-flow__node[data-id="1"]').click();
  await window.keyboard.press('Control+g');

  const workflow = await exportDocument(window);
  expect(workflow.version).toBe(1);
  expect(workflow.definitions.subgraphs).toHaveLength(1);
  await app.close();
});

test('Check Show and Ask Why preserve a definition-local identity that also exists at the root', async () => {
  const { nestedSubgraphWorkflow, INNER_ID } = await import('./fixtures/nestedSubgraphWorkflow');
  const { pickOption } = await import('./pickOption');
  const { app, window } = await launch();
  try {
    const api = (name: string, args: unknown[] = []) => window.evaluate(async ({ name, args }) => {
      const bridge = (window as unknown as { electronAPI: Record<string, (...input: unknown[]) => Promise<any>> }).electronAPI;
      return bridge[name](...args);
    }, { name, args });
    const workflow = structuredClone(nestedSubgraphWorkflow) as Record<string, any>;
    workflow.nodes[0].title = 'Root node one';
    const inner = workflow.definitions.subgraphs.find((item: any) => item.id === INNER_ID);
    inner.nodes[0].type = 'MissingInnerClass';
    inner.nodes[0].title = 'Inner node one';
    const current = await api('readProjection', ['desktop']);
    expect((await api('commitCommand', [{ projectId: 'desktop', actionId: 'scoped-check', expectedRevisionId: current.currentRevisionId,
      actor: 'manual', runId: null, payload: { type: 'import-workflow', document: workflow } }])).status).toBe('applied');
    await window.reload();
    await window.locator('#chat-provider').waitFor();
    await pickOption(window, 'Choose the assistant', 'TEST mode');
    await window.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await window.keyboard.press('Control+Shift+c');
    const row = window.locator('.check-panel li[data-type="missingNodes"]').filter({ hasText: 'MissingInnerClass' });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(window.locator('[data-canvas-mode="definition"]')).toBeVisible();
    await expect(window.locator('.react-flow__node[data-id="1"]')).toContainText('Inner node one');
    await expect(window.locator('.react-flow__node[data-id="1"]')).toHaveClass(/selected/);
    await row.getByRole('button', { name: 'Ask why', exact: true }).click();
    // Context belongs to the live turn; persisted ChatRecord rows intentionally omit it.
    await expect(window.locator('.message-row[data-role="user"] button[data-object-key]')).toHaveAttribute(
      'data-object-key', `node:1@${INNER_ID}`);
    const projection = await api('readProjection', ['desktop']);
    expect(projection.snapshot.nodes.find((node: any) => node.id === '1').data.title).toBe('Root node one');
  } finally {
    await app.close();
  }
});
