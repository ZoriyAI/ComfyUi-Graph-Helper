import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { ensureWorkspace, startRun } from '../../src/main/commands/commit';
import { upsertNodeClasses } from '../../src/main/catalog/repository';
import { CATALOG_NOT_SYNCED, catalogSynced, editDistance, nearestNodeClasses, validateNodeClass } from '../../src/main/knowledge/nodeClassGuard';
import { createBuildTools } from '../../src/main/agent/buildTools';
import { createAgentTools } from '../../src/main/agent/tools';
import { BUILD_TOOL_SPECS } from '../../src/shared/commands/toolSpecs';
import { knowledgeHandlers } from '../../src/main/knowledge/handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './agent/fakes';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function sync(db: Database.Database): void {
  upsertNodeClasses(db, ['KSampler', 'KSamplerAdvanced', 'SamplerCustom', 'EmptyLatentImage', 'LoraLoader', 'VAEEncode'].map((classType) => ({
    classType, module: 'nodes', displayName: classType, category: 'sampling',
  })), Date.now());
}

describe('node class guard', () => {
  it('counts the catalog as synced only beyond the seeded classes', () => {
    const db = openDb();
    expect(catalogSynced(db)).toBe(false);
    sync(db);
    expect(catalogSynced(db)).toBe(true);
  });

  it('measures swapped letters as one edit', () => {
    expect(editDistance('KSmapler', 'KSampler')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });

  it('refuses an unknown class once synced, with up to five nearest names', () => {
    const db = openDb();
    sync(db);
    const verdict = validateNodeClass(db, 'KSmapler');
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.suggestions.slice(0, 2)).toEqual(['KSampler', 'KSamplerAdvanced']);
    expect(verdict.suggestions.length).toBeLessThanOrEqual(5);
    expect(verdict.error).toBe(`Unknown node class \`KSmapler\`. Did you mean: ${verdict.suggestions.join(', ')}?`);
    expect(nearestNodeClasses(db, 'Lora')).toContain('LoraLoader');
    expect(validateNodeClass(db, 'KSampler')).toEqual({ ok: true, known: true, portsKnown: true });
  });

  it('allows an unknown class before a sync, with a warning', () => {
    const db = openDb();
    expect(validateNodeClass(db, 'TestNode')).toEqual({ ok: true, known: false, portsKnown: false, warning: CATALOG_NOT_SYNCED });
  });

  it('says which known classes have no ports yet', () => {
    const db = openDb();
    upsertNodeClasses(db, [{ classType: 'MysteryNode', module: 'custom_nodes.x', displayName: 'Mystery', category: 'x' }], null);
    upsertNodeClasses(db, [{ classType: 'A', module: 'm', displayName: 'A', category: 'x' }, { classType: 'B', module: 'm', displayName: 'B', category: 'x' }], null);
    expect(validateNodeClass(db, 'MysteryNode')).toMatchObject({ ok: true, known: true, portsKnown: false });
  });

  it('agent addNode returns suggestions instead of committing, and a warning before a sync', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    const loose = await tools.addNode.execute({ nodeType: 'TestNode' }, { toolCallId: 't1' }) as Record<string, unknown>;
    expect(loose).toMatchObject({ success: true, warning: CATALOG_NOT_SYNCED });
    sync(db);
    const refused = await tools.addNode.execute({ nodeType: 'KSmapler' }, { toolCallId: 't2' }) as Record<string, unknown>;
    expect(refused).toMatchObject({ success: false, suggestions: expect.arrayContaining(['KSampler', 'KSamplerAdvanced']) });
    expect(String(refused.error)).toContain('Did you mean: KSampler, KSamplerAdvanced');
    const known = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 't3' }) as Record<string, unknown>;
    expect(known).toMatchObject({ success: true });
    expect(known.warning).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('agent proposeNode is refused the same way', async () => {
    const db = openDb();
    sync(db);
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createAgentTools({
      db, projectId: DESKTOP_PROJECT_ID, runId: run.runId, revision: run.expectedRevisionId,
      knowledge: fakeKnowledge(), proposals: fakeProposals(),
    }) as Record<string, { execute: (args: unknown) => Promise<Record<string, unknown>> }>;
    const refused = await tools.proposeNode.execute({ nodeType: 'KSmapler', note: 'sampler' });
    expect(refused).toMatchObject({ success: false, suggestions: expect.arrayContaining(['KSampler']) });
  });

  it('is reachable over IPC for the add-node search', async () => {
    const db = openDb();
    sync(db);
    const handlers = knowledgeHandlers({ db: () => db, sync: {} as never });
    const verdict = await handlers[IPC_CHANNELS.KNOWLEDGE_VALIDATE_NODE_CLASS]('KSmapler') as { ok: boolean };
    expect(verdict.ok).toBe(false);
  });
});
