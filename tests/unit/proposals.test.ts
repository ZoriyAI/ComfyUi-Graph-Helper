import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { createProposal, listProposals, resolveProposal, setProposalsNotifier } from '../../src/main/proposals/repository';
import { engineHandlers } from '../../src/main/ipc/engineIpc';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import type { Proposal } from '../../src/shared/contracts/proposals';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function current(db: Database.Database) {
  return readProjection(db, DESKTOP_PROJECT_ID)!;
}

function manual(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: current(db).currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function propose(db: Database.Database, payload: Record<string, unknown>, note = 'because') {
  return createProposal(db, {
    projectId: DESKTOP_PROJECT_ID,
    runId: null,
    kind: payload.type as Proposal['kind'],
    payload: payload as Proposal['payload'],
    note,
  });
}

afterEach(() => setProposalsNotifier(null));

describe('proposals', () => {
  it('stores a ghost without touching the graph and pins it to the current revision', () => {
    const db = openDb();
    const before = current(db);
    const pushes: Array<[string, Proposal[]]> = [];
    setProposalsNotifier((projectId, open) => pushes.push([projectId, open]));
    const proposal = propose(db, { type: 'add-node', nodeType: 'KSampler', x: 10, y: 20 });
    expect(proposal).toMatchObject({ status: 'proposed', kind: 'add-node', revisionId: before.currentRevisionId, runId: null, resolvedAt: null, note: 'because' });
    expect(proposal.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(current(db).currentRevisionId).toBe(before.currentRevisionId);
    expect(current(db).snapshot.nodes).toHaveLength(0);
    expect(listProposals(db, DESKTOP_PROJECT_ID).map((item) => item.id)).toEqual([proposal.id]);
    expect(pushes).toEqual([[DESKTOP_PROJECT_ID, [proposal]]]);
    db.close();
  });

  it('refuses an invalid payload or a kind that does not match it', () => {
    const db = openDb();
    expect(() => propose(db, { type: 'add-node' })).toThrow('The proposal payload is not a graph change.');
    expect(() => createProposal(db, { projectId: DESKTOP_PROJECT_ID, runId: null, kind: 'connect', payload: { type: 'add-node', nodeType: 'X' }, note: '' })).toThrow(
      'The proposal kind does not match its payload.',
    );
    expect(() => createProposal(db, { projectId: 'missing', runId: null, kind: 'add-node', payload: { type: 'add-node', nodeType: 'X' }, note: '' })).toThrow('Project is not ready.');
    expect(listProposals(db, DESKTOP_PROJECT_ID)).toEqual([]);
    db.close();
  });

  it('accepts through commitCommand as a manual proposal action against the current revision', () => {
    const db = openDb();
    const proposal = propose(db, { type: 'add-node', nodeType: 'KSampler', title: 'Ghost' });
    // The graph moves on after the proposal was made; accepting still commits against the current revision.
    manual(db, 'human', { type: 'add-node', nodeType: 'VAEDecode' });
    const pushes: Proposal[][] = [];
    setProposalsNotifier((_projectId, open) => pushes.push(open));
    const resolution = resolveProposal(db, { projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'accept' });
    expect(resolution.command?.status).toBe('applied');
    expect(resolution.proposal).toMatchObject({ status: 'accepted' });
    expect(resolution.proposal.resolvedAt).not.toBeNull();
    const nodes = current(db).snapshot.nodes as Array<Record<string, any>>;
    expect(nodes.map((node) => node.data.title)).toEqual(['VAEDecode', 'Ghost']);
    expect(nodes[1].id).toBe(`node-proposal-${proposal.id}`);
    const audit = db.prepare('SELECT actor, run_id FROM applied_commands WHERE action_id = ?').get(`proposal-${proposal.id}`);
    expect(audit).toEqual({ actor: 'manual', run_id: null });
    expect(pushes).toEqual([[]]);
    // Resolving again is a no-op that returns the stored state.
    const again = resolveProposal(db, { projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'accept' });
    expect(again).toEqual({ proposal: resolution.proposal, command: null });
    db.close();
  });

  it('supersedes a ghost whose commit is refused and keeps the engine reason', () => {
    const db = openDb();
    manual(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    const proposal = propose(db, { type: 'connect', source: '1', target: '3', sourceHandle: 'out-0', targetHandle: 'in-1' }, 'wire it');
    const resolution = resolveProposal(db, { projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'accept' });
    expect(resolution.command?.status).toBe('rejected');
    expect(resolution.proposal.status).toBe('superseded');
    expect(resolution.proposal.note).toBe('wire it [superseded: Port types cannot be connected.]');
    expect(current(db).snapshot.edges).toHaveLength(1);
    db.close();
  });

  it('supersedes a ghost whose commit the engine turns away (action id already spent)', () => {
    const db = openDb();
    const proposal = propose(db, { type: 'add-node', nodeType: 'KSampler' });
    // Spend the proposal's action id with another payload, so the engine refuses the accept.
    commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: `proposal-${proposal.id}`,
      expectedRevisionId: current(db).currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'add-node', nodeType: 'Other' },
    });
    const resolution = resolveProposal(db, { projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'accept' });
    expect(['conflict', 'rejected']).toContain(resolution.command?.status);
    expect(resolution.proposal.status).toBe('superseded');
    expect(resolution.proposal.note).toMatch(/\[superseded: .+\]$/);
    db.close();
  });

  it('rejects without touching the graph', () => {
    const db = openDb();
    const before = current(db).currentRevisionId;
    const proposal = propose(db, { type: 'add-node', nodeType: 'KSampler' });
    const resolution = resolveProposal(db, { projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'reject' });
    expect(resolution).toMatchObject({ proposal: { status: 'rejected' }, command: null });
    expect(current(db).currentRevisionId).toBe(before);
    expect(() => resolveProposal(db, { projectId: 'other', proposalId: proposal.id, decision: 'reject' })).toThrow('Proposal was not found.');
    db.close();
  });

  it('supersedes open ghosts that point at a node a commit removed, and pushes the change', async () => {
    const db = openDb();
    manual(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    const onRemoved = propose(db, { type: 'set-parameter', nodeId: '3', key: 'x', value: 1 });
    const linked = propose(db, { type: 'connect', source: '1', target: '3', sourceHandle: 'out-2', targetHandle: 'in-1' });
    const unrelated = propose(db, { type: 'set-parameter', nodeId: '2', key: 'text', value: 'hi' });
    const pushes: Proposal[][] = [];
    setProposalsNotifier((_projectId, open) => pushes.push(open));
    expect(manual(db, 'rm', { type: 'remove-node', nodeId: '3' }).status).toBe('applied');
    const byId = new Map(listProposals(db, DESKTOP_PROJECT_ID).map((item) => [item.id, item]));
    expect(byId.get(onRemoved.id)!.status).toBe('superseded');
    expect(byId.get(onRemoved.id)!.note).toContain('node 3 was removed by remove-node');
    expect(byId.get(linked.id)!.status).toBe('superseded');
    expect(byId.get(unrelated.id)!.status).toBe('proposed');
    await Promise.resolve();
    expect(pushes.at(-1)!.map((item) => item.id)).toEqual([unrelated.id]);
    db.close();
  });

  it('serves list and resolve through validated engine handlers', () => {
    const db = openDb();
    const handlers = engineHandlers(() => db);
    const proposal = propose(db, { type: 'add-node', nodeType: 'KSampler' });
    expect(handlers.listProposals(DESKTOP_PROJECT_ID).map((item) => item.id)).toEqual([proposal.id]);
    expect(() => handlers.listProposals('')).toThrow('The request does not match the schema.');
    expect(() => handlers.resolveProposal({ projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'maybe' })).toThrow(
      'The request does not match the schema.',
    );
    expect(handlers.resolveProposal({ projectId: DESKTOP_PROJECT_ID, proposalId: proposal.id, decision: 'reject' }).proposal.status).toBe('rejected');
    db.close();
  });
});

describe('revision history', () => {
  it('lists revisions oldest first and loads any of them without moving the current pointer', () => {
    const db = openDb();
    const handlers = engineHandlers(() => db);
    manual(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    manual(db, 'sg', { type: 'create-subgraph', name: 'Text', nodeIds: ['2'], inputs: [], outputs: [] });
    const head = current(db);
    const list = handlers.listRevisions(DESKTOP_PROJECT_ID);
    expect(list.map((item) => [item.revSeq, item.description, item.source])).toEqual([
      [1, 'Initial', 'system'],
      [2, 'import-workflow', 'user'],
      [3, 'create-subgraph', 'user'],
    ]);
    expect(typeof list[0].timestamp).toBe('number');
    const middle = handlers.loadRevision({ projectId: DESKTOP_PROJECT_ID, revisionId: list[1].id })!;
    expect(middle.nodes).toHaveLength(3);
    expect(middle.subgraphs).toEqual([]);
    expect(middle.groups).toEqual([]);
    const last = handlers.loadRevision({ projectId: DESKTOP_PROJECT_ID, revisionId: list[2].id })!;
    expect(last).toEqual(head.snapshot);
    expect(last.subgraphs).toHaveLength(1);
    expect(handlers.loadRevision({ projectId: 'other', revisionId: list[2].id })).toBeNull();
    expect(() => handlers.loadRevision({ projectId: DESKTOP_PROJECT_ID })).toThrow('The request does not match the schema.');
    expect(current(db).currentRevisionId).toBe(head.currentRevisionId);
    db.close();
  });
});
