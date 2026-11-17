/**
 * Tests of the lessons and the built-in knowledge on picture model families (src/shared/lessons/sets/image-models.ts,
 * src/shared/knowledge/sets/image-models*.ts): every lesson fits the fake ComfyUI and runs to its end, a step says
 * the number "Do this for me" sets, the checks catch what each family gets wrong, and the knowledge exists in both
 * languages and is seeded with the core set.
 */
import { answerAll, isPersonStep, type StepAnswers } from '../../src/shared/lessons/steps';
import { describe, expect, it } from 'vitest';
import { fixFor, lessonProgress, type ClassPorts, type Lesson, type LessonGraph, type LessonNode, type Missing } from '../../src/shared/lessons/engine';
import { fits, groupGaps, lessonFit } from '../../src/shared/lessons/fit';
import { LESSON_AFTER, LESSON_PATH, LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import { IMAGE_MODEL_LESSONS } from '../../src/shared/lessons/sets/image-models';
import { lessonWords } from '../../src/shared/lessons/texts';
import { CORE_KNOWLEDGE, CORE_NODE_CLASSES, coreSeeds, familyNote } from '../../src/shared/knowledge/coreKnowledge';
import {
  GUIDED_FAMILIES,
  IMAGE_MODEL_NODE_CLASSES,
  IMAGE_MODELS_KNOWLEDGE,
  NEW_FAMILIES,
  familyGuide,
  fieldNote,
  imageModelSeeds,
} from '../../src/shared/knowledge/sets/image-models';
import { CLASSES, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';

/** The fake ComfyUI's classes, the picture-model ones among them, as the lessons see a node. */
const DEFS = new Map([...CLASSES, ...VIDEO_CLASSES].map((def) => [def.classType, def]));

const ports: ClassPorts = (classType) => {
  const def = DEFS.get(classType);
  if (!def) return null;
  const names = def.outputName ?? def.output;
  return { inputs: [...Object.keys(def.required ?? {}), ...Object.keys(def.optional ?? {})], outputs: def.output.map((type, index) => ({ name: names[index] ?? type, type })) };
};
const installed = (classType: string) => DEFS.has(classType);

class Canvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;

  add(classType: string): LessonNode {
    const def = DEFS.get(classType);
    if (!def) throw new Error(`no class ${classType}`);
    const specs = Object.entries({ ...def.required, ...def.optional });
    const names = def.outputName ?? def.output;
    const values: Record<string, unknown> = {};
    for (const [name, [type, options]] of specs) {
      if (Array.isArray(type)) values[name] = (options as { default?: unknown } | undefined)?.default ?? type[0];
      else if (['INT', 'FLOAT', 'STRING', 'BOOLEAN'].includes(type)) values[name] = (options as { default?: unknown } | undefined)?.default ?? (type === 'STRING' ? '' : 0);
    }
    const node: LessonNode = {
      id: String(this.next),
      classType,
      inputs: specs.map(([name, [type]], index) => ({ id: `in-${index}`, name, type: Array.isArray(type) ? 'COMBO' : type })),
      outputs: def.output.map((type, index) => ({ id: `out-${index}`, name: names[index] ?? type, type })),
      values,
      // What a fresh node starts with: a lesson does not count it as the person's choice of a number.
      defaults: { ...values },
    };
    this.next += 1;
    this.nodes.push(node);
    return node;
  }

  connect(from: string, fromPort: string, to: string, toPort: string): void {
    this.links = this.links.filter((link) => !(link.to === to && link.toPort === toPort));
    this.links.push({ from, fromPort, to, toPort });
  }

  remove(id: string): void {
    this.nodes = this.nodes.filter((node) => node.id !== id);
    this.links = this.links.filter((link) => link.from !== id && link.to !== id);
  }

  node(id: string): LessonNode {
    return this.nodes.find((node) => node.id === id)!;
  }

  port(id: string, name: string, side: 'in' | 'out' = 'in'): string {
    const node = this.node(id);
    return (side === 'in' ? node.inputs : node.outputs).find((port) => port.name === name)!.id;
  }
}

/** What only the person decides: which file, what words. */
function decide(canvas: Canvas, missing: Missing): void {
  if (missing.kind !== 'field') throw new Error(`nothing to decide for ${JSON.stringify(missing)}`);
  const node = canvas.node(missing.nodeId);
  if (missing.test.kind === 'chosen') node.values[missing.field] = 'chosen.safetensors';
  else if (missing.test.kind === 'differs') node.values[missing.field] = `other-${missing.nodeId}`;
  // A file of the kind the step names, as a model page names it.
  else if (missing.test.kind === 'file') node.values[missing.field] = missing.test.want.example;
  else if (missing.test.kind === 'text') node.values[missing.field] = `scenery, mountain lake, sunrise, pine trees, mist, a quiet morning ${(missing.test.has ?? []).join(' ')}`.slice(0, Math.max(missing.test.minChars + 40, 80));
  else throw new Error(`the lesson fixes this itself: ${JSON.stringify(missing)}`);
}

const readIds = (lesson: Lesson) => new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));

