import { test, expect, _electron as electron } from '@playwright/test';
import { useEnglish } from './locale';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const snapshot = {
  CheckpointLoaderSimple: {
    input: {
      required: {
        ckpt_name: [['known.safetensors'], { tooltip: 'The name of the checkpoint (model) to load.' }],
      },
    },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE'],
    name: 'CheckpointLoaderSimple',
    display_name: 'Load Checkpoint',
    description: '',
    python_module: 'nodes',
    category: 'loaders',
    output_node: false,
  },
  VAELoader: {
    input: { required: { vae_name: ['COMBO', { options: ['vae.safetensors'] }] } },
    input_order: { required: ['vae_name'] },
    output: ['VAE'],
    name: 'VAELoader',
    display_name: 'Load VAE',
    description: '',
    python_module: 'nodes',
    category: 'loaders',
    output_node: false,
  },
};

const workflow = {
  version: 1,
  state: { lastNodeId: 3, lastLinkId: 0 },
  nodes: [{
    id: 1,
    type: 'CheckpointLoaderSimple',
    pos: [0, 0],
    size: [10, 10],
    flags: {},
    order: 0,
    mode: 0,
    properties: {
      models: [
        { name: 'known.safetensors', url: 'https://example.com/known', directory: 'checkpoints' },
        { name: 'missing.safetensors', url: 'https://example.com/missing', directory: 'checkpoints' },
      ],
    },
  }],
  definitions: {
    subgraphs: [{
      id: 'sg',
      name: 'Inner',
      nodes: [
        { id: 2, type: 'VAELoader', pos: [0, 0], size: [1, 1], flags: {}, order: 0, mode: 0, properties: {} },
        { id: 3, type: 'NotInCatalog', pos: [0, 0], size: [1, 1], flags: {}, order: 0, mode: 0, properties: {} },
      ],
    }],
  },
  links: [],
};

test('catalog snapshot import persists guidance and workflow missing-deps use it', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-snapshot-'));
  const source = path.join(userData, 'object_info.json');
  const broken = path.join(userData, 'broken.json');
  const arrayFile = path.join(userData, 'array.json');
  fs.writeFileSync(source, JSON.stringify(snapshot));
  fs.writeFileSync(broken, '{');
  fs.writeFileSync(arrayFile, '[]');
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist/main/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await electronApp.firstWindow();
  await useEnglish(window);
  await window.locator('#chat-provider').waitFor();
  const appRoot = path.join(__dirname, '../..');
  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.source] });
  }, { source });
  await window.getByRole('button', { name: 'Catalog snapshot', exact: true }).click();
  await expect(window.getByText('Catalog snapshot imported. Nodes: 2. Models: 2. Skipped: 0.')).toBeVisible();

  const stored = await electronApp.evaluate(async ({ app }, { appRoot: root }) => {
    const nodeModule = process.getBuiltinModule('module');
    const nodePath = process.getBuiltinModule('path');
    const Database = nodeModule.createRequire(nodePath.join(root, 'package.json'))('better-sqlite3');
    const db = new Database(nodePath.join(app.getPath('userData'), 'comfyui-desktop.db'), { readonly: true, fileMustExist: true });
    const nodes = db.prepare('SELECT class_type, pack, python_module FROM node_catalog ORDER BY class_type').all();
    const models = db.prepare('SELECT directory, name FROM model_catalog ORDER BY directory, name').all();
    db.close();
    return { nodes, models };
  }, { appRoot });
  const rows = stored.nodes as Array<{ class_type: string; pack: string; python_module: string }>;
  expect(rows.find((row) => row.class_type === 'CheckpointLoaderSimple')).toMatchObject({ python_module: 'nodes' });
  expect(rows.find((row) => row.class_type === 'CLIPTextEncode')).toMatchObject({ pack: 'core' });
  expect(rows.find((row) => row.class_type === 'SaveImage')).toBeTruthy();
  expect(stored.models).toEqual([
    { directory: 'checkpoints', name: 'known.safetensors' },
    { directory: 'vae', name: 'vae.safetensors' },
  ]);

  const current = await window.evaluate(async () => {
    const bridge = (window as unknown as { electronAPI: { readProjection: (id: string) => Promise<{ currentRevisionId: string }> } }).electronAPI;
    return bridge.readProjection('desktop');
  });
  const imported = await window.evaluate(async (document) => {
    const bridge = (window as unknown as {
      electronAPI: {
        commitCommand: (input: unknown) => Promise<{ status: string; result: { missingNodes: string[]; missingModels: Array<{ directory: string; name: string }> } }>;
      };
    }).electronAPI;
    return bridge.commitCommand({
      projectId: 'desktop',
      actionId: 'import-after-catalog',
      expectedRevisionId: (document as { expected: string }).expected,
      actor: 'manual',
      runId: null,
      payload: { type: 'import-workflow', document: (document as { workflow: unknown }).workflow },
    });
  }, { expected: current.currentRevisionId, workflow });
  expect(imported.status).toBe('applied');
  expect(imported.result.missingNodes).toEqual(['NotInCatalog']);
  expect(imported.result.missingModels).toEqual([{ directory: 'checkpoints', name: 'missing.safetensors' }]);

  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.broken] });
  }, { broken });
  await window.getByRole('button', { name: 'Catalog snapshot', exact: true }).click();
  await expect(window.getByText('Catalog JSON could not be parsed.')).toBeVisible();
  const afterReject = await electronApp.evaluate(async ({ app }, { appRoot: root }) => {
    const nodeModule = process.getBuiltinModule('module');
    const nodePath = process.getBuiltinModule('path');
    const Database = nodeModule.createRequire(nodePath.join(root, 'package.json'))('better-sqlite3');
    const db = new Database(nodePath.join(app.getPath('userData'), 'comfyui-desktop.db'), { readonly: true, fileMustExist: true });
    const count = db.prepare('SELECT COUNT(*) AS count FROM node_catalog').get() as { count: number };
    db.close();
    return count.count;
  }, { appRoot });
  expect(afterReject).toBe(rows.length);

  await electronApp.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.arrayFile] });
  }, { arrayFile });
  await window.getByRole('button', { name: 'Catalog snapshot', exact: true }).click();
  await expect(window.getByText('Catalog snapshot is not object_info.')).toBeVisible();
  const afterArray = await electronApp.evaluate(async ({ app }, { appRoot: root }) => {
    const nodeModule = process.getBuiltinModule('module');
    const nodePath = process.getBuiltinModule('path');
    const Database = nodeModule.createRequire(nodePath.join(root, 'package.json'))('better-sqlite3');
    const db = new Database(nodePath.join(app.getPath('userData'), 'comfyui-desktop.db'), { readonly: true, fileMustExist: true });
    const count = db.prepare('SELECT COUNT(*) AS count FROM node_catalog').get() as { count: number };
    db.close();
    return count.count;
  }, { appRoot });
  expect(afterArray).toBe(rows.length);
  await electronApp.close();
});
