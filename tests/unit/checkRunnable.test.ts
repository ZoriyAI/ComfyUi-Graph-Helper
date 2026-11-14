import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertModelFiles, upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/check';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { CLASSES, MODELS, objectInfoDocument } from '../fixtures/mcp/fakeMcpServer';
import { checkFindingCount, findingsOf } from '../../src/renderer/components/check/checkModel';
import { exportGuardFindings } from '../../src/renderer/commands/exportGuard';

/**
 * What ComfyUI refuses at queue time that the check must say before export: no output node, a number outside
 * its range, a list value the list does not have, and a loop. And no false alarm on a sound graph.
 */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(objectInfoDocument(CLASSES)), 1000);
  upsertModelFiles(db, MODELS.map((model) => ({ directory: model.category, name: model.filename, sizeBytes: model.size })));
  return db;
}

const out = (name: string, type: string, links: number[] = []) => ({ name, type, links });
const inp = (name: string, type: string, link: number | null = null) => ({ name, type, link });

interface Over { steps?: number; sampler?: string; denoise?: number; noSave?: boolean; loop?: boolean; image?: string; extra?: unknown[] }

/** A sound text-to-image graph, with one thing changed at a time. */
function txt2img(over: Over = {}) {
  const nodes: Array<Record<string, unknown>> = [
    { id: 1, type: 'CheckpointLoaderSimple', outputs: [out('MODEL', 'MODEL', [1]), out('CLIP', 'CLIP', [2, 3]), out('VAE', 'VAE', [8])], widgets_values: ['sd_xl_base_1.0.safetensors'] },
    { id: 2, type: 'CLIPTextEncode', inputs: [inp('clip', 'CLIP', 2)], outputs: [out('CONDITIONING', 'CONDITIONING', [4])], widgets_values: ['a cat'] },
    { id: 3, type: 'CLIPTextEncode', inputs: [inp('clip', 'CLIP', 3)], outputs: [out('CONDITIONING', 'CONDITIONING', [5])], widgets_values: ['blurry'] },
    { id: 4, type: 'EmptyLatentImage', outputs: [out('LATENT', 'LATENT', [6])], widgets_values: [1024, 1024, 1] },
    { id: 5, type: 'KSampler', inputs: [inp('model', 'MODEL', 1), inp('positive', 'CONDITIONING', 4), inp('negative', 'CONDITIONING', 5), inp('latent_image', 'LATENT', over.loop ? 10 : 6)], outputs: [out('LATENT', 'LATENT', over.loop ? [7, 10] : [7])], widgets_values: [0, 'fixed', over.steps ?? 20, 7, over.sampler ?? 'euler', 'normal', over.denoise ?? 1] },
    { id: 6, type: 'VAEDecode', inputs: [inp('samples', 'LATENT', 7), inp('vae', 'VAE', 8)], outputs: [out('IMAGE', 'IMAGE', over.noSave ? [] : [9])] },
  ];
  const links: unknown[][] = [[1, 1, 0, 5, 0, 'MODEL'], [2, 1, 1, 2, 0, 'CLIP'], [3, 1, 1, 3, 0, 'CLIP'], [4, 2, 0, 5, 1, 'CONDITIONING'], [5, 3, 0, 5, 2, 'CONDITIONING'], [7, 5, 0, 6, 0, 'LATENT'], [8, 1, 2, 6, 1, 'VAE']];
  links.push(over.loop ? [10, 5, 0, 5, 3, 'LATENT'] : [6, 4, 0, 5, 3, 'LATENT']);
  if (!over.noSave) {
    nodes.push({ id: 7, type: 'SaveImage', inputs: [inp('images', 'IMAGE', 9)], widgets_values: ['ComfyUI'] });
    links.push([9, 6, 0, 7, 0, 'IMAGE']);
  }
  for (const extra of over.extra ?? []) nodes.push(extra as Record<string, unknown>);
  return {
    version: 0.4, last_node_id: 20, last_link_id: 20, groups: [], config: {}, extra: {}, links,
    nodes: nodes.map((node, index) => ({ pos: [index * 300, 0], size: [200, 100], flags: {}, order: index, mode: 0, properties: {}, inputs: [], outputs: [], ...node })),
  };
}

