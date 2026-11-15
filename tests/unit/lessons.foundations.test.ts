import { describe, expect, it } from 'vitest';
import { fixFor, lessonGaps, lessonProgress, rolesOf, type ClassPorts, type Lesson, type LessonGraph, type LessonNode, type Missing } from '../../src/shared/lessons/engine';
import { fits, lessonFit } from '../../src/shared/lessons/fit';
import { LESSONS, LESSON_AFTER, LESSON_PATH, lessonById } from '../../src/shared/lessons/lessons';
import { lessonWords } from '../../src/shared/lessons/texts';
import { lessonGroups } from '../../src/shared/lessons/navigation';
import {
  FOUNDATIONS_AFTER,
  FOUNDATIONS_FIRST,
  FOUNDATIONS_LESSONS,
  FOUNDATIONS_PATH,
  FOUNDATIONS_TOOLS,
} from '../../src/shared/lessons/sets/foundations';
import {
  COMFY_ERRORS,
  comfyErrorNotes,
  FIELD_KEYS,
  foundationsKnowledgeSet,
  foundationsPackId,
  folderNote,
  FOUNDATIONS,
  FOUNDATIONS_NODE_CLASSES,
  FOUNDATIONS_NODE_DOCS,
  FOUNDATIONS_PACKS,
  GLOSSARY_TERMS,
  glossary,
  MODEL_FOLDERS,
  TOPIC_IDS,
  topicNote,
} from '../../src/shared/knowledge/sets/foundations';
import { conceptNote, CORE_NODE_CLASSES, coreSeeds, fieldNote, KNOWLEDGE_LANGUAGES, KNOWLEDGE_SETS, packNote, type KnowledgeLanguage } from '../../src/shared/knowledge/coreKnowledge';
import { fieldNote as imageFieldNote } from '../../src/shared/knowledge/sets/image-models';
import { CLASSES as FAKE_CLASSES, VIDEO_CLASSES } from '../fixtures/mcp/fakeMcpServer';
import { FOUNDATIONS_CLASSES, lessonSpecs } from '../fixtures/mcp/classes/foundations';

/**
 * The foundations domain: its lessons run to the end on a canvas the way a person builds it, and its knowledge
 * exists in both languages with the facts the screens look up.
 */

const DOMAIN: readonly Lesson[] = [...FOUNDATIONS_FIRST, ...FOUNDATIONS_LESSONS, ...FOUNDATIONS_TOOLS];

