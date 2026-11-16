/** Checks optional Russian model description translation, caching and cancellation. */
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { modelDetail } from '../../src/main/knowledge/repository';
import { ModelTranslations, readableModelFields } from '../../src/main/knowledge/modelTranslations';
function fixture(count = 2) {
  const db = new Database(':memory:'); migrate(db, { upTo: 18 }); migrate(db);
  for (let i = 0; i < count; i++) db.prepare('INSERT INTO model_catalog(directory,name,description,metadata_json,notes_json,trigger_words) VALUES (?,?,?,?,?,?)').run(i % 2 ? 'diffusion_models' : 'loras', `model-${i}.safetensors`, `Portrait style description ${i}.`, JSON.stringify({ 'modelspec.description': 'Use soft light.', ss_steps: '100', trigger_word: 'ExactTrigger' }), JSON.stringify({ notes: 'Works with portraits.' }), '["ExactTrigger"]');
  return { db, detail: (i = 0) => modelDetail(db, i % 2 ? 'diffusion_models' : 'loras', `model-${i}.safetensors`)! };
}
describe('Russian display-only model translation', () => {
  it('translates every model folder in the background, preserves originals/technical data, and reuses persistent cache', async () => {
    const { db, detail } = fixture(); const translate = vi.fn(async (fields) => ({ text: `Перевод: ${fields.text}` }));
    const worker = new ModelTranslations({ db: () => db, language: () => 'ru', ready: () => true, translate });
    const original = detail(); worker.kick(); await worker.idle();
    for (const i of [0, 1]) { expect(worker.decorate(detail(i))?.translation?.state).toBe('ready'); expect(worker.decorate(detail(i))?.translation?.fields?.description).toContain('Перевод'); }
    expect(detail()).toEqual(original); expect(readableModelFields(original)).not.toHaveProperty('metadata:ss_steps'); expect(readableModelFields(original)).not.toHaveProperty('metadata:trigger_word');
    const calls = translate.mock.calls.length; worker.kick(); await worker.idle(); expect(translate).toHaveBeenCalledTimes(calls);
    worker.stop(); const restarted = new ModelTranslations({ db: () => db, language: () => 'ru', ready: () => false, translate });
    expect(restarted.decorate(detail())?.translation?.state).toBe('ready'); restarted.stop(); db.close();
  });
  it('does not translate for English or an unconfigured assistant', async () => {
    const { db, detail } = fixture(); const translate = vi.fn(); let language = 'en'; let ready = true;
    const worker = new ModelTranslations({ db: () => db, language: () => language, ready: () => ready, translate });
    expect(worker.decorate(detail())?.translation).toBeUndefined(); worker.kick(); expect(translate).not.toHaveBeenCalled();
    language = 'ru'; ready = false; expect(worker.decorate(detail())?.translation?.state).toBe('unavailable'); expect(translate).not.toHaveBeenCalled(); worker.stop(); db.close();
  });
  it('discards a response if model prose or UI language changed during translation', async () => {
    const { db, detail } = fixture(1); let resolve!: (value: { text: string }) => void; let language = 'ru';
    const worker = new ModelTranslations({ db: () => db, language: () => language, ready: () => true, translate: () => new Promise((done) => { resolve = done; }) });
    worker.decorate(detail()); language = 'en'; db.prepare("UPDATE model_catalog SET description='Changed description'").run();
    resolve({ text: 'Старый перевод' });
    // Remaining fields also observe cancellation via the test translator.
    worker.stop(); await worker.idle();
    expect((db.prepare('SELECT COUNT(*) AS n FROM model_text_translations').get() as { n: number }).n).toBe(0); db.close();
  });
  it('stops a failing provider after three errors instead of retrying every model', async () => {
    const { db } = fixture(12); const translate = vi.fn(async () => { throw Error('offline'); });
    const worker = new ModelTranslations({ db: () => db, language: () => 'ru', ready: () => true, translate }); worker.kick(); await worker.idle();
    expect(translate).toHaveBeenCalledTimes(3); worker.kick(); await worker.idle(); expect(translate).toHaveBeenCalledTimes(3); worker.stop(); db.close();
  });
});
