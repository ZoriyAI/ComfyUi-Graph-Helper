/**
 * Tests of the video lessons and the built-in knowledge about video (lessons/sets/video.ts,
 * knowledge/sets/video*.ts): the lessons are registered with titled groups, fit a ComfyUI that has their nodes and
 * name each pack; their words state the memory and time cost first, the consent rule where a face, body or voice is
 * carried over, the very numbers the checks want and the files to fetch; the knowledge matches in both languages and
 * covers every node the lessons use. Video is the heaviest work a person does here, so the cost must be said early.
 */
import { describe, expect, it } from 'vitest';
import { lessonGaps, rolesOf, type ClassPorts } from '../../src/shared/lessons/engine';
import { packOf } from '../../src/shared/lessons/fit';
import { LESSON_AFTER, LESSON_PATH, LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import { VIDEO_FILE_KINDS, VIDEO_LESSONS, VIDEO_PACK_OF } from '../../src/shared/lessons/sets/video';
import { lessonWords } from '../../src/shared/lessons/texts';
import {
  CORE_KNOWLEDGE, CORE_NODE_CLASSES, conceptNote, coreSeeds, familyNote, fieldNote, linkTypeNote, packNote, type KnowledgeLanguage,
} from '../../src/shared/knowledge/coreKnowledge';
import { VIDEO_KNOWLEDGE_EN } from '../../src/shared/knowledge/sets/video.en';
import { VIDEO_KNOWLEDGE_RU } from '../../src/shared/knowledge/sets/video.ru';
import { VIDEO_SET_CLASSES, videoSetSpecs } from '../fixtures/mcp/classes/video';
import { CLASSES, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

const LANGUAGES: KnowledgeLanguage[] = ['en', 'ru'];

/** The fake ComfyUI with its video nodes, as the lesson list sees it. */
const ports: ClassPorts = (classType) => {
  const all = [...CLASSES, ...VIDEO_CLASSES];
  const item = all.find((def) => def.classType === classType);
  if (!item) return null;
  const names = item.outputName ?? item.output;
  return { inputs: [...Object.keys(item.required ?? {}), ...Object.keys(item.optional ?? {})], outputs: item.output.map((type, index) => ({ name: names[index] ?? type, type })) };
};

describe('the video lessons are registered and fit a ComfyUI that has their nodes', () => {
  it('are in the list, each with a group that has a title in both languages', () => {
    for (const lesson of VIDEO_LESSONS) {
      expect(lessonById(lesson.id), lesson.id).toBe(lesson);
      const path = LESSON_PATH[lesson.id];
      expect(path, lesson.id).toBeDefined();
      expect(path.group.title.ru).toMatch(/[а-яё]/i);
      expect(path.group.title.en).not.toMatch(/[а-яё]/i);
      for (const other of path.follows) expect(lessonById(other), `${lesson.id} follows ${other}`).not.toBeNull();
    }
    expect(VIDEO_LESSONS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length);
    expect(LESSON_AFTER['video-memory']).toEqual(['video-small']);
    expect(LESSON_PATH['anchor-reference'].group.id).toBe('video-anchor');
  });

  it('fit the fake ComfyUI, whose video nodes are the ones the lessons name', () => {
    for (const lesson of VIDEO_LESSONS) expect(lessonGaps(lesson, ports), lesson.id).toEqual([]);
    // The fixture says the same in both of its forms.
    const specs = videoSetSpecs();
    for (const def of VIDEO_SET_CLASSES) {
      expect(specs[def.classType].inputs.map(([name]) => name)).toEqual([...Object.keys(def.required ?? {}), ...Object.keys(def.optional ?? {})]);
    }
  });

  it('name the pack of each pack node they use', () => {
    expect(packOf('VHS_LoadVideo')).toBe('ComfyUI-VideoHelperSuite');
    expect(packOf('SeedVR2VideoUpscaler')).toBe('ComfyUI-SeedVR2_VideoUpscaler');
    expect(packOf('ProPainterInpaint')).toBe('ComfyUI_ProPainter_Nodes');
    expect(packOf('RIFE VFI')).toBe('ComfyUI-Frame-Interpolation');
    expect(packOf('CoTrackerNode')).toBe('comfyui_cotracker_node');
    expect(packOf('ImageResizeKJv2')).toBe('ComfyUI-KJNodes');
    // ComfyUI's own nodes stay ComfyUI's, the SeedVR2 nodes built into it included.
    for (const classType of ['FrameInterpolate', 'LTXVConditioning', 'WanHuMoImageToVideo', 'SeedVR2Conditioning', 'CreateVideo']) expect(packOf(classType), classType).toBeNull();
    for (const [, pack] of VIDEO_PACK_OF) for (const language of LANGUAGES) expect(packNote(pack, language), `${language}/${pack}`).not.toBeNull();
  });
});

describe('the words of the video lessons', () => {
  const body = (language: string, lessonId: string, stepId: string) => lessonWords(language, lessonId)!.steps[stepId].body;

  it('say the cost in memory and time at the start', () => {
    for (const lesson of VIDEO_LESSONS) {
      const intro = lesson.steps[0];
      expect(intro.read, lesson.id).toBe(true);
      expect(body('en', lesson.id, intro.id), lesson.id).toMatch(/memory|GB|card/i);
      expect(body('ru', lesson.id, intro.id), lesson.id).toMatch(/памят|ГБ|карт/i);
      expect(body('en', lesson.id, intro.id), lesson.id).toMatch(/minute|second|long|slow|quick|fast|run/i);
    }
  });

  it('start with the consent rule wherever a face, a body or a voice is carried onto something', () => {
    const voice = { en: 'Only someone who agrees may be voiced this way', ru: 'Озвучивать так можно только того, кто на это согласен' };
    const body2 = { en: 'Only someone who agrees may be brought to life this way', ru: 'Оживлять так можно только того, кто на это согласен' };
    for (const language of ['en', 'ru'] as const) {
      expect(body(language, 'video-speech', 'intro').startsWith(voice[language])).toBe(true);
      expect(body(language, 'video-control', 'intro').startsWith(body2[language])).toBe(true);
      // The anchor thread uses pictures of people throughout: each lesson starts with the rule and names the limits.
      for (const id of ['anchor-start', 'video-flf', 'anchor-reference', 'anchor-parts']) {
        expect(body(language, id, 'intro').startsWith(body2[language]), `${language}/${id}`).toBe(true);
        expect(body(language, id, 'intro'), `${language}/${id}`).toMatch(language === 'en' ? /under 18/ : /младше 18/);
      }
      // The same words as the talking-portrait lesson that came first.
      expect(body(language, 'wrapper-talk', 'intro')).toContain(voice[language]);
      expect(body(language, 'wrapper-animate', 'intro')).toContain(body2[language]);
    }
  });

  it('name in the text the very number a rule prefers or asks for', () => {
    const missing: string[] = [];
    for (const lesson of VIDEO_LESSONS) {
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const value = spec.test.kind === 'between' ? spec.test.prefer : spec.test.kind === 'equals' ? spec.test.value : undefined;
          if (value === undefined) continue;
          for (const language of ['en', 'ru'] as const) {
            const text = body(language, lesson.id, step.id);
            const said = typeof value === 'number' ? new RegExp(`(^|[^\\d.])${String(value).replace('.', '\\.')}(?![\\d])`).test(text) : text.includes(String(value));
            if (!said) missing.push(`${language}/${lesson.id}/${step.id}: ${spec.field} ${String(value)}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('say which files each lesson needs and send to the folder or the template where they are', () => {
    for (const lesson of VIDEO_LESSONS) {
      const all = (language: string) => Object.values(lessonWords(language, lesson.id)!.steps).map((step) => step.body).join('\n');
      const kinds = VIDEO_FILE_KINDS[lesson.id];
      expect(kinds, lesson.id).toBeDefined();
      for (const kind of kinds) expect(rolesOf(lesson).some((spec) => spec.role === kind.role), `${lesson.id}/${kind.role}`).toBe(true);
      if (kinds.length > 0) {
        expect(all('en'), lesson.id).toMatch(/models\/|template/);
        expect(all('ru'), lesson.id).toMatch(/models\/|шаблон/);
      }
    }
  });

  it('say that a pack runs other people\'s code where a lesson needs one', () => {
    for (const id of ['video-vhs', 'video-upscale', 'video-remove']) {
      expect(body('en', id, 'intro')).toContain('runs other people\'s code');
      expect(body('ru', id, 'intro')).toContain('чужой код');
    }
  });
});

describe('the built-in knowledge about video', () => {
  it('has the same entries in both languages', () => {
    for (const part of ['nodes', 'linkTypes', 'families', 'packs', 'fields', 'concepts'] as const) {
      expect(Object.keys(VIDEO_KNOWLEDGE_RU[part] ?? {}).sort(), part).toEqual(Object.keys(VIDEO_KNOWLEDGE_EN[part] ?? {}).sort());
    }
    for (const [classType, fields] of Object.entries(VIDEO_KNOWLEDGE_EN.fields)) {
      expect(Object.keys(VIDEO_KNOWLEDGE_RU.fields[classType]).sort(), classType).toEqual(Object.keys(fields).sort());
    }
    for (const [classType, texts] of Object.entries(VIDEO_KNOWLEDGE_EN.nodes)) {
      const ru = VIDEO_KNOWLEDGE_RU.nodes[classType];
      expect(Boolean(ru.risk), classType).toBe(Boolean(texts.risk));
      for (const aspect of ['what', 'why', 'connect'] as const) {
        expect(texts[aspect].length, `en/${classType}/${aspect}`).toBeGreaterThan(10);
        expect(ru[aspect].length, `ru/${classType}/${aspect}`).toBeGreaterThan(10);
      }
    }
  });

  it('describes every node the video lessons use, and the ones the first video lessons used without a word', () => {
    const known = new Set<string>([...CORE_NODE_CLASSES, ...Object.keys(VIDEO_KNOWLEDGE_EN.nodes)]);
    const lessons = LESSONS.filter((lesson) => lesson.id.startsWith('video') || VIDEO_LESSONS.includes(lesson));
    for (const lesson of lessons) for (const spec of rolesOf(lesson)) expect(known.has(spec.classes[0]), `${lesson.id}: ${spec.classes[0]}`).toBe(true);
    for (const classType of ['ModelSamplingSD3', 'EmptyHunyuanLatentVideo', 'WanImageToVideo', 'CreateVideo', 'SaveVideo', 'LoadVideo', 'GetVideoComponents', 'LoadAudio']) {
      expect(known.has(classType), classType).toBe(true);
    }
  });

  it('is seeded with the core, one text per thing: what the set once corrected is the core now', () => {
    for (const language of LANGUAGES) {
      const seeds = coreSeeds(language);
      expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
      const latent = seeds.find((seed) => seed.owner.kind === 'linkType' && seed.owner.id === 'LATENT' && seed.aspect === 'what')!;
      expect(latent.text).toBe(CORE_KNOWLEDGE[language].linkTypes.LATENT.what);
      expect(latent.text).toContain('16 × 16');
      expect(seeds.some((seed) => seed.owner.kind === 'nodeClass' && seed.owner.id === 'WanImageToVideo')).toBe(true);
      expect(seeds.some((seed) => seed.owner.kind === 'linkType' && seed.owner.id === 'VIDEO')).toBe(true);
      expect(seeds.some((seed) => seed.owner.kind === 'family' && seed.owner.id === 'hunyuan15')).toBe(true);
    }
  });

  it('answers for families, link types, fields and packs', () => {
    expect(familyNote('wan2.2', 'en')!.risk).toContain('often work');
    expect(familyNote('kandinsky5', 'ru')!.what).toContain('Kandinsky');
    expect(familyNote('sdxl', 'en')).toEqual(CORE_KNOWLEDGE.en.families.sdxl);
    expect(linkTypeNote('audio', 'en')!.what).toContain('AUDIO');
    expect(linkTypeNote('MODEL', 'ru')).toEqual(CORE_KNOWLEDGE.ru.linkTypes.MODEL);
    expect(fieldNote('CreateVideo', 'fps', 'ru')).toContain('16');
    expect(fieldNote('CreateVideo', 'nothing', 'en')).toBeNull();
    expect(packNote('comfyui-videohelpersuite', 'en')!.nodes).toContain('Video Combine');
    expect(packNote('nobody', 'en')).toBeNull();
    for (const id of ['anchor-picture', 'identity-drift', 'reference-input']) {
      expect(conceptNote(id, 'en')!.term.length, id).toBeGreaterThan(3);
      expect(conceptNote(id, 'ru')!.text.length, id).toBeGreaterThan(30);
    }
  });
});