function check(document: unknown) {
  const db = openDb();
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: `import-${Math.random()}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: { type: 'import-workflow', document } });
  expect(result.status).toBe('applied');
  const report = checkGraph(db, DESKTOP_PROJECT_ID);
  db.close();
  return report;
}

describe('graph check: what ComfyUI refuses to run', () => {
  it('is quiet on a sound graph', () => {
    const report = check(txt2img());
    expect(report.ok).toBe(true);
    expect(report.noOutputNode).toBeNull();
    expect(report.valuesOutOfRange).toEqual([]);
    expect(report.valuesNotInList).toEqual([]);
    expect(report.cycles).toEqual([]);
    expect(checkFindingCount(report)).toBe(0);
  });

  it('says when nothing saves or shows the result, and points at the end of the chain', () => {
    const report = check(txt2img({ noSave: true }));
    expect(report.ok).toBe(false);
    expect(report.noOutputNode).toEqual({ nodeId: '6' });
    const [finding] = findingsOf(report);
    expect(finding).toMatchObject({ type: 'noOutputNode', textKey: 'check.noOutputNodeItem', ref: { kind: 'node', id: '6' } });
  });

  it('does not ask for an output node when a class it does not know may be one', () => {
    const unknown = { id: 20, type: 'SomePackSaver', inputs: [], outputs: [], widgets_values: [] };
    expect(check(txt2img({ noSave: true, extra: [unknown] })).noOutputNode).toBeNull();
  });

  it('reports numbers below the minimum and above the maximum with the limit', () => {
    const report = check(txt2img({ steps: 0, denoise: 3 }));
    expect(report.valuesOutOfRange).toEqual([
      { nodeId: '5', classType: 'KSampler', input: 'steps', value: 0, min: 1, max: 10000 },
      { nodeId: '5', classType: 'KSampler', input: 'denoise', value: 3, min: 0, max: 1 },
    ]);
    const rows = findingsOf(report, () => 'in-5');
    expect(rows.map((row) => row.textKey)).toEqual(['check.valuesBelowMinItem', 'check.valuesAboveMaxItem']);
    expect(rows[0].values).toMatchObject({ input: 'steps', value: '0', limit: '1' });
    expect(rows[0].ref).toMatchObject({ kind: 'port', nodeId: '5', portName: 'in-5' });
  });

  it('reports a list value the list does not have, but not a model file and not an upload', () => {
    const image = { id: 21, type: 'LoadImage', inputs: [], outputs: [out('IMAGE', 'IMAGE'), out('MASK', 'MASK')], widgets_values: ['uploaded-later.png', 'image'] };
    const report = check(txt2img({ sampler: 'made_up_sampler', extra: [image] }));
    expect(report.valuesNotInList).toEqual([{ nodeId: '5', classType: 'KSampler', input: 'sampler_name', value: 'made_up_sampler' }]);
    const missingCkpt = txt2img();
    (missingCkpt.nodes[0] as { widgets_values: unknown[] }).widgets_values = ['not_on_disk.safetensors'];
    const other = check(missingCkpt);
    expect(other.valuesNotInList).toEqual([]);
    expect(other.missingModels).toHaveLength(1);
  });

  it('reports a loop once, naming its nodes', () => {
    const report = check(txt2img({ loop: true }));
    expect(report.cycles).toEqual([{ nodeIds: ['5'] }]);
    const rows = findingsOf(report, undefined, (id) => (id === '5' ? 'KSampler' : undefined));
    expect(rows.find((row) => row.type === 'cycles')?.values.nodes).toBe('KSampler');
  });

  it('lists the new findings in the export guard', () => {
    const keys = exportGuardFindings(check(txt2img({ noSave: true, steps: 0, sampler: 'nope' }))).map((row) => row.textKey);
    expect(keys).toEqual(expect.arrayContaining(['check.noOutputNodeItem', 'check.valuesBelowMinItem', 'check.valuesNotInListItem']));
  });
});
