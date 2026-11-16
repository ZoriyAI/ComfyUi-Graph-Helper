import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

function setup(workflow: Record<string, any> = structuredClone(nestedSubgraphWorkflow)) {
  const db = new Database(':memory:'); migrate(db); ensureWorkspace(db);
  const head = () => readProjection(db, 'desktop')!;
  const snap = () => head().snapshot as GraphSnapshot;
  let serial = 0;
  const commit = (payload: Record<string, unknown>) => {
    const response = commitCommand(db, { projectId: 'desktop', actionId: `nested-${serial++}`, expectedRevisionId: head().currentRevisionId, actor: 'manual', runId: null, payload });
    return { ...response, result: response.result as Record<string, unknown> };
  };
  const edit = (edit: Record<string, unknown>) => commit({ type: 'edit-in-subgraph', definitionId: OUTER_ID, edit });
  const definition = (id = OUTER_ID) => snap().subgraphs!.find((item) => item.id === id)!;
  const exported = () => { const result = exportWorkflow(snap(), '2026-11-16T00:00:00Z'); if (!result.ok) throw Error(result.error); return result.workflow as Record<string, any>; };
  expect(commit({ type: 'import-workflow', document: workflow }).status).toBe('applied');
  return { db, head, snap, commit, edit, definition, exported };
}

function withControls(): Record<string, any> {
  const file: Record<string, any> = structuredClone(nestedSubgraphWorkflow);
  const [outer, inner] = file.definitions.subgraphs;
  const extra = structuredClone(inner.nodes[0]); extra.id = 2; extra.pos = [500, 0]; extra.widgets = [{ name: 'text' }];
  inner.nodes.push(extra); inner.state.lastNodeId = 2;
  inner.groups = [{ id: 1, title: 'Text stage', bounding: [-20, -100, 850, 300], color: '#123456', vendor: { keep: true } }];
  outer.nodes[0].properties.proxyWidgets = [['2', 'text']]; outer.nodes[0].widgets_values = ['nested default'];
  outer.widgets = [{ id: '1', name: '2::text', vendor: 'control' }]; outer.state.lastGroupId = 5;
  outer.links[0].vendor = 'outer input'; inner.links[1].vendor = 'inner output';
  file.nodes[1].properties.proxyWidgets = [['1', '2::text']]; file.nodes[1].widgets_values = ['first override'];
  const second = structuredClone(file.nodes[1]); second.id = 4; second.widgets_values = ['second override']; file.nodes.push(second);
  return file;
}

