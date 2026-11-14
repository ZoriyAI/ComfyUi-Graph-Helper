import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { inferModelsFromNames, upsertModelFiles, upsertNodeClasses } from '../../src/main/catalog/repository';
import { searchModels, searchNodeClasses } from '../../src/main/knowledge/repository';

function setup() {
  const db = new Database(':memory:');
  migrate(db);
  upsertNodeClasses(db, [
    { classType: 'LoraLoader', module: 'nodes', displayName: 'Load LoRA', category: 'loaders' },
    { classType: 'LoraLoaderModelOnly', module: 'nodes', displayName: 'LoraLoaderModelOnly', category: 'loaders' },
    { classType: 'KSampler', module: 'nodes', displayName: 'KSampler', category: 'sampling' },
    { classType: 'KSamplerAdvanced', module: 'nodes', displayName: 'KSampler (Advanced)', category: 'sampling' },
    { classType: 'CheckpointLoaderSimple', module: 'nodes', displayName: 'Load Checkpoint', category: 'loaders' },
  ]);
  upsertModelFiles(db, [
    { directory: 'loras', name: 'flux_realism_lora.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'FluxDetailer.safetensors', sizeBytes: 1 },
    { directory: 'loras', name: 'sdxl_style.safetensors', sizeBytes: 1 },
    { directory: 'checkpoints', name: 'flux1-dev.safetensors', sizeBytes: 1 },
  ]);
  inferModelsFromNames(db);
  return db;
}

describe('multi-word search', () => {
  it('requires every word to match some field and ranks by the sum', () => {
    const db = setup();
    expect(searchNodeClasses(db, { query: 'lora loader' }).map((row) => row.classType)).toEqual(['LoraLoader', 'LoraLoaderModelOnly']);
    expect(searchNodeClasses(db, { query: 'ksampler advanced' }).map((row) => row.classType)).toEqual(['KSamplerAdvanced']);
    expect(searchNodeClasses(db, { query: '  KSampler  ' }).map((row) => row.classType)[0]).toBe('KSampler');
    expect(searchNodeClasses(db, { query: 'lora sampling' })).toEqual([]);
    const flux = searchModels(db, { query: 'flux lora' }).map((row) => row.name);
    expect(flux).toEqual(expect.arrayContaining(['flux_realism_lora.safetensors', 'FluxDetailer.safetensors']));
    expect(flux).not.toContain('flux1-dev.safetensors');
    expect(flux).not.toContain('sdxl_style.safetensors');
    expect(searchModels(db, { query: '' })).toHaveLength(4);
    db.close();
  });
});
