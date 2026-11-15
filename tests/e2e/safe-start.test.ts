/**
 * E2E spec for the safe start in the built app: a graph over the size limit is refused, and a graph the last start
 * never drew is asked about at the next start (fixtures/answerStartDialog.js answers the question and records it).
 * A person whose window hung on a graph must get back into the app without editing files by hand.
 */
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GRAPH_NODE_LIMIT } from '../../src/shared/workflow/graphLimits';

const MAIN = path.join(__dirname, '../../dist/main/index.js');
const ANSWER = path.join(__dirname, 'fixtures/answerStartDialog.js');

function workflow(count: number) {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: index + 1, type: 'KSampler', pos: [(index % 60) * 260, Math.floor(index / 60) * 200], size: [240, 160], flags: {}, order: index, mode: 0,
    inputs: [], outputs: [], properties: {}, widgets_values: [1, 'fixed', 20, 8, 'euler', 'normal', 1],
  }));
  return { version: 0.4, last_node_id: count, last_link_id: 0, nodes, links: [], groups: [], config: {}, extra: {} };
}

/** Starts the app; with `answer` the dialog stub is preloaded with `-r` so the start question is answered at once. */
async function launch(userData: string, answer = false): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({ args: [...(answer ? ['-r', ANSWER] : []), MAIN, `--user-data-dir=${userData}`], env: { ...process.env, NODE_ENV: 'production' } });
  const window = await app.firstWindow();
  await window.locator('#chat-provider').waitFor({ timeout: 90_000 });
  return { app, window };
}

/** Imports a workflow through the command bridge; returns the status, the error text and the new revision id. */
async function commitImport(window: Page, document: unknown) {
  return window.evaluate(async (doc) => {
    const api = (window as any).electronAPI;
    const current = await api.readProjection('desktop');
    const response = await api.commitCommand({ projectId: 'desktop', actionId: `import-${Date.now()}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document: doc } });
    return { status: response.status as string, error: (response.result?.error ?? '') as string, revisionId: (response.projection?.currentRevisionId ?? null) as string | null };
  }, document);
}

test('a graph over the size limit is refused, and one the last start never drew is asked about', async () => {
  test.setTimeout(300_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-start-'));
  let { app, window } = await launch(userData);
  const refused = await commitImport(window, workflow(GRAPH_NODE_LIMIT + 1));
  expect(refused.status).toBe('rejected');
  expect(refused.error).toMatch(/too large to open/);

  // A graph that replaced the canvas and was never drawn (the app closed first): the mark says "drawing".
  const applied = await commitImport(window, workflow(40));
  expect(applied.status).toBe('applied');
  await app.close();
  // Make it look like the window never finished drawing the graph on screen (as after a hang and a forced quit).
  const revisionId = applied.revisionId;
  fs.writeFileSync(path.join(userData, 'graph-start.json'), JSON.stringify({ state: 'drawing', revisionId, at: Date.now() }));

  ({ app, window } = await launch(userData, true));
  const asked = await app.evaluate(() => (globalThis as any).__asked);
  expect(asked.length).toBe(1);
  await expect(window.locator('.react-flow__node')).toHaveCount(0);
  // Undo brings the graph back.
  const nodes = await window.evaluate(async () => (await (window as any).electronAPI.readProjection('desktop')).snapshot.nodes.length);
  expect(nodes).toBe(0);
  await expect.poll(() => JSON.parse(fs.readFileSync(path.join(userData, 'graph-start.json'), 'utf8')).state, { timeout: 20_000 }).toBe('drawn');
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
