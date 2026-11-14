import type { CoreSeed, CoreTexts, FamilyTexts, KnowledgeLanguage } from '../coreKnowledge';
import type { ExplanationAspect, Provenance } from '../../contracts/knowledge';
import { objectKey, type ObjectRef } from '../../contracts/objects';
import { IMAGE_MODELS_EN } from './image-models.en';
import { IMAGE_MODELS_RU } from './image-models.ru';

/**
 * Built-in knowledge on the families of picture models and how each is loaded: the loaders and family nodes the
 * official templates use beyond the core set (coreKnowledge.ts), a guide per family (files and folders, settings,
 * how to write the prompt), the fields the lessons on these families set, and the ComfyUI-GGUF pack.
 *
 * Sources: ComfyUI's nodes.py and comfy_extras (inputs, defaults), the official workflow templates (files, folders,
 * settings), docs.comfy.org (the pages linked below, checked against its sitemap), ComfyUI-GGUF's README and
 * nodes.py. As in the core set, `what` and `connect` of a node are facts with their page; advice is inference.
 */

export const IMAGE_MODEL_NODE_CLASSES = [
  'ModelSamplingSD3', 'ModelSamplingAuraFlow', 'ConditioningZeroOut', 'EmptyFlux2LatentImage', 'Flux2Scheduler', 'CFGGuider',
  'BasicGuider', 'RandomNoise', 'SamplerCustomAdvanced', 'TripleCLIPLoader', 'QuadrupleCLIPLoader', 'CLIPTextEncodeFlux',
  'CLIPTextEncodeSDXL', 'SDTurboScheduler', 'CFGNorm', 'UnetLoaderGGUF', 'UnetLoaderGGUFAdvanced', 'CLIPLoaderGGUF',
  'DualCLIPLoaderGGUF', 'TripleCLIPLoaderGGUF', 'QuadrupleCLIPLoaderGGUF',
] as const;
export type ImageModelNodeClass = typeof IMAGE_MODEL_NODE_CLASSES[number];

/** Families the core set already introduces (what, risk): this set adds their files, settings and prompt. */
export const GUIDED_FAMILIES = ['sd15', 'sdxl', 'pony', 'illustrious', 'sd3', 'flux1', 'flux2', 'chroma', 'qwen-image', 'zimage', 'krea'] as const;
export type GuidedFamily = typeof GUIDED_FAMILIES[number];

/** Families of the official templates that the core set does not know: this set introduces them whole. */
export const NEW_FAMILIES = ['hidream', 'lumina', 'anima', 'flux3', 'ovis', 'longcat', 'kandinsky5', 'omnigen2', 'ernie'] as const;
export type NewFamily = typeof NEW_FAMILIES[number];

/** How a family is set up: which files go where, what the sampler wants, how the prompt is written. */
export interface FamilyGuide {
  files: string;
  settings: string;
  prompt: string;
}

/** A family the core set does not know: also what it is and what does not mix with it. */
export interface NewFamilyTexts extends FamilyGuide {
  what: string;
  mix: string;
}

/** One field of a node: what it does and what to put. */
export interface FieldTexts {
  what: string;
  set: string;
}

export interface PackTexts {
  what: string;
  nodes: string;
}

export interface ImageModelsPack {
  nodes: Record<ImageModelNodeClass, CoreTexts>;
  guides: Record<GuidedFamily, FamilyGuide>;
  families: Record<NewFamily, NewFamilyTexts>;
  /** By "Class.field". */
  fields: Record<string, FieldTexts>;
  packs: Record<string, PackTexts>;
}

export const IMAGE_MODELS_KNOWLEDGE: Record<KnowledgeLanguage, ImageModelsPack> = { en: IMAGE_MODELS_EN, ru: IMAGE_MODELS_RU };

const DOCS = 'https://docs.comfy.org';
const GGUF_SOURCE = 'https://github.com/city96/ComfyUI-GGUF';

/** Each node's page: docs.comfy.org for ComfyUI's own nodes, the pack's repository for those of ComfyUI-GGUF. */
export const IMAGE_MODEL_NODE_DOCS: Record<ImageModelNodeClass, string> = {
  ModelSamplingSD3: `${DOCS}/built-in-nodes/ModelSamplingSD3`,
  ModelSamplingAuraFlow: `${DOCS}/built-in-nodes/ModelSamplingAuraFlow`,
  ConditioningZeroOut: `${DOCS}/built-in-nodes/ConditioningZeroOut`,
  EmptyFlux2LatentImage: `${DOCS}/built-in-nodes/EmptyFlux2LatentImage`,
  Flux2Scheduler: `${DOCS}/built-in-nodes/Flux2Scheduler`,
  CFGGuider: `${DOCS}/built-in-nodes/CFGGuider`,
  BasicGuider: `${DOCS}/built-in-nodes/BasicGuider`,
  RandomNoise: `${DOCS}/built-in-nodes/RandomNoise`,
  SamplerCustomAdvanced: `${DOCS}/built-in-nodes/SamplerCustomAdvanced`,
  TripleCLIPLoader: `${DOCS}/built-in-nodes/TripleCLIPLoader`,
  QuadrupleCLIPLoader: `${DOCS}/built-in-nodes/QuadrupleCLIPLoader`,
  CLIPTextEncodeFlux: `${DOCS}/built-in-nodes/ClipTextEncodeFlux`,
  CLIPTextEncodeSDXL: `${DOCS}/built-in-nodes/ClipTextEncodeSdxl`,
  SDTurboScheduler: `${DOCS}/built-in-nodes/SDTurboScheduler`,
  CFGNorm: `${DOCS}/built-in-nodes/CFGNorm`,
  UnetLoaderGGUF: GGUF_SOURCE,
  UnetLoaderGGUFAdvanced: GGUF_SOURCE,
  CLIPLoaderGGUF: GGUF_SOURCE,
  DualCLIPLoaderGGUF: GGUF_SOURCE,
  TripleCLIPLoaderGGUF: GGUF_SOURCE,
  QuadrupleCLIPLoaderGGUF: GGUF_SOURCE,
};

