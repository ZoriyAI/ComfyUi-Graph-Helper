// Launches the built app under Xvfb, drives it like a person would, and saves screenshots to inspect.
// Usage: npm run build && xvfb-run -a -s "-screen 0 1600x1000x24" node scripts/capture-screens/capture.js [outDir]
// (or `npm run shots`). Each state is captured independently; a failed state is logged and skipped.
const { _electron: electron } = require('playwright');
const electronPath = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const appRoot = path.resolve(__dirname, '../..');
const DEFAULT_OUT = '/tmp/claude-0/-home-user/642acb4b-9b98-5a4a-a77d-82d5730b2765/scratchpad/shots/out';
const outDir = process.argv[2] || DEFAULT_OUT;
fs.mkdirSync(outDir, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'helper-shots-'));
const taken = [];

async function shot(page, name) {
  await page.waitForTimeout(450);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  taken.push(file);
  console.log('shot', name);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.log(`state ${name} skipped: ${String(error && error.message).split('\n')[0]}`);
  }
}

async function zoomOf(page) {
  const text = await page.locator('.status-bar').innerText();
  const match = text.match(/(\d+)\s*%/);
  return match ? Number(match[1]) : 0;
}

/** Wheel-zoom around a point until the status bar reads about 100 %. */
async function zoomTo100(page, x, y) {
  await page.mouse.move(x, y);
  for (let i = 0; i < 40; i += 1) {
    const zoom = await zoomOf(page);
    if (zoom >= 97 && zoom <= 103) return zoom;
    await page.mouse.wheel(0, zoom < 100 ? -40 : 40);
    await page.waitForTimeout(80);
  }
  return zoomOf(page);
}

async function importWorkflow(page) {
  const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'workflow.json'), 'utf8'));
  const imported = await page.evaluate(async (document) => {
    const api = window.electronAPI;
    const projection = await api.readProjection('desktop');
    return api.commitCommand({
      projectId: 'desktop',
      actionId: `shot-import-${Date.now()}`,
      expectedRevisionId: projection.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'import-workflow', document },
    });
  }, workflow);
  console.log('import status', imported && imported.status);
  // The bridge call bypasses the renderer's projection apply; a reload re-reads the stored project.
  await page.reload();
  await page.locator('.app-shell').waitFor();
  await page.waitForTimeout(1500);
}

async function setLanguage(page, language) {
  await page.evaluate(async (lang) => {
    const api = window.electronAPI;
    const read = await api.getSettings();
    return api.saveSettings({ ...(read.values || {}), language: lang });
  }, language);
  await page.reload();
  await page.locator('.app-shell').waitFor();
  await page.waitForTimeout(1200);
}

async function fit(page) {
  await page.locator('.react-flow__controls-fitview').click();
  await page.waitForTimeout(500);
}

