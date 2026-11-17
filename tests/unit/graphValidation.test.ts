/**
 * Graph validation in main: the commit refuses a self-link or a new cycle, and checkGraph (main/knowledge/check.ts,
 * behind the Check panel's knowledge:check-graph IPC and the assistant's checkGraph tool) reports imported cycles,
 * broken links, values out of range or not in a list, and wrong types, also inside subgraphs. A person sees these
 * findings before ComfyUI refuses the queue, so a false alarm or a missed problem both cost them a run.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/check';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';

/** A trimmed object_info of three core classes, enough for ranges, combos and an upload field. */
const CORE = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['base.safetensors']] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    python_module: 'nodes',
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffff, control_after_generate: true }],
        steps: ['INT', { default: 20, min: 1 }],
        cfg: ['FLOAT', { default: 8.0, step: 0.1 }],
        sampler_name: [['euler', 'dpmpp_2m']],
        scheduler: ['COMBO', { options: ['normal', 'karras'], default: 'karras' }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        denoise: ['FLOAT', { default: 1.0 }],
      },
    },
    input_order: { required: ['model', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'positive', 'negative', 'latent_image', 'denoise'] },
    output: ['LATENT'],
    python_module: 'nodes',
  },
  LoadImage: {
    input: { required: { image: [['example.png', 'portrait.jpg'], { image_upload: true }] } },
    input_order: { required: ['image'] },
    output: ['IMAGE', 'MASK'],
    python_module: 'nodes',
  },
};

function openDb(withCore = false): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  if (withCore) upsertObjectInfo(db, parseObjectInfo(CORE));
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

function reroute(id: number, links: { input?: number | null; output?: number[] }) {
  return {
    id,
    type: 'Reroute',
    pos: [id * 100, 0],
    size: [100, 60],
    flags: {},
    order: id,
    mode: 0,
    properties: {},
    inputs: [{ name: 'in', type: '*', link: links.input ?? null }],
    outputs: [{ name: 'out', type: '*', links: links.output ?? [] }],
  };
}

/**
 * Two Reroutes linked 1 to 2. Cyclic adds a link back from 2 to 1 and a link to node 99, which does not exist, so the
 * import carries both a cycle and a broken link.
 */
function rerouteWorkflow(cyclic: boolean) {
  const links: Array<Record<string, unknown>> = [
    { id: 1, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: '*' },
  ];
  if (cyclic) {
    links.push(
      { id: 2, origin_id: 2, origin_slot: 0, target_id: 1, target_slot: 0, type: '*' },
      { id: 3, origin_id: 1, origin_slot: 0, target_id: 99, target_slot: 0, type: '*' },
    );
  }
  return {
    version: 1,
    state: { lastNodeId: 2, lastLinkId: links.length },
    nodes: [reroute(1, { input: cyclic ? 2 : null, output: [1] }), reroute(2, { input: 1, output: cyclic ? [2] : [] })],
    links,
  };
}

describe('graph validation', () => {
  it('rejects self-links and new cycles without writing a revision', () => {
    const db = openDb();
    expect(commit(db, 'import', { type: 'import-workflow', document: rerouteWorkflow(false) }).status).toBe('applied');
    const before = readProjection(db, DESKTOP_PROJECT_ID)!.revSeq;
    expect(commit(db, 'self', { type: 'connect', source: '1', target: '1', sourceHandle: 'out-0', targetHandle: 'in-0' }).status).toBe('rejected');
    expect(commit(db, 'cycle', { type: 'connect', source: '2', target: '1', sourceHandle: 'out-0', targetHandle: 'in-0' }).status).toBe('rejected');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before);
  });

  it('reports imported cycles and broken links', () => {
    const db = openDb();
    expect(commit(db, 'import', { type: 'import-workflow', document: rerouteWorkflow(true) }).status).toBe('applied');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.ok).toBe(false);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles?.[0]?.nodeIds).toEqual(expect.arrayContaining(['1', '2']));
    expect(report.brokenEdges).toEqual([{ edgeId: 'link-3', source: '1', target: '99' }]);
  });

  it('checks numeric ranges and combo choices against object_info', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: withSamplerValues(-1, 'not-a-sampler') }).status).toBe('applied');
    // Explicit edits reject invalid numeric values; imported workflows still need diagnostic findings.
    expect(commit(db, 'steps', { type: 'set-parameter', nodeId: '4', key: 'steps', value: -2 }).status).toBe('rejected');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.valuesOutOfRange).toContainEqual(expect.objectContaining({ nodeId: '4', input: 'steps', value: -1, min: 1 }));
    expect(report.valuesNotInList).toContainEqual(expect.objectContaining({ nodeId: '4', input: 'sampler_name', value: 'not-a-sampler' }));
    expect(report.invalidParameters).toEqual([]);
    expect(report.ok).toBe(false);
  });

  it('allows a newly uploaded file that is not in the previous catalog listing', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) }).status).toBe('applied');
    expect(commit(db, 'upload', { type: 'add-node', nodeType: 'LoadImage', parameters: { image: 'new-upload.png' } }).status).toBe('applied');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.invalidParameters ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'image' }),
    ]));
  });

  it('applies the same parameter checks inside a subgraph', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: withSamplerValues(-1) }).status).toBe('applied');
    const created = commit(db, 'sg', { type: 'create-subgraph', name: 'Sampler block', nodeIds: ['4'], inputs: [], outputs: [] });
    expect(created.status).toBe('applied');
    const definitionId = (created.result as { definitionId: string }).definitionId;
    expect(commit(db, 'inner', {
      type: 'edit-in-subgraph',
      definitionId,
      edit: { type: 'set-parameter', nodeId: '4', key: 'steps', value: -2 },
    }).status).toBe('rejected');
    expect(checkGraph(db, DESKTOP_PROJECT_ID).valuesOutOfRange).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: '4', input: 'steps', value: -1, subgraphId: definitionId }),
    ]));
  });
});

