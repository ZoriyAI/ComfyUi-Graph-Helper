/**
 * Protects copy, paste, cut and delete of a selection on the canvas. Each is one revision (one undo step), pasted
 * nodes and links get fresh ids and a free place, a subgraph can never be pasted into itself even when its marks are
 * stripped, unknown native fields survive cut and paste, and a bad paste changes nothing. Pruning history keeps the
 * revision an open proposal was built on. A person can rearrange work freely without corrupting the file.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { createProposal } from '../../src/main/proposals/repository';
import { pruneHistory } from '../../src/main/commands/history';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { EMPTY_WORKFLOW } from '../../src/renderer/commands/actions';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function commit(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function snapshot(db: Database.Database): GraphSnapshot {
  return readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as GraphSnapshot;
}

function importDense(db: Database.Database): void {
  expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) }).status).toBe('applied');
}

/** Pastes nodes 1 and 2 of the dense fixture with the link between them, 32 px down and right. */
function pasteFirstPrompt(db: Database.Database, actionId: string) {
  const current = snapshot(db);
  return commit(db, actionId, {
    type: 'paste-selection',
    nodes: current.nodes.filter((node) => ['1', '2'].includes(String(node.id))),
    edges: current.edges.filter((edge) => String(edge.id) === 'link-1'),
    offsetX: 32,
    offsetY: 32,
  });
}

