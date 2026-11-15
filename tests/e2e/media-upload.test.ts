/** One scoped desktop/phone journey for loader file selection, shared values and library group controls. */
import { test, expect, _electron as electron, chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useEnglish } from './locale';

const picture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
const info = {
  LoadImage: { display_name: 'Load Image', category: 'image', input: { required: { image: [['previous.png'], { image_upload: true }] } }, output: ['IMAGE', 'MASK'] },
  SaveImage: { display_name: 'Save Image', category: 'image', input: { required: { images: ['IMAGE'], filename_prefix: ['STRING', { default: 'ComfyUI' }] } }, output: [], output_node: true },
  LoadAudio: { display_name: 'Load Audio', category: 'audio', input: { required: { audio: [['previous.wav']] } }, output: ['AUDIO'] },
  KSampler: { display_name: 'KSampler', category: 'sampling', input: { required: { model: ['MODEL'], seed: ['INT', { default: 0 }], steps: ['INT', { default: 20, min: 1, max: 10000 }] } }, output: ['LATENT'] },
};

test('choose media from desktop and phone, retain failed selection, and fold all library groups', async () => {
  test.setTimeout(90_000);
  const uploaded: { name: string; data: Buffer }[] = [];
  const server = createServer((req, res) => { void (async () => {
    if (req.method === 'GET') {
      if (req.url?.startsWith('/view?')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(picture); return; }
      const value = req.url === '/object_info' ? info : req.url === '/system_stats' ? { system: { comfyui_version: '0.45.0', os: 'posix', ram_total: 32 * 1024 ** 3, ram_free: 20 * 1024 ** 3 }, devices: [{ name: 'Fixture GPU', type: 'cuda', vram_total: 12 * 1024 ** 3, vram_free: 10 * 1024 ** 3 }] } : req.url === '/models' || req.url === '/experiment/models' ? [] : null;
      res.writeHead(value === null ? 404 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); return;
    }
    if (req.url !== '/upload/image') { res.writeHead(404); res.end(); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type']! } }).formData();
    const file = form.get('image') as File;
    expect(form.get('type')).toBe('input'); expect(form.get('overwrite')).toBe('false');
    uploaded.push({ name: file.name, data: Buffer.from(await file.arrayBuffer()) });
    if (file.name === 'refuse.png') { res.writeHead(500); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: `uploaded-${file.name}`, subfolder: '', type: 'input' }));
  })().catch((error) => { res.writeHead(500); res.end(String(error)); }); });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const allocator = createServer(); await new Promise<void>((done) => allocator.listen(0, '127.0.0.1', done));
  const port = (allocator.address() as { port: number }).port; await new Promise<void>((done) => allocator.close(() => done()));
  const profile = mkdtempSync(join(tmpdir(), 'nodewise-media-'));
  const env = { ...process.env, NODE_ENV: 'production' } as Record<string, string>;
  delete env.DBUS_SESSION_BUS_ADDRESS; delete env.GNOME_KEYRING_CONTROL;
  const app = await electron.launch({ args: [join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${profile}`], env });
  const browser = await chromium.launch({ channel: 'chromium' });
  const errors: string[] = [];
  const choose = async (page: Page, name: string, touch = false) => {
    const field = page.locator('.react-flow__node .node-field[data-field="image"]');
    const next = page.waitForEvent('filechooser');
    const picker = field.locator('label[role=button]');
    if (touch) await picker.tap(); else await picker.click();
    await (await next).setFiles({ name, mimeType: 'image/png', buffer: picture });
    return field;
  };
  try {
    const pc = await app.firstWindow(); pc.on('pageerror', (e) => errors.push(e.message));
    await pc.setViewportSize({ width: 1440, height: 900 }); await useEnglish(pc);
    await pc.evaluate(async (comfyOrigin) => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Fresh settings unreadable');
      await window.electronAPI.saveSettings({ ...read.values, comfyOrigin, mcpUrl: '' });
      const status = await window.electronAPI.syncNow(); if (status.state === 'error') throw Error(status.lastError ?? 'Sync failed');
    }, origin);
    const rail = pc.locator('#library-rail'); await rail.getByRole('tab', { name: 'Nodes', exact: true }).click();
    // The three fixture categories plus the app's two editor-node categories.
    await expect(pc.locator('#node-library-list [data-collapsed]')).toHaveCount(5);
    await rail.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await expect(pc.locator('#node-library-list [data-collapsed="true"]')).toHaveCount(5);
    await rail.getByRole('button', { name: 'Expand all', exact: true }).click();
    await expect(pc.locator('#node-library-list [data-collapsed="false"]')).toHaveCount(5);
    const search = rail.getByRole('searchbox', { name: 'Search nodes' }).or(rail.getByRole('textbox', { name: 'Search nodes' })).first();
    await search.fill('LoadImage');
    await pc.locator('#node-library-list').getByRole('option').filter({ hasText: 'Load Image' }).first().dblclick();
    await pc.getByRole('button', { name: 'Fit to view', exact: true }).first().click();
    const field = await choose(pc, 'desktop.png');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-desktop.png');
    expect(uploaded[0]).toEqual({ name: 'desktop.png', data: picture });
    await choose(pc, 'refuse.png');
    await expect(field.getByRole('alert')).toContainText('could not be uploaded');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-desktop.png');
    await pc.evaluate(async (port) => {
      const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Settings unreadable');
      await window.electronAPI.saveSettings({ ...read.values, preferences: { browserAccess: { enabled: true, address: '127.0.0.1', port } } });
    }, port);
    await expect.poll(() => pc.evaluate(async () => (await window.electronAPI.browserAccessStatus()).state)).toBe('listening');
    const code = await pc.evaluate(async () => (await window.electronAPI.browserPairingCode()).code);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const host = `http://127.0.0.1:${port}`;
    expect((await context.request.post(`${host}/browser/pair`, { headers: { Origin: host }, data: { code } })).status()).toBe(200);
    const phone = await context.newPage(); phone.on('pageerror', (e) => errors.push(e.message)); await phone.goto(host);
    await phone.getByRole('button', { name: 'Canvas', exact: true }).click();
    await phone.getByRole('button', { name: 'Fit to view', exact: true }).first().click();
    const mobileField = await choose(phone, 'phone.png', true);
    await expect(mobileField.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-phone.png');
    await expect(field.getByRole('combobox')).toHaveAttribute('data-value', 'uploaded-phone.png');
    await expect(field.getByRole('alert')).toHaveCount(0);
    expect(uploaded[2]).toEqual({ name: 'phone.png', data: picture });
    await expect(phone.locator('[data-image-source] img')).toBeVisible();
    // Both a second tap on the active panel and the explicit back action return to a clear canvas.
    await phone.getByRole('button', { name: 'Library', exact: true }).tap();
    await phone.getByRole('button', { name: /Back to canvas/ }).tap();
    await expect(phone.locator('.app-shell')).toHaveAttribute('data-mobile-panel', 'canvas');
    const chooser = phone.waitForEvent('filechooser');
    await phone.locator('label[role=button]').filter({ has: phone.locator('input[type=file][accept^="image/png"]') }).tap();
    await (await chooser).setFiles({ name: 'source.png', mimeType: 'image/png', buffer: picture });
    await expect(phone.locator('.react-flow__node')).toHaveCount(2);
    await expect(phone.locator('[data-image-source] img')).toHaveCount(2);
    // Add by the single-tap library/card path; its portaled card must close after insertion.
    await phone.getByRole('button', { name: 'Library', exact: true }).tap();
    const phoneRail = phone.locator('#library-rail'); await phoneRail.getByRole('tab', { name: 'Nodes', exact: true }).tap();
    await phoneRail.getByRole('searchbox', { name: 'Search nodes' }).or(phoneRail.getByRole('textbox', { name: 'Search nodes' })).first().fill('SaveImage');
    await phone.locator('#node-library-list [data-node-class="SaveImage"]').tap();
    await phone.getByRole('button', { name: 'Add to canvas', exact: true }).tap();
    await expect(phone.locator('.node-card')).toHaveCount(0);
    await expect(phone.locator('.app-shell')).toHaveAttribute('data-mobile-panel', 'canvas');
    await expect(phone.locator('.react-flow__node')).toHaveCount(3);
    await phone.getByRole('button', { name: 'Fit to view', exact: true }).first().tap();
    const imageNode = phone.locator('.react-flow__node').filter({ hasText: 'source.png' });
    const saveNode = phone.locator('.react-flow__node').filter({ hasText: 'Save Image' });
    // No mouse drag or modifier key: tap an output, then an input.
    await imageNode.locator('.react-flow__handle.source[data-handleid="out-0"]').tap();
    await saveNode.locator('.react-flow__handle.target').first().tap();
    await expect(phone.locator('.react-flow__edge')).toHaveCount(1);
    await phone.getByRole('button', { name: 'Zoom out', exact: true }).first().tap();
    await expect(saveNode.locator('.node-fields')).toBeVisible();
    // The node’s own menu exposes deletion; touch undo restores both node and connection.
    await imageNode.getByRole('button', { name: 'Node menu: source.png', exact: true }).tap();
    await phone.getByRole('menuitem', { name: 'Delete node', exact: true }).tap();
    await expect(phone.locator('.react-flow__node')).toHaveCount(2);
    await phone.getByRole('toolbar', { name: 'Touch graph actions' }).getByRole('button', { name: 'Undo', exact: true }).tap();
    await expect(phone.locator('.react-flow__node')).toHaveCount(3); await expect(phone.locator('.react-flow__edge')).toHaveCount(1);
    const touch = phone.getByRole('toolbar', { name: 'Touch graph actions' });
    await touch.getByRole('button', { name: 'Select all', exact: true }).tap();
    await expect(phone.locator('.react-flow__node.selected')).toHaveCount(3);
    await touch.getByRole('button', { name: 'Select several nodes by tapping', exact: true }).tap();
    await imageNode.locator('.graph-node-title').tap(); await expect(phone.locator('.react-flow__node.selected')).toHaveCount(2);
    await imageNode.locator('.graph-node-title').tap(); await expect(phone.locator('.react-flow__node.selected')).toHaveCount(3);
    await saveNode.locator('.graph-node-title').tap(); await expect(phone.locator('.react-flow__node.selected')).toHaveCount(2);
    await touch.getByRole('button', { name: 'Select several nodes by tapping', exact: true }).tap();
    await phone.getByRole('button', { name: 'Task wizards', exact: true }).tap();
    const task = phone.getByRole('dialog', { name: 'Create with a task wizard', exact: true });
    await task.getByRole('button', { name: 'Ollama and local AI', exact: true }).tap();
    await task.getByRole('button', { name: 'Review Ollama node package', exact: true }).tap();
    const extension = task.locator('[data-extension-draft]');
    await expect(extension.getByText('Source package for review.', { exact: false })).toBeVisible();
    await extension.getByRole('combobox', { name: 'Read a source file' }).selectOption('nodes.py');
    await expect(extension.locator('pre')).toContainText('class NodeWiseOllamaVisionPrompt');
    const zip = phone.waitForEvent('download'); await extension.getByRole('button', { name: 'Download extension ZIP' }).tap();
    const downloaded = await zip; await downloaded.saveAs(join(profile, 'phone-extension.zip'));
    expect(downloaded.suggestedFilename()).toBe('nodewise_ollama.zip'); expect(readFileSync(join(profile, 'phone-extension.zip')).readUInt32LE()).toBe(0x04034b50);
    await phone.screenshot({ path: 'test-results/extension-phone.png' });
    await task.getByRole('button', { name: 'Custom extension', exact: true }).tap();
    await expect(task.getByText('For a new algorithm, describe its inputs', { exact: false })).toBeVisible();
    await task.getByRole('button', { name: 'Video', exact: true }).tap();
    await task.getByRole('searchbox', { name: 'Find a task or model' }).fill('Get Any Video Frame');
    await task.getByRole('option').filter({ hasText: 'Get Any Video Frame' }).tap();
    await task.getByRole('button', { name: 'Next', exact: true }).tap();
    await expect(task.getByText('VIDEO', { exact: true })).toBeVisible();
    await task.getByRole('textbox', { name: 'What result do you want?' }).fill('Extract a photo from the selected video frame.');
    await task.getByRole('button', { name: 'Next', exact: true }).tap();
    await expect(task.getByRole('button', { name: 'Create editable subgraph' })).toBeInViewport();
    await task.getByRole('checkbox', { name: 'Open the inner graph after saving', exact: true }).uncheck();
    await phone.screenshot({ path: 'test-results/task-wizard-phone.png' });
    await task.getByRole('button', { name: 'Create editable subgraph', exact: true }).tap();
    await expect(task).toHaveCount(0); await expect(phone.locator('.react-flow__node')).toHaveCount(4);
    const exported = await phone.evaluate(() => window.electronAPI.exportWorkflowDocument());
    expect(exported.ok).toBe(true); if (!exported.ok) throw Error('Blueprint export refused');
    expect((exported.workflow as any).definitions.subgraphs[0].nodes).toHaveLength(5);
    await phone.getByRole('button', { name: 'Fit to view', exact: true }).first().tap();
    await phone.screenshot({ path: 'test-results/media-upload-phone.png' });
    await pc.screenshot({ path: 'test-results/media-upload-desktop.png' });
    await pc.getByRole('button', { name: 'Check graph', exact: true }).first().click();
    const resources = pc.getByRole('region', { name: 'Hardware and combined models', exact: true });
    await expect(resources.getByText('Fixture GPU', { exact: false })).toBeVisible();
    await resources.getByRole('button', { name: 'Refresh hardware and estimate' }).click();
    await expect(resources.locator('[data-resource-verdict]')).toHaveAttribute('data-resource-verdict', 'blocked');
    await pc.screenshot({ path: 'test-results/resource-panel-desktop.png' });
    // Seed only this disposable profile with a checked translation cache; never call an owner LLM.
    await app.evaluate(({ app }, root) => {
      const nodeModule = process.getBuiltinModule('module'); const nodePath = process.getBuiltinModule('path');
      const req = nodeModule.createRequire(nodePath.join(root, 'package.json')); const Database = req('better-sqlite3');
      const db = new Database(nodePath.join(app.getPath('userData'), 'comfyui-desktop.db'));
      db.prepare('INSERT INTO model_catalog(directory,name,kind,description,metadata_json,notes_json,trigger_words) VALUES (?,?,?,?,?,?,?)').run('loras', 'study_fixture.safetensors', 'lora', 'Portrait style description.', JSON.stringify({ 'modelspec.description': 'Use soft light.', ss_steps: '100' }), JSON.stringify({ notes: 'Works with portraits.' }), '["ExactTrigger"]');
      const { modelDetail } = req(nodePath.join(root, 'dist/main/knowledge/repository.js'));
      const { readableModelFields, modelTextHash } = req(nodePath.join(root, 'dist/main/knowledge/modelTranslations.js'));
      const fields = readableModelFields(modelDetail(db, 'loras', 'study_fixture.safetensors'));
      db.prepare('INSERT INTO model_text_translations(source_hash,language,fields_json,updated_at) VALUES (?,?,?,?)').run(modelTextHash(fields), 'ru', JSON.stringify({ description: 'Описание портретного стиля.', notes: 'Подходит для портретов.', 'metadata:modelspec.description': 'Используйте мягкий свет.' }), Date.now());
      db.close();
    }, join(__dirname, '../..'));
    await pc.evaluate(async () => { const read = await window.electronAPI.getSettings(); if (read.source === 'corrupt') throw Error('Settings'); await window.electronAPI.saveSettings({ ...read.values, language: 'ru' }); });
    await pc.reload(); await expect(pc.locator('html')).toHaveAttribute('lang', 'ru');
    const ruRail = pc.locator('#library-rail'); await ruRail.getByRole('tab', { name: 'Модели', exact: true }).click();
    await ruRail.getByRole('searchbox').fill('study_fixture');
    await ruRail.locator('[role=option]').filter({ hasText: 'study_fixture.safetensors' }).first().click();
    const modelCard = pc.getByRole('dialog', { name: 'study_fixture.safetensors', exact: true });
    await expect(modelCard.getByText('Описание портретного стиля.', { exact: true })).toBeVisible();
    await expect(modelCard.getByText('Используйте мягкий свет.', { exact: true })).toBeVisible();
    await expect(modelCard.getByText('ExactTrigger', { exact: true }).first()).toBeVisible();
    await modelCard.getByRole('button', { name: 'Показать оригинал', exact: true }).click();
    await expect(modelCard.getByText('Portrait style description.', { exact: true })).toBeVisible();
    await pc.screenshot({ path: 'test-results/model-translation-original.png' });
    await modelCard.getByRole('button', { name: 'Показать перевод', exact: true }).click();
    await pc.screenshot({ path: 'test-results/model-translation-ru.png' });
    expect(errors).toEqual([]);
  } finally {
    await browser.close(); await app.close();
    await new Promise<void>((done) => { server.close(() => done()); server.closeAllConnections(); });
    rmSync(profile, { recursive: true, force: true });
  }
});