describe('integrated graph-check regressions', () => {
  it('reports nonexistent handles and root pseudo-boundary endpoints', () => {
    const db = openDb();
    const workflow = rerouteWorkflow(false);
    workflow.links[0].origin_slot = 99;
    workflow.links[0].target_slot = 99;
    // Node -10 is the root graph's pseudo input boundary, which only a subgraph definition may link from.
    workflow.links.push({ id: 2, origin_id: -10, origin_slot: 0, target_id: 1, target_slot: 0, type: '*' });
    commit(db, 'bad-handles', { type: 'import-workflow', document: workflow });
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.ok).toBe(false);
    expect(report.brokenEdges?.map((edge) => edge.edgeId)).toEqual(['link-1', 'link-2']);
  });

  it('validates definition boundaries in their real slots without blessing invalid slots', async () => {
    const { nestedSubgraphWorkflow, OUTER_ID } = await import('../e2e/fixtures/nestedSubgraphWorkflow');
    const db = openDb();
    const workflow = structuredClone(nestedSubgraphWorkflow);
    commit(db, 'valid-boundaries', { type: 'import-workflow', document: workflow });
    expect(checkGraph(db, DESKTOP_PROJECT_ID).brokenEdges).toEqual([]);
    workflow.definitions.subgraphs[0].links[0].origin_slot = 99;
    commit(db, 'bad-boundaries', { type: 'import-workflow', document: workflow });
    expect(checkGraph(db, DESKTOP_PROJECT_ID).brokenEdges).toEqual([expect.objectContaining({ subgraphId: OUTER_ID, edgeId: 'link-1' })]);
  });

  it('ignores connected numeric/combo widgets but validates the same stale values when disconnected', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo({ ValueNode: { input: { required: { amount: ['FLOAT', { default: 1, min: 0, max: 10 }], choice: [['a', 'b']] } }, input_order: { required: ['amount', 'choice'] }, output: ['FLOAT', 'COMBO'] } }));
    commit(db, 'a', { type: 'add-node', nodeType: 'ValueNode' });
    commit(db, 'b', { type: 'add-node', nodeType: 'ValueNode' });
    const exported = exportWorkflow(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as GraphSnapshot, '2026-11-17');
    if (!exported.ok) throw Error(exported.error);
    const imported = exported.workflow.nodes as Array<{ id: number; widgets_values: unknown[] }>;
    imported.find(node => String(node.id) === '2')!.widgets_values = [-100, 'missing'];
    expect(commit(db, 'stale-values', { type: 'import-workflow', document: exported.workflow }).status).toBe('applied');
    expect(commit(db, 'link-a', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' }).status).toBe('applied');
    expect(commit(db, 'link-b', { type: 'connect', source: '1', sourceHandle: 'out-1', target: '2', targetHandle: 'in-1' }).status).toBe('applied');
    const linked = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(linked.invalidParameters).toEqual([]);
    expect(linked.valuesOutOfRange).toEqual([]);
    expect(linked.valuesNotInList).toEqual([]);
    const edges = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges;
    commit(db, 'unlink', { type: 'batch', label: 'delete', edits: edges.map((edge) => ({ type: 'remove-edge', edgeId: (edge as { id: string }).id })) });
    const unlinked = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(unlinked.valuesOutOfRange).toHaveLength(1);
    expect(unlinked.valuesNotInList).toHaveLength(1);
    expect(unlinked.invalidParameters).toEqual([]);
  });

  it('reports imported type errors without duplicating range findings and rejects invalid explicit edits', () => {
    const db = openDb(true);
    commit(db, 'import', { type: 'import-workflow', document: withSamplerValues('twenty') });
    expect(commit(db, 'bad-type', { type: 'set-parameter', nodeId: '4', key: 'steps', value: 'thirty' }).status).toBe('rejected');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.invalidParameters).toContainEqual(expect.objectContaining({ nodeId: '4', name: 'steps', reason: 'type' }));
    expect(report.valuesOutOfRange?.filter((item) => item.nodeId === '4' && item.input === 'steps')).toEqual([]);
  });
});

/** Invalid values may arrive in an external file even though the editor refuses to create them. */
function withSamplerValues(steps: unknown, sampler = 'euler') {
  return { ...structuredClone(denseWorkflow), nodes: denseWorkflow.nodes.map(node => node.id === 4
    ? { ...node, widgets_values: [0, 'fixed', steps, 8, sampler, 'karras', 1] } : structuredClone(node)) };
}
