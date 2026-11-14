import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuildTools } from '../../../src/main/agent/buildTools';
import { commitCommand, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { listProposals } from '../../../src/main/proposals/store';
import { resolveProposal } from '../../../src/main/proposals/repository';
import { migrate } from '../../../src/main/settings/migrate';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

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
    expect(after.snapshot.nodes.map((node) => node.id)).toEqual(before.snapshot.nodes.map((node) => node.id));
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
});