describe('selection commands', () => {
  it('starts a new project in format 1, so a subgraph works immediately', () => {
    const db = openDb();
    expect(commit(db, 'new', { type: 'import-workflow', document: EMPTY_WORKFLOW }).status).toBe('applied');
    expect(snapshot(db).document?.formatVersion).toBe(1);
    expect(commit(db, 'add', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' }).status).toBe('applied');
    expect(commit(db, 'sg', { type: 'create-subgraph', name: 'Block', nodeIds: ['1'], inputs: [], outputs: [] }).status).toBe('applied');
  });

  it('pastes nodes and their internal edge as one revision with fresh ids and a clean export', () => {
    const db = openDb();
    importDense(db);
    const before = readProjection(db, DESKTOP_PROJECT_ID)!.revSeq;
    const pasted = pasteFirstPrompt(db, 'paste');
    expect(pasted.status).toBe('applied');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before + 1);
    expect(pasted.result).toMatchObject({ nodeIds: ['13', '14'], edgeIds: ['link-7'], idMap: { 1: '13', 2: '14' } });

    const current = snapshot(db);
    expect(current.nodes).toHaveLength(14);
    expect(current.edges).toHaveLength(7);
    expect(current.nodes.find((node) => node.id === '13')?.data.title).toBe('Checkpoint A');
    expect(current.nodes.find((node) => node.id === '14')?.data.title).toBe('Positive');
    expect(current.edges.find((edge) => edge.id === 'link-7')).toMatchObject({ source: '13', target: '14' });

    const exported = exportWorkflow(current, '2026-11-15T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.workflow.state).toMatchObject({ lastNodeId: 14, lastLinkId: 7 });
    expect(exported.workflow.links).toContainEqual(expect.objectContaining({ id: 7, origin_id: 13, target_id: 14 }));
    // The exported workflow is plain JSON to the type system: read the two fields this test looks at.
    const nodes = exported.workflow.nodes as Array<{ id: number; inputs: Array<{ link: number | null }> }>;
    const prompt = nodes.find((node) => node.id === 14)!;
    expect(prompt.inputs[0].link).toBe(7);
  });

  it('finds another free place on repeated paste and keeps the relative arrangement', () => {
    const db = openDb();
    importDense(db);
    pasteFirstPrompt(db, 'paste-1');
    const first = snapshot(db).nodes.filter((node) => ['13', '14'].includes(String(node.id)));
    const second = pasteFirstPrompt(db, 'paste-2');
    expect(second.status).toBe('applied');
    expect(second.result).toMatchObject({ nodeIds: ['15', '16'], edgeIds: ['link-8'] });
    const added = snapshot(db).nodes.filter((node) => ['15', '16'].includes(String(node.id)));
    const occupied = new Set(snapshot(db).nodes.filter((node) => !['15', '16'].includes(String(node.id))).map((node) => `${node.position.x}:${node.position.y}`));
    for (const node of added) expect(occupied.has(`${node.position.x}:${node.position.y}`)).toBe(false);
    expect(added[0].position.x - added[1].position.x).toBe(first[0].position.x - first[1].position.x);
    expect(added[0].position.y - added[1].position.y).toBe(first[0].position.y - first[1].position.y);
  });

  it('removes a whole selection and every attached edge as one revision', () => {
    const db = openDb();
    importDense(db);
    const before = readProjection(db, DESKTOP_PROJECT_ID)!.revSeq;
    const removed = commit(db, 'remove', { type: 'remove-selection', nodeIds: ['1', '2'], edgeIds: [] });
    expect(removed.status).toBe('applied');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before + 1);
    expect(removed.result).toMatchObject({ nodeIds: ['1', '2'] });
    expect((removed.result as { edgeIds: string[] }).edgeIds).toHaveLength(5);
    expect(snapshot(db).nodes).toHaveLength(10);
    expect(snapshot(db).edges).toHaveLength(1);
    expect(snapshot(db).edges.map((edge) => edge.id)).toEqual(['link-5']);
  });

  it('pastes into a subgraph and refuses to nest a definition into itself', () => {
    const db = openDb();
    importDense(db);
    const source = snapshot(db);
    const clipboard = {
      nodes: source.nodes.filter((node) => ['1', '2'].includes(String(node.id))),
      edges: source.edges.filter((edge) => String(edge.id) === 'link-1'),
    };
    const created = commit(db, 'sg', { type: 'create-subgraph', name: 'Target', nodeIds: ['3', '4'], inputs: [], outputs: [] });
    const definitionId = (created.result as { definitionId: string }).definitionId;
    const pasted = commit(db, 'paste-inner', {
      type: 'edit-in-subgraph',
      definitionId,
      edit: { type: 'paste-selection', ...clipboard, offsetX: 32, offsetY: 32, destinationDefinitionId: definitionId },
    });
    expect(pasted.status).toBe('applied');
    expect(pasted.result).toMatchObject({ nodeIds: ['5', '6'] });
    expect((pasted.result as { edgeIds: string[] }).edgeIds).toHaveLength(1);
    const pastedEdgeId = (pasted.result as { edgeIds: string[] }).edgeIds[0];
    expect(pastedEdgeId).not.toBe('link-1');
    const definition = snapshot(db).subgraphs!.find((item) => item.id === definitionId)!;
    expect(definition.nodes).toHaveLength(4);
    expect(definition.edges.map((edge) => edge.id)).toContain(pastedEdgeId);
    expect(definition.edges.find((edge) => edge.id === pastedEdgeId)).toMatchObject({ source: '5', target: '6' });

    const instance = snapshot(db).nodes.find((node) => node.data.kind === 'subgraph-instance')!;
    const nested = commit(db, 'paste-recursive', {
      type: 'edit-in-subgraph',
      definitionId,
      edit: { type: 'paste-selection', nodes: [instance], edges: [], destinationDefinitionId: definitionId },
    });
    expect(nested.status).toBe('rejected');
  });

  it('keeps the revision an open proposal was made against while pruning history', () => {
    const db = openDb();
    importDense(db);
    const proposal = createProposal(db, {
      projectId: DESKTOP_PROJECT_ID,
      runId: null,
      kind: 'add-node',
      payload: { type: 'add-node', nodeType: 'CheckpointLoaderSimple' },
      note: 'Keep this base',
      revisionId: readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
    });
    expect(commit(db, 'later', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' }).status).toBe('applied');
    pruneHistory(db, DESKTOP_PROJECT_ID, { keep: 1, batch: 200 });
    expect(proposal.status).toBe('proposed');
    const ids = (db.prepare('SELECT id FROM graph_revisions ORDER BY rev_seq').all() as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toContain(proposal.revisionId);
  });
});

describe('native clipboard integration regressions', () => {
  it('duplicates nested instances with a real registry, independently allocated ids, and authoritative recursion guards', async () => {
    const { nestedSubgraphWorkflow, INNER_ID, OUTER_ID } = await import('../e2e/fixtures/nestedSubgraphWorkflow');
    const db = openDb();
    commit(db, 'nested', { type: 'import-workflow', document: nestedSubgraphWorkflow });
    const outer = snapshot(db).subgraphs!.find((d) => d.id === OUTER_ID)!;
    const nested = outer.nodes.find((node) => node.data.comfyType === INNER_ID)!;
    // The destination the caller names is ignored: the engine uses the definition the edit is in.
    const pasted = commit(db, 'duplicate-nested', { type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: {
      type: 'paste-selection', nodes: [nested], edges: [], destinationDefinitionId: 'untrusted-caller-value',
    } });
    expect(pasted.status).toBe('applied');
    expect(pasted.result).toMatchObject({ nodeIds: ['3'] });
    expect(snapshot(db).nodes.map((node) => node.id)).toEqual(['1', '2', '3']);
    const rootInsert = commit(db, 'root-inner', { type: 'insert-subgraph', definitionId: INNER_ID, x: 0, y: 0 });
    expect(rootInsert.status).toBe('applied');
    const rootInner = snapshot(db).nodes.find((node) => node.data.comfyType === INNER_ID)!;
    expect(commit(db, 'root-to-inner', { type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: { type: 'paste-selection', nodes: [rootInner], edges: [] } }).status).toBe('applied');
    const rootOuter = snapshot(db).nodes.find((node) => node.data.comfyType === OUTER_ID)!;
    const before = readProjection(db, DESKTOP_PROJECT_ID)!;
    // Pasting into INNER must be refused for INNER itself, for OUTER (which holds INNER), and for an INNER instance
    // whose instance marks were removed: the engine looks at the node type, not at what the caller says.
    const disguised = structuredClone(rootInner);
    delete disguised.data.kind;
    delete disguised.data.subgraphId;
    for (const [id, node] of [['direct', rootInner], ['indirect', rootOuter], ['disguised', disguised]] as const) {
      const refused = commit(db, id, { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'paste-selection', nodes: [node], edges: [], destinationDefinitionId: 'wrong' } });
      expect(refused.status).toBe('rejected');
      expect(refused.result).toMatchObject({ error: 'A subgraph cannot contain itself.' });
    }
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before.revSeq);
  });

  it.each([1, 0.4])('preserves native link and node extensions through cut/paste, native save and format %s export', async (version) => {
    const { nativeProjectFile, openNativeFile } = await import('../../src/main/ipc/projectFile');
    const db = openDb();
    const document = structuredClone(denseWorkflow) as Record<string, any>;
    document.version = version;
    document.nodes[0].vendor_node = { keep: ['nested', 7] };
    if (version === 0.4) document.links = document.links.map((link: any) => [link.id, link.origin_id, link.origin_slot, link.target_id, link.target_slot, link.type, { vendor: 'tuple-tail' }]);
    else document.links[0].vendor_metadata = { keep: ['native-link', 9] };
    commit(db, 'import-native', { type: 'import-workflow', document });
    const old = snapshot(db);
    const nodes = old.nodes.filter((node) => ['1', '2'].includes(String(node.id)));
    const edges = old.edges.filter((edge) => edge.id === 'link-1');
    edges[0].vendor_edge = { keep: true };
    edges[0].data.vendor_data = ['edge-extension'];
    commit(db, 'cut-native', { type: 'remove-selection', nodeIds: ['1', '2'], edgeIds: [] });
    expect(commit(db, 'paste-native', { type: 'paste-selection', nodes, edges }).status).toBe('applied');
    const pasted = snapshot(db).edges.at(-1)!;
    expect(pasted.vendor_edge).toEqual({ keep: true });
    expect(pasted.data.vendor_data).toEqual(['edge-extension']);
    const saved = nativeProjectFile(db, DESKTOP_PROJECT_ID);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(openNativeFile(db, DESKTOP_PROJECT_ID, saved.project).status).toBe('applied');
    const exported = exportWorkflow(snapshot(db), '2026-11-15');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    // A link is an object in a version 1 workflow and a tuple in version 0.4; a node is plain JSON.
    const link = (exported.workflow.links as unknown[]).at(-1) as Record<string | number, unknown>;
    expect(version === 1 ? link.vendor_metadata : link[6]).toEqual(version === 1 ? { keep: ['native-link', 9] } : { vendor: 'tuple-tail' });
    expect((exported.workflow.nodes as Array<{ vendor_node?: unknown }>).find((node) => node.vendor_node)?.vendor_node).toEqual({ keep: ['nested', 7] });
  });

  it.each(['out-99', 'in-0'])('rejects invalid source handle %s atomically', (handle) => {
    const db = openDb();
    importDense(db);
    const old = snapshot(db);
    const before = readProjection(db, DESKTOP_PROJECT_ID)!.revSeq;
    const result = commit(db, 'bad-paste', { type: 'paste-selection', nodes: old.nodes.filter((node) => ['1', '2'].includes(node.id)), edges: [{ ...old.edges[0], sourceHandle: handle }] });
    expect(result.status).toBe('rejected');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before);
  });
});