function carryOut(lesson: Lesson, canvas: Canvas): void {
  const read = new Set<string>();
  const answers: Record<string, StepAnswers> = {};
  for (let guard = 0; guard < 400; guard += 1) {
    const progress = lessonProgress(lesson, canvas, {}, read, answers);
    if (progress.current === lesson.steps.length) return;
    const step = lesson.steps[progress.current];
    if (step.read) {
      read.add(step.id);
      continue;
    }
    if (isPersonStep(step)) {
      expect(answers[step.id], `${lesson.id}/${step.id}: only one simulated answer`).toBeUndefined();
      answers[step.id] = answerAll(step);
      continue;
    }
    const missing = progress.missing[0];
    const fix = fixFor(missing, canvas, installed);
    if (!fix) decide(canvas, missing);
    else if (fix.kind === 'add-node') canvas.add(fix.classType);
    else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    else canvas.node(fix.nodeId).values[fix.field] = fix.value;
  }
  throw new Error(`${lesson.id} did not come to its end`);
}

function build(id: string): Canvas {
  const canvas = new Canvas();
  const chain = (lessonId: string): string[] => {
    const before = LESSON_AFTER[lessonId]?.[0];
    return before ? [...chain(before), before] : [];
  };
  for (const before of chain(id)) carryOut(lessonById(before)!, canvas);
  carryOut(lessonById(id)!, canvas);
  return canvas;
}

const progressOf = (id: string, canvas: Canvas) => {
  const lesson = lessonById(id)!;
  return lessonProgress(lesson, canvas, {}, readIds(lesson), Object.fromEntries(lesson.steps.filter(isPersonStep).map((step) => [step.id, answerAll(step)])));
};
const stepAt = (id: string, canvas: Canvas) => lessonById(id)!.steps[progressOf(id, canvas).current]?.id ?? 'end';

