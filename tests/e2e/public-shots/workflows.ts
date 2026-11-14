/**
 * Neutral ComfyUI workflows (UI format 0.4) for the public screenshots: a text-to-picture graph, the same graph
 * with its last part missing, and a large graph of several variants in groups. Built from the core node classes the
 * test MCP server lists and from its plain model file names, so the pictures show no real person's work or data.
 */

type Link = [number, number, number, number, number, string];

interface Node {
  id: number;
  type: string;
  pos: [number, number];
  size: [number, number];
  flags: Record<string, never>;
  order: number;
  mode: number;
  title?: string;
  inputs: Array<{ name: string; type: string; link: number | null }>;
  outputs: Array<{ name: string; type: string; links: number[]; slot_index: number }>;
  properties: Record<string, unknown>;
  widgets_values: unknown[];
}

/** Collects nodes and links with fresh ids; `link` wires an output slot to an input slot by name. */
class Builder {
  nodes: Node[] = [];
  links: Link[] = [];
  groups: Array<{ id: number; title: string; bounding: [number, number, number, number]; color: string; font_size: number; flags: Record<string, never> }> = [];

  add(type: string, x: number, y: number, widgets: unknown[], title?: string): Node {
    const shape = SHAPES[type];
    const node: Node = {
      id: this.nodes.length + 1,
      type,
      pos: [x, y],
      size: shape.size,
      flags: {},
      order: this.nodes.length,
      mode: 0,
      ...(title ? { title } : {}),
      inputs: shape.inputs.map(([name, kind]) => ({ name, type: kind, link: null })),
      outputs: shape.outputs.map(([name, kind], slot) => ({ name, type: kind, links: [], slot_index: slot })),
      properties: { 'Node name for S&R': type },
      widgets_values: widgets,
    };
    this.nodes.push(node);
    return node;
  }

  link(from: Node, output: string, to: Node, input: string): void {
    const slot = from.outputs.findIndex((item) => item.name === output);
    const target = to.inputs.findIndex((item) => item.name === input);
    if (slot < 0 || target < 0) throw new Error(`no ${output} on ${from.type} or no ${input} on ${to.type}`);
    const id = this.links.length + 1;
    from.outputs[slot].links.push(id);
    to.inputs[target].link = id;
    this.links.push([id, from.id, slot, to.id, target, from.outputs[slot].type]);
  }

  group(title: string, bounding: [number, number, number, number], color: string): void {
    this.groups.push({ id: this.groups.length + 1, title, bounding, color, font_size: 24, flags: {} });
  }

  workflow(): Record<string, unknown> {
    return {
      last_node_id: this.nodes.length,
      last_link_id: this.links.length,
      nodes: this.nodes,
      links: this.links,
      groups: this.groups,
      config: {},
      extra: { ds: { scale: 1, offset: [0, 0] } },
      version: 0.4,
    };
  }
}

