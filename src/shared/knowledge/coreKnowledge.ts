import type { BaseModelFamily, ExplanationAspect, Provenance } from '../contracts/knowledge';
import { objectKey, type ObjectRef } from '../contracts/objects';
import { CORE_KNOWLEDGE_EN } from './coreKnowledge.en';
import { CORE_KNOWLEDGE_RU } from './coreKnowledge.ru';

/**
 * Built-in teaching knowledge: what the core ComfyUI nodes, data types and base-model families are, written by
 * hand in English and Russian so the canvas can explain the basics before any LLM is configured.
 *
 * Provenance (helper brief §2, principle 3):
 * - `what` and `connect` describe standard ComfyUI behaviour and are marked `fact`, with the official docs page
 *   when one exists (every URL below was checked against https://docs.comfy.org/sitemap.xml).
 * - `why` and `risk` are usage advice, so they are marked `inference`.
 * - A family note is `fact` only when an official tutorial page backs the components it names; otherwise
 *   `inference`. Family `risk` (the LoRA rule and similar advice) is always `inference`.
 */

export type KnowledgeLanguage = 'en' | 'ru';
export const KNOWLEDGE_LANGUAGES: readonly KnowledgeLanguage[] = ['en', 'ru'];

export const CORE_NODE_CLASSES = [
  'CheckpointLoaderSimple', 'UNETLoader', 'CLIPLoader', 'DualCLIPLoader', 'VAELoader', 'LoraLoader', 'LoraLoaderModelOnly',
  'CLIPTextEncode', 'CLIPSetLastLayer', 'EmptyLatentImage', 'EmptySD3LatentImage', 'KSampler', 'KSamplerAdvanced',
  'SamplerCustom', 'BasicScheduler', 'KSamplerSelect', 'VAEDecode', 'VAEEncode', 'VAEEncodeForInpaint', 'SaveImage',
  'PreviewImage', 'LoadImage', 'ImageScale', 'ImageScaleBy', 'UpscaleModelLoader', 'ImageUpscaleWithModel',
  'ControlNetLoader', 'ControlNetApplyAdvanced', 'ConditioningCombine', 'ConditioningConcat', 'ConditioningSetArea',
  'LatentUpscale', 'LatentUpscaleBy', 'SetLatentNoiseMask', 'InpaintModelConditioning', 'CLIPVisionLoader',
  'CLIPVisionEncode', 'ModelSamplingFlux', 'FluxGuidance', 'Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode',
] as const;
export type CoreNodeClass = typeof CORE_NODE_CLASSES[number];

export const CORE_LINK_TYPES = [
  'MODEL', 'CLIP', 'VAE', 'CONDITIONING', 'LATENT', 'IMAGE', 'MASK', 'CONTROL_NET', 'UPSCALE_MODEL', 'CLIP_VISION',
  'CLIP_VISION_OUTPUT', 'SIGMAS', 'SAMPLER', 'GUIDER', 'NOISE', 'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO',
] as const;
export type CoreLinkType = typeof CORE_LINK_TYPES[number];

export const CORE_FAMILIES = [
  'sd15', 'sdxl', 'pony', 'illustrious', 'flux1', 'flux2', 'chroma', 'qwen-image', 'wan2.1', 'wan2.2', 'ltx2', 'hunyuan',
  'zimage', 'krea', 'sd3', 'kolors', 'auraflow', 'cascade',
] as const satisfies readonly BaseModelFamily[];
export type CoreFamily = typeof CORE_FAMILIES[number];

/** One node class or data type: what it is, why it is used, what goes in and out, and an optional pitfall. */
export interface CoreTexts {
  what: string;
  why: string;
  connect: string;
  risk?: string;
}

/** One base-model family: what it is and which loaders it needs, and the compatibility pitfall. */
export interface FamilyTexts {
  what: string;
  risk: string;
}

export interface CoreLanguagePack {
  nodes: Record<CoreNodeClass, CoreTexts>;
  linkTypes: Record<CoreLinkType, CoreTexts>;
  families: Record<CoreFamily, FamilyTexts>;
}

export const CORE_KNOWLEDGE: Record<KnowledgeLanguage, CoreLanguagePack> = { en: CORE_KNOWLEDGE_EN, ru: CORE_KNOWLEDGE_RU };

const DOCS = 'https://docs.comfy.org';