/** The fake ComfyUI's classes (the lesson specs of the core ones the lessons stand on, and the domain's own). */
type Spec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };
const SPECS: Record<string, Spec> = {
  CheckpointLoaderSimple: { inputs: [['ckpt_name', 'COMBO', 'first.safetensors']], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP'], ['VAE', 'VAE']] },
  CLIPTextEncode: { inputs: [['text', 'STRING', ''], ['clip', 'CLIP']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  EmptyLatentImage: { inputs: [['width', 'INT', 512], ['height', 'INT', 512], ['batch_size', 'INT', 4]], outputs: [['LATENT', 'LATENT']] },
  KSampler: {
    inputs: [['model', 'MODEL'], ['seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8], ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'simple'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT'], ['denoise', 'FLOAT', 0.6]],
    outputs: [['LATENT', 'LATENT']],
  },
  VAEDecode: { inputs: [['samples', 'LATENT'], ['vae', 'VAE']], outputs: [['IMAGE', 'IMAGE']] },
  SaveImage: { inputs: [['images', 'IMAGE'], ['filename_prefix', 'STRING', 'ComfyUI']], outputs: [] },
  PreviewImage: { inputs: [['images', 'IMAGE']], outputs: [] },
  LoadImage: { inputs: [['image', 'COMBO', 'example.png']], outputs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
  CLIPLoader: { inputs: [['clip_name', 'COMBO', 'qwen_3_4b.safetensors'], ['type', 'COMBO', 'stable_diffusion']], outputs: [['CLIP', 'CLIP']] },
  VAEDecodeTiled: {
    inputs: [['samples', 'LATENT'], ['vae', 'VAE'], ['tile_size', 'INT', 512], ['overlap', 'INT', 64], ['temporal_size', 'INT', 64], ['temporal_overlap', 'INT', 8]],
    outputs: [['IMAGE', 'IMAGE']],
  },
  ...lessonSpecs(),
};

const ports: ClassPorts = (classType) => {
  const spec = SPECS[classType];
  return spec ? { inputs: spec.inputs.map(([name]) => name), outputs: spec.outputs.map(([name, type]) => ({ name, type })) } : null;
};
const installed = (classType: string) => classType in SPECS;

class Canvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;

  add(classType: string): LessonNode {
    const spec = SPECS[classType];
    const node: LessonNode = {
      id: String(this.next),
      classType,
      inputs: spec.inputs.map(([name, type], index) => ({ id: `in-${index}`, name, type })),
      outputs: spec.outputs.map(([name, type], index) => ({ id: `out-${index}`, name, type })),
      values: Object.fromEntries(spec.inputs.filter((input) => input.length > 2).map(([name, , value]) => [name, value])),
    };
    this.next += 1;
    this.nodes.push(node);
    return node;
  }

  connect(from: string, fromPort: string, to: string, toPort: string): void {
    this.links = this.links.filter((link) => !(link.to === to && link.toPort === toPort));
    this.links.push({ from, fromPort, to, toPort });
  }

  node(id: string): LessonNode {
    return this.nodes.find((node) => node.id === id)!;
  }

  /** The node and the port that feed an input, if any. */
  feeder(nodeId: string, input: string): { node: LessonNode; port: string } | null {
    const node = this.node(nodeId);
    const port = node.inputs.find((item) => item.name === input);
    const link = this.links.find((item) => item.to === nodeId && item.toPort === port?.id);
    if (!link) return null;
    const from = this.node(link.from);
    return { node: from, port: from.outputs.find((item) => item.id === link.fromPort)!.name };
  }
}

function decide(canvas: Canvas, missing: Missing): void {
  if (missing.kind !== 'field') throw new Error(`nothing to decide for ${JSON.stringify(missing)}`);
  const node = canvas.node(missing.nodeId);
  if (missing.test.kind === 'chosen') node.values[missing.field] = 'chosen.safetensors';
  else if (missing.test.kind === 'differs') node.values[missing.field] = `${String(missing.other?.value ?? '')} at dusk`;
  else if (missing.test.kind === 'text') node.values[missing.field] = 'Rewrite the idea as one detailed image prompt in English. Answer with the prompt only.';
  else throw new Error(`the lesson fixes this itself: ${JSON.stringify(missing)}`);
}

/** Does what the lesson says, one lack at a time. */
function carryOut(lesson: Lesson, canvas: Canvas): void {
  const read = new Set<string>();
  for (let guard = 0; guard < 300; guard += 1) {
    const progress = lessonProgress(lesson, canvas, {}, read);
    if (progress.current === lesson.steps.length) return;
    const step = lesson.steps[progress.current];
    if (step.read) {
      read.add(step.id);
      continue;
    }
    const missing = progress.missing[0];
    expect(missing, `${lesson.id}/${step.id} says what it lacks`).toBeDefined();
    const fix = fixFor(missing, canvas, installed);
    if (!fix) decide(canvas, missing);
    else if (fix.kind === 'add-node') canvas.add(fix.classType);
    else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    else canvas.node(fix.nodeId).values[fix.field] = fix.value;
  }
  throw new Error(`${lesson.id} did not come to its end`);
}

const chain = (id: string): string[] => {
  const before = LESSON_AFTER[id]?.[0];
  return before ? [...chain(before), before] : [];
};

function built(id: string): Canvas {
  const canvas = new Canvas();
  for (const before of [...chain(id), id]) carryOut(lessonById(before)!, canvas);
  return canvas;
}

const only = (canvas: Canvas, classType: string) => {
  const found = canvas.nodes.filter((node) => node.classType === classType);
  expect(found, classType).toHaveLength(1);
  return found[0];
};

describe('the foundations lessons', () => {
  it('are registered: the first one before every other lesson, the rest with what they continue and a group each', () => {
    expect(LESSONS[0].id).toBe('comfy-basics');
    for (const lesson of DOMAIN) {
      expect(lessonById(lesson.id), lesson.id).toBe(lesson);
      if (FOUNDATIONS_PATH[lesson.id]) expect(LESSON_PATH[lesson.id], lesson.id).toEqual(FOUNDATIONS_PATH[lesson.id]);
      for (const id of LESSON_PATH[lesson.id].follows) expect(lessonById(id), id).not.toBeNull();
    }
    // The foundations are the first group of the lesson list; the sampler's settings join the first pictures.
    const groups = lessonGroups();
    expect(groups[0].id).toBe('foundations');
    expect(groups[0].lessons.map((lesson) => lesson.id)).toEqual(['comfy-basics', 'read-workflow', 'vram']);
    expect(LESSON_PATH['sampler-fields'].group.id).toBe(LESSON_PATH.image.group.id);
    expect(LESSON_PATH['llm-prompt'].group.id).toBe('packs-tools');
    for (const [id, before] of Object.entries(FOUNDATIONS_AFTER)) expect(LESSON_AFTER[id]).toEqual(before);
    expect(DOMAIN.length).toBeGreaterThanOrEqual(6);
  });

  it('each comes to its end on a canvas built step by step, after the lesson it continues', () => {
    for (const lesson of DOMAIN) {
      const canvas = built(lesson.id);
      const read = new Set(lesson.steps.filter((step) => step.read).map((step) => step.id));
      expect(lessonProgress(lesson, canvas, {}, read).current, lesson.id).toBe(lesson.steps.length);
    }
  });

  it('fit the fake ComfyUI (the first one even without its video nodes), and the classes are ComfyUI\'s own', () => {
    const portsOf = (classes: ReadonlyArray<{ classType: string; required?: Record<string, unknown>; optional?: Record<string, unknown>; output: string[]; outputName?: string[] }>): ClassPorts => {
      const byType = new Map(classes.map((item) => [item.classType, item]));
      return (classType) => {
        const item = byType.get(classType);
        if (!item) return null;
        const names = item.outputName ?? item.output;
        return { inputs: [...Object.keys(item.required ?? {}), ...Object.keys(item.optional ?? {})], outputs: item.output.map((type, index) => ({ name: names[index] ?? type, type })) };
      };
    };
    expect(fits(lessonFit(lessonById('comfy-basics')!, portsOf(FAKE_CLASSES)))).toBe(true);
    const all = portsOf([...FAKE_CLASSES, ...VIDEO_CLASSES]);
    for (const lesson of DOMAIN) expect(lessonGaps(lesson, all), lesson.id).toEqual([]);
    for (const def of FOUNDATIONS_CLASSES) expect(def.pack, def.classType).toBe(0);
    // Without the language model node a ComfyUI says which node is missing.
    const old = portsOf(FAKE_CLASSES);
    expect(lessonGaps(lessonById('llm-prompt')!, old).some((gap) => gap.kind === 'class' && gap.classes.includes('TextGenerateV2'))).toBe(true);
    expect(lessonGaps(lessonById('llm-prompt')!, ports)).toEqual([]);
  });

  it('set the sampler the way ComfyUI\'s SDXL template does', () => {
    const sampler = only(built('sampler-fields'), 'KSampler');
    expect(sampler.values).toMatchObject({ steps: 25, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1 });
  });

  it('make the picture graph lighter: one picture, the tiled decode feeding the saver', () => {
    const canvas = built('vram');
    expect(only(canvas, 'EmptyLatentImage').values.batch_size).toBe(1);
    const tiled = only(canvas, 'VAEDecodeTiled');
    expect(tiled.values.tile_size).toBe(512);
    expect(canvas.feeder(tiled.id, 'samples')?.node.classType).toBe('KSampler');
    expect(canvas.feeder(tiled.id, 'vae')?.port).toBe('VAE');
    expect(canvas.feeder(only(canvas, 'SaveImage').id, 'images')?.node.classType).toBe('VAEDecodeTiled');
  });

  it('give the width and the height of the blank one value', () => {
    const canvas = built('read-workflow');
    const latent = only(canvas, 'EmptyLatentImage');
    const size = only(canvas, 'PrimitiveInt');
    expect(size.values.value).toBe(1024);
    expect(canvas.feeder(latent.id, 'width')?.node.id).toBe(size.id);
    expect(canvas.feeder(latent.id, 'height')?.node.id).toBe(size.id);
  });

  it('choose between two prompts with a switch, and later put the language model on its other side', () => {
    const canvas = built('switch');
    const choice = only(canvas, 'ComfySwitchNode');
    const prompt = canvas.nodes.find((node) => node.classType === 'CLIPTextEncode' && canvas.feeder(node.id, 'text'))!;
    expect(canvas.feeder(prompt.id, 'text')?.node.id).toBe(choice.id);
    expect(canvas.feeder(choice.id, 'switch')?.node.values.value).toBe(true);
    const [first, second] = [canvas.feeder(choice.id, 'on_false')!.node, canvas.feeder(choice.id, 'on_true')!.node];
    expect(first.values.value).not.toBe(second.values.value);

    carryOut(lessonById('llm-prompt')!, canvas);
    const llm = only(canvas, 'TextGenerateV2');
    expect(canvas.feeder(choice.id, 'on_true')).toEqual({ node: llm, port: 'generated_text' });
    expect(canvas.feeder(choice.id, 'on_false')?.node.id).toBe(first.id);
    expect(canvas.feeder(llm.id, 'prompt')?.node.id).toBe(first.id);
    expect(canvas.feeder(llm.id, 'clip')?.node.classType).toBe('CLIPLoader');
    expect(llm.values.max_length).toBe(512);
    expect(canvas.feeder(only(canvas, 'PreviewAny').id, 'source')?.node.id).toBe(llm.id);
    // The second text of the switch lesson is free once the model takes its side, and becomes the instruction.
    expect(canvas.feeder(llm.id, 'system_prompt')?.node.id).toBe(second.id);
  });

  it('say in their words the number "Do this for me" sets, in both languages', () => {
    for (const lesson of DOMAIN) {
      for (const step of lesson.steps) {
        for (const spec of step.fields ?? []) {
          const test = spec.test;
          const value = test.kind === 'between' ? test.prefer : test.kind === 'equals' ? test.value : undefined;
          if (value === undefined) continue;
          for (const language of ['ru', 'en'] as const) {
            const body = lessonWords(language, lesson.id)!.steps[step.id].body;
            expect(body, `${language}/${lesson.id}/${step.id}: ${spec.field}`).toContain(String(value));
          }
        }
      }
    }
  });

  it('keep to the limits: no long dashes, no download links, the app runs nothing', () => {
    for (const language of ['ru', 'en'] as const) {
      for (const lesson of DOMAIN) {
        const words = lessonWords(language, lesson.id)!;
        const all = [words.title, words.result, ...Object.values(words.steps).flatMap((step) => [step.title, step.body])].join('\n');
        expect(all, `${language}/${lesson.id}`).not.toMatch(/—|https?:\/\//);
      }
      expect(lessonWords(language, 'comfy-basics')!.steps.intro.body).toMatch(language === 'ru' ? /никогда ничего не запускает/ : /never runs anything/);
    }
    // Every role a step names is one the lesson has.
    for (const lesson of DOMAIN) expect(new Set(rolesOf(lesson).map((item) => item.role)).size).toBe(rolesOf(lesson).length);
  });
});

describe('the foundations knowledge', () => {
  const BRIEF_FOLDERS = [
    'checkpoints', 'diffusion_models', 'unet', 'loras', 'vae', 'vae_approx', 'text_encoders', 'clip', 'clip_vision', 'controlnet',
    'ipadapter', 'style_models', 'upscale_models', 'latent_upscale_models', 'embeddings', 'hypernetworks', 'gligen', 'photomaker',
    'insightface', 'facerestore_models', 'facedetection', 'facexlib', 'sam2', 'sams', 'ultralytics', 'yolo', 'detection', 'rembg',
    'background_removal', 'frame_interpolation', 'optical_flow', 'cotracker', 'propainter', 'SEEDVR2', 'audio_encoders', 'mmaudio',
    'hunyuan_foley', 'demucs', 'qwen-tts', 'stt', 'LLM', 'wd14', 'classifiers', 'geometry_estimation', 'unirig', 'luts',
    'model_patches', 'diffusers', 'configs',
  ];

  it('explains every model folder of a real ComfyUI in both languages', () => {
    const ids = MODEL_FOLDERS.map((folder) => folder.id);
    for (const id of BRIEF_FOLDERS) expect(ids, id).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const language of KNOWLEDGE_LANGUAGES) {
      expect(Object.keys(FOUNDATIONS[language].folders).sort()).toEqual([...ids].sort());
      for (const id of ids) {
        const texts = FOUNDATIONS[language].folders[id as keyof typeof FOUNDATIONS.en.folders];
        for (const part of ['what', 'readers', 'size', 'wrong'] as const) expect(texts[part].trim().length, `${language} ${id} ${part}`).toBeGreaterThan(5);
      }
    }
  });

  it('finds the note of a folder as the catalog names it', () => {
    expect(folderNote('loras/style', 'en')?.id).toBe('loras');
    expect(folderNote('Clip', 'ru')).toMatchObject({ id: 'clip', sameAs: 'text_encoders', core: true });
    expect(folderNote('seedvr2', 'en')?.id).toBe('SEEDVR2');
    expect(folderNote('ipadapter', 'en')?.core).toBe(false);
    expect(folderNote('checkpoints', 'ru')?.wrong).toMatch(/Could not detect model type/);
    expect(folderNote('nowhere', 'en')).toBeNull();
  });

  it('has, with the other sets, a text for the fields everybody meets, and never redefines theirs', () => {
    const brief: Array<[string, string]> = [
      ['KSampler', 'seed'], ['KSampler', 'control_after_generate'], ['KSampler', 'steps'], ['KSampler', 'cfg'], ['KSampler', 'sampler_name'],
      ['KSampler', 'scheduler'], ['KSampler', 'denoise'], ['EmptyLatentImage', 'width'], ['EmptyLatentImage', 'height'], ['EmptyLatentImage', 'batch_size'],
      ['ModelSamplingSD3', 'shift'], ['EmptyHunyuanLatentVideo', 'length'], ['CreateVideo', 'fps'], ['LoraLoader', 'strength_model'],
      ['LoraLoader', 'strength_clip'], ['UNETLoader', 'weight_dtype'], ['CheckpointLoaderSimple', 'ckpt_name'], ['UNETLoader', 'unet_name'],
      ['CLIPLoader', 'clip_name'], ['CLIPLoader', 'type'], ['VAELoader', 'vae_name'], ['LoraLoader', 'lora_name'], ['KSamplerAdvanced', 'add_noise'],
      ['PrimitiveInt', 'value'], ['ComfySwitchNode', 'switch'], ['TextGenerateV2', 'system_prompt'], ['VAEDecodeTiled', 'tile_size'],
    ];
    const known = (classType: string, field: string, language: KnowledgeLanguage) => fieldNote(classType, field, language) ?? imageFieldNote(classType, field, language)?.what ?? null;
    for (const language of KNOWLEDGE_LANGUAGES) {
      for (const [classType, field] of brief) expect(known(classType, field, language), `${language} ${classType}.${field}`).toBeTruthy();
      expect(Object.keys(FOUNDATIONS[language].fields).sort()).toEqual([...FIELD_KEYS].sort());
      for (const key of FIELD_KEYS) {
        expect(FOUNDATIONS[language].fields[key].what.trim(), `${language} ${key}`).not.toBe('');
        expect(FOUNDATIONS[language].fields[key].set.trim(), `${language} ${key}`).not.toBe('');
      }
      // No class and field of this set is one the video or picture-models set already explains.
      // (The video set is the second entry. Sets after it may explain a field again in more detail: the later text wins.)
      const others = [KNOWLEDGE_SETS[language][1].set];
      for (const [classType, fields] of Object.entries(foundationsKnowledgeSet(language).fields)) {
        for (const field of Object.keys(fields)) {
          expect(others.some((set) => set.fields[classType]?.[field]), `${classType}.${field} is another set's`).toBe(false);
          expect(imageFieldNote(classType, field, language), `${classType}.${field} is the picture set's`).toBeNull();
          // A later, more specific set may explain the same field again; some text is always there.
          expect(fieldNote(classType, field, language)).toBeTruthy();
        }
      }
    }
    expect(KNOWLEDGE_SETS.en[0].set.fields.ComfySwitchNode.switch).toMatch(/on_true/);
    expect(fieldNote('KSampler', 'control_after_generate', 'ru')).toMatch(/fixed/);
  });

  it('explains the usual ComfyUI errors by their own words', () => {
    // Messages as execution.py and comfy/utils.py word them.
    const oom = 'torch.OutOfMemoryError: Allocation on device\nThis error means you ran out of memory on your GPU.\n\nTIPS: If the workflow worked before you might have accidentally set the batch_size to a large number.';
    expect(comfyErrorNotes(oom, 'en').map((item) => item.id)).toEqual(['oom']);
    expect(comfyErrorNotes('Prompt outputs failed validation\nCheckpointLoaderSimple:\n- Value not in list: ckpt_name: \'x.safetensors\' not in []', 'ru').map((item) => item.id))
      .toEqual(['validation-failed', 'value-not-in-list']);
    expect(comfyErrorNotes("Node 'WanVideoSampler' not found. The custom node may not be installed.", 'en')[0].id).toBe('node-not-found');
    expect(comfyErrorNotes('RuntimeError: mat1 and mat2 shapes cannot be multiplied (77x768 and 4096x5120)', 'en')[0].id).toBe('mat-shapes');
    expect(comfyErrorNotes('ERROR: Could not detect model type of: /x/loras/a.safetensors', 'en')[0].id).toBe('detect-model-type');
    expect(comfyErrorNotes('Value 0 smaller than min of 1: steps', 'en')[0].id).toBe('value-out-of-range');
    expect(comfyErrorNotes('all is well', 'en')).toEqual([]);
    for (const language of KNOWLEDGE_LANGUAGES) {
      for (const item of COMFY_ERRORS) {
        const texts = FOUNDATIONS[language].errors[item.id];
        expect(texts.title && texts.meaning && texts.fix, `${language} ${item.id}`).toBeTruthy();
      }
    }
  });

  it('has topics, packs and the glossary in both languages', () => {
    for (const language of KNOWLEDGE_LANGUAGES) {
      expect(Object.keys(FOUNDATIONS[language].topics).sort()).toEqual([...TOPIC_IDS].sort());
      expect(Object.keys(FOUNDATIONS[language].packs).sort()).toEqual(FOUNDATIONS_PACKS.map((pack) => pack.id).sort());
      expect(Object.keys(FOUNDATIONS[language].glossary).sort()).toEqual(GLOSSARY_TERMS.map((term) => term.id).sort());
      for (const id of TOPIC_IDS) expect(topicNote(id, language).body.length, `${language} ${id}`).toBeGreaterThan(100);
    }
    expect(topicNote('partner-nodes', 'en').body).toMatch(/cost money/);
    expect(topicNote('partner-nodes', 'ru').body).toMatch(/стоят денег/);
    expect(topicNote('pack-safety', 'en').body).toMatch(/\.ckpt, \.pt, \.pth, \.bin/);
    expect(foundationsPackId('custom_nodes/ComfyUI_essentials')).toBe('comfyui_essentials');
    expect(foundationsPackId('rgthree_comfy')).toBe('rgthree-comfy');
    expect(foundationsPackId('ComfyUI-WanVideoWrapper')).toBeNull();
    expect(packNote('rgthree-comfy', 'en')?.what).toMatch(/group/);
    expect(packNote('partner-nodes', 'en')?.risk).toMatch(/money/);
    expect(packNote('comfyui_LLM_party', 'ru')?.risk).toMatch(/стоят денег/);
    // The video set's KJNodes entry is the one that answers; this set does not redefine it.
    expect(Object.keys(foundationsKnowledgeSet('en').packs)).not.toContain('ComfyUI-KJNodes');
    expect(conceptNote('grey-drafts', 'ru')?.term).toBe('серые черновики');
    expect(conceptNote('anchor-picture', 'en')).not.toBeNull();
  });

  it('gives the glossary as one list per language, with the community\'s English word', () => {
    expect(GLOSSARY_TERMS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(GLOSSARY_TERMS.map((term) => term.id)).size).toBe(GLOSSARY_TERMS.length);
    for (const language of KNOWLEDGE_LANGUAGES) {
      const list = glossary(language);
      expect(list).toHaveLength(GLOSSARY_TERMS.length);
      const terms = list.map((entry) => entry.term);
      expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, language)));
      for (const entry of list) {
        expect(entry.community.length, entry.id).toBeGreaterThan(1);
        expect(entry.text.trim().split(/[.!?]\s/).length, `${language} ${entry.id}: one sentence`).toBe(1);
      }
    }
    const ru = new Map(glossary('ru').map((entry) => [entry.id, entry.term]));
    // The app's own words, as the glossary of the brief has them.
    expect([ru.get('node'), ru.get('link'), ru.get('canvas'), ru.get('assistant'), ru.get('grey-drafts'), ru.get('graph-version'), ru.get('subgraph')])
      .toEqual(['нода', 'связь', 'холст', 'помощник', 'серые черновики', 'версия графа', 'субграф']);
  });

  it('writes Russian in Russian and English without Cyrillic, with no long dashes and no links', () => {
    const texts = (value: unknown): string[] => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : []);
    const en = texts(FOUNDATIONS.en);
    const ru = texts(FOUNDATIONS.ru);
    expect(en.length).toBe(ru.length);
    for (const text of en) {
      expect(/[а-яё]/i.test(text), text).toBe(false);
      expect(text, text).not.toMatch(/—|https?:\/\//);
    }
    for (const text of ru) expect(text, text).not.toMatch(/—|https?:\/\//);
    for (const [id, item] of Object.entries(FOUNDATIONS.ru.nodes)) expect(/[а-яё]/i.test(item.what), id).toBe(true);
  });

  it('seeds its nodes with the core knowledge, each with its page on docs.comfy.org', () => {
    for (const classType of FOUNDATIONS_NODE_CLASSES) {
      expect((CORE_NODE_CLASSES as readonly string[]).includes(classType), classType).toBe(false);
      expect(FOUNDATIONS_NODE_DOCS[classType]).toBe(`https://docs.comfy.org/built-in-nodes/${classType}`);
    }
    for (const language of KNOWLEDGE_LANGUAGES) {
      const seeded = new Set(coreSeeds(language).filter((seed) => seed.owner.kind === 'nodeClass').map((seed) => seed.owner.id));
      for (const classType of FOUNDATIONS_NODE_CLASSES) expect(seeded.has(classType), `${language} ${classType}`).toBe(true);
    }
  });
});
