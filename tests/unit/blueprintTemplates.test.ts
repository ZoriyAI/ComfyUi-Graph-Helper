/** Bundled blueprints are real native graphs; insertion never replaces a person's graph or reuses a definition. */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { exportWorkflow, projectWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { BLUEPRINTS, blueprintFacts } from '../../src/shared/templates/catalog';

function fixture() {
  const db = new Database(':memory:'); migrate(db); ensureWorkspace(db); let seq = 0;
  const snap = () => readProjection(db, 'desktop')!.snapshot as GraphSnapshot;
  const commit = (payload: unknown) => commitCommand(db, { projectId: 'desktop', actionId: `blueprint-${++seq}`, expectedRevisionId: readProjection(db, 'desktop')!.currentRevisionId, actor: 'manual', runId: null, payload });
  return { db, snap, commit };
}
describe('native task blueprints', () => {
  it('inserts every bundled blueprint with native controls, links and settings preserved through export', () => {
    for (const entry of BLUEPRINTS) {
      const { db, snap, commit } = fixture();
      const before = snap(); const facts = blueprintFacts(entry); expect(facts.inputs.length + facts.outputs.length).toBeGreaterThan(0);
      const result = commit({ type: 'insert-blueprint', templateId: entry.id, x: 50, y: 60, name: entry.title.en, description: entry.description.en });
      expect(result.status, entry.id).toBe('applied');
      expect(snap().nodes.length, entry.id).toBe(before.nodes.length + 1);
      const outer = snap().nodes.at(-1)!; const rawOuter = entry.workflow.nodes[0];
      expect(outer.data.comfy.widgets_values, entry.id).toEqual(rawOuter.widgets_values);
      expect(outer.data.comfy.properties.proxyWidgets, entry.id).toEqual(rawOuter.properties.proxyWidgets);
      const native = exportWorkflow(snap(), '2026-11-16T00:00:00Z'); if (!native.ok) throw Error(native.error);
      const parsed = projectWorkflow(native.workflow); if ('error' in parsed) throw Error(parsed.error);
      const definition = parsed.snapshot.subgraphs!.find((item) => item.id === outer.data.subgraphId)!;
      expect(definition.nodes.length, entry.id).toBe(facts.definition.nodes.length);
      expect(definition.edges.length, entry.id).toBe(facts.definition.edges.length);
      expect(definition.nodes.map((node) => node.data.comfy.widgets_values), entry.id).toEqual(facts.definition.nodes.map((node) => node.data.comfy.widgets_values));
      db.close();
    }
  });
  it('keeps imported boundary and promoted controls when renamed and when another instance is added', () => {
    const { db, snap, commit } = fixture();
    const made = commit({ type: 'insert-blueprint', templateId: 'image_edit_qwen_2511', x: 0, y: 0 });
    const definitionId = (made.result as any).definitionId; const first = snap().nodes[0]; const controls = structuredClone(first.data.comfy.properties.proxyWidgets); const values = structuredClone(first.data.comfy.widgets_values);
    expect(commit({ type: 'configure-subgraph', definitionId, name: 'Renamed native blueprint', widgets: [] }).status).toBe('applied');
    expect(snap().nodes[0].data.comfy.properties.proxyWidgets).toEqual(controls); expect(snap().nodes[0].data.comfy.widgets_values).toEqual(values);
    expect(commit({ type: 'insert-subgraph', definitionId, x: 600, y: 0 }).status).toBe('applied');
    expect(snap().nodes[1].data.comfy.properties.proxyWidgets).toEqual(controls); expect(snap().nodes[1].data.comfy.widgets_values).toEqual(values); db.close();
  });
  it('makes independent copies including nested references, and inserts into the current inner namespace', () => {
    const { db, snap, commit } = fixture();
    const first = commit({ type: 'insert-blueprint', templateId: 'image_outpainting_qwen_image', name: 'First', x: 0, y: 0 });
    const firstId = (first.result as any).definitionId;
    const second = commit({ type: 'insert-blueprint', templateId: 'image_outpainting_qwen_image', name: 'Second', x: 500, y: 0, destinationDefinitionId: firstId });
    expect(second.status).toBe('applied'); const secondId = (second.result as any).definitionId;
    expect(firstId).not.toBe(secondId); expect(snap().nodes).toHaveLength(1);
    expect(snap().subgraphs!.find((d) => d.id === firstId)!.nodes.some((n) => n.data.subgraphId === secondId)).toBe(true);
    const ids = snap().subgraphs!.map((d) => d.id); expect(new Set(ids).size).toBe(ids.length);
    expect(snap().subgraphs!.every((d) => d.nodes.every((n) => !n.data.subgraphId || ids.includes(n.data.subgraphId)))).toBe(true); db.close();
  });
  it('refuses invalid ids, stale destinations and implicit legacy upgrades without changing the graph', () => {
    const { db, snap, commit } = fixture();
    const baseline = snap();
    expect(commit({ type: 'insert-blueprint', templateId: '../../bad', x: 0, y: 0 }).status).toBe('rejected'); expect(snap()).toEqual(baseline);
    expect(commit({ type: 'insert-blueprint', templateId: 'get_any_video_frame', destinationDefinitionId: 'gone', x: 0, y: 0 }).status).toBe('rejected'); expect(snap()).toEqual(baseline);
    commit({ type: 'import-workflow', document: { version: 0.4, last_node_id: 0, last_link_id: 0, nodes: [], links: [] } });
    expect(commit({ type: 'insert-blueprint', templateId: 'get_any_video_frame', x: 0, y: 0 }).status).toBe('rejected'); expect(snap().document!.formatVersion).toBe(0.4);
    expect(commit({ type: 'insert-blueprint', templateId: 'get_any_video_frame', x: 0, y: 0, upgradeToV1: true }).status).toBe('applied'); expect(snap().document!.formatVersion).toBe(1); db.close();
  });
});