/** Official built-in node pages. The docs spell some class names differently (ClipLoader for CLIPLoader). */
export const CORE_NODE_DOCS: Record<CoreNodeClass, string | null> = {
  CheckpointLoaderSimple: `${DOCS}/built-in-nodes/CheckpointLoaderSimple`,
  UNETLoader: `${DOCS}/built-in-nodes/UNETLoader`,
  CLIPLoader: `${DOCS}/built-in-nodes/ClipLoader`,
  DualCLIPLoader: `${DOCS}/built-in-nodes/DualCLIPLoader`,
  VAELoader: `${DOCS}/built-in-nodes/VAELoader`,
  LoraLoader: `${DOCS}/built-in-nodes/LoraLoader`,
  LoraLoaderModelOnly: `${DOCS}/built-in-nodes/LoraLoaderModelOnly`,
  CLIPTextEncode: `${DOCS}/built-in-nodes/ClipTextEncode`,
  CLIPSetLastLayer: `${DOCS}/built-in-nodes/ClipSetLastLayer`,
  EmptyLatentImage: `${DOCS}/built-in-nodes/EmptyLatentImage`,
  EmptySD3LatentImage: `${DOCS}/built-in-nodes/EmptySD3LatentImage`,
  KSampler: `${DOCS}/built-in-nodes/KSampler`,
  KSamplerAdvanced: `${DOCS}/built-in-nodes/KSamplerAdvanced`,
  SamplerCustom: `${DOCS}/built-in-nodes/SamplerCustom`,
  BasicScheduler: `${DOCS}/built-in-nodes/BasicScheduler`,
  KSamplerSelect: `${DOCS}/built-in-nodes/KSamplerSelect`,
  VAEDecode: `${DOCS}/built-in-nodes/VAEDecode`,
  VAEEncode: `${DOCS}/built-in-nodes/VAEEncode`,
  VAEEncodeForInpaint: `${DOCS}/built-in-nodes/VAEEncodeForInpaint`,
  SaveImage: `${DOCS}/built-in-nodes/SaveImage`,
  PreviewImage: `${DOCS}/built-in-nodes/PreviewImage`,
  LoadImage: `${DOCS}/built-in-nodes/LoadImage`,
  ImageScale: `${DOCS}/built-in-nodes/ImageScale`,
  ImageScaleBy: `${DOCS}/built-in-nodes/ImageScaleBy`,
  UpscaleModelLoader: `${DOCS}/built-in-nodes/UpscaleModelLoader`,
  ImageUpscaleWithModel: `${DOCS}/built-in-nodes/ImageUpscaleWithModel`,
  ControlNetLoader: `${DOCS}/built-in-nodes/ControlNetLoader`,
  ControlNetApplyAdvanced: `${DOCS}/built-in-nodes/ControlNetApplyAdvanced`,
  ConditioningCombine: `${DOCS}/built-in-nodes/ConditioningCombine`,
  ConditioningConcat: `${DOCS}/built-in-nodes/ConditioningConcat`,
  ConditioningSetArea: `${DOCS}/built-in-nodes/ConditioningSetArea`,
  LatentUpscale: `${DOCS}/built-in-nodes/LatentUpscale`,
  LatentUpscaleBy: `${DOCS}/built-in-nodes/LatentUpscaleBy`,
  SetLatentNoiseMask: `${DOCS}/built-in-nodes/SetLatentNoiseMask`,
  InpaintModelConditioning: `${DOCS}/built-in-nodes/InpaintModelConditioning`,
  CLIPVisionLoader: `${DOCS}/built-in-nodes/ClipVisionLoader`,
  CLIPVisionEncode: `${DOCS}/built-in-nodes/ClipVisionEncode`,
  ModelSamplingFlux: `${DOCS}/built-in-nodes/ModelSamplingFlux`,
  FluxGuidance: `${DOCS}/built-in-nodes/FluxGuidance`,
  Note: `${DOCS}/built-in-nodes/Note`,
  MarkdownNote: `${DOCS}/built-in-nodes/MarkdownNote`,
  Reroute: `${DOCS}/built-in-nodes/Reroute`,
  // The frontend-only Primitive node is described on the datatypes page ("Primitive and reroute").
  PrimitiveNode: `${DOCS}/custom-nodes/backend/datatypes`,
};

const DATATYPES = `${DOCS}/custom-nodes/backend/datatypes`;

/** The datatypes page names these types; the rest link to the node that produces them. */
export const CORE_LINK_TYPE_DOCS: Record<CoreLinkType, string | null> = {
  MODEL: DATATYPES,
  CLIP: DATATYPES,
  VAE: DATATYPES,
  CONDITIONING: DATATYPES,
  LATENT: DATATYPES,
  IMAGE: DATATYPES,
  MASK: DATATYPES,
  CONTROL_NET: CORE_NODE_DOCS.ControlNetLoader,
  UPSCALE_MODEL: CORE_NODE_DOCS.UpscaleModelLoader,
  CLIP_VISION: CORE_NODE_DOCS.CLIPVisionLoader,
  CLIP_VISION_OUTPUT: CORE_NODE_DOCS.CLIPVisionEncode,
  SIGMAS: DATATYPES,
  SAMPLER: DATATYPES,
  GUIDER: DATATYPES,
  NOISE: DATATYPES,
  INT: DATATYPES,
  FLOAT: DATATYPES,
  STRING: DATATYPES,
  BOOLEAN: DATATYPES,
  COMBO: DATATYPES,
};

