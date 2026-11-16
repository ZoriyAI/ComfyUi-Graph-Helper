/** Checks requested canvas clearing, independent graph creation and later edits through agent tools. */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createBuildTools } from '../../../src/main/agent/buildTools';
import { closeRun, commitCommand, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { upsertObjectInfo } from '../../../src/main/catalog/repository';
import { parseObjectInfo } from '../../../src/shared/catalog/objectInfo';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';

const databases: Database.Database[] = [];
function workspace() {
  const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo({ KSampler: {
    input: { required: { model: ['MODEL'], steps: ['INT', { default: 20, min: 1, max: 10000 }] } },
    output: ['LATENT'], output_name: ['LATENT'], display_name: 'KSampler', category: 'sampling', python_module: 'nodes',
  } }));
  return db;
}
function manual(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  return commitCommand(db, { projectId: P, actionId, actor: 'manual', runId: null,
    expectedRevisionId: readProjection(db, P)!.currentRevisionId, payload: payload as never });
}
function assistant(db: Database.Database) {
  const run = startRun(db, P);
  const tools = createBuildTools(BUILD_TOOL_SPECS, { db, allowExistingEdits: true,
    run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
    toolContext: () => ({ snapshot: readProjection(db, P)!.snapshot as never }) });
  return { run, call: async (name: string, args: Record<string, unknown>, id: string) => await tools[name].execute(args, { toolCallId: id }) as Record<string, any> };
}
afterEach(() => { databases.splice(0).forEach(db => db.close()); });

describe('requested canvas work across assistant turns', () => {
  it('clears all levels with history, creates three distinct graphs, fills them, and edits one on the next turn', async () => {
    const db = workspace();
    manual(db, 'initial-node', { type: 'add-node', nodeType: 'KSampler' });
    manual(db, 'initial-subgraph', { type: 'create-subgraph', name: 'Old', nodeIds: [] });
    const before = readProjection(db, P)!;
    const first = assistant(db);
    expect(await first.call('clearCanvas', {}, 'clear')).toMatchObject({ success: true });
    expect(readProjection(db, P)!.snapshot).toMatchObject({ nodes: [], edges: [], subgraphs: [], groups: [] });
    expect(readProjection(db, P)!.activeRun?.runId).toBe(first.run.runId);
    const graphs = await first.call('createGraphSet', { graphs: [{ name: 'Photo' }, { name: 'Video' }, { name: 'Prompt' }] }, 'graphs');
    expect(graphs, JSON.stringify(graphs)).toMatchObject({ success: true, graphs: expect.any(Array) });
    expect(graphs.graphs).toHaveLength(3);
    expect(new Set(graphs.graphs.map((item: any) => item.definitionId)).size).toBe(3);
    const positions = readProjection(db, P)!.snapshot.nodes.map((node: any) => node.position.x);
    expect(new Set(positions).size).toBe(3);
    const ids: string[] = [];
    for (const [i, graph] of graphs.graphs.entries()) {
      const added = await first.call('addNode', { nodeType: 'KSampler', parameters: { steps: 20 }, inSubgraph: graph.definitionId }, `node${i}`);
      expect(added, JSON.stringify(added)).toMatchObject({ success: true }); ids.push(String(added.nodeId));
    }
    closeRun(db, P, first.run.runId);
    const second = assistant(db);
    const edited = await second.call('setParameter', { nodeId: ids[0], key: 'steps', value: 12, inSubgraph: graphs.graphs[0].definitionId }, 'edit-previous'); expect(edited, JSON.stringify(edited)).toMatchObject({ success: true });
    expect(await second.call('configureSubgraph', { definitionId: graphs.graphs[0].definitionId, name: 'Edited photo', widgets: [] }, 'rename')).toMatchObject({ success: true });
    const defs = readProjection(db, P)!.snapshot.subgraphs as any[];
    expect(defs[0].nodes[0].data.parameters.steps).toBe(12);
    expect(defs.slice(1).map(item => item.name)).toEqual(['Video', 'Prompt']);
    closeRun(db, P, second.run.runId);
    expect(manual(db, 'restore', { type: 'restore-revision', revisionId: before.currentRevisionId }).status).toBe('applied');
    expect(readProjection(db, P)!.snapshot.nodes).toEqual(before.snapshot.nodes);
    expect((readProjection(db, P)!.snapshot.subgraphs as any[]).map(item => item.name)).toEqual(['Old']);
  });

  it('does not overwrite a concurrent manual change and does not duplicate a retried graph set', async () => {
    const db = workspace(); const first = assistant(db);
    const args = { graphs: [{ name: 'Only once' }] };
    const made = await first.call('createGraphSet', args, 'same-call'); expect(made, JSON.stringify(made)).toMatchObject({ success: true });
    expect(await first.call('createGraphSet', args, 'same-call')).toMatchObject({ success: true });
    expect(readProjection(db, P)!.snapshot.nodes).toHaveLength(1);
    manual(db, 'concurrent', { type: 'add-node', nodeType: 'KSampler' });
    const before = readProjection(db, P)!;
    expect(await first.call('clearCanvas', {}, 'stale-clear')).toMatchObject({ success: false, conflict: true });
    expect(readProjection(db, P)!.currentRevisionId).toBe(before.currentRevisionId);
    expect(await first.call('createGraphSet', { graphs: [] }, 'empty')).toMatchObject({ success: false });
  });
});