describe('the lessons on picture model families', () => {
  it('are registered, each with words in both languages and a place on the learning path', () => {
    expect(IMAGE_MODEL_LESSONS.length).toBeGreaterThanOrEqual(8);
    for (const lesson of IMAGE_MODEL_LESSONS) {
      expect(LESSONS.find((item) => item.id === lesson.id)?.steps.slice(0, lesson.steps.length)).toEqual(lesson.steps);
      expect(lessonWords('ru', lesson.id), lesson.id).not.toBeNull();
      expect(lessonWords('en', lesson.id), lesson.id).not.toBeNull();
      const path = LESSON_PATH[lesson.id];
      expect(path, lesson.id).toBeDefined();
      expect(path.group.title.ru).toMatch(/[а-яё]/i);
      expect(path.group.title.en).not.toMatch(/[а-яё]/i);
      for (const other of path.follows) expect(lessonById(other), `${lesson.id} follows ${other}`).not.toBeNull();
    }
  });

  it('fit the fake ComfyUI with its picture-model nodes, and run from an empty canvas to the end', () => {
    for (const lesson of IMAGE_MODEL_LESSONS) {
      expect(fits(lessonFit(lesson, ports)), lesson.id).toBe(true);
      const canvas = build(lesson.id);
      expect(stepAt(lesson.id, canvas), lesson.id).toBe('end');
    }
  });

  it('say in the text of a step the number that "Do this for me" sets', () => {
    const said: string[] = [];
    for (const lesson of IMAGE_MODEL_LESSONS) {
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const value = spec.test.kind === 'between' ? spec.test.prefer : spec.test.kind === 'equals' ? spec.test.value : undefined;
          if (value === undefined) continue;
          expect(spec.test.kind !== 'between' || spec.test.prefer !== undefined, `${lesson.id}/${step.id}/${spec.field} has a preferred value`).toBe(true);
          for (const language of ['ru', 'en'] as const) {
            const body = lessonWords(language, lesson.id)!.steps[step.id].body;
            const shown = typeof value === 'number' ? String(value) : `\`${String(value)}\``;
            if (!body.includes(shown)) said.push(`${language}/${lesson.id}/${step.id}: ${spec.field} ${shown}`);
          }
        }
      }
    }
    expect(said, 'numbers and values a step sets but does not say').toEqual([]);
  });

  it('have an explanation for every field they set, in both languages', () => {
    const missing: string[] = [];
    for (const lesson of IMAGE_MODEL_LESSONS) {
      const classOf = new Map(lesson.steps.flatMap((step) => step.roles ?? []).map((spec) => [spec.role, spec.classes[0]]));
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const classType = classOf.get(spec.role) ?? lessonById(LESSON_AFTER[lesson.id]?.[0] ?? '')?.steps.flatMap((item) => item.roles ?? []).find((item) => item.role === spec.role)?.classes[0];
          for (const language of ['ru', 'en'] as const) {
            if (!classType || !fieldNote(classType, spec.field, language)) missing.push(`${language}/${lesson.id}: ${classType}.${spec.field}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('have knowledge about every node they use', () => {
    const known = new Set<string>([...CORE_NODE_CLASSES, ...IMAGE_MODEL_NODE_CLASSES]);
    for (const lesson of IMAGE_MODEL_LESSONS) {
      for (const spec of lesson.steps.flatMap((step) => step.roles ?? [])) {
        for (const classType of spec.classes) {
          if (DEFS.has(classType)) expect(known.has(classType), `${lesson.id}: ${classType}`).toBe(true);
        }
      }
    }
  });
});

describe('what the lessons on picture models check', () => {
  it('Flux: the guidance node between the prompt and the sampler keeps the graph whole, and a wrong encoder type is named', () => {
    const canvas = build('flux');
    const roles = progressOf('flux', canvas).roles;
    expect(canvas.node(roles.guidance).values.guidance).toBe(3.5);
    expect(canvas.node(roles.sampler).values.cfg).toBe(1);
    canvas.node(roles.clip).values.type = 'sdxl';
    expect(stepAt('flux', canvas)).toBe('text-encoders');
    expect(progressOf('flux', canvas).missing).toContainEqual(expect.objectContaining({ kind: 'field', field: 'type', test: { kind: 'equals', value: 'flux' } }));
  });

  it('Flux: two text encoder fields holding one file are not two encoders', () => {
    const canvas = build('flux');
    const roles = progressOf('flux', canvas).roles;
    canvas.node(roles.clip).values.clip_name2 = canvas.node(roles.clip).values.clip_name1;
    expect(stepAt('flux', canvas)).toBe('text-encoders');
  });

  it('Z-Image Turbo: "Do this for me" sets 8 steps, cfg 1 and the shift of the template', () => {
    const canvas = build('zimage-turbo');
    const roles = progressOf('zimage-turbo', canvas).roles;
    expect(canvas.node(roles.sampler).values).toMatchObject({ steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple' });
    expect(canvas.node(roles.shift).values.shift).toBe(3);
    // A cfg of SDXL takes the lesson back to its settings.
    canvas.node(roles.sampler).values.cfg = 7;
    expect(stepAt('zimage-turbo', canvas)).toBe('settings');
  });

  it('Qwen-Image: the size and the shift of the family', () => {
    const canvas = build('qwen-image');
    const roles = progressOf('qwen-image', canvas).roles;
    expect(canvas.node(roles.latent).values).toMatchObject({ width: 1328, height: 1328 });
    expect(canvas.node(roles.shift).values.shift).toBe(3.1);
    expect(canvas.node(roles.clip).values.type).toBe('qwen_image');
  });

  it('Flux.2 Klein: the schedule must have the size of the empty latent', () => {
    const canvas = build('flux2-klein');
    const roles = progressOf('flux2-klein', canvas).roles;
    canvas.node(roles.latent).values.width = 832;
    expect(stepAt('flux2-klein', canvas)).toBe('schedule');
    canvas.node(roles.latent).values.width = 1024;
    expect(stepAt('flux2-klein', canvas)).toBe('end');
    canvas.node(roles.schedule).values.width = 768;
    expect(stepAt('flux2-klein', canvas)).toBe('schedule');
    expect(progressOf('flux2-klein', canvas).missing).toContainEqual(expect.objectContaining({ kind: 'field', field: 'width', test: { kind: 'same', role: 'latent', field: 'width' } }));
  });

  it('GGUF: the loader may feed the shift node of a Z-Image graph instead of the sampler', () => {
    const canvas = new Canvas();
    carryOut(lessonById('zimage-turbo')!, canvas);
    const z = progressOf('zimage-turbo', canvas).roles;
    const gguf = canvas.add('UnetLoaderGGUF');
    canvas.connect(gguf.id, canvas.port(gguf.id, 'MODEL', 'out'), z.shift, canvas.port(z.shift, 'model'));
    canvas.remove(z.unet);
    const lesson = lessonById('gguf')!;
    expect(lessonProgress(lesson, canvas, {}, readIds(lesson)).current).toBe(lesson.steps.length);
  });

  it('GGUF: without the pack the lesson names it as the pack to install', () => {
    const without: ClassPorts = (classType) => (classType.includes('GGUF') ? null : ports(classType));
    const fit = lessonFit(lessonById('gguf')!, without);
    expect(fits(fit)).toBe(false);
    expect(groupGaps(fit.gaps, (classType) => classType).groups.map((group) => group.pack)).toContain('ComfyUI-GGUF');
  });

  it('SDXL and the tag families stand on the first picture and set their own size', () => {
    const sdxl = build('sdxl');
    expect(stepAt('image', sdxl)).toBe('end');
    const latent = sdxl.node(progressOf('sdxl', sdxl).roles.latent);
    expect(latent.values).toMatchObject({ width: 1024, height: 1024 });
    const tags = build('tags');
    const portrait = tags.node(progressOf('tags', tags).roles.latent);
    expect(portrait.values).toMatchObject({ width: 832, height: 1216 });
    // A sentence without a comma is not a tag prompt.
    tags.node(progressOf('tags', tags).roles.positive).values.text = 'A quiet mountain lake at sunrise with pine trees around it';
    expect(stepAt('tags', tags)).toBe('tags');
  });

  it('the sampler comparison holds only while one setting differs', () => {
    const canvas = build('samplers');
    const roles = progressOf('samplers', canvas).roles;
    canvas.node(roles.samplerB).values.sampler_name = canvas.node(roles.sampler).values.sampler_name;
    expect(stepAt('samplers', canvas)).toBe('other');
    canvas.node(roles.samplerB).values.sampler_name = 'dpmpp_2m';
    canvas.node(roles.samplerB).values.seed = 42;
    expect(stepAt('samplers', canvas)).toBe('same');
  });
});

describe('knowledge on picture model families', () => {
  it('has every node, guide, family, field and pack in both languages, the Russian in Russian', () => {
    const { en, ru } = IMAGE_MODELS_KNOWLEDGE;
    for (const classType of IMAGE_MODEL_NODE_CLASSES) {
      for (const aspect of ['what', 'why', 'connect'] as const) {
        expect(en.nodes[classType][aspect].trim(), `en ${classType} ${aspect}`).not.toBe('');
        expect(ru.nodes[classType][aspect], `ru ${classType} ${aspect}`).toMatch(/[а-яё]/i);
      }
      expect(Boolean(en.nodes[classType].risk), classType).toBe(Boolean(ru.nodes[classType].risk));
      // Not said twice: the core set does not have these classes.
      expect((CORE_NODE_CLASSES as readonly string[]).includes(classType), classType).toBe(false);
    }
    for (const family of GUIDED_FAMILIES) {
      expect(CORE_KNOWLEDGE.en.families[family], family).toBeDefined();
      for (const language of ['en', 'ru'] as const) {
        const guide = familyGuide(family, language)!;
        for (const part of [guide.files, guide.settings, guide.prompt]) expect(part.trim().length, `${language} ${family}`).toBeGreaterThan(20);
      }
    }
    for (const family of NEW_FAMILIES) {
      expect(familyNote(family, 'en')?.what, family).toBeTruthy();
      expect(familyNote(family, 'ru')?.risk, family).toMatch(/[а-яё]/i);
    }
    expect(Object.keys(ru.fields).sort()).toEqual(Object.keys(en.fields).sort());
    expect(Object.keys(ru.packs).sort()).toEqual(Object.keys(en.packs).sort());
    for (const [key, texts] of Object.entries(ru.fields)) expect(`${texts.what} ${texts.set}`, key).toMatch(/[а-яё]/i);
    for (const [key, texts] of Object.entries(en.fields)) expect(`${texts.what} ${texts.set}`, key).not.toMatch(/[а-яё]/i);
    expect(en.packs['ComfyUI-GGUF'].what).toMatch(/other people's code/);
    expect(ru.packs['ComfyUI-GGUF'].what).toMatch(/чужой код/);
  });

  it('is seeded with the core knowledge, with the same ids in both languages', () => {
    const en = imageModelSeeds('en');
    const ru = imageModelSeeds('ru');
    expect(en.map((seed) => seed.id.replace(/^seed:en:/, ''))).toEqual(ru.map((seed) => seed.id.replace(/^seed:ru:/, '')));
    const all = new Set(coreSeeds('en').map((seed) => seed.id));
    for (const seed of en) expect(all.has(seed.id), seed.id).toBe(true);
    // No seed of this set takes the place of a core one.
    expect(new Set(coreSeeds('en').map((seed) => seed.id)).size).toBe(coreSeeds('en').length);
    expect(en.find((seed) => seed.id === 'seed:en:family:flux1:next')?.text).toMatch(/sentences/);
    expect(en.find((seed) => seed.id === 'seed:en:nodeClass:UnetLoaderGGUF:what')?.sourceUrl).toMatch(/^https:\/\/github\.com\//);
  });

  it('says what ComfyUI does with clip skip on SDXL, the way its source does', () => {
    expect(fieldNote('CLIPSetLastLayer', 'stop_at_clip_layer', 'en')?.set).toMatch(/already read -2/);
    expect(fieldNote('CLIPSetLastLayer', 'stop_at_clip_layer', 'ru')?.set).toMatch(/уже читают -2/);
    expect(fieldNote('KSampler', 'nope', 'en')).toBeNull();
  });
});
