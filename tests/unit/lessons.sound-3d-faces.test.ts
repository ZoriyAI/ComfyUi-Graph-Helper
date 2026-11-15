import { describe, expect, it } from 'vitest';
import { lessonGaps, rolesOf, type ClassPorts, type FieldTest } from '../../src/shared/lessons/engine';
import { packOf } from '../../src/shared/lessons/fit';
import { LESSONS, LESSON_AFTER, LESSON_PATH } from '../../src/shared/lessons/lessons';
import { SOUND_3D_FACES_AFTER, SOUND_3D_FACES_GROUPS, SOUND_3D_FACES_LESSONS, SOUND_3D_FACES_LESSON_GROUP } from '../../src/shared/lessons/sets/sound-3d-faces';
import { lessonWords } from '../../src/shared/lessons/texts';
import { conceptNote, CORE_KNOWLEDGE, CORE_NODE_CLASSES, coreSeeds, fieldNote, KNOWLEDGE_SETS, packNote } from '../../src/shared/knowledge/coreKnowledge';
import { SOUND_3D_FACES_KNOWLEDGE_DOCS } from '../../src/shared/knowledge/sets/sound-3d-faces';
import { SOUND_3D_FACES_KNOWLEDGE_EN } from '../../src/shared/knowledge/sets/sound-3d-faces.en';
import { SOUND_3D_FACES_KNOWLEDGE_RU } from '../../src/shared/knowledge/sets/sound-3d-faces.ru';
import { VIDEO_KNOWLEDGE_EN } from '../../src/shared/knowledge/sets/video.en';
import { IMAGE_TECHNIQUES_KNOWLEDGE } from '../../src/shared/knowledge/sets/image-techniques';
import { IMAGE_MODEL_NODE_CLASSES } from '../../src/shared/knowledge/sets/image-models';
import { lessonSpecs, SOUND_3D_FACES_CLASSES } from '../fixtures/mcp/classes/sound-3d-faces';
import { CLASSES, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

const ids = SOUND_3D_FACES_LESSONS.map((lesson) => lesson.id);
const specs = lessonSpecs();

/** The fake ComfyUI with its video classes, which carry this domain's classes too. */
const ports: ClassPorts = (classType) => {
  const item = [...CLASSES, ...VIDEO_CLASSES].find((def) => def.classType === classType);
  if (!item) return null;
  const names = item.outputName ?? item.output;
  return { inputs: [...Object.keys(item.required ?? {}), ...Object.keys(item.optional ?? {})], outputs: item.output.map((type, index) => ({ name: names[index] ?? type, type })) };
};

const numbersIn = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => Number(item.replace(',', '.')));

