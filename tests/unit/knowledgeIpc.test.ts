import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { ensureWorkspace } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { knowledgeHandlers } from '../../src/main/knowledge/handlers';
import { SyncService } from '../../src/main/mcp/sync';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo({
    KSampler: { input: { required: { model: ['MODEL'] } }, output: ['LATENT'], display_name: 'KSampler', category: 'sampling', python_module: 'nodes' },
  }));
  const sync = new SyncService({ token: () => null, readUrl: () => '' });
  return { db, handlers: knowledgeHandlers({ db: () => db, sync }) };
}

describe('knowledge IPC handlers', () => {
  it('registers every knowledge and sync channel from the contract', () => {
    const { handlers, db } = setup();
    const expected = Object.entries(IPC_CHANNELS)
      .filter(([key]) => key.startsWith('KNOWLEDGE_') || (key.startsWith('SYNC_') && key !== 'SYNC_EVENT'))
      .map(([, channel]) => channel)
      .sort();
    expect(Object.keys(handlers).sort()).toEqual(expected);
    db.close();
  });

  it('answers valid requests and rejects invalid ones with a clean message', async () => {
    const { handlers, db } = setup();
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES]({ query: 'ksam' })).toEqual([
      { classType: 'KSampler', displayName: 'KSampler', category: 'sampling', pack: 'core', detailed: true },
    ]);
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_NODE_DETAIL]('KSampler')).toMatchObject({ classType: 'KSampler' });
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_MODEL_DETAIL]({ directory: 'loras', name: 'x.safetensors' })).toBeNull();
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH](DESKTOP_PROJECT_ID)).toMatchObject({ ok: true });
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_CHECK_GRAPH]('missing')).rejects.toThrow('Project was not found.');
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_SEARCH_NODES]({ query: 5 })).rejects.toThrow('Knowledge request is not valid.');
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_SEARCH_MODELS]({ query: '', baseModel: 'sd99' })).rejects.toThrow('Knowledge request is not valid.');
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({ text: 'x' })).rejects.toThrow('Knowledge request is not valid.');
    const saved = await handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      projectId: DESKTOP_PROJECT_ID,
      owner: { kind: 'node', id: '1' },
      aspect: 'what',
      text: 'Samples.',
      provenance: 'user',
      sourceUrl: null,
      revisionId: null,
      createdBy: 'user',
    });
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS]({ owner: { kind: 'node', id: '1' } })).toEqual([saved]);
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_LIST_EXPLANATIONS](undefined)).toEqual([saved]);
    db.close();
  });

  it('saves a renderer explanation as the person\'s, refuses secrets and incomplete port owners', async () => {
    const { handlers, db } = setup();
    const base = { projectId: DESKTOP_PROJECT_ID, aspect: 'what', sourceUrl: null, revisionId: null };
    const forged = await handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      ...base, owner: { kind: 'node', id: '1' }, text: 'Claims to be a fact.', provenance: 'fact', createdBy: 'sync',
    });
    expect(forged).toMatchObject({ provenance: 'user', createdBy: 'user' });
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      ...base, owner: { kind: 'node', id: '1' }, text: 'my key is sk-proj-AbC123_def-GHI456', provenance: 'user', createdBy: 'user',
    })).rejects.toThrow('Explanations cannot store a secret.');
    await expect(handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      ...base, owner: { kind: 'port', id: 'p' }, text: 'A port.', provenance: 'user', createdBy: 'user',
    })).rejects.toThrow('Knowledge request is not valid.');
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      ...base, owner: { kind: 'port', id: 'p', nodeId: '1', direction: 'input', portName: 'model' }, text: 'A port.', provenance: 'user', createdBy: 'user',
    })).toMatchObject({ provenance: 'user' });
    expect(await handlers[IPC_CHANNELS.KNOWLEDGE_SAVE_EXPLANATION]({
      ...base, owner: { kind: 'node', id: '1' }, text: 'The mask-like face LoRA is loras/mask-xl_v1.safetensors.', provenance: 'user', createdBy: 'user',
    })).toMatchObject({ provenance: 'user' });
    db.close();
  });

  it('reports sync status, refuses a too-short interval, and syncs without a URL as an error', async () => {
    const { handlers, db } = setup();
    expect(await handlers[IPC_CHANNELS.SYNC_STATUS]()).toMatchObject({ state: 'never', tokenHeld: false });
    await expect(handlers[IPC_CHANNELS.SYNC_SET_AUTO]({ enabled: true, intervalMinutes: 1 })).rejects.toThrow('Knowledge request is not valid.');
    expect(await handlers[IPC_CHANNELS.SYNC_SET_AUTO]({ enabled: false, intervalMinutes: 15 })).toMatchObject({ auto: { enabled: false, intervalMinutes: 15 } });
    expect(await handlers[IPC_CHANNELS.SYNC_NOW]()).toMatchObject({ state: 'error', lastError: 'MCP server URL is empty.' });
    db.close();
  });
});
