import { describe, expect, it } from 'vitest';
import {
  classOfRole,
  fixFor,
  lessonGaps,
  lessonProgress,
  rolesOf,
  type ClassPorts,
  type Lesson,
  type LessonFacts,
  type LessonGraph,
  type LessonNode,
  type Missing,
} from '../../src/shared/lessons/engine';
import { columnsOf, lessonSpot, type FlowRect } from '../../src/shared/lessons/flow';
import { LESSONS, LESSON_AFTER, lessonById } from '../../src/shared/lessons/lessons';

/**
 * ComfyUI's own nodes as far as the lessons use them: inputs with the value a fresh node starts with (link
 * inputs have none), and outputs. From nodes.py and comfy_extras (nodes_wan, nodes_video, nodes_hunyuan,
 * nodes_model_advanced).
 */
type Spec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };
const CLASSES: Record<string, Spec> = {
  CheckpointLoaderSimple: { inputs: [['ckpt_name', 'COMBO', 'first.safetensors']], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP'], ['VAE', 'VAE']] },
  CLIPTextEncode: { inputs: [['text', 'STRING', ''], ['clip', 'CLIP']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  EmptyLatentImage: { inputs: [['width', 'INT', 512], ['height', 'INT', 512], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  KSampler: {
    inputs: [['model', 'MODEL'], ['seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8], ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'simple'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT'], ['denoise', 'FLOAT', 1]],
    outputs: [['LATENT', 'LATENT']],
  },
  VAEDecode: { inputs: [['samples', 'LATENT'], ['vae', 'VAE']], outputs: [['IMAGE', 'IMAGE']] },
  SaveImage: { inputs: [['images', 'IMAGE'], ['filename_prefix', 'STRING', 'ComfyUI']], outputs: [] },
  UNETLoader: { inputs: [['unet_name', 'COMBO', 'first.safetensors'], ['weight_dtype', 'COMBO', 'default']], outputs: [['MODEL', 'MODEL']] },
  CLIPLoader: { inputs: [['clip_name', 'COMBO', 'umt5.safetensors'], ['type', 'COMBO', 'stable_diffusion']], outputs: [['CLIP', 'CLIP']] },
  VAELoader: { inputs: [['vae_name', 'COMBO', 'vae.safetensors']], outputs: [['VAE', 'VAE']] },
  ModelSamplingSD3: { inputs: [['model', 'MODEL'], ['shift', 'FLOAT', 3]], outputs: [['MODEL', 'MODEL']] },
  EmptyHunyuanLatentVideo: { inputs: [['width', 'INT', 848], ['height', 'INT', 480], ['length', 'INT', 25], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  KSamplerAdvanced: {
    inputs: [
      ['model', 'MODEL'], ['add_noise', 'COMBO', 'enable'], ['noise_seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8],
      ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'simple'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'],
      ['latent_image', 'LATENT'], ['start_at_step', 'INT', 0], ['end_at_step', 'INT', 10000], ['return_with_leftover_noise', 'COMBO', 'disable'],
    ],
    outputs: [['LATENT', 'LATENT']],
  },
  CreateVideo: { inputs: [['images', 'IMAGE'], ['fps', 'FLOAT', 30], ['audio', 'AUDIO']], outputs: [['VIDEO', 'VIDEO']] },
  SaveVideo: { inputs: [['video', 'VIDEO'], ['filename_prefix', 'STRING', 'video/ComfyUI'], ['format', 'COMBO', 'auto'], ['codec', 'COMBO', 'auto']], outputs: [] },
  LoadImage: { inputs: [['image', 'COMBO', 'example.png']], outputs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
  WanImageToVideo: {
    inputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['vae', 'VAE'], ['width', 'INT', 832], ['height', 'INT', 480], ['length', 'INT', 81], ['batch_size', 'INT', 1], ['clip_vision_output', 'CLIP_VISION_OUTPUT'], ['start_image', 'IMAGE']],
    outputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent', 'LATENT']],
  },
  LoraLoaderModelOnly: { inputs: [['model', 'MODEL'], ['lora_name', 'COMBO', 'first-lora.safetensors'], ['strength_model', 'FLOAT', 1]], outputs: [['MODEL', 'MODEL']] },
};

const ports: ClassPorts = (classType) => {
  const spec = CLASSES[classType];
  return spec ? { inputs: spec.inputs.map(([name]) => name), outputs: spec.outputs.map(([name, type]) => ({ name, type })) } : null;
};
const installed = (classType: string) => classType in CLASSES;

/** A canvas a person works on, as far as a lesson can see it. */
class Canvas implements LessonGraph {
  nodes: LessonNode[] = [];
  links: LessonGraph['links'] = [];
  private next = 1;

  add(classType: string): LessonNode {
    const spec = CLASSES[classType];
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

  /** An input takes one link: a new one replaces the old, as in ComfyUI. */
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
}

const FACTS: LessonFacts = { triggers: { 'style-high.safetensors': ['neon rain'], 'style-low.safetensors': ['neon rain'] } };

/** What only the person can decide: which file, what words. */
function decide(canvas: Canvas, missing: Missing): void {
  if (missing.kind !== 'field') throw new Error(`nothing to decide for ${JSON.stringify(missing)}`);
  const node = canvas.node(missing.nodeId);
  switch (missing.test.kind) {
    case 'chosen':
      node.values[missing.field] = 'chosen.safetensors';
      return;
    case 'differs':
      node.values[missing.field] = `other-${missing.nodeId}.safetensors`;
      return;
    case 'text':
      node.values[missing.field] = 'a quiet lake at dawn, slow camera';
      return;
    case 'has-trigger':
      node.values[missing.field] = `${String(node.values[missing.field] ?? '')}, neon rain`;
      return;
    default:
      throw new Error(`the lesson fixes this itself: ${JSON.stringify(missing)}`);
  }
}

/** Does what the lesson says, one lack at a time, and returns how many actions each step took. */
function carryOut(lesson: Lesson, canvas: Canvas, facts: LessonFacts = FACTS): number[] {
  const read = new Set<string>();
  const actions: number[] = lesson.steps.map(() => 0);
  for (let guard = 0; guard < 400; guard += 1) {
    const progress = lessonProgress(lesson, canvas, facts, read);
    if (progress.current === lesson.steps.length) return actions;
    const step = lesson.steps[progress.current];
    actions[progress.current] += 1;
    if (step.read) {
      expect(progress.missing, `${lesson.id}/${step.id}: a step that explains lacks nothing`).toEqual([]);
      read.add(step.id);
      continue;
    }
    expect(progress.missing.length, `${lesson.id}/${step.id}: a step that is not done says what it lacks`).toBeGreaterThan(0);
    const missing = progress.missing[0];
    const fix = fixFor(missing, canvas, installed);
    if (!fix) decide(canvas, missing);
    else if (fix.kind === 'add-node') canvas.add(fix.classType);
    else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
    else canvas.node(fix.nodeId).values[fix.field] = fix.value;
  }
  throw new Error(`${lesson.id} did not come to its end`);
}

const done = (lesson: Lesson, canvas: Canvas, read: string[] = lesson.steps.filter((step) => step.read).map((step) => step.id)) => lessonProgress(lesson, canvas, FACTS, new Set(read));

describe('every lesson can be done by doing what it says', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: from an empty canvas to the end`, () => {
      const canvas = new Canvas();
      // The lessons that stand on a video graph start from the one the lesson before them leaves.
      for (const before of chain(lesson.id)) carryOut(lessonById(before)!, canvas);
      const actions = carryOut(lesson, canvas);
      expect(done(lesson, canvas).current).toBe(lesson.steps.length);
      // Every step that explains was shown once.
      lesson.steps.forEach((step, index) => {
        if (step.read) expect(actions[index], `${lesson.id}/${step.id}`).toBe(1);
      });
    });
  }

  it('fits a ComfyUI that has the nodes, and each lesson has steps to do and steps to read', () => {
    for (const lesson of LESSONS) {
      expect(lessonGaps(lesson, ports), lesson.id).toEqual([]);
      expect(lesson.steps[0].read, `${lesson.id} starts by saying what it is about`).toBe(true);
      expect(lesson.steps.some((step) => !step.read), `${lesson.id} has something to do`).toBe(true);
      expect(new Set(lesson.steps.map((step) => step.id)).size, `${lesson.id}: step ids are its own`).toBe(lesson.steps.length);
      // A role is brought in once, before anything refers to it.
      const brought = new Set<string>();
      for (const step of lesson.steps) {
        for (const spec of step.roles ?? []) {
          expect(brought.has(spec.role), `${lesson.id}/${step.id}: ${spec.role} twice`).toBe(false);
          brought.add(spec.role);
        }
        for (const spec of step.links ?? []) expect([spec.from, spec.to].every((role) => brought.has(role)), `${lesson.id}/${step.id}: link ${spec.from} → ${spec.to}`).toBe(true);
        for (const spec of step.fields ?? []) expect(brought.has(spec.role), `${lesson.id}/${step.id}: field of ${spec.role}`).toBe(true);
      }
    }
    for (const [id, before] of Object.entries(LESSON_AFTER)) {
      expect(lessonById(id), id).not.toBeNull();
      for (const other of before) expect(lessonById(other), other).not.toBeNull();
    }
  });
});

/** The lessons whose graph a lesson stands on, first to last. */
function chain(id: string): string[] {
  const before = LESSON_AFTER[id]?.[0];
  return before ? [...chain(before), before] : [];
}

describe('where a person is in a lesson is read off the graph', () => {
  const lesson = lessonById('image')!;

  it('starts at the first step and waits there until it is read', () => {
    const canvas = new Canvas();
    expect(lessonProgress(lesson, canvas, {}, new Set())).toMatchObject({ current: 0, missing: [] });
    const next = lessonProgress(lesson, canvas, {}, new Set(['intro']));
    expect(next.current).toBe(1);
    expect(next.missing).toEqual([{ kind: 'node', role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }]);
  });

  it('goes back when a node the lesson stands on is deleted, and forward again when it returns', () => {
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const sampler = canvas.nodes.find((node) => node.classType === 'KSampler')!;
    canvas.remove(sampler.id);
    const back = done(lesson, canvas);
    expect(lesson.steps[back.current].id).toBe('sampler');
    carryOut(lesson, canvas);
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });

  it('counts a graph built in another order', () => {
    const canvas = new Canvas();
    // Everything at once, the saver first.
    for (const classType of ['SaveImage', 'VAEDecode', 'KSampler', 'EmptyLatentImage', 'CLIPTextEncode', 'CLIPTextEncode', 'CheckpointLoaderSimple']) canvas.add(classType);
    const progress = done(lesson, canvas);
    // The nodes are there; the first thing still to do is to link the checkpoint to the prompts.
    expect(lesson.steps[progress.current].id).toBe('prompts-clip');
    expect(progress.missing.every((item) => item.kind === 'link')).toBe(true);
  });

  it('says which node feeds an input when it is the wrong one', () => {
    const canvas = new Canvas();
    carryOut(lesson, canvas);
    const sampler = canvas.nodes.find((node) => node.classType === 'KSampler')!;
    const progress = done(lesson, canvas);
    const positive = canvas.node(progress.roles.positive);
    const negative = canvas.node(progress.roles.negative);
    // The person drags the empty prompt into "positive" too: the prompt with the words no longer reaches it.
    canvas.connect(negative.id, 'out-0', sampler.id, sampler.inputs.find((port) => port.name === 'positive')!.id);
    const wrong = done(lesson, canvas);
    expect(lesson.steps[wrong.current].id).toBe('sampler-links');
    expect(wrong.missing).toContainEqual({
      kind: 'link',
      from: { role: 'positive', nodeId: positive.id },
      output: 'CONDITIONING',
      to: { role: 'sampler', nodeId: sampler.id },
      input: 'positive',
      fedBy: negative.id,
      absent: null,
    });
    // Doing what it says puts it right.
    const fix = fixFor(wrong.missing[0], canvas, installed)!;
    expect(fix).toMatchObject({ kind: 'connect', from: positive.id, to: sampler.id });
  });

  it('gives each of two nodes of one class its own role, by what they are linked to', () => {
    const video = lessonById('video-text')!;
    const canvas = new Canvas();
    carryOut(video, canvas);
    const roles = done(video, canvas).roles;
    expect(new Set(Object.values(roles)).size).toBe(Object.keys(roles).length);
    // The first sampler is the one fed by the empty latent, the second the one fed by the first.
    const latentTo = canvas.links.find((link) => link.from === roles.latent)!.to;
    expect(latentTo).toBe(roles.first);
    expect(canvas.links.some((link) => link.from === roles.first && link.to === roles.second)).toBe(true);
    expect(canvas.node(roles.second).values.start_at_step).toBe(canvas.node(roles.first).values.end_at_step);
  });
});

describe('a LoRA loader on the way does not break a lesson', () => {
  it('keeps the video lesson done after LoRA loaders are put into both model paths, one or two in a row', () => {
    const video = lessonById('video-text')!;
    const canvas = new Canvas();
    carryOut(video, canvas);
    carryOut(lessonById('lora')!, canvas);
    expect(done(video, canvas).current).toBe(video.steps.length);
    // A second LoRA in the high path, between the first one and the shift node.
    const roles = done(lessonById('lora')!, canvas).roles;
    const extra = canvas.add('LoraLoaderModelOnly');
    canvas.connect(roles.loraHigh, 'out-0', extra.id, 'in-0');
    canvas.connect(extra.id, 'out-0', roles.shiftHigh, 'in-0');
    expect(done(video, canvas).current).toBe(video.steps.length);
    expect(done(lessonById('lora')!, canvas).current).toBe(lessonById('lora')!.steps.length);
  });

  it('asks for a trigger word only when the file names one', () => {
    const lesson = lessonById('lora')!;
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    // Without known trigger words there is nothing to check.
    carryOut(lesson, canvas, {});
    const roles = lessonProgress(lesson, canvas, {}, new Set(lesson.steps.filter((step) => step.read).map((step) => step.id))).roles;
    canvas.node(roles.loraHigh).values.lora_name = 'style-high.safetensors';
    const asks = done(lesson, canvas);
    expect(lesson.steps[asks.current].id).toBe('trigger');
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'text', test: { kind: 'has-trigger' } });
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night, Neon Rain on glass';
    expect(done(lesson, canvas).current).toBe(lesson.steps.length);
  });
});

describe('the lesson on adult content asks for neither a LoRA nor a further-trained model', () => {
  const lesson = lessonById('adult')!;
  const read = lesson.steps.filter((step) => step.read).map((step) => step.id);

  it('is done on a plain video graph: the subject may come from the pair of models chosen in the two loaders', () => {
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    expect(canvas.nodes.some((node) => node.classType === 'LoraLoaderModelOnly')).toBe(false);
    // Nothing on the canvas is asked for: only the steps that explain are left.
    const before = lessonProgress(lesson, canvas, FACTS, new Set());
    expect(lesson.steps[before.current].id).toBe('rules');
    expect(done(lesson, canvas, read).current).toBe(lesson.steps.length);
    expect(rolesOf(lesson).map((spec) => spec.classes[0])).not.toContain('LoraLoaderModelOnly');
    expect(lessonGaps(lesson, (classType) => (classType === 'LoraLoaderModelOnly' ? null : ports(classType)))).toEqual([]);
  });

  it('holds a LoRA that is on the canvas to its words, wherever it stands', () => {
    const canvas = new Canvas();
    carryOut(lessonById('video-text')!, canvas);
    carryOut(lessonById('lora')!, canvas, {});
    // The files name no words: nothing to compare with.
    expect(lessonProgress(lesson, canvas, {}, new Set(read)).current).toBe(lesson.steps.length);
    const loaders = canvas.nodes.filter((node) => node.classType === 'LoraLoaderModelOnly');
    loaders[1].values.lora_name = 'style-low.safetensors';
    const asks = done(lesson, canvas, read);
    expect(lesson.steps[asks.current].id).toBe('trigger');
    expect(asks.missing).toHaveLength(1);
    expect(asks.missing[0]).toMatchObject({ kind: 'field', field: 'text', test: { kind: 'has-trigger' } });
    // Only the person can write the words.
    expect(fixFor(asks.missing[0], canvas, installed)).toBeNull();
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night, neon rain on glass';
    expect(done(lesson, canvas, read).current).toBe(lesson.steps.length);
    // A LoRA node that is linked to nothing yet counts too: its file is chosen, its words are asked for.
    canvas.node(asks.missing[0].kind === 'field' ? asks.missing[0].nodeId : '').values.text = 'a street at night';
    for (const loader of loaders) canvas.links = canvas.links.filter((link) => link.from !== loader.id && link.to !== loader.id);
    expect(lesson.steps[done(lesson, canvas, read).current].id).toBe('trigger');
  });

  it('says both ways in its words, and what a model with the speed-up built in needs', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const language of ['ru', 'en'] as const) {
      const steps = lessonWords(language, 'adult')!.steps;
      expect(steps.tuned.body).toContain('`unet_name`');
      expect(steps.tuned.body).toMatch(/`steps` 4/);
      expect(steps.tuned.body).toMatch(/`cfg` 1/);
      expect(steps.lora.body).toContain(lessonWords(language, 'lora')!.title);
      expect(steps.tuned.body).toContain(lessonWords(language, 'video-fast')!.title);
      // The step that checks the words says when there is nothing to check.
      expect(steps.trigger.body).toMatch(language === 'ru' ? /LoRA в графе нет/ : /has no LoRA/);
    }
  });
});

describe('a node the app adds for a lesson stands where the graph reads left to right', () => {
  const GAPS = { x: 96, y: 72 };
  const sizeOf = (classType: string) => ({ width: 240, height: 70 + 30 * CLASSES[classType].inputs.length });

  /** Carries a lesson out as carryOut does, and gives each node the app adds the spot the app would give it. */
  function build(lesson: Lesson, canvas: Canvas, rects: Map<string, FlowRect>): void {
    const read = new Set<string>();
    for (let guard = 0; guard < 400; guard += 1) {
      const progress = lessonProgress(lesson, canvas, FACTS, read);
      if (progress.current === lesson.steps.length) return;
      const step = lesson.steps[progress.current];
      if (step.read) {
        read.add(step.id);
        continue;
      }
      const missing = progress.missing[0];
      const fix = fixFor(missing, canvas, installed);
      if (!fix) decide(canvas, missing);
      else if (fix.kind === 'add-node') {
        const size = sizeOf(fix.classType);
        // The first node of a lesson goes where any new node goes; here that is the origin.
        const spot = (missing.kind === 'node' ? lessonSpot(lesson, missing.role, progress.roles, rects, size, GAPS) : null) ?? { x: 0, y: 0 };
        rects.set(canvas.add(fix.classType).id, { ...spot, ...size });
      } else if (fix.kind === 'connect') canvas.connect(fix.from, fix.fromPort, fix.to, fix.toPort);
      else canvas.node(fix.nodeId).values[fix.field] = fix.value;
    }
    throw new Error(`${lesson.id} did not come to its end`);
  }

  /** Pairs of nodes that stand closer than the room the canvas keeps around a new node. */
  function crowded(rects: Map<string, FlowRect>, room = 56): string[] {
    const all = [...rects.entries()];
    const out: string[] = [];
    all.forEach(([a, one], index) => {
      for (const [b, other] of all.slice(index + 1)) {
        if (one.x < other.x + other.width + room && one.x + one.width + room > other.x && one.y < other.y + other.height + room && one.y + one.height + room > other.y) out.push(`${a} and ${b}`);
      }
    });
    return out;
  }

  it('gives every role a column, and every link of every lesson goes to a column further right', () => {
    for (const lesson of LESSONS) {
      const columns = columnsOf(lesson);
      expect(Object.keys(columns).sort(), lesson.id).toEqual([...new Set(rolesOf(lesson).map((spec) => spec.role))].sort());
      for (const step of lesson.steps) {
        for (const link of step.links ?? []) expect(columns[link.from], `${lesson.id}: ${link.from} → ${link.to}`).toBeLessThan(columns[link.to]);
      }
    }
    expect(columnsOf(lessonById('image')!)).toEqual({ checkpoint: 0, latent: 0, positive: 1, negative: 1, sampler: 2, decode: 3, save: 4 });
    expect(columnsOf(lessonById('video-text')!)).toMatchObject({ high: 0, low: 0, clip: 0, vae: 0, shiftHigh: 1, shiftLow: 1, first: 2, second: 3, decode: 4, video: 5, save: 6 });
  });

  for (const id of ['image', 'video-text', 'video-image']) {
    it(`${id}: built by the app from an empty canvas, every link goes from left to right and no node crowds another`, () => {
      const lesson = lessonById(id)!;
      const canvas = new Canvas();
      const rects = new Map<string, FlowRect>();
      build(lesson, canvas, rects);
      expect(rects.size).toBe(rolesOf(lesson).length);
      expect(canvas.links.length).toBeGreaterThan(5);
      for (const link of canvas.links) {
        const from = rects.get(link.from)!;
        const to = rects.get(link.to)!;
        expect(from.x + from.width, `${canvas.node(link.from).classType} → ${canvas.node(link.to).classType}`).toBeLessThan(to.x);
      }
      expect(crowded(rects)).toEqual([]);
      // The two models stand one under the other, and each one's noise shift at its own height.
      if (id !== 'image') {
        const roles = done(lesson, canvas).roles;
        expect(rects.get(roles.low)!.x).toBe(rects.get(roles.high)!.x);
        expect(rects.get(roles.shiftHigh)!.y).toBe(rects.get(roles.high)!.y);
        expect(rects.get(roles.shiftLow)!.y).toBe(rects.get(roles.low)!.y);
      }
    });
  }

  it('puts the nodes of a later lesson into the graph of an earlier one without crowding it', () => {
    const canvas = new Canvas();
    const rects = new Map<string, FlowRect>();
    build(lessonById('video-text')!, canvas, rects);
    build(lessonById('lora')!, canvas, rects);
    build(lessonById('video-fast')!, canvas, rects);
    expect(canvas.nodes.filter((node) => node.classType === 'LoraLoaderModelOnly')).toHaveLength(2);
    expect(rects.size).toBe(canvas.nodes.length);
    expect(crowded(rects)).toEqual([]);
    // Each LoRA stands right of the model it takes.
    const roles = done(lessonById('lora')!, canvas).roles;
    expect(rects.get(roles.loraHigh)!.x).toBeGreaterThan(rects.get(roles.high)!.x);
    expect(rects.get(roles.loraLow)!.x).toBeGreaterThan(rects.get(roles.low)!.x);
  });

  it('leaves the first node of a lesson to the canvas, and a node placed by hand is not stood upon', () => {
    const lesson = lessonById('image')!;
    expect(lessonSpot(lesson, 'checkpoint', {}, new Map(), sizeOf('CheckpointLoaderSimple'), GAPS)).toBeNull();
    // The person put the model loader somewhere and a note-sized node right where the first text would go.
    const rects = new Map<string, FlowRect>([
      ['1', { x: 500, y: 300, width: 240, height: 100 }],
      ['9', { x: 836, y: 280, width: 240, height: 160 }],
    ]);
    const spot = lessonSpot(lesson, 'positive', { checkpoint: '1' }, rects, sizeOf('CLIPTextEncode'), GAPS)!;
    expect(spot).toEqual({ x: 500 + 240 + 96, y: 280 + 160 + 72 });
    // A role the lesson does not have gets no spot.
    expect(lessonSpot(lesson, 'nobody', { checkpoint: '1' }, rects, sizeOf('CLIPTextEncode'), GAPS)).toBeNull();
  });
});

describe('a lesson is offered only where it fits', () => {
  it('names the class that is not installed', () => {
    const without: ClassPorts = (classType) => (classType === 'WanImageToVideo' ? null : ports(classType));
    expect(lessonGaps(lessonById('video-image')!, without)).toEqual([{ kind: 'class', role: 'start', classes: ['WanImageToVideo'] }]);
    expect(lessonGaps(lessonById('video-text')!, without)).toEqual([]);
    // The prompt in use may feed any of three classes: one of them is enough.
    expect(lessonGaps(lessonById('lora')!, without)).toEqual([]);
    expect(classOfRole(lessonById('lora')!, 'wants', without)).toBe('KSamplerAdvanced');
    expect(classOfRole(lessonById('lora')!, 'wants', ports)).toBe('WanImageToVideo');
    expect(classOfRole(lessonById('lora')!, 'nobody', ports)).toBeNull();
  });

  it('names the input a class lacks when it is built differently here', () => {
    const changed: ClassPorts = (classType) => {
      const known = ports(classType);
      return known && classType === 'CreateVideo' ? { ...known, inputs: known.inputs.filter((name) => name !== 'fps') } : known;
    };
    expect(lessonGaps(lessonById('video-text')!, changed)).toEqual([{ kind: 'port', classType: 'CreateVideo', port: 'fps', side: 'input' }]);
  });

  it('lists every role once with the step that brings it', () => {
    const roles = rolesOf(lessonById('image')!);
    expect(roles.map((item) => item.role)).toEqual(['checkpoint', 'positive', 'negative', 'latent', 'sampler', 'decode', 'save']);
    expect(roles[0].step).toBe(1);
  });
});

describe('the words of the lessons', () => {
  it('has a title and a text for every step, in both languages, and names only nodes the lesson has', async () => {
    const { lessonWords, rolesIn, withNodeNames } = await import('../../src/shared/lessons/texts');
    const unnamed: string[] = [];
    for (const language of ['ru', 'en'] as const) {
      for (const lesson of LESSONS) {
        const words = lessonWords(language, lesson.id);
        expect(words, `${language}/${lesson.id}`).not.toBeNull();
        expect(words!.title.length, `${language}/${lesson.id} title`).toBeGreaterThan(3);
        expect(words!.result.length, `${language}/${lesson.id} result`).toBeGreaterThan(10);
        // No words for a step that is not there, and none missing.
        expect(Object.keys(words!.steps).sort(), `${language}/${lesson.id}`).toEqual(lesson.steps.map((step) => step.id).sort());
        const roles = new Set(rolesOf(lesson).map((item) => item.role));
        for (const step of lesson.steps) {
          const text = words!.steps[step.id];
          expect(text.title.trim().length, `${language}/${lesson.id}/${step.id} title`).toBeGreaterThan(2);
          expect(text.body.trim().length, `${language}/${lesson.id}/${step.id} body`).toBeGreaterThan(30);
          for (const role of rolesIn(`${text.title} ${text.body}`)) expect(roles.has(role), `${language}/${lesson.id}/${step.id} names {${role}}`).toBe(true);
          // Once the names are in, nothing of the template is left for a person to see.
          const shown = withNodeNames(`${text.title}\n${text.body}`, (role) => `Node ${role}`);
          expect(shown).not.toMatch(/[{}]|undefined|\[object/);
          // A step that asks for a field names it the way the node shows it.
          for (const spec of step.fields ?? []) {
            if (!text.body.includes(`\`${spec.field}\``)) unnamed.push(`${language}/${lesson.id}/${step.id}: ${spec.field}`);
          }
        }
      }
    }
    expect(unnamed, 'fields a step asks for and does not name').toEqual([]);
    expect(lessonWords('ru', 'nope')).toBeNull();
    // Another interface language reads the English words.
    expect(lessonWords('de', 'image')).toBe(lessonWords('en', 'image'));
    expect(withNodeNames('Add {latent} and {nobody}.', (role) => (role === 'latent' ? 'Empty *Latent* Image' : null))).toBe('Add **Empty Latent Image** and **nobody**.');
  });

  it('says the same numbers in both languages', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((item) => item.replace(',', '.')).join(' ');
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        const ru = lessonWords('ru', lesson.id)!.steps[step.id];
        const en = lessonWords('en', lesson.id)!.steps[step.id];
        expect(numbers(ru.body), `${lesson.id}/${step.id}`).toBe(numbers(en.body));
        // And the same fields and values in backticks.
        const marked = (text: string) => (text.match(/`[^`]+`/g) ?? []).sort().join(' ');
        expect(marked(ru.body), `${lesson.id}/${step.id}`).toBe(marked(en.body));
      }
    }
  });

  it("names only fields that the nodes of the lesson's graph have", async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const inputsOf = (classType: string) => CLASSES[classType].inputs.map(([name]) => name);
    // A word in backticks that is an input of some node is a field; the rest are values and file names.
    const fields = new Set(Object.keys(CLASSES).flatMap(inputsOf));
    // What a lesson's graph is made of: its own nodes, those of the lessons it stands on, and those of a lesson
    // its text sends the reader to by name. The samplers of a video graph call the seed `noise_seed`; a lesson
    // on that graph that said `seed` would send a person to a field that is not there.
    const own = (id: string): string[] => rolesOf(lessonById(id)!).map((spec) => spec.classes[0]);
    const standsOn = (id: string): string[] => (LESSON_AFTER[id] ?? []).flatMap((other) => [other, ...standsOn(other)]);
    const strangers: string[] = [];
    for (const language of ['ru', 'en'] as const) {
      for (const lesson of LESSONS) {
        const said = Object.values(lessonWords(language, lesson.id)!.steps).map((step) => step.body).join('\n');
        const sentTo = LESSONS.filter((other) => other.id !== lesson.id && said.includes(lessonWords(language, other.id)!.title)).map((other) => other.id);
        const here = new Set([lesson.id, ...standsOn(lesson.id), ...sentTo].flatMap(own).flatMap(inputsOf));
        for (const [stepId, text] of Object.entries(lessonWords(language, lesson.id)!.steps)) {
          for (const marked of text.body.match(/`[^`]+`/g) ?? []) {
            const word = marked.slice(1, -1);
            if (fields.has(word) && !here.has(word)) strangers.push(`${language}/${lesson.id}/${stepId}: ${word}`);
          }
        }
      }
    }
    expect(strangers, 'fields a lesson names that no node of its graph has').toEqual([]);
  });

  it('keeps the lesson on adult content to technique and limits', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    for (const language of ['ru', 'en'] as const) {
      const words = lessonWords(language, 'adult')!;
      const rules = words.steps.rules.body.toLowerCase();
      // The two limits are said first, in plain words.
      expect(rules).toMatch(language === 'ru' ? /несовершеннолетн/ : /minors/);
      expect(rules).toMatch(language === 'ru' ? /без их согласия/ : /without their consent/);
      expect(lessonById('adult')!.steps[0].id).toBe('rules');
      // And the helper's privacy is said: descriptions travel with the graph.
      expect(words.steps.helper.body).toMatch(language === 'ru' ? /Приватность/ : /Privacy/);
    }
  });
});

describe('what the lessons say about their own size', () => {
  it('names the number of nodes the lesson really has', async () => {
    const { lessonWords } = await import('../../src/shared/lessons/texts');
    const count = (id: string) => rolesOf(lessonById(id)!).length;
    expect(count('image')).toBe(7);
    expect(lessonWords('en', 'image')!.result).toContain('seven nodes');
    expect(lessonWords('ru', 'image')!.result).toContain('семи нод');
    expect(count('video-text')).toBe(14);
    expect(lessonWords('en', 'video-text')!.steps.intro.body).toContain('fourteen nodes');
    expect(lessonWords('ru', 'video-text')!.steps.intro.body).toContain('четырнадцать нод');
  });
});
