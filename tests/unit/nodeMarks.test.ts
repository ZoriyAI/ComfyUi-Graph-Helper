/**
 * Node marks (editing package): object_info flags api_node, deprecated and experimental are kept (migration 18),
 * a class of ComfyUI's comfy_api_nodes package counts as paid even without the flag, an outdated node comes after
 * its neighbours in the search, and a seed field gets its "after run" row (fieldModel.nodeLayout).
 * Why: the person should see before adding a node that it costs money, is outdated or may change.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { nodeClassDetail, searchNodeClasses } from '../../src/main/knowledge/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { AFTER_RUN_CHOICES, nodeLayout } from '../../src/renderer/components/fields/fieldModel';

/** An object_info entry for a simple image node; `extra` adds flags such as deprecated or api_node. */
const base = (name: string, extra: Record<string, unknown> = {}, module = 'nodes') => ({
  input: { required: { image: ['IMAGE'] } }, output: ['IMAGE'], output_name: ['IMAGE'], name, display_name: name, category: 'image', python_module: module, ...extra,
});

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  upsertObjectInfo(db, parseObjectInfo({
    ImageEditOld: base('ImageEditOld', { deprecated: true }),
    ImageEditNew: base('ImageEditNew'),
    ImageEditTry: base('ImageEditTry', { experimental: true }),
    ImageEditCloud: base('ImageEditCloud', { api_node: true }),
    ImageEditModule: base('ImageEditModule', {}, 'comfy_api_nodes.nodes_x'),
    SaveImage: { ...base('SaveImage', { output_node: true }), output: [], output_name: [] },
  }), Date.now());
  return db;
}

describe('node marks', () => {
  it('carries paid, outdated and experimental marks and the result mark', () => {
    const db = openDb();
    const found = Object.fromEntries(searchNodeClasses(db, { query: 'imageedit', limit: 20 }).map((item) => [item.classType, item]));
    expect(found.ImageEditOld.marks).toEqual(['deprecated']);
    expect(found.ImageEditTry.marks).toEqual(['experimental']);
    expect(found.ImageEditCloud.marks).toEqual(['api']);
    expect(found.ImageEditModule.marks).toEqual(['api']);
    expect(found.ImageEditNew.marks).toBeUndefined();
    expect(nodeClassDetail(db, 'ImageEditCloud')!.marks).toEqual(['api']);
    expect(searchNodeClasses(db, { query: 'save', limit: 5 })[0]).toMatchObject({ classType: 'SaveImage', outputNode: true });
    db.close();
  });

  it('puts an outdated node after its current neighbours', () => {
    const db = openDb();
    const order = searchNodeClasses(db, { query: 'imageedit', limit: 20 }).map((item) => item.classType);
    expect(order.indexOf('ImageEditOld')).toBe(order.length - 1);
    db.close();
  });
});

describe('seed after run row', () => {
  it('adds a row with ComfyUI\'s four choices after a field that has the slot', () => {
    const detail = {
      classType: 'KSampler', displayName: 'KSampler', category: 'sampling', pack: 'core', detailed: true, description: '',
      inputs: [{ name: 'seed', type: 'INT', widget: true, required: true, spec: { kind: 'int' as const, control: 'randomize' } }],
      outputs: [], widgetOrder: ['seed', 'seed::control_after_generate'], widgetOrderReliable: true, outputNode: false, syncedAt: null,
    };
    const layout = nodeLayout({ comfyType: 'KSampler', inputs: [{ id: 'in-0', name: 'seed', dataType: 'INT', optional: false }], outputs: [], parameters: {}, comfy: { widgets_values: [5, 'fixed'] } } as never, detail);
    const row = layout.fields.find((field) => field.name === 'seed::control_after_generate')!;
    expect(row).toMatchObject({ labelKey: 'editing.afterRun', value: 'fixed', spec: { kind: 'combo', options: AFTER_RUN_CHOICES } });
  });
});
