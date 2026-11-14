import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { inferModelsFromNames, upsertModelFiles, upsertNodeClasses } from '../../src/main/catalog/repository';
import { searchModels, searchNodeClasses } from '../../src/main/knowledge/repository';
import { migrate } from '../../src/main/settings/migrate';
import { editDistance, englishFor, MATCH_EXACT, MATCH_FUZZY, rankWord, RU_WORDS } from '../../src/shared/knowledge/searchWords';
import { filterModels } from '../../src/renderer/components/library/libraryModel';
import { CLASSES, PACKS, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

/** The real node names of the fake catalog (core, KJNodes, WanVideoWrapper, controlnet_aux, rgthree, video nodes). */
function catalog(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  upsertNodeClasses(db, [...CLASSES, ...VIDEO_CLASSES].map((def) => ({
    classType: def.classType, module: PACKS[def.pack].module, displayName: def.display, category: def.category,
  })));
  return db;
}

const found = (db: Database.Database, query: string) => searchNodeClasses(db, { query, limit: 200 }).map((row) => row.classType);

describe('the Russian word table', () => {
  it('has at least 60 Russian stems, each lower case with е for ё', () => {
    const stems = RU_WORDS.flatMap((group) => group.ru);
    expect(stems.length).toBeGreaterThanOrEqual(60);
    for (const stem of stems) expect(stem).toBe(stem.toLowerCase().replace(/ё/g, 'е'));
  });

  it('understands inflections, ё, a word being typed and one slip in a longer word', () => {
    expect(englishFor('Картинку')).toContain('image');
    expect(englishFor('изображение')).toContain('image');
    expect(englishFor('загрузчик')).toContain('loader');
    expect(englishFor('загрузить')).toContain('load');
    expect(englishFor('сэмпл')).toContain('sampler');
    expect(englishFor('семплер')).toContain('sampler');
    expect(englishFor('сэмплр')).toContain('sampler');
    expect(englishFor('чёрный')).toEqual([]);
    expect(englishFor('lora')).toEqual([]);
    expect(editDistance('ksamplr', 'ksampler')).toBe(1);
    expect(editDistance('ksmapler', 'ksampler')).toBe(1);
  });

  it('ranks exact, then prefix, then a Russian word, then a slip', () => {
    expect(rankWord('KSampler', 'ksampler')).toBe(MATCH_EXACT);
    expect(rankWord('KSampler (Advanced)', 'ksampler')).toBeLessThan(rankWord('KSampler', 'сэмплер'));
    expect(rankWord('KSampler', 'сэмплер')).toBeLessThan(rankWord('KSampler', 'ksamplr'));
    expect(rankWord('KSampler', 'ksamplr')).toBe(MATCH_FUZZY);
    expect(rankWord('Load VAE', 'vea')).toBe(Infinity);
  });
});

describe('node search by Russian words, one group at a time', () => {
  const db = catalog();
  const cases: Array<[string, string[]]> = [
    ['сэмплер', ['KSampler', 'KSamplerAdvanced', 'WanVideoSampler']],
    ['семплер', ['KSampler']],
    ['загрузить', ['CheckpointLoaderSimple', 'LoraLoader', 'LoadImage', 'VAELoader']],
    ['загрузчик', ['UNETLoader', 'WanVideoModelLoader']],
    ['сохранить', ['SaveImage', 'SaveVideo']],
    ['картинка', ['LoadImage', 'SaveImage', 'PreviewImage']],
    ['изображение', ['ImageScale']],
    ['видео', ['LoadVideo', 'CreateVideo', 'SaveVideo', 'WanVideoSampler']],
    ['апскейл', ['ImageUpscaleWithModel', 'UpscaleModelLoader', 'LatentUpscale']],
    ['увеличить', ['ImageScaleBy']],
    ['латент', ['EmptyLatentImage', 'LatentUpscale']],
    ['промпт', ['CLIPTextEncode']],
    ['описание', ['CLIPTextEncode']],
    ['текст', ['CLIPTextEncode', 'WanVideoTextEncode']],
    ['лора', ['LoraLoader', 'LoraLoaderModelOnly', 'WanVideoLoraSelect']],
    ['контролнет', ['ControlNetLoader', 'ControlNetApplyAdvanced']],
    ['декодер', ['VAEDecode', 'WanVideoDecode']],
    ['энкодер', ['VAEEncode', 'CLIPTextEncode']],
    ['модель', ['UpscaleModelLoader', 'UNETLoader']],
    ['чекпоинт', ['CheckpointLoaderSimple']],
    ['вае', ['VAELoader', 'VAEDecode']],
    ['клип', ['CLIPLoader', 'CLIPSetLastLayer']],
    ['глубина', ['DepthAnythingV2Preprocessor']],
    ['поза', ['OpenposePreprocessor', 'PoseAndFaceDetection']],
    ['контур', ['CannyEdgePreprocessor']],
    ['цвет', ['ColorMatch']],
    ['размер', ['GetImageSizeAndCount', 'ImageResizeKJ']],
    ['звук', ['LoadAudio']],
    ['сид', ['Seed (rgthree)']],
    ['превью', ['PreviewImage']],
    ['условие', ['ConditioningCombine']],
    ['объединить', ['ConditioningCombine']],
    ['пустой латент', ['EmptyLatentImage']],
    ['загрузить картинку', ['LoadImage']],
    ['камера', ['WanVideoReCamMasterDefaultCamera']],
  ];
  for (const [query, expected] of cases) {
    it(`"${query}" finds ${expected.join(', ')}`, () => {
      const result = found(db, query);
      for (const classType of expected) expect(result, query).toContain(classType);
    });
  }

  it('forgives one slip in a word of five letters or more, and not in shorter ones', () => {
    expect(found(db, 'ksamplr')).toContain('KSampler');
    expect(found(db, 'ksmapler')).toContain('KSampler');
    expect(found(db, 'chekpoint')).toContain('CheckpointLoaderSimple');
    expect(found(db, 'upscal')).toContain('ImageUpscaleWithModel');
    expect(found(db, 'vea')).toEqual([]);
    expect(found(db, 'zzzzz')).toEqual([]);
  });

  it('puts the exact and the prefix match first', () => {
    expect(found(db, 'KSampler')[0]).toBe('KSampler');
    expect(found(db, 'Load Image')[0]).toBe('LoadImage');
    expect(found(db, 'сэмплер').slice(0, 2)).toEqual(expect.arrayContaining(['KSampler']));
  });

  it('matches by class name, display name, category and pack', () => {
    expect(found(db, 'CheckpointLoaderSimple')).toEqual(['CheckpointLoaderSimple']);
    expect(found(db, 'Load Checkpoint')[0]).toBe('CheckpointLoaderSimple');
    expect(found(db, 'conditioning')).toContain('CLIPTextEncode');
    expect(found(db, 'rgthree')).toContain('Image Comparer (rgthree)');
  });
});

describe('model search finds what the list shows', () => {
  function models(): Database.Database {
    const db = new Database(':memory:');
    migrate(db);
    upsertModelFiles(db, [
      { directory: 'loras', name: 'flux_realism_lora.safetensors', sizeBytes: 1 },
      { directory: 'loras', name: '20251206.safetensors', sizeBytes: 1 },
      { directory: 'checkpoints', name: 'ponyDiffusionV6XL.safetensors', sizeBytes: 1 },
      { directory: 'upscale_models', name: '4x-UltraSharp.pth', sizeBytes: 1 },
    ]);
    inferModelsFromNames(db);
    db.prepare("UPDATE model_catalog SET notes_json = ?, trigger_words = ? WHERE name = 'flux_realism_lora.safetensors'")
      .run(JSON.stringify({ title: 'Night Painter', baseModelLabel: 'Flux.1 D', tags: ['painterly'] }), JSON.stringify(['night painter', 'moonlit']));
    return db;
  }
  const names = (db: Database.Database, query: string) => searchModels(db, { query, limit: 50 }).map((row) => row.name);

  it('by the title, the base-model words and the trigger words, and by Russian words', () => {
    const db = models();
    expect(names(db, 'Night')).toEqual(['flux_realism_lora.safetensors']);
    expect(names(db, 'night painter')).toEqual(['flux_realism_lora.safetensors']);
    expect(names(db, 'moonlit')).toEqual(['flux_realism_lora.safetensors']);
    expect(names(db, 'flux.1 d')).toContain('flux_realism_lora.safetensors');
    expect(names(db, 'лора')).toEqual(expect.arrayContaining(['flux_realism_lora.safetensors', '20251206.safetensors']));
    expect(names(db, 'чекпоинт')).toEqual(['ponyDiffusionV6XL.safetensors']);
    expect(names(db, 'апскейл')).toEqual(['4x-UltraSharp.pth']);
    expect(names(db, 'ultrashrp')).toEqual(['4x-UltraSharp.pth']);
    db.close();
  });

  it('the same in the list narrowed in the window (LoRAs that fit a model)', () => {
    const list = [
      { directory: 'loras', name: 'flux_realism_lora.safetensors', kind: 'lora', baseModel: 'flux', sizeBytes: 1, enriched: true, title: 'Night Painter', preview: null, mature: false },
      { directory: 'loras', name: 'pixel-art-xl.safetensors', kind: 'lora', baseModel: 'sdxl', sizeBytes: 1, enriched: true, title: 'Pixel Art XL', preview: null, mature: false },
    ] as Parameters<typeof filterModels>[0];
    expect(filterModels(list, 'night', { directory: '', baseModel: '', kind: '' }).map((row) => row.name)).toEqual(['flux_realism_lora.safetensors']);
    expect(filterModels(list, 'лора', { directory: '', baseModel: '', kind: '' })).toHaveLength(2);
  });
});