(async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['--no-sandbox', path.join(appRoot, 'dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.app-shell').waitFor();
  await page.waitForTimeout(1000);

  // Russian first: the app starts in Russian.
  await shot(page, '01-ru-empty');
  await step('expand-rail', async () => {
    const expand = page.getByRole('button', { name: /развернуть библиотеку|expand library/i }).first();
    if (await expand.count()) await expand.click();
    await page.waitForTimeout(400);
    await shot(page, '01b-ru-empty-rail');
  });
  await step('library-subgraphs-empty', async () => {
    await page.getByRole('tab', { name: /субграф|subgraph/i }).first().click();
    await shot(page, '02-ru-library-subgraphs-empty');
  });
  await step('library-models-empty', async () => {
    await page.getByRole('tab', { name: /модел|models/i }).first().click();
    await shot(page, '03-ru-library-models-empty');
    await page.getByRole('tab', { name: /ноды|nodes/i }).first().click();
  });

  await importWorkflow(page);
  await shot(page, '04-ru-graph');

  await step('node-100', async () => {
    const node = page.locator('.react-flow__node').filter({ hasText: 'KSampler' }).first();
    const box = await node.boundingBox();
    await zoomTo100(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await node.click({ position: { x: 60, y: 14 } });
    const handle = node.locator('.react-flow__handle').first();
    await handle.hover();
    await shot(page, '05-ru-node-100-port-hover');
  });

  await step('context-menu', async () => {
    const node = page.locator('.react-flow__node').filter({ hasText: 'KSampler' }).first();
    await node.click({ button: 'right', position: { x: 60, y: 14 } });
    await page.waitForTimeout(400);
    await shot(page, '06-ru-context-menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });


  await step('tour', async () => {
    await fit(page);
    await page.getByRole('button', { name: /экскурс|tour the graph/i }).first().click();
    await page.waitForTimeout(1400);
    await shot(page, '07-ru-tour');
    await page.getByRole('button', { name: /закончить экскурсию|завершить экскурсию|stop the tour|end the tour/i }).first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
  });

  await step('ghost', async () => {
    await fit(page);
    await page.getByRole('tab', { name: /ассист|assistant/i }).first().click();
    await page.locator('#chat-provider').click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /TEST|фикстура/i }).first().click();
    await page.waitForTimeout(300);
    const input = page.locator('textarea[aria-label]').first();
    await input.fill('propose a sampler');
    await input.press('Enter');
    await page.waitForTimeout(2500);
    await fit(page);
    await shot(page, '08-ru-ghost');
    const ghost = page.locator('[data-ghost-kind="add-node"]').first();
    if (await ghost.count()) {
      const box = await ghost.boundingBox();
      await zoomTo100(page, box.x + 60, box.y + 40);
      await page.waitForTimeout(300);
      await shot(page, '09-ru-ghost-100');
    }
    await fit(page);
  });

  await step('chat-explain', async () => {
    const input = page.locator('textarea[aria-label]').first();
    await input.fill('explain this');
    await input.press('Enter');
    await page.waitForTimeout(2500);
    await shot(page, '10-ru-chat');
  });

  await step('explain-check', async () => {
    await page.getByRole('tab', { name: /объясн|explain/i }).first().click();
    await shot(page, '11-ru-explain');
    await page.getByRole('tab', { name: /провер|check/i }).first().click();
    await shot(page, '12-ru-check');
  });

  await step('library-nodes-toast', async () => {
    await page.getByRole('tab', { name: /ноды|nodes/i }).first().click();
    const row = page.locator('#node-library-list [role="option"]').nth(1);
    await row.hover();
    await shot(page, '13-ru-library-nodes-hover');
    await row.dblclick();
    await page.waitForTimeout(500);
    await shot(page, '14-ru-toast');
  });

  await step('settings', async () => {
    await page.getByRole('button', { name: /^(settings|настройки)$/i }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '15-ru-settings');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await step('dock-1024', async () => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await fit(page);
    await shot(page, '16-ru-1024');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
  });

  await step('split', async () => {
    await page.setViewportSize({ width: 1600, height: 960 });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /показать оба|show both/i }).first().click();
    await page.waitForTimeout(500);
    await shot(page, '17-ru-split');
    await page.getByRole('button', { name: /^(инспектор|inspector)$/i }).first().click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
  });

  await step('hidden-dock', async () => {
    await page.getByRole('button', { name: /скрыть инструменты|hide tools/i }).first().click();
    await page.waitForTimeout(500);
    await shot(page, '18-ru-dock-hidden');
    await page.getByRole('button', { name: /показать инструменты|show tools/i }).first().click();
    await page.waitForTimeout(400);
  });

  await step('subgraph-instance', async () => {
    await fit(page);
    const node = page.locator('.react-flow__node').filter({ hasText: 'Save Image' }).first();
    await node.click({ position: { x: 40, y: 12 } });
    await node.click({ button: 'right', position: { x: 40, y: 12 } });
    await page.getByRole('menuitem', { name: /субграф из выделенного|subgraph from selection/i }).first().click();
    await page.waitForTimeout(1200);
    const instance = page.locator('[data-node-kind="subgraph-instance"]').first();
    const box = await instance.boundingBox();
    await zoomTo100(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await shot(page, '19-ru-subgraph-instance');
    await fit(page);
  });

  // English pass for the main frame.
  await step('english', async () => {
    await setLanguage(page, 'en');
    await fit(page);
    await shot(page, '20-en-graph');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await shot(page, '21-en-1024');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  fs.writeFileSync(path.join(outDir, 'console-errors.txt'), errors.join('\n'));
  console.log('console errors:', errors.length);
  console.log(`screenshots (${taken.length}):\n${taken.join('\n')}`);
  await app.close();
})().catch((error) => { console.error(error); process.exit(1); });