const SHAPES: Record<string, { size: [number, number]; inputs: Array<[string, string]>; outputs: Array<[string, string]> }> = {
  CheckpointLoaderSimple: { size: [315, 98], inputs: [], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP'], ['VAE', 'VAE']] },
  CLIPTextEncode: { size: [400, 200], inputs: [['clip', 'CLIP']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  EmptyLatentImage: { size: [315, 106], inputs: [], outputs: [['LATENT', 'LATENT']] },
  KSampler: { size: [315, 262], inputs: [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT']], outputs: [['LATENT', 'LATENT']] },
  VAEDecode: { size: [210, 46], inputs: [['samples', 'LATENT'], ['vae', 'VAE']], outputs: [['IMAGE', 'IMAGE']] },
  SaveImage: { size: [315, 270], inputs: [['images', 'IMAGE']], outputs: [] },
  LoraLoader: { size: [315, 126], inputs: [['model', 'MODEL'], ['clip', 'CLIP']], outputs: [['MODEL', 'MODEL'], ['CLIP', 'CLIP']] },
};

/** Node titles as a person would name them, in the language of the pictures. */
export type TitleLanguage = 'en' | 'ru';
const TITLES: Record<TitleLanguage, Record<string, string>> = {
  en: { loader: 'Load Checkpoint', lora: 'Load LoRA', positive: 'Positive prompt', negative: 'Negative prompt', latent: 'Empty Latent Image', sampler: 'KSampler', decode: 'VAE Decode', save: 'Save Image' },
  ru: { loader: 'Модель', lora: 'LoRA', positive: 'Промпт', negative: 'Негативный промпт', latent: 'Размер картинки', sampler: 'KSampler', decode: 'Декодер', save: 'Сохранение' },
};
let titles = TITLES.en;

const CHECKPOINT = 'sd_xl_base_1.0.safetensors';
const PROMPT = 'a lighthouse on a cliff at sunset, soft warm light, calm sea';
const NEGATIVE = 'blurry, low quality';

/** One text-to-picture chain at an offset; returns its nodes so a caller can leave parts out or link more. */
function chain(builder: Builder, x: number, y: number, options: { lora?: string; prompt?: string; finish?: boolean } = {}) {
  const loader = builder.add('CheckpointLoaderSimple', x, y + 160, [CHECKPOINT], titles.loader);
  let model: { node: Node; output: string } = { node: loader, output: 'MODEL' };
  let clip: { node: Node; output: string } = { node: loader, output: 'CLIP' };
  if (options.lora) {
    const lora = builder.add('LoraLoader', x, y + 360, [options.lora, 0.8, 0.8], titles.lora);
    builder.link(loader, 'MODEL', lora, 'model');
    builder.link(loader, 'CLIP', lora, 'clip');
    model = { node: lora, output: 'MODEL' };
    clip = { node: lora, output: 'CLIP' };
  }
  const positive = builder.add('CLIPTextEncode', x + 420, y, [options.prompt ?? PROMPT], titles.positive);
  const negative = builder.add('CLIPTextEncode', x + 420, y + 260, [NEGATIVE], titles.negative);
  builder.link(clip.node, clip.output, positive, 'clip');
  builder.link(clip.node, clip.output, negative, 'clip');
  const latent = builder.add('EmptyLatentImage', x + 420, y + 520, [1024, 1024, 1], titles.latent);
  if (options.finish === false) return { loader, positive, negative, latent, model };
  const sampler = builder.add('KSampler', x + 900, y + 120, [42, 'fixed', 25, 6.5, 'euler', 'normal', 1], titles.sampler);
  builder.link(model.node, model.output, sampler, 'model');
  builder.link(positive, 'CONDITIONING', sampler, 'positive');
  builder.link(negative, 'CONDITIONING', sampler, 'negative');
  builder.link(latent, 'LATENT', sampler, 'latent_image');
  const decode = builder.add('VAEDecode', x + 1300, y + 160, [], titles.decode);
  builder.link(sampler, 'LATENT', decode, 'samples');
  builder.link(loader, 'VAE', decode, 'vae');
  const save = builder.add('SaveImage', x + 1600, y + 160, ['lighthouse'], titles.save);
  builder.link(decode, 'IMAGE', save, 'images');
  return { loader, positive, negative, latent, model, sampler, decode, save };
}

/** Seven nodes: a whole text-to-picture graph. */
export function textToPictureWorkflow(language: TitleLanguage = 'en'): Record<string, unknown> {
  titles = TITLES[language];
  const builder = new Builder();
  chain(builder, 0, 0);
  return builder.workflow();
}

/**
 * The first half of the graph: model, prompts and picture size. With `sampler`, a sampler stands beside them with
 * nothing linked into it, which is what the Check tab finds.
 */
export function unfinishedWorkflow(options: { sampler?: boolean } = {}, language: TitleLanguage = 'en'): Record<string, unknown> {
  titles = TITLES[language];
  const builder = new Builder();
  chain(builder, 0, 0, { finish: false });
  if (options.sampler) {
    const sampler = builder.add('KSampler', 900, 120, [42, 'fixed', 25, 6.5, 'euler', 'normal', 1], titles.sampler);
    const decode = builder.add('VAEDecode', 1300, 160, [], titles.decode);
    builder.link(sampler, 'LATENT', decode, 'samples');
  }
  return builder.workflow();
}

/** Six variants of the picture, each in its own group, side by side: about fifty nodes. */
export function largeWorkflow(language: TitleLanguage = 'en'): Record<string, unknown> {
  titles = TITLES[language];
  const builder = new Builder();
  const variants: Array<{ title: string; lora?: string; prompt: string; color: string }> = [
    { title: language === 'ru' ? 'Основа' : 'Base', prompt: PROMPT, color: '#3f789e' },
    { title: language === 'ru' ? 'Пиксель-арт' : 'Pixel art', lora: 'pixel-art-xl.safetensors', prompt: `pixel art, ${PROMPT}`, color: '#8a5ab0' },
    { title: language === 'ru' ? 'Больше деталей' : 'More detail', lora: 'add-detail-xl.safetensors', prompt: PROMPT, color: '#4a8a5c' },
    { title: language === 'ru' ? 'Ночь' : 'Night', prompt: 'a lighthouse on a cliff at night, stars, calm sea', color: '#355070' },
    { title: language === 'ru' ? 'Быстрый черновик' : 'Fast draft', lora: 'sdxl_lightning_8step_lora.safetensors', prompt: PROMPT, color: '#a0703a' },
    { title: language === 'ru' ? 'Зима' : 'Winter', prompt: 'a lighthouse on a snowy cliff, winter morning', color: '#5a6f8a' },
  ];
  variants.forEach((variant, index) => {
    const x = (index % 2) * 2200;
    const y = Math.floor(index / 2) * 900;
    chain(builder, x, y, { lora: variant.lora, prompt: variant.prompt });
    builder.group(variant.title, [x - 40, y - 80, 2040, 820], variant.color);
  });
  return builder.workflow();
}