describe('the lessons on sound, speech, 3D, faces and characters', () => {
  it('are in the lesson list, each in a group, and continue only the lessons they say', () => {
    for (const id of ids) {
      expect(LESSONS.some((lesson) => lesson.id === id), id).toBe(true);
      expect(SOUND_3D_FACES_GROUPS[SOUND_3D_FACES_LESSON_GROUP[id]], id).toBeDefined();
      expect(LESSON_AFTER[id], id).toEqual(SOUND_3D_FACES_AFTER[id]);
      expect(LESSON_PATH[id]?.group.id, id).toBe(SOUND_3D_FACES_LESSON_GROUP[id]);
      for (const before of LESSON_PATH[id].follows) expect(LESSONS.some((lesson) => lesson.id === before), `${id} follows ${before}`).toBe(true);
    }
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
    for (const group of Object.values(SOUND_3D_FACES_GROUPS)) expect(group.ru.length * group.en.length).toBeGreaterThan(0);
  });

  it('fit a ComfyUI that has their nodes, and name the pack of a missing node', () => {
    for (const lesson of SOUND_3D_FACES_LESSONS) expect(lessonGaps(lesson, ports), lesson.id).toEqual([]);
    const without: ClassPorts = (classType) => (classType === 'MMAudioSampler' ? null : ports(classType));
    expect(lessonGaps(SOUND_3D_FACES_LESSONS.find((lesson) => lesson.id === 'audio-foley')!, without)).toEqual([{ kind: 'class', role: 'sampler', classes: ['MMAudioSampler'] }]);
    expect(packOf('MMAudioSampler')).toBe('ComfyUI-MMAudio');
    expect(packOf('VHS_VideoCombine')).toBe('ComfyUI-VideoHelperSuite');
    expect(packOf('FL_ChatterboxTTS')).toBe('ComfyUI_Fill-ChatterBox');
    expect(packOf('Apply Whisper')).toBe('ComfyUI-Whisper');
    expect(packOf('ReActorRestoreFace')).toBe('ComfyUI-ReActor');
    expect(packOf('IPAdapterFaceID')).toBe('ComfyUI_IPAdapter_plus');
    expect(packOf('TextEncodeAceStepAudio1.5')).toBeNull();
  });

  it('say the number "Do this for me" sets, in both languages', () => {
    const preferred = (test: FieldTest): number | null => (test.kind === 'between' ? test.prefer ?? null : test.kind === 'equals' && typeof test.value === 'number' ? test.value : null);
    for (const lesson of SOUND_3D_FACES_LESSONS) {
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const value = preferred(spec.test);
          if (value === null) continue;
          for (const language of ['ru', 'en'] as const) {
            expect(numbersIn(lessonWords(language, lesson.id)!.steps[step.id].body), `${language}/${lesson.id}/${step.id}: ${spec.field} ${value}`).toContain(value);
          }
        }
      }
    }
  });

  it('say the rule first wherever a voice or a face is given, restored or kept', () => {
    for (const id of ['audio-speech', 'character-kontext', 'character-series', 'face-same-photo', 'face-swap', 'face-restore']) {
      const lesson = SOUND_3D_FACES_LESSONS.find((item) => item.id === id)!;
      expect(lesson.steps[0]).toMatchObject({ id: 'intro', read: true });
      const ru = lessonWords('ru', id)!.steps.intro.body;
      const en = lessonWords('en', id)!.steps.intro.body;
      expect(ru, id).toMatch(/соглас/);
      expect(en, id).toMatch(/consent/);
      expect(ru, id).toMatch(/откровенн/);
      expect(en, id).toMatch(/explicit/);
    }
    for (const id of ['audio-speech', 'character-kontext']) {
      expect(lessonWords('ru', id)!.steps.intro.body).toMatch(/несовершеннолетн/);
      expect(lessonWords('en', id)!.steps.intro.body).toMatch(/minor/);
    }
    // The lessons the owner asked for by name say all three limits, and that the person or the character agreed.
    for (const id of ['character-series', 'face-same-photo', 'face-swap']) {
      const ru = lessonWords('ru', id)!.steps.intro.body;
      const en = lessonWords('en', id)!.steps.intro.body;
      expect(en, id).toMatch(/yourself, a person who gave permission, or an invented character/);
      expect(en, id).toMatch(/under 18/);
      expect(en, id).toMatch(/pass a person off as saying or doing what they did not/);
      expect(ru, id).toMatch(/себя, человека, который разрешил, или придуманного героя/);
      expect(ru, id).toMatch(/младше 18/);
      expect(ru, id).toMatch(/говорил или делал то, чего не было/);
    }
  });

  it('say that a pack runs other people\'s code where a lesson needs a pack', () => {
    for (const id of ['audio-speech', 'audio-foley', 'audio-transcribe', 'face-restore', 'face-same-photo', 'face-swap']) {
      expect(lessonWords('en', id)!.steps.intro.body, id).toMatch(/other people's code/);
      expect(lessonWords('ru', id)!.steps.intro.body, id).toMatch(/чужой код/);
    }
  });

  it('use fixture classes that have every input and output the lessons name', () => {
    for (const def of SOUND_3D_FACES_CLASSES) expect(specs[def.classType], def.classType).toBeDefined();
    for (const lesson of SOUND_3D_FACES_LESSONS) {
      for (const spec of rolesOf(lesson)) expect(ports(spec.classes[0]), `${lesson.id}: ${spec.classes[0]}`).not.toBeNull();
    }
  });
});