describe('nested graph construction', () => {
  it('edits inner groups independently and keeps native fields, member changes and monotonic undo counters', () => {
    const file: Record<string, any> = structuredClone(nestedSubgraphWorkflow);
    file.definitions.subgraphs[0].groups = [{ id: 1, title: 'Inner frame', bounding: [-20, -90, 600, 250], vendor: { retain: 1 } }];
    const c = setup(file);
    try {
      const root = structuredClone({ nodes: c.snap().nodes, groups: c.snap().groups });
      expect(c.edit({ type: 'rename-group', groupId: '1', title: 'Prompt preparation' }).status).toBe('applied');
      expect(c.edit({ type: 'set-group-color', groupId: '1', color: 'purple' }).status).toBe('applied');
      expect(c.edit({ type: 'set-group-members', groupId: '1', add: [], remove: ['2'] }).status).toBe('applied');
      expect(c.definition().groups![0].nodeIds).toEqual(['1']);
      expect(c.edit({ type: 'move-node', nodeId: '1', x: 130, y: 240 }).status).toBe('applied');
      const before = c.head().currentRevisionId;
      const added = c.edit({ type: 'add-group', title: 'Second', nodeIds: ['2'] });
      expect(added.status).toBe('applied'); const firstId = Number(added.result.groupId);
      expect(c.commit({ type: 'restore-revision', revisionId: before }).status).toBe('applied');
      const again = c.edit({ type: 'add-group', title: 'After undo', nodeIds: ['2'] });
      expect(again.status).toBe('applied'); expect(Number(again.result.groupId)).toBeGreaterThan(firstId);
      const out = c.exported(); const inner = out.definitions.subgraphs[0];
      expect(inner.groups[0]).toMatchObject({ title: 'Prompt preparation', vendor: { retain: 1 } });
      expect(inner.state.lastGroupId).toBe(Number(again.result.groupId));
      expect({ nodes: c.snap().nodes, groups: c.snap().groups }).toEqual(root);
      const reopened = setup(out); try { expect(reopened.exported().definitions).toEqual(out.definitions); } finally { reopened.db.close(); }
      expect(c.edit({ type: 'remove-group', groupId: '1' }).status).toBe('applied');
      expect(c.definition().groups!.some((group) => group.id === '1')).toBe(false);
      expect(c.snap().groups![0].id).toBe('1');
    } finally { c.db.close(); }
  });

  it('unpacks inner nodes, frames and boundary links, retargets outer controls and retains independent overrides', () => {
    const c = setup(withControls());
    try {
      const rootEdges = structuredClone(c.snap().edges); const before = c.head().currentRevisionId;
      const result = c.edit({ type: 'dissolve-subgraph', nodeId: '1' });
      expect(result.status).toBe('applied'); expect(result.result.definitionRemoved).toBe(true);
      const outer = c.definition();
      expect(outer.nodes.map((node) => node.id)).toEqual(['2', '1', '3']);
      expect(outer.nodes.find((node) => node.id === '3')!.data.comfy.widgets_values).toEqual(['nested default']);
      expect(outer.groups![0]).toMatchObject({ id: '6', nodeIds: ['1', '3'], raw: { vendor: { keep: true } } });
      expect(outer.raw.widgets).toEqual([{ id: '3', name: 'text', vendor: 'control' }]);
      expect(outer.edges.some((edge) => edge.source === '-10' && edge.target === '1' && edge.data.comfyLink.vendor === 'outer input')).toBe(true);
      expect(outer.edges.some((edge) => edge.source === '1' && edge.target === '2' && edge.data.comfyLink.vendor === 'inner output')).toBe(true);
      const instances = c.snap().nodes.filter((node) => node.data.comfyType === OUTER_ID);
      expect(instances.map((node) => node.data.comfy.properties.proxyWidgets)).toEqual([[['3', 'text']], [['3', 'text']]]);
      expect(instances.map((node) => node.data.comfy.widgets_values)).toEqual([['first override'], ['second override']]);
      expect(outer.instanceDefaults!.properties).toMatchObject({ proxyWidgets: [['3', 'text']] });
      expect(c.snap().edges).toEqual(rootEdges);
      const out = c.exported(); const reopened = setup(out);
      try { expect(reopened.exported().definitions).toEqual(out.definitions); } finally { reopened.db.close(); }
      expect(c.commit({ type: 'restore-revision', revisionId: before }).status).toBe('applied');
      expect(c.definition().nodes[0].data.comfyType).toBe(INNER_ID);
      expect(c.snap().nodes[1].data.comfy.widgets_values).toEqual(['first override']);
      expect(c.snap().nodes[1].data.comfy.properties.proxyWidgets).toEqual([['1', '2::text']]);
    } finally { c.db.close(); }
  });

  it('retains a shared definition still used at the root and promotes its values when its parent is unpacked', () => {
    const file = withControls(); const shared = structuredClone(file.definitions.subgraphs[0].nodes[0]); shared.id = 5; file.nodes.push(shared);
    const c = setup(file);
    try {
      expect(c.edit({ type: 'dissolve-subgraph', nodeId: '1' })).toMatchObject({ status: 'applied', result: { definitionRemoved: false } });
      expect(c.definition(INNER_ID)).toBeDefined();
      const result = c.commit({ type: 'dissolve-subgraph', nodeId: '2' });
      expect(result.status).toBe('applied');
      expect(c.snap().nodes.some((node) => node.data.comfyType === 'CLIPTextEncode' && node.data.comfy.widgets_values[0] === 'first override')).toBe(true);
      expect(c.snap().nodes.find((node) => node.id === '4')!.data.comfy.widgets_values).toEqual(['second override']);
    } finally { c.db.close(); }
  });

  it('propagates promoted control names through a third level without losing its value', () => {
    const file = withControls(); const outer = file.definitions.subgraphs[0];
    const parent = structuredClone(outer); parent.id = 'parent'; parent.name = 'Parent'; parent.nodes = [structuredClone(file.nodes[1])];
    parent.nodes[0].id = 10; parent.widgets = [{ id: '10', name: '1::2::text' }]; parent.links = []; parent.inputs = []; parent.outputs = [];
    const root = structuredClone(file.nodes[1]); root.id = 6; root.type = parent.id; root.properties.proxyWidgets = [['10', '1::2::text']]; root.widgets_values = ['third level']; file.nodes.push(root); file.definitions.subgraphs.push(parent);
    const c = setup(file);
    try {
      expect(c.edit({ type: 'dissolve-subgraph', nodeId: '1' }).status).toBe('applied');
      expect(c.definition('parent').raw.widgets).toEqual([{ id: '10', name: '3::text' }]);
      expect(c.snap().nodes.find((node) => node.id === '6')!.data.comfy).toMatchObject({ properties: { proxyWidgets: [['10', '3::text']] }, widgets_values: ['third level'] });
    } finally { c.db.close(); }
  });

  it('refuses an ambiguous promoted source atomically', () => {
    const file = withControls(); file.nodes[1].properties.proxyWidgets = [['1', 'unknown-field']];
    const c = setup(file);
    try {
      const before = c.head().currentRevisionId; const snapshot = structuredClone(c.snap());
      expect(c.edit({ type: 'dissolve-subgraph', nodeId: '1' }).status).toBe('rejected');
      expect(c.head().currentRevisionId).toBe(before); expect(c.snap()).toEqual(snapshot);
    } finally { c.db.close(); }
  });

  it('carries whole selected group frames into a new nested definition and restores them when unpacked', () => {
    const c = setup();
    try {
      expect(c.edit({ type: 'add-group', nodeIds: ['1', '2'], title: 'Both stages', color: '#123456' }).status).toBe('applied');
      const created = c.edit({ type: 'create-subgraph', nodeIds: ['1', '2'], name: 'Nested stages' });
      expect(created.status).toBe('applied'); expect(c.definition().groups).toEqual([]);
      const added = c.definition(String(created.result.definitionId)); expect(added.groups![0].title).toBe('Both stages');
      expect(c.edit({ type: 'dissolve-subgraph', nodeId: created.result.nodeId }).status).toBe('applied');
      expect(c.definition().groups![0]).toMatchObject({ title: 'Both stages', color: '#123456', nodeIds: ['1', '2'] });
    } finally { c.db.close(); }
  });

  it('keeps existing outer controls when wrapping their source into another nested subgraph and unpacking again', () => {
    const c = setup(withControls());
    try {
      const created = c.edit({ type: 'create-subgraph', nodeIds: ['1'], name: 'Wrapped encode' });
      expect(created.status).toBe('applied');
      const instanceId = String(created.result.nodeId);
      expect(c.definition().raw.widgets).toEqual([{ id: instanceId, name: '1::2::text', vendor: 'control' }]);
      expect(c.snap().nodes[1].data.comfy).toMatchObject({ properties: { proxyWidgets: [[instanceId, '1::2::text']] }, widgets_values: ['first override'] });
      expect(c.edit({ type: 'dissolve-subgraph', nodeId: instanceId }).status).toBe('applied');
      expect(c.definition().raw.widgets).toEqual([{ id: '1', name: '2::text', vendor: 'control' }]);
      expect(c.snap().nodes[1].data.comfy).toMatchObject({ properties: { proxyWidgets: [['1', '2::text']] }, widgets_values: ['first override'] });
    } finally { c.db.close(); }
  });

  it('scopes stale group and dissolve ids to the shown definition instead of falling back to root', async () => {
    const { scopedToLevel } = await import('../../src/renderer/components/graph/commit');
    const { useGraphStore } = await import('../../src/renderer/state/graphState');
    const c = setup(); const previous = useGraphStore.getState();
    try {
      useGraphStore.setState({ subgraphs: c.snap().subgraphs, activeSubgraphId: OUTER_ID });
      for (const edit of [{ type: 'remove-group' as const, groupId: 'missing' }, { type: 'rename-group' as const, groupId: '1', title: 'Inner' }, { type: 'dissolve-subgraph' as const, nodeId: 'missing' }]) {
        expect(scopedToLevel(edit)).toEqual({ type: 'edit-in-subgraph', definitionId: OUTER_ID, edit });
      }
    } finally { useGraphStore.setState(previous); c.db.close(); }
  });
});
