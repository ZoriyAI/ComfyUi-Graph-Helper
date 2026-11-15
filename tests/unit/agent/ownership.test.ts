/**
 * Protects the person's own work from an assistant build: removing, renaming, documenting, retuning or rewiring
 * anything the person made becomes a grey draft they accept or decline, while the assistant's own nodes change
 * directly. A person who asks for help must never find their graph changed behind their back.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuildTools } from '../../../src/main/agent/buildTools';
import { commitCommand, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { listProposals } from '../../../src/main/proposals/store';
import { resolveProposal } from '../../../src/main/proposals/repository';
import { migrate } from '../../../src/main/settings/migrate';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

/** Commits a change as the person, on top of the current revision. */
const manual = (db: Database.Database, actionId: string, payload: Record<string, unknown>) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual', runId: null, payload: payload as never,
});

describe('a build changes only what it placed itself (P0)', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('turns every change to the person\'s work into a grey draft and applies its own', async () => {
    const db = openDb();
    // The person's graph: a loader, a sampler, a link between them, a name for the project.
    manual(db, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
    manual(db, 'b', { type: 'add-node', nodeType: 'KSampler', x: 500, y: 0 });
    manual(db, 'c', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' });
    manual(db, 'd', { type: 'set-process', title: 'My portrait', notes: '' });
    const before = readProjection(db, P)!;
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });

    const removed = await tools.removeNode.execute({ nodeId: '2', why: 'Not needed.' }, { toolCallId: 'r' }) as Record<string, unknown>;
    expect(removed).toMatchObject({ success: true, drafted: true, kind: 'remove-node' });
    const renamed = await tools.setProcess.execute({ title: 'Overwritten', notes: '' }, { toolCallId: 'p' }) as Record<string, unknown>;
    expect(renamed).toMatchObject({ drafted: true, kind: 'set-process' });
    const described = await tools.setComponentDocumentation.execute({ ownerKind: 'node', ownerId: '1', purpose: 'x', usage: 'y' }, { toolCallId: 'd' }) as Record<string, unknown>;
    expect(described).toMatchObject({ drafted: true, kind: 'set-component' });
    const field = await tools.setParameter.execute({ nodeId: '2', key: 'steps', value: 12, widgetIndex: 2 }, { toolCallId: 's' }) as Record<string, unknown>;
    expect(field).toMatchObject({ drafted: true, kind: 'set-parameter' });

    // Its own node: added, linked from the person's output (that changes nothing of theirs), then removed.
    const mine = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'm' }) as Record<string, unknown>;
    expect(mine.success).toBe(true);
    const fromPerson = await tools.connectNodes.execute({ sourceNodeId: '1', sourceHandle: 'out-0', targetNodeId: mine.nodeId, targetHandle: 'in-0' }, { toolCallId: 'l' }) as Record<string, unknown>;
    expect(fromPerson).toMatchObject({ success: true });
    expect(fromPerson.drafted).toBeUndefined();
    // A link into the person's node rewires it: a draft.
    const intoPerson = await tools.connectNodes.execute({ sourceNodeId: '1', sourceHandle: 'out-0', targetNodeId: '2', targetHandle: 'in-0' }, { toolCallId: 'x' }) as Record<string, unknown>;
    expect(intoPerson).toMatchObject({ drafted: true, kind: 'connect' });
    const gone = await tools.removeNode.execute({ nodeId: mine.nodeId }, { toolCallId: 'g' }) as Record<string, unknown>;
    expect(gone).toMatchObject({ success: true });
    expect(gone.drafted).toBeUndefined();

    // The person's graph is exactly as it was; the drafts wait for them.
    const after = readProjection(db, P)!;
    // Projection snapshots hold nodes as unknown: read only their ids.
    const ids = (nodes: unknown[]) => nodes.map((node) => (node as { id: string }).id);
    expect(ids(after.snapshot.nodes)).toEqual(ids(before.snapshot.nodes));
    expect(after.snapshot.edges).toHaveLength(1);
    expect((after.snapshot.process as { title: string }).title).toBe('My portrait');
    const drafts = listProposals(db, P, 'proposed');
    expect(drafts.map((draft) => draft.kind).sort()).toEqual(['connect', 'remove-node', 'set-component', 'set-parameter', 'set-process']);
    // Accepting one applies it as the person's own step.
    const name = drafts.find((draft) => draft.kind === 'set-process')!;
    expect(resolveProposal(db, { projectId: P, proposalId: name.id, decision: 'accept' }).command?.status).toBe('applied');
    expect((readProjection(db, P)!.snapshot.process as { title: string }).title).toBe('Overwritten');
  });

  it('may name a graph that has no name yet', async () => {
    const db = openDb();
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId } });
    const named = await tools.setProcess.execute({ title: 'Text to image', notes: '' }, { toolCallId: 'n' }) as Record<string, unknown>;
    expect(named).toMatchObject({ success: true });
    expect(named.drafted).toBeUndefined();
  });

  it('constructs and configures its own nested graphs without acquiring the person\'s definitions or root ids', async () => {
    const db = openDb();
    const before = manual(db, 'user-subgraph', { type: 'create-subgraph', name: 'Mine', nodeIds: [] });
    const personId = (before.result as { definitionId: string }).definitionId;
    const run = startRun(db, P);
    const tools = createBuildTools(BUILD_TOOL_SPECS, { db, run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId }, toolContext: () => ({ snapshot: readProjection(db, P)!.snapshot as never }) });
    const denied = await tools.configureSubgraph.execute({ definitionId: personId, name: 'Overwritten', widgets: [] }, { toolCallId: 'deny' });
    expect(denied).toMatchObject({ success: false });
    const made = await tools.createSubgraph.execute({ name: 'Agent outer', nodeIds: [] }, { toolCallId: 'outer' }) as { success: boolean; definitionId: string };
    expect(made.success).toBe(true);
    const nested = await tools.createSubgraph.execute({ name: 'Agent inner', nodeIds: [], inSubgraph: made.definitionId }, { toolCallId: 'inner' }) as { success: boolean; definitionId: string };
    expect(nested.success).toBe(true);
    const innerNode = await tools.addNode.execute({ nodeType: 'KSampler', inSubgraph: nested.definitionId }, { toolCallId: 'add' }) as { success: boolean; outputs: Array<{ name: string }> };
    expect(innerNode.success).toBe(true);
    expect(innerNode.outputs.some((port) => port.name === 'LATENT')).toBe(true);
    expect(await tools.configureSubgraph.execute({ definitionId: nested.definitionId, name: 'Named inner', widgets: [] }, { toolCallId: 'configure' })).toMatchObject({ success: true });
    expect(await tools.addNode.execute({ nodeType: 'KSampler', inSubgraph: personId }, { toolCallId: 'deny-inner' })).toMatchObject({ success: false });
    const definitions = readProjection(db, P)!.snapshot.subgraphs as Array<{ id: string; name: string; nodes: unknown[] }>;
    expect(definitions.find((item) => item.id === personId)).toMatchObject({ name: 'Mine', nodes: [] });
    expect(definitions.find((item) => item.id === nested.definitionId)).toMatchObject({ name: 'Named inner' });
    expect(definitions.find((item) => item.id === nested.definitionId)!.nodes).toHaveLength(1);
    db.close();
  });
});
