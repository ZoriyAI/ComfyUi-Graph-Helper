import { describe, expect, it } from 'vitest';
import { lessonGaps, rolesOf, type ClassPorts, type FieldTest } from '../../src/shared/lessons/engine';
import { packOf } from '../../src/shared/lessons/fit';
import { LESSONS, LESSON_AFTER } from '../../src/shared/lessons/lessons';
import { SOUND_3D_FACES_GROUPS, SOUND_3D_FACES_LESSONS, SOUND_3D_FACES_LESSON_GROUP } from '../../src/shared/lessons/sets/sound-3d-faces';
import { lessonWords } from '../../src/shared/lessons/texts';
import { CORE_KNOWLEDGE, CORE_NODE_CLASSES, coreSeeds } from '../../src/shared/knowledge/coreKnowledge';
import { fieldNote, KNOWLEDGE_SETS, modelFolderNote, packNote, type KnowledgeSetTexts } from '../../src/shared/knowledge/knowledgeSets';
import { SOUND_3D_FACES_KNOWLEDGE } from '../../src/shared/knowledge/sets/sound-3d-faces';
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
  it('are in the lesson list, each in a group, none standing on another', () => {
    for (const id of ids) {
      expect(LESSONS.some((lesson) => lesson.id === id), id).toBe(true);
      expect(SOUND_3D_FACES_GROUPS[SOUND_3D_FACES_LESSON_GROUP[id]], id).toBeDefined();
      expect(LESSON_AFTER[id], id).toBeUndefined();
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
    for (const id of ['audio-speech', 'character-kontext', 'face-restore']) {
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
  });

  it('say that a pack runs other people\'s code where a lesson needs a pack', () => {
    for (const id of ['audio-speech', 'audio-foley', 'audio-transcribe', 'face-restore']) {
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
  const sections = ['nodes', 'families', 'packs', 'folders', 'fields'] as const;

  it('is registered and says the same things in both languages, never blank', () => {
    expect(KNOWLEDGE_SETS).toContain(SOUND_3D_FACES_KNOWLEDGE);
    const { en, ru } = SOUND_3D_FACES_KNOWLEDGE;
    for (const section of sections) {
      expect(Object.keys(ru[section]).sort(), section).toEqual(Object.keys(en[section]).sort());
    }
    const strings = (texts: KnowledgeSetTexts) => sections.flatMap((section) => Object.values(texts[section]).flatMap((item) => (typeof item === 'string' ? [item] : Object.values(item))));
    for (const text of strings(en)) {
      expect(text.trim().length, text).toBeGreaterThan(5);
      expect(/[а-яё]/i.test(text), text).toBe(false);
    }
    for (const text of strings(ru)) {
      expect(text.trim().length, text).toBeGreaterThan(5);
      // A pack's list of node names may stay in Latin letters; every other text is Russian.
      if (!Object.values(ru.packs).some((pack) => pack.nodes === text)) expect(/[а-яё]/i.test(text), text).toBe(true);
    }
    for (const classType of Object.keys(en.nodes)) {
      expect(en.nodes[classType].what && en.nodes[classType].why && en.nodes[classType].connect, classType).toBeTruthy();
      expect(Boolean(ru.nodes[classType].risk), classType).toBe(Boolean(en.nodes[classType].risk));
      expect([...CORE_NODE_CLASSES, ...IMAGE_MODEL_NODE_CLASSES].includes(classType as never), `${classType} is described by another set`).toBe(false);
    }
    expect(Object.keys(SOUND_3D_FACES_KNOWLEDGE.docs.nodes).sort()).toEqual(Object.keys(en.nodes).sort());
    expect(Object.keys(SOUND_3D_FACES_KNOWLEDGE.docs.families).sort()).toEqual(Object.keys(en.families).sort());
  });

  it('describes every node class of the lessons, in the core pack or in the set', () => {
    for (const language of ['en', 'ru'] as const) {
      const known = new Set<string>([...CORE_NODE_CLASSES, ...IMAGE_MODEL_NODE_CLASSES, ...Object.keys(SOUND_3D_FACES_KNOWLEDGE[language].nodes)]);
      for (const lesson of SOUND_3D_FACES_LESSONS) {
        for (const spec of rolesOf(lesson)) expect(spec.classes.some((classType) => known.has(classType)), `${language}/${lesson.id}: ${spec.classes.join(', ')}`).toBe(true);
      }
      expect(CORE_KNOWLEDGE[language].nodes.CLIPVisionEncode.what.length).toBeGreaterThan(5);
    }
  });

  it('describes the packs, the model folders and the fields of the domain', () => {
    for (const pack of ['ComfyUI-MMAudio', 'ComfyUI-HunyuanVideo-Foley', 'ComfyUI-Qwen-TTS', 'ComfyUI-Whisper', 'ComfyUI_AudioTools', 'ComfyUI-3D-Pack', 'ComfyUI-Trellis2', 'ComfyUI-UniRig', 'ComfyUI_InfiniteYou', 'ComfyUI-ReActor']) {
      for (const language of ['en', 'ru'] as const) expect(packNote(pack, language)?.what, `${language} ${pack}`).toBeTruthy();
    }
    for (const folder of ['mmaudio', 'foley', 'qwen-tts', 'stt', 'audio_encoders', 'demucs', 'facerestore_models', 'facedetection', 'insightface', 'photomaker', 'ipadapter', 'unirig']) {
      expect(modelFolderNote(folder, 'en'), folder).toBeTruthy();
      expect(modelFolderNote(folder, 'ru'), folder).toBeTruthy();
    }
    expect(modelFolderNote('nope', 'en')).toBeNull();
    expect(packNote('nope', 'ru')).toBeNull();
    // Every field a lesson asks a number or a choice for has a note, and the note says the lesson's number.
    expect(fieldNote('EmptyAceStep1.5LatentAudio', 'seconds', 'en')).toMatch(/120/);
    expect(fieldNote('VoxelToMesh', 'threshold', 'ru')).toMatch(/0\.6/);
    expect(fieldNote('FL_ChatterboxTTS', 'exaggeration', 'en')).toMatch(/0\.5/);
    expect(fieldNote('KSampler', 'nope', 'en')).toBeNull();
  });

  it('says the rule wherever a face or a voice is put onto someone', () => {
    for (const language of ['en', 'ru'] as const) {
      const texts = SOUND_3D_FACES_KNOWLEDGE[language];
      const rule = language === 'en' ? /consent.*explicit.*minor/ : /согласия.*откровенном.*несовершеннолетним/;
      for (const classType of ['ReActorFaceSwap', 'FL_ChatterboxTTS', 'PhotoMakerEncode']) expect(texts.nodes[classType].risk, `${language} ${classType}`).toMatch(rule);
      for (const family of ['chatterbox', 'qwen-tts', 'photomaker', 'infiniteyou', 'ipadapter-faceid']) expect(texts.families[family].risk, `${language} ${family}`).toMatch(rule);
      for (const pack of ['ComfyUI-ReActor', 'ComfyUI_Fill-ChatterBox', 'ComfyUI-Qwen-TTS', 'ComfyUI_InfiniteYou']) expect(texts.packs[pack].limits, `${language} ${pack}`).toMatch(rule);
    }
  });

  it('is seeded as explanations with the core knowledge, linked to docs.comfy.org or to the pack\'s repository', () => {
    for (const language of ['en', 'ru'] as const) {
      const seeds = coreSeeds(language);
      expect(seeds.some((seed) => seed.owner.id === 'MMAudioSampler' && seed.aspect === 'what')).toBe(true);
      expect(seeds.some((seed) => seed.owner.kind === 'family' && seed.owner.id === 'ace-step')).toBe(true);
      expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
      for (const seed of seeds) if (seed.sourceUrl) expect(['docs.comfy.org', 'github.com']).toContain(new URL(seed.sourceUrl).hostname);
    }
  });
});
