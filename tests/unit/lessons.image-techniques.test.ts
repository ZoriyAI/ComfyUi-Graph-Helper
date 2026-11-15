/**
 * Tests of the lessons and the built-in knowledge on picture techniques (lessons/sets/image-techniques.ts and
 * knowledge/sets/image-techniques*.ts): each lesson is carried out on a small canvas and its graph is checked against
 * the template it follows; the knowledge is held to both languages and to its sources.
 */
import { describe, expect, it } from 'vitest';
import { fixFor, lessonProgress, type ClassPorts, type Lesson, type LessonGraph, type LessonNode } from '../../src/shared/lessons/engine';
import { fitLines, lessonFit, packOf } from '../../src/shared/lessons/fit';
import { LESSON_AFTER, LESSON_PATH, LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import { IMAGE_TECHNIQUE_LESSONS } from '../../src/shared/lessons/sets/image-techniques';
import { lessonWords } from '../../src/shared/lessons/texts';
import { conceptNote, CORE_NODE_CLASSES, coreSeeds, fieldNote, KNOWLEDGE_LANGUAGES, KNOWLEDGE_SETS, packNote } from '../../src/shared/knowledge/coreKnowledge';
import { IMAGE_TECHNIQUES_KNOWLEDGE, IMAGE_TECHNIQUES_KNOWLEDGE_DOCS, IMAGE_TECHNIQUE_PACK_SOURCES, IMAGE_TECHNIQUES_TEXTS } from '../../src/shared/knowledge/sets/image-techniques';
import { IMAGE_TECHNIQUE_LESSON_CLASSES } from '../fixtures/mcp/classes/image-techniques';
import { imageModelLessonSpecs } from '../fixtures/mcp/classes/image-models';

/** The base classes the lessons of this set stand on, as ComfyUI declares them (nodes.py). */
const BASE: Record<string, { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> }> = {
  CheckpointLoaderSimple: { inputs: [['ckpt_name', 'COMBO', 'first.safetensors']], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP'], ['VAE', 'VAE']] },
  CLIPTextEncode: { inputs: [['text', 'STRING', ''], ['clip', 'CLIP']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  EmptyLatentImage: { inputs: [['width', 'INT', 512], ['height', 'INT', 512], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  KSampler: {
    inputs: [['model', 'MODEL'], ['seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT'], ['denoise', 'FLOAT', 1]],
    outputs: [['LATENT', 'LATENT']],
  },
  VAEDecode: { inputs: [['samples', 'LATENT'], ['vae', 'VAE']], outputs: [['IMAGE', 'IMAGE']] },
  VAEEncode: { inputs: [['pixels', 'IMAGE'], ['vae', 'VAE']], outputs: [['LATENT', 'LATENT']] },
  SaveImage: { inputs: [['images', 'IMAGE'], ['filename_prefix', 'STRING', 'ComfyUI']], outputs: [] },
  PreviewImage: { inputs: [['images', 'IMAGE']], outputs: [] },
  LoadImage: { inputs: [['image', 'COMBO', 'example.png']], outputs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
  LoraLoader: {
    inputs: [['model', 'MODEL'], ['clip', 'CLIP'], ['lora_name', 'COMBO', 'first-lora.safetensors'], ['strength_model', 'FLOAT', 1], ['strength_clip', 'FLOAT', 1]],
    outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP']],
  },
  UNETLoader: { inputs: [['unet_name', 'COMBO', 'first.safetensors'], ['weight_dtype', 'COMBO', 'default']], outputs: [['MODEL', 'MODEL']] },
  CLIPLoader: { inputs: [['clip_name', 'COMBO', 'te.safetensors'], ['type', 'COMBO', 'stable_diffusion']], outputs: [['CLIP', 'CLIP']] },
  VAELoader: { inputs: [['vae_name', 'COMBO', 'vae.safetensors']], outputs: [['VAE', 'VAE']] },
  CLIPVisionLoader: { inputs: [['clip_name', 'COMBO', 'clip-vision.safetensors']], outputs: [['CLIP_VISION', 'CLIP_VISION']] },
};
const CLASSES = { ...BASE, ...imageModelLessonSpecs(), ...IMAGE_TECHNIQUE_LESSON_CLASSES };
const installed = (classType: string) => classType in CLASSES;
const ports: ClassPorts = (classType) => {
  const spec = CLASSES[classType];
  return spec ? { inputs: spec.inputs.map(([name]) => name), outputs: spec.outputs.map(([name, type]) => ({ name, type })) } : null;
};

class Canvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;
  add(classType: string): LessonNode {
    const spec = CLASSES[classType];
    const node: LessonNode = {
      id: String(this.next++),
      classType,
      inputs: spec.inputs.map(([name, type], index) => ({ id: `in-${index}`, name, type })),
      outputs: spec.outputs.map(([name, type], index) => ({ id: `out-${index}`, name, type })),
      values: Object.fromEntries(spec.inputs.filter((input) => input.length > 2).map(([name, , value]) => [name, value])),
    };
    this.nodes.push(node);
    return node;
  }
  connect(from: string, fromPort: string, to: string, toPort: string): void {
    this.links = this.links.filter((item) => !(item.to === to && item.toPort === toPort));
    this.links.push({ from, fromPort, to, toPort });
  }
  node(id: string): LessonNode {
    return this.nodes.find((item) => item.id === id)!;
  }
  /** The node whose output feeds this input of a node. */
  feeder(node: LessonNode, input: string): LessonNode | undefined {
    const port = node.inputs.find((item) => item.name === input)!;
    const into = this.links.find((item) => item.to === node.id && item.toPort === port.id);
    return into ? this.node(into.from) : undefined;
  }
}

/** Does what a lesson says, choosing files and words where only a person can. */
function carryOut(lesson: Lesson, canvas: Canvas): void {
  const read = new Set<string>();
  for (let guard = 0; guard < 400; guard += 1) {
    const progress = lessonProgress(lesson, canvas, {}, read);
    if (progress.current === lesson.steps.length) return;
    const step = lesson.steps[progress.current];
    if (step.read) {
      read.add(step.id);
      continue;
    }
    const missing = progress.missing[0];
    const fix = fixFor(missing, canvas, installed);
    if (fix?.kind === 'add-node') canvas.add(fix.classType);
    else if (fix?.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    else if (fix?.kind === 'set-field') canvas.node(fix.nodeId).values[fix.field] = fix.value;
    else if (missing.kind === 'field') canvas.node(missing.nodeId).values[missing.field] = missing.test.kind === 'differs' ? `other-${missing.nodeId}.safetensors` : 'a red wool hat on a man';
    else throw new Error(`${lesson.id}: cannot do ${JSON.stringify(missing)}`);
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

const only = (canvas: Canvas, classType: string) => canvas.nodes.filter((node) => node.classType === classType);

describe('the lessons on picture techniques', () => {
  it('are in the list, each in a group with a title in both languages, and continue lessons that exist', () => {
    for (const lesson of IMAGE_TECHNIQUE_LESSONS) {
      expect(LESSONS).toContain(lesson);
      const group = LESSON_PATH[lesson.id]?.group;
      expect(group?.title.en, lesson.id).toBeTruthy();
      for (const before of LESSON_PATH[lesson.id].follows) expect(lessonById(before), `${lesson.id} follows ${before}`).not.toBeNull();
      expect(group.title.ru).toMatch(/[а-яё]/i);
      for (const before of LESSON_AFTER[lesson.id] ?? []) expect(lessonById(before), `${lesson.id} after ${before}`).not.toBeNull();
    }
    expect(LESSON_PATH.detailer.group.id).toBe('packs-tools');
    expect(LESSON_PATH.img2img.group.id).toBe('image-techniques');
  });

  it('names in each step the number the app sets for it, in both languages', () => {
    for (const lesson of IMAGE_TECHNIQUE_LESSONS) {
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const value = spec.test.kind === 'between' ? spec.test.prefer : spec.test.kind === 'equals' ? spec.test.value : undefined;
          if (value === undefined) continue;
          for (const language of ['en', 'ru'] as const) {
            const body = lessonWords(language, lesson.id)!.steps[step.id].body;
            expect(body, `${language}/${lesson.id}/${step.id}: ${spec.field}`).toContain(String(value));
          }
        }
      }
    }
  });

  it('a picture from a picture feeds the sampler the encoded picture at the denoise its text names', () => {
    const canvas = build('img2img');
    const [sampler] = only(canvas, 'KSampler');
    expect(canvas.feeder(sampler, 'latent_image')?.classType).toBe('VAEEncode');
    expect(canvas.feeder(canvas.feeder(sampler, 'latent_image')!, 'pixels')?.classType).toBe('ImageScaleToTotalPixels');
    expect(sampler.values.denoise).toBe(0.6);
  });

  it('inpainting puts the inpainting node between the texts and the sampler, and the mask comes from the picture', () => {
    const canvas = build('inpaint');
    const [sampler] = only(canvas, 'KSampler');
    const inpaint = canvas.feeder(sampler, 'latent_image')!;
    expect(inpaint.classType).toBe('InpaintModelConditioning');
    expect(canvas.feeder(sampler, 'positive')).toBe(inpaint);
    expect(canvas.feeder(inpaint, 'mask')?.classType).toBe('LoadImage');
    expect(canvas.feeder(inpaint, 'positive')?.classType).toBe('CLIPTextEncode');
    expect(sampler.values.denoise).toBe(0.6);
  });

  it('a mask by words takes its own checkpoint and replaces the painted mask', () => {
    const canvas = build('mask-text');
    const [inpaint] = only(canvas, 'InpaintModelConditioning');
    const detect = canvas.feeder(inpaint, 'mask')!;
    expect(detect.classType).toBe('SAM3_Detect');
    const finder = canvas.feeder(detect, 'model')!;
    const checkpoints = only(canvas, 'CheckpointLoaderSimple');
    expect(checkpoints).toHaveLength(2);
    expect(finder.values.ckpt_name).not.toBe(checkpoints.find((node) => node !== finder)!.values.ckpt_name);
    expect(canvas.feeder(canvas.feeder(detect, 'conditioning')!, 'clip')).toBe(finder);
  });

  it('outpainting gives the inpainting node the frame and draws it at denoise 1', () => {
    const canvas = build('outpaint');
    const [inpaint] = only(canvas, 'InpaintModelConditioning');
    expect(canvas.feeder(inpaint, 'pixels')?.classType).toBe('ImagePadForOutpaint');
    expect(canvas.feeder(inpaint, 'mask')?.classType).toBe('ImagePadForOutpaint');
    expect(only(canvas, 'ImagePadForOutpaint')[0].values.right).toBe(256);
    expect(only(canvas, 'KSampler')[0].values.denoise).toBe(1);
  });

  it('a second pass redraws the enlarged picture with a second sampler at 0.5', () => {
    const canvas = build('hires-fix');
    const samplers = only(canvas, 'KSampler');
    expect(samplers).toHaveLength(2);
    const second = samplers.find((node) => canvas.feeder(node, 'latent_image')?.classType === 'VAEEncode')!;
    expect(second.values.denoise).toBe(0.5);
    expect(canvas.feeder(canvas.feeder(second, 'latent_image')!, 'pixels')?.classType).toBe('ImageScale');
  });

  it('ControlNet adds the edges to both descriptions; the depth lesson swaps them for a depth map', () => {
    const edges = build('controlnet');
    const [apply] = only(edges, 'ControlNetApplyAdvanced');
    const [sampler] = only(edges, 'KSampler');
    expect(edges.feeder(sampler, 'positive')).toBe(apply);
    expect(edges.feeder(sampler, 'negative')).toBe(apply);
    expect(edges.feeder(apply, 'image')?.classType).toBe('Canny');
    const depth = build('controlnet-depth');
    expect(depth.feeder(only(depth, 'ControlNetApplyAdvanced')[0], 'image')?.classType).toBe('DepthAnythingV2Preprocessor');
    expect(only(depth, 'DepthAnythingV2Preprocessor')[0].values.resolution).toBe(1024);
  });

  it('two LoRAs stand in a chain between the checkpoint and everything that used it', () => {
    const canvas = build('lora-image');
    const loras = only(canvas, 'LoraLoader');
    expect(loras).toHaveLength(2);
    const [sampler] = only(canvas, 'KSampler');
    const last = canvas.feeder(sampler, 'model')!;
    expect(last.classType).toBe('LoraLoader');
    expect(canvas.feeder(last, 'model')?.classType).toBe('LoraLoader');
    for (const text of only(canvas, 'CLIPTextEncode')) expect(canvas.feeder(text, 'clip')).toBe(last);
    expect(loras.map((node) => node.values.strength_model).sort()).toEqual([0.6, 0.8]);
  });

  it('the character lesson adds a third LoRA at half strength, and holds the description to the words of all three', () => {
    const canvas = build('lora-character');
    const loras = only(canvas, 'LoraLoader');
    expect(loras).toHaveLength(3);
    const last = canvas.feeder(only(canvas, 'KSampler')[0], 'model')!;
    expect(last.values.strength_model).toBe(0.5);
    expect(canvas.feeder(canvas.feeder(last, 'model')!, 'model')?.classType).toBe('LoraLoader');
    const trigger = lessonById('lora-character')!.steps.find((step) => step.id === 'trigger')!.fields![0].test;
    expect(trigger.kind === 'has-trigger' ? trigger.of : []).toHaveLength(3);
    // Consent and adults are said before anything is built.
    expect(lessonWords('en', 'lora-character')!.steps.intro.body).toMatch(/only with that person's consent[\s\S]*adults/);
    expect(lessonWords('ru', 'lora-character')!.steps.intro.body).toMatch(/только с его согласия[\s\S]*взрослые/);
  });

  it('editing by words, the style reference, IP-Adapter and the detailer end with the numbers of their templates', () => {
    const edit = build('edit-words');
    // The template's 40 steps are asked for; the 20 a fresh sampler starts with already fall in the range the lesson accepts.
    expect(only(edit, 'KSampler')[0].values.cfg).toBe(4);
    expect(only(edit, 'ModelSamplingAuraFlow')[0].values.shift).toBe(3.1);
    expect(only(edit, 'CLIPLoader')[0].values.type).toBe('qwen_image');
    const style = build('style-reference');
    expect(only(style, 'KSampler')[0].values.cfg).toBe(1);
    expect(style.feeder(only(style, 'KSampler')[0], 'positive')?.classType).toBe('StyleModelApply');
    expect(only(style, 'DualCLIPLoader')[0].values.type).toBe('flux');
    const ip = build('ipadapter');
    expect(only(ip, 'IPAdapter')[0].values).toMatchObject({ weight: 0.8, weight_type: 'style transfer' });
    expect(ip.feeder(only(ip, 'KSampler')[0], 'model')?.classType).toBe('IPAdapter');
    const face = build('detailer');
    const [detailer] = only(face, 'FaceDetailer');
    expect(face.feeder(detailer, 'image')?.classType).toBe('VAEDecode');
    expect(face.feeder(detailer, 'bbox_detector')?.classType).toBe('UltralyticsDetectorProvider');
  });

  it('removing a background saves the picture with the inverted mask as its transparency', () => {
    const canvas = build('remove-background');
    const [join] = only(canvas, 'JoinImageWithAlpha');
    expect(canvas.feeder(join, 'alpha')?.classType).toBe('InvertMask');
    expect(canvas.feeder(canvas.feeder(join, 'alpha')!, 'mask')?.classType).toBe('RemoveBackground');
    expect(canvas.feeder(only(canvas, 'SaveImage')[0], 'images')).toBe(join);
  });

  it('a lesson on a pack is offered only with the pack, says which pack is missing, and warns about other people\'s code', () => {
    const without = (missing: string[]): ClassPorts => (classType) => (missing.includes(classType) ? null : ports(classType));
    const t = (key: string, values?: Record<string, unknown>) => `${key}${values ? JSON.stringify(values) : ''}`;
    const cases: Array<[string, string, string]> = [
      ['detailer', 'FaceDetailer', 'ComfyUI-Impact-Pack'],
      ['detailer', 'UltralyticsDetectorProvider', 'ComfyUI-Impact-Subpack'],
      ['ipadapter', 'IPAdapter', 'ComfyUI_IPAdapter_plus'],
      ['controlnet-depth', 'DepthAnythingV2Preprocessor', 'comfyui_controlnet_aux'],
    ];
    for (const [id, classType, pack] of cases) {
      expect(packOf(classType)).toBe(pack);
      const lines = fitLines(lessonFit(lessonById(id)!, without([classType])), t, (name) => name, (name) => name);
      expect(lines.some((line) => line.includes(pack)), `${id} without ${classType}`).toBe(true);
    }
    expect(packOf('InpaintModelConditioning')).toBeNull();
    for (const id of ['detailer', 'ipadapter', 'controlnet-depth']) {
      expect(lessonWords('en', id)!.steps.intro.body).toContain("other people's code");
      expect(lessonWords('ru', id)!.steps.intro.body).toContain('чужой код');
    }
  });

  it('says that a detailer draws the face that is there, and that a face is carried only with consent', () => {
    expect(lessonWords('en', 'detailer')!.steps.intro.body).toContain("does not put another person's face");
    expect(lessonWords('ru', 'detailer')!.steps.intro.body).toContain('не ставит на его место лицо другого человека');
    expect(lessonWords('en', 'ipadapter')!.steps.tune.body).toContain('Get that consent first');
    expect(lessonWords('ru', 'ipadapter')!.steps.tune.body).toContain('получите это согласие');
    expect(lessonWords('en', 'edit-words')!.steps.families.body).toMatch(/cost money and send/);
    expect(lessonWords('ru', 'edit-words')!.steps.families.body).toMatch(/стоят денег и отправляют/);
  });
});

describe('the built-in knowledge on picture techniques', () => {
  const texts = IMAGE_TECHNIQUES_TEXTS;

  it('says the same things in both languages: the same nodes, packs, kinds of files and fields, the same optional notes', () => {
    for (const part of ['nodes', 'packs', 'topics', 'fields'] as const) {
      expect(Object.keys(texts.ru[part]).sort(), part).toEqual(Object.keys(texts.en[part]).sort());
    }
    for (const [classType, en] of Object.entries(texts.en.nodes)) {
      const ru = texts.ru.nodes[classType];
      for (const aspect of ['what', 'why', 'connect'] as const) {
        expect(en[aspect].trim(), `${classType} ${aspect}`).not.toBe('');
        expect(ru[aspect], `${classType} ${aspect}`).toMatch(/[а-яё]/i);
        expect(en[aspect], `${classType} ${aspect}`).not.toMatch(/[а-яё]/i);
      }
      expect(Boolean(ru.risk), classType).toBe(Boolean(en.risk));
    }
    for (const [pack, en] of Object.entries(texts.en.packs)) {
      expect(texts.ru.packs[pack].what, pack).toMatch(/[а-яё]/i);
      expect(Boolean(texts.ru.packs[pack].risk), pack).toBe(Boolean(en.risk));
    }
    for (const [id, en] of Object.entries(texts.en.topics)) {
      expect(texts.ru.topics[id].what, id).toMatch(/[а-яё]/i);
      expect(Boolean(texts.ru.topics[id].risk), id).toBe(Boolean(en.risk));
    }
    for (const key of Object.keys(texts.en.fields)) expect(texts.ru.fields[key], key).toMatch(/[а-яё]/i);
  });

  it('describes every class the lessons use, in the core or here, and never one the core already has', () => {
    // Described anywhere: the core, this set, or another set (Canny is the video set's, the loaders the picture models').
    const known = new Set<string>(coreSeeds('en').filter((seed) => seed.owner.kind === 'nodeClass' && seed.aspect === 'what').map((seed) => seed.owner.id));
    const used = new Set(IMAGE_TECHNIQUE_LESSONS.flatMap((lesson) => lesson.steps.flatMap((step) => (step.roles ?? []).flatMap((spec) => spec.classes))));
    for (const classType of used) expect(known.has(classType), classType).toBe(true);
    for (const classType of Object.keys(texts.en.nodes)) expect((CORE_NODE_CLASSES as readonly string[]).includes(classType), classType).toBe(false);
  });

  it('names a source for every class: its page on docs.comfy.org or its pack\'s repository, and every pack has its repository', () => {
    for (const classType of Object.keys(texts.en.nodes)) {
      const url = IMAGE_TECHNIQUES_KNOWLEDGE_DOCS.nodes[classType];
      expect(url, classType).toMatch(/^https:\/\/(?:docs\.comfy\.org\/built-in-nodes\/|github\.com\/)/);
    }
    for (const pack of Object.keys(texts.en.packs)) expect(IMAGE_TECHNIQUE_PACK_SOURCES[pack], pack).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });

  it('seeds its classes with the core ones, as facts with their source', () => {
    for (const language of KNOWLEDGE_LANGUAGES) {
      const seeds = coreSeeds(language);
      expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
      const what = seeds.find((seed) => seed.owner.id === 'FaceDetailer' && seed.aspect === 'what')!;
      expect(what.provenance).toBe('fact');
      expect(what.sourceUrl).toBe('https://github.com/ltdrdata/ComfyUI-Impact-Pack');
      const sam = seeds.find((seed) => seed.owner.id === 'SAM3_Detect' && seed.aspect === 'connect')!;
      expect(sam.sourceUrl).toBe('https://docs.comfy.org/built-in-nodes/SAM3_Detect');
      expect(seeds.find((seed) => seed.owner.id === 'FaceDetailer' && seed.aspect === 'why')!.provenance).toBe('inference');
    }
    for (const language of KNOWLEDGE_LANGUAGES) expect(KNOWLEDGE_SETS[language].map((item) => item.set)).toContain(IMAGE_TECHNIQUES_KNOWLEDGE[language]);
  });

  it('finds a pack however its name is spelled, a kind of file by its id, a field by its class', () => {
    expect(packNote('comfyui-impact-pack', 'en')?.nodes).toContain('FaceDetailer');
    expect(packNote('ComfyUI-Impact-Pack', 'ru')?.what).toMatch(/[а-яё]/i);
    expect(conceptNote('controlnets', 'en')?.text).toMatch(/SD 1\.5/);
    expect(conceptNote('lora-side-effects', 'ru')?.term).toMatch(/LoRA/);
    expect(conceptNote('nothing', 'en')).toBeNull();
    expect(fieldNote('LoraLoader', 'strength_clip', 'ru')).toMatch(/0/);
    expect(fieldNote('IPAdapter', 'weight', 'en')).toMatch(/0\.8/);
    expect(fieldNote('KSampler', 'nothing', 'en')).toBeNull();
    // The pack lessons warn about faces in the knowledge too.
    expect(texts.en.nodes.FaceDetailer.why).toContain("does not put another person's face");
    expect(texts.en.packs.ComfyUI_IPAdapter_plus.risk).toMatch(/agrees/);
  });
});
