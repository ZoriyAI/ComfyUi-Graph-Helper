import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { cachedCatalog, commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { mutationFromTool } from '../../src/shared/commands/tools';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';

const databases: Database.Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function setup() {
  const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo({
    KSampler: { input: { required: { steps: ['INT', { default: 20, min: 1, max: 100 }], cfg: ['FLOAT', { default: 8, min: 0, max: 30 }] } }, input_order: { required: ['steps', 'cfg'] }, output: ['LATENT'] },
    Switch: { input: { required: { enabled: ['BOOLEAN', { default: true }] } }, output: ['BOOLEAN'] },
  }));
  const head = () => readProjection(db, P)!;
  let sequence = 0;
  const commit = (payload: unknown) => commitCommand(db, { projectId: P, actionId: `test-${++sequence}`, expectedRevisionId: head().currentRevisionId, actor: 'manual', runId: null, payload });
  const tool = (name: string, args: Record<string, unknown>) => {
    const mutation = mutationFromTool(name, args, { snapshot: head().snapshot as GraphSnapshot, catalog: cachedCatalog(db) });
    expect(mutation).not.toBeNull(); return commit(mutation);
  };
  const snapshot = () => head().snapshot as GraphSnapshot;
  const native = () => { const result = exportWorkflow(snapshot(), '2026-11-17T00:00:00.000Z', cachedCatalog(db)); if (!result.ok) throw Error(result.error); return result.workflow as Record<string, any>; };
  return { db, head, commit, tool, snapshot, native };
}

describe('explicit parameter commands preserve real values', () => {
  it('saves both note aliases, edits by name and restores the previous native text with Undo', () => {
    const { tool, head, commit, native } = setup();
    expect(tool('addNode', { nodeType: 'Note', parameters: { text: 'Первый' } }).status).toBe('applied');
    expect(tool('addNode', { nodeType: 'MarkdownNote', parameters: { 'widget[0]': '**Второй**' } }).status).toBe('applied');
    expect(native().nodes.map((node: { widgets_values: unknown }) => node.widgets_values)).toEqual([['Первый'], ['**Второй**']]);
    const before = head().currentRevisionId;
    expect(tool('setParameter', { nodeId: '1', key: 'text', value: 'Изменено' }).status).toBe('applied');
    expect(native().nodes[0].widgets_values).toEqual(['Изменено']);
    expect(commit({ type: 'restore-revision', revisionId: before }).status).toBe('applied');
    expect(native().nodes[0].widgets_values).toEqual(['Первый']);
  });

  it('rejects conflicting or unsupported note fields instead of reporting an empty successful node', () => {
    const { tool, head } = setup(); const before = head().currentRevisionId;
    for (const parameters of [{ text: 42 }, { text: 'a', 'widget[0]': 'b' }, { typo: 'lost' }]) {
      expect(tool('addNode', { nodeType: 'Note', parameters }).status).toBe('rejected');
      expect(head().currentRevisionId).toBe(before);
    }
    expect(tool('addNode', { nodeType: 'PrimitiveNode', parameters: { value: 12 } }).status).toBe('rejected');
  });

  it('normalizes declared numbers and booleans on add and set and refuses invalid edits atomically', () => {
    const { tool, head, snapshot, native } = setup();
    expect(tool('addNode', { nodeType: 'KSampler', parameters: { steps: '27', cfg: '6.5' } }).status).toBe('applied');
    expect(tool('addNode', { nodeType: 'Switch', parameters: { enabled: 'false' } }).status).toBe('applied');
    expect(native().nodes[0].widgets_values).toEqual([27, 6.5]);
    expect(native().nodes[1].widgets_values).toEqual([false]);
    expect(tool('setParameter', { nodeId: '1', key: 'steps', value: '30' }).status).toBe('applied');
    expect(snapshot().nodes[0].data.parameters.steps).toBe(30);
    expect(native().nodes[0].widgets_values).toEqual([30, 6.5]);
    const before = head().currentRevisionId;
    for (const value of ['', 'NaN', true, '2.5', '101', '-1', '9007199254740993']) {
      expect(tool('setParameter', { nodeId: '1', key: 'steps', value }).status).toBe('rejected');
      expect(head().currentRevisionId).toBe(before);
    }
    expect(tool('setParameter', { nodeId: '2', key: 'enabled', value: 'sometimes' }).status).toBe('rejected');
  });

  it('preserves initial and edited inner note text and types exposed subgraph controls from their source', () => {
    const { tool, commit, native, snapshot } = setup();
    tool('addNode', { nodeType: 'KSampler' });
    const made = commit({ type: 'create-subgraph', name: 'A', nodeIds: ['1'], widgets: [{ nodeId: '1', name: 'steps' }] });
    expect(made.status).toBe('applied');
    const result = made.result as { definitionId: string; nodeId: string };
    const definitionId = result.definitionId; const nodeId = result.nodeId;
    expect(tool('addNode', { nodeType: 'Note', inSubgraph: definitionId, parameters: { 'widget[0]': 'Внутри A' } }).status).toBe('applied');
    const inner = snapshot().subgraphs!.find(item => item.id === definitionId)!.nodes.find(item => item.data.comfyType === 'Note')!;
    expect(native().definitions.subgraphs[0].nodes.find((item: { type: string }) => item.type === 'Note').widgets_values).toEqual(['Внутри A']);
    expect(tool('setParameter', { nodeId: String(inner.id), inSubgraph: definitionId, key: 'text', value: 'Обновлено' }).status).toBe('applied');
    expect(tool('setParameter', { nodeId, key: 'steps', widgetIndex: 0, value: '44' }).status).toBe('applied');
    expect(native().nodes[0].widgets_values).toEqual([44]);
    expect(native().definitions.subgraphs[0].nodes.find((item: { type: string }) => item.type === 'Note').widgets_values).toEqual(['Обновлено']);
    expect(tool('setParameter', { nodeId: '1', inSubgraph: definitionId, key: 'steps', value: '39' }).status).toBe('applied');
    expect(native().definitions.subgraphs[0].nodes.find((item: { type: string }) => item.type === 'KSampler').widgets_values[0]).toBe(39);
    expect(native().nodes[0].widgets_values).toEqual([44]);
  });

  it('does not rewrite imported unknown values merely because their shape resembles a number', () => {
    const { commit, native } = setup();
    const document = { version: 0.4, nodes: [{ id: 1, type: 'CustomUnknown', pos: [0, 0], size: [200, 100], flags: {}, order: 0, mode: 0, properties: {}, widgets_values: ['00027', { custom: 4 }] }], links: [], groups: [], config: {}, extra: {}, last_node_id: 1, last_link_id: 0 };
    expect(commit({ type: 'import-workflow', document }).status).toBe('applied');
    expect(native().nodes[0].widgets_values).toEqual(document.nodes[0].widgets_values);
  });
});