describe('the knowledge of sound, speech, 3D, faces and characters', () => {
  const sets = { en: SOUND_3D_FACES_KNOWLEDGE_EN, ru: SOUND_3D_FACES_KNOWLEDGE_RU };
  const sections = ['nodes', 'linkTypes', 'families', 'packs', 'fields', 'concepts'] as const;
  const strings = (value: unknown): string[] => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);

  it('is registered after the video set and says the same things in both languages, never blank', () => {
    for (const language of ['en', 'ru'] as const) expect(KNOWLEDGE_SETS[language].map((entry) => entry.set)).toContain(sets[language]);
    const { en, ru } = sets;
    for (const section of sections) expect(Object.keys(ru[section] ?? {}).sort(), section).toEqual(Object.keys(en[section] ?? {}).sort());
    for (const classType of Object.keys(en.fields)) expect(Object.keys(ru.fields[classType]).sort(), classType).toEqual(Object.keys(en.fields[classType]).sort());
    for (const text of strings(en)) {
      expect(text.trim().length, text).toBeGreaterThan(1);
      expect(/[а-яё]/i.test(text), text).toBe(false);
    }
    // A pack's list of node names and a folder's path may stay in Latin letters; every other text is Russian.
    const latin = new Set([...Object.values(ru.packs).map((pack) => pack.nodes), ...Object.values(ru.concepts ?? {}).map((concept) => concept.term)]);
    for (const text of strings(ru)) if (!latin.has(text)) expect(/[а-яё]/i.test(text), text).toBe(true);
    for (const classType of Object.keys(en.nodes)) {
      expect(en.nodes[classType].what && en.nodes[classType].why && en.nodes[classType].connect, classType).toBeTruthy();
      expect(Boolean(ru.nodes[classType].risk), classType).toBe(Boolean(en.nodes[classType].risk));
      expect(SOUND_3D_FACES_KNOWLEDGE_DOCS.nodes[classType], `${classType} has a source`).toBeTruthy();
    }
  });

  it('does not redefine what the core or another set already describes', () => {
    const others = [VIDEO_KNOWLEDGE_EN, IMAGE_TECHNIQUES_KNOWLEDGE.en];
    for (const classType of Object.keys(SOUND_3D_FACES_KNOWLEDGE_EN.nodes)) {
      expect([...CORE_NODE_CLASSES, ...IMAGE_MODEL_NODE_CLASSES].includes(classType as never), classType).toBe(false);
      for (const other of others) expect(other.nodes[classType], classType).toBeUndefined();
    }
    for (const kind of ['linkTypes', 'families', 'packs', 'concepts'] as const) {
      for (const id of Object.keys(SOUND_3D_FACES_KNOWLEDGE_EN[kind] ?? {})) for (const other of others) expect((other[kind] ?? {})[id], `${kind} ${id}`).toBeUndefined();
    }
  });

  it('describes every node class of the lessons, in the core pack or a set', () => {
    for (const language of ['en', 'ru'] as const) {
      const known = new Set<string>([...CORE_NODE_CLASSES, ...IMAGE_MODEL_NODE_CLASSES, ...KNOWLEDGE_SETS[language].flatMap((entry) => Object.keys(entry.set.nodes))]);
      for (const lesson of SOUND_3D_FACES_LESSONS) {
        for (const spec of rolesOf(lesson)) expect(spec.classes.some((classType) => known.has(classType)), `${language}/${lesson.id}: ${spec.classes.join(', ')}`).toBe(true);
      }
      expect(CORE_KNOWLEDGE[language].nodes.CLIPVisionEncode.what.length).toBeGreaterThan(5);
    }
  });

  it('describes the packs, the model folders and the fields of the domain', () => {
    for (const pack of ['ComfyUI-MMAudio', 'ComfyUI-HunyuanVideo-Foley', 'ComfyUI-Qwen-TTS', 'ComfyUI-Whisper', 'ComfyUI_AudioTools', 'ComfyUI-3D-Pack', 'ComfyUI-Trellis2', 'ComfyUI-UniRig', 'ComfyUI_InfiniteYou', 'ComfyUI-ReActor', 'ComfyUI_IPAdapter_plus', 'ComfyUI-Impact-Pack', 'ComfyUI_InstantID']) {
      for (const language of ['en', 'ru'] as const) expect(packNote(pack, language)?.what, `${language} ${pack}`).toBeTruthy();
    }
    for (const folder of ['mmaudio', 'foley', 'qwen-tts', 'stt', 'audio_encoders', 'demucs', 'facerestore_models', 'facedetection', 'insightface', 'photomaker', 'ipadapter', 'unirig', 'ultralytics', 'sams', 'instantid', 'pulid']) {
      expect(conceptNote(`models-${folder}`, 'en')?.term, folder).toBe(`models/${folder}`);
      expect(conceptNote(`models-${folder}`, 'ru')?.text, folder).toBeTruthy();
    }
    expect(fieldNote('EmptyAceStep1.5LatentAudio', 'seconds', 'en')).toMatch(/120/);
    expect(fieldNote('VoxelToMesh', 'threshold', 'ru')).toMatch(/0\.6/);
    expect(fieldNote('FL_ChatterboxTTS', 'exaggeration', 'en')).toMatch(/0\.5/);
    expect(fieldNote('IPAdapterFaceID', 'weight', 'en')).toMatch(/0\.7/);
    // One entry compares the three ways to keep a face, and starts with the rule.
    expect(conceptNote('identity', 'en')?.term).toMatch(/adapter, LoRA or swap/);
    expect(conceptNote('identity', 'en')?.text).toMatch(/^A real person's face or voice only with their consent/);
    expect(conceptNote('identity', 'ru')?.text).toMatch(/LoRA/);
  });

  it('says the rule wherever a face or a voice is put onto someone', () => {
    for (const language of ['en', 'ru'] as const) {
      const texts = sets[language];
      const rule = language === 'en' ? /consent.*explicit.*minor/ : /согласия.*откровенном.*несовершеннолетним/;
      for (const classType of ['ReActorFaceSwap', 'FL_ChatterboxTTS', 'PhotoMakerEncode', 'IPAdapterFaceID', 'IPAdapterUnifiedLoaderFaceID']) expect(texts.nodes[classType].risk, `${language} ${classType}`).toMatch(rule);
      for (const family of ['chatterbox', 'qwen-tts', 'photomaker', 'infiniteyou', 'ipadapter-faceid', 'instantid', 'pulid']) expect(texts.families[family].risk, `${language} ${family}`).toMatch(rule);
      for (const pack of ['ComfyUI-ReActor', 'ComfyUI_Fill-ChatterBox', 'ComfyUI-Qwen-TTS', 'ComfyUI_InfiniteYou']) expect(texts.packs[pack].risk, `${language} ${pack}`).toMatch(rule);
    }
  });

  it('is seeded as explanations with the core knowledge, linked to docs.comfy.org or to the pack\'s repository', () => {
    for (const language of ['en', 'ru'] as const) {
      const seeds = coreSeeds(language);
      expect(seeds.some((seed) => seed.owner.id === 'MMAudioSampler' && seed.aspect === 'what')).toBe(true);
      expect(seeds.some((seed) => seed.owner.kind === 'family' && seed.owner.id === 'ace-step')).toBe(true);
      expect(seeds.some((seed) => seed.owner.kind === 'linkType' && seed.owner.id === 'MESH')).toBe(true);
      expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
      for (const seed of seeds) if (seed.sourceUrl) expect(['docs.comfy.org', 'github.com']).toContain(new URL(seed.sourceUrl).hostname);
    }
  });
});