/**
 * Official tutorial pages that list the files a family needs. A family with a page has a `fact` note; one
 * without keeps its note as `inference`.
 */
export const CORE_FAMILY_DOCS: Record<CoreFamily, string | null> = {
  sd15: `${DOCS}/tutorials/basic/text-to-image`,
  sdxl: null,
  pony: null,
  illustrious: null,
  flux1: `${DOCS}/tutorials/flux/flux-1-text-to-image`,
  flux2: `${DOCS}/tutorials/flux/flux-2-dev`,
  chroma: null,
  'qwen-image': `${DOCS}/tutorials/image/qwen/qwen-image`,
  'wan2.1': `${DOCS}/tutorials/video/wan/wan-video`,
  'wan2.2': `${DOCS}/tutorials/video/wan/wan2_2`,
  ltx2: `${DOCS}/tutorials/video/ltx/ltx-2`,
  hunyuan: `${DOCS}/tutorials/video/hunyuan/hunyuan-video`,
  zimage: `${DOCS}/tutorials/image/z-image/z-image-turbo`,
  krea: `${DOCS}/tutorials/flux/flux1-krea-dev`,
  sd3: null,
  kolors: null,
  auraflow: null,
  cascade: null,
};

export function nodeClassRef(classType: string): ObjectRef {
  return { kind: 'nodeClass', id: classType, classType };
}

/** The data type of a link as an owner; null for an empty or wildcard type. */
export function linkTypeRef(dataType: string | null | undefined): ObjectRef | null {
  const type = (dataType ?? '').trim();
  if (!type || type === '*') return null;
  return { kind: 'linkType', id: type.toUpperCase() };
}

export function familyRef(family: string): ObjectRef {
  return { kind: 'family', id: family };
}

/** One seeded explanation, before it is stored. */
export interface CoreSeed {
  id: string;
  owner: ObjectRef;
  aspect: ExplanationAspect;
  text: string;
  provenance: Provenance;
  sourceUrl: string | null;
}

/** Stable per (owner, aspect, language): seeding again updates the same row. */
export function coreSeedId(owner: ObjectRef, aspect: ExplanationAspect, language: KnowledgeLanguage): string {
  return `seed:${language}:${objectKey(owner)}:${aspect}`;
}

const TEXT_ASPECTS = ['what', 'why', 'connect', 'risk'] as const;

function textSeeds(owner: ObjectRef, texts: CoreTexts, url: string | null, language: KnowledgeLanguage): CoreSeed[] {
  return TEXT_ASPECTS.flatMap((aspect) => {
    const text = texts[aspect]?.trim();
    if (!text) return [];
    const fact = aspect === 'what' || aspect === 'connect';
    return [{
      id: coreSeedId(owner, aspect, language),
      owner,
      aspect,
      text,
      provenance: fact ? 'fact' as const : 'inference' as const,
      sourceUrl: fact ? url : null,
    }];
  });
}

/** Every seed for one language: node classes, link types, families. */
export function coreSeeds(language: KnowledgeLanguage): CoreSeed[] {
  const pack = CORE_KNOWLEDGE[language];
  const seeds: CoreSeed[] = [];
  for (const classType of CORE_NODE_CLASSES) {
    seeds.push(...textSeeds(nodeClassRef(classType), pack.nodes[classType], CORE_NODE_DOCS[classType], language));
  }
  for (const type of CORE_LINK_TYPES) {
    seeds.push(...textSeeds({ kind: 'linkType', id: type }, pack.linkTypes[type], CORE_LINK_TYPE_DOCS[type], language));
  }
  for (const family of CORE_FAMILIES) {
    const owner = familyRef(family);
    const texts = pack.families[family];
    const url = CORE_FAMILY_DOCS[family];
    seeds.push({
      id: coreSeedId(owner, 'what', language), owner, aspect: 'what', text: texts.what.trim(),
      provenance: url ? 'fact' : 'inference', sourceUrl: url,
    });
    seeds.push({ id: coreSeedId(owner, 'risk', language), owner, aspect: 'risk', text: texts.risk.trim(), provenance: 'inference', sourceUrl: null });
  }
  return seeds;
}

/** The built-in note about a family in the given language, for tooltips and the "Ask about this model" message. */
export function familyNote(family: string, language: KnowledgeLanguage): FamilyTexts | null {
  const pack = CORE_KNOWLEDGE[language].families as Record<string, FamilyTexts | undefined>;
  return pack[family] ?? null;
}