/** Official tutorial pages of the families; with one, the files a guide names are a fact. */
export const IMAGE_MODEL_FAMILY_DOCS: Record<GuidedFamily | NewFamily, string | null> = {
  sd15: `${DOCS}/tutorials/basic/text-to-image`,
  sdxl: null,
  pony: null,
  illustrious: null,
  sd3: null,
  flux1: `${DOCS}/tutorials/flux/flux-1-text-to-image`,
  flux2: `${DOCS}/tutorials/flux/flux-2-klein`,
  chroma: null,
  'qwen-image': `${DOCS}/tutorials/image/qwen/qwen-image`,
  zimage: `${DOCS}/tutorials/image/z-image/z-image-turbo`,
  krea: `${DOCS}/tutorials/image/krea/krea-2`,
  hidream: `${DOCS}/tutorials/image/hidream/hidream-i1`,
  lumina: null,
  anima: `${DOCS}/tutorials/image/anima/anima`,
  flux3: `${DOCS}/tutorials/flux/flux-3-klein`,
  ovis: `${DOCS}/tutorials/image/ovis/ovis-image`,
  longcat: null,
  kandinsky5: null,
  omnigen2: `${DOCS}/tutorials/image/omnigen/omnigen2`,
  ernie: `${DOCS}/tutorials/image/ernie-image/ernie-image`,
};

function seedId(owner: ObjectRef, aspect: ExplanationAspect, language: KnowledgeLanguage): string {
  return `seed:${language}:${objectKey(owner)}:${aspect}`;
}

function seed(owner: ObjectRef, aspect: ExplanationAspect, text: string | undefined, provenance: Provenance, url: string | null, language: KnowledgeLanguage): CoreSeed[] {
  const trimmed = text?.trim();
  if (!trimmed) return [];
  return [{ id: seedId(owner, aspect, language), owner, aspect, text: trimmed, provenance, sourceUrl: provenance === 'fact' ? url : null }];
}

/**
 * The seeds of this set for one language, stored like the core ones. A node: what, why, connect, risk. A guided
 * family: its files (connect), settings (why) and prompt (next). A new family: those and what (what), what does not
 * mix (risk).
 */
export function imageModelSeeds(language: KnowledgeLanguage): CoreSeed[] {
  const pack = IMAGE_MODELS_KNOWLEDGE[language];
  const seeds: CoreSeed[] = [];
  for (const classType of IMAGE_MODEL_NODE_CLASSES) {
    const owner: ObjectRef = { kind: 'nodeClass', id: classType, classType };
    const texts = pack.nodes[classType];
    const url = IMAGE_MODEL_NODE_DOCS[classType];
    seeds.push(...seed(owner, 'what', texts.what, 'fact', url, language));
    seeds.push(...seed(owner, 'why', texts.why, 'inference', null, language));
    seeds.push(...seed(owner, 'connect', texts.connect, 'fact', url, language));
    seeds.push(...seed(owner, 'risk', texts.risk, 'inference', null, language));
  }
  const guide = (family: GuidedFamily | NewFamily, texts: FamilyGuide) => {
    const owner: ObjectRef = { kind: 'family', id: family };
    const url = IMAGE_MODEL_FAMILY_DOCS[family];
    seeds.push(...seed(owner, 'connect', texts.files, url ? 'fact' : 'inference', url, language));
    seeds.push(...seed(owner, 'why', texts.settings, 'inference', null, language));
    seeds.push(...seed(owner, 'next', texts.prompt, 'inference', null, language));
  };
  for (const family of GUIDED_FAMILIES) guide(family, pack.guides[family]);
  for (const family of NEW_FAMILIES) {
    const texts = pack.families[family];
    const owner: ObjectRef = { kind: 'family', id: family };
    const url = IMAGE_MODEL_FAMILY_DOCS[family];
    seeds.push(...seed(owner, 'what', texts.what, url ? 'fact' : 'inference', url, language));
    guide(family, texts);
    seeds.push(...seed(owner, 'risk', texts.mix, 'inference', null, language));
  }
  return seeds;
}

/** The note on a family this set introduces, in the shape of the core notes; null for any other. */
export function imageFamilyNote(family: string, language: KnowledgeLanguage): FamilyTexts | null {
  const texts = (IMAGE_MODELS_KNOWLEDGE[language].families as Record<string, NewFamilyTexts | undefined>)[family];
  return texts ? { what: texts.what, risk: texts.mix } : null;
}

/** How a family is set up (files, settings, prompt), for families of the core set and of this one; null if unknown. */
export function familyGuide(family: string, language: KnowledgeLanguage): FamilyGuide | null {
  const pack = IMAGE_MODELS_KNOWLEDGE[language];
  return (pack.guides as Record<string, FamilyGuide | undefined>)[family] ?? (pack.families as Record<string, FamilyGuide | undefined>)[family] ?? null;
}

/** What a field of a node does and what to put in it; null when this set says nothing about it. */
export function fieldNote(classType: string, field: string, language: KnowledgeLanguage): FieldTexts | null {
  return IMAGE_MODELS_KNOWLEDGE[language].fields[`${classType}.${field}`] ?? null;
}
