import type { BaseModelFamily, ExplanationAspect, Provenance } from '../contracts/knowledge';
import { objectKey, type ObjectRef } from '../contracts/objects';
import { CORE_KNOWLEDGE_EN } from './coreKnowledge.en';
import { CORE_KNOWLEDGE_RU } from './coreKnowledge.ru';
import { imageFamilyNote, imageModelSeeds } from './sets/image-models';
import { VIDEO_KNOWLEDGE_EN } from './sets/video.en';
import { VIDEO_KNOWLEDGE_RU } from './sets/video.ru';
import { VIDEO_KNOWLEDGE_DOCS } from './sets/video';
import { IMAGE_TECHNIQUES_KNOWLEDGE, IMAGE_TECHNIQUES_KNOWLEDGE_DOCS } from './sets/image-techniques';
import { foundationsKnowledgeSet, FOUNDATIONS_SET_DOCS } from './sets/foundations';

/**
 * Built-in teaching knowledge: what the core ComfyUI nodes, data types and base-model families are, written by
 * hand in English and Russian so the canvas can explain the basics before any LLM is configured.
 *
 * Provenance (every explanation shows where it comes from):
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

/** What a pack is for and its key nodes, by the pack's folder name. */
export interface PackTexts {
  what: string;
  nodes: string;
  risk?: string;
}

/**
 * Built-in knowledge of one domain, written beside the core (src/shared/knowledge/sets): node classes, link types
 * and families by id, the packs of the domain, and notes on fields by class and field name. An entry with the same
 * owner as a core one replaces it: that is how a set corrects the core.
 */
export interface KnowledgeSet {
  nodes: Record<string, CoreTexts>;
  linkTypes: Record<string, CoreTexts>;
  families: Record<string, FamilyTexts>;
  packs: Record<string, PackTexts>;
  fields: Record<string, Record<string, string>>;
  /** Ideas a person meets in lessons and asks about by name ("anchor picture"), for the glossary, by a stable id. */
  concepts?: Record<string, ConceptTexts>;
}

/** One idea of the glossary: its name as a person reads it, and what it means. */
export interface ConceptTexts {
  term: string;
  text: string;
}

/** Official pages for a set's node classes and families; a missing one has none. */
export interface KnowledgeSetDocs {
  nodes: Record<string, string>;
  families: Record<string, string>;
}

/** The sets, in the order they are read; a later one wins over an earlier one and over the core. */
export const KNOWLEDGE_SETS: Record<KnowledgeLanguage, Array<{ set: KnowledgeSet; docs: KnowledgeSetDocs }>> = {
  // The foundations set comes first: it never replaces an entry of the domain sets after it.
  en: [{ set: foundationsKnowledgeSet('en'), docs: FOUNDATIONS_SET_DOCS }, { set: VIDEO_KNOWLEDGE_EN, docs: VIDEO_KNOWLEDGE_DOCS }, { set: IMAGE_TECHNIQUES_KNOWLEDGE.en, docs: IMAGE_TECHNIQUES_KNOWLEDGE_DOCS }],
  ru: [{ set: foundationsKnowledgeSet('ru'), docs: FOUNDATIONS_SET_DOCS }, { set: VIDEO_KNOWLEDGE_RU, docs: VIDEO_KNOWLEDGE_DOCS }, { set: IMAGE_TECHNIQUES_KNOWLEDGE.ru, docs: IMAGE_TECHNIQUES_KNOWLEDGE_DOCS }],
};

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

/** `fact` marks what and connect as facts; a set's entry with no official page passes false and stays an inference. */
function textSeeds(owner: ObjectRef, texts: CoreTexts, url: string | null, language: KnowledgeLanguage, facts = true): CoreSeed[] {
  return TEXT_ASPECTS.flatMap((aspect) => {
    const text = texts[aspect]?.trim();
    if (!text) return [];
    const fact = facts && (aspect === 'what' || aspect === 'connect');
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
  seeds.push(...imageModelSeeds(language));
  for (const { set, docs } of KNOWLEDGE_SETS[language]) {
    for (const [classType, texts] of Object.entries(set.nodes)) {
      const url = docs.nodes[classType] ?? (CORE_NODE_DOCS as Record<string, string | null>)[classType] ?? null;
      seeds.push(...textSeeds(nodeClassRef(classType), texts, url, language, url !== null));
    }
    for (const [type, texts] of Object.entries(set.linkTypes)) {
      const url = (CORE_LINK_TYPE_DOCS as Record<string, string | null>)[type] ?? null;
      seeds.push(...textSeeds({ kind: 'linkType', id: type }, texts, url, language, url !== null));
    }
    for (const [family, texts] of Object.entries(set.families)) {
      const owner = familyRef(family);
      const url = docs.families[family] ?? CORE_FAMILY_DOCS[family as CoreFamily] ?? null;
      seeds.push({ id: coreSeedId(owner, 'what', language), owner, aspect: 'what', text: texts.what.trim(), provenance: url ? 'fact' : 'inference', sourceUrl: url });
      seeds.push({ id: coreSeedId(owner, 'risk', language), owner, aspect: 'risk', text: texts.risk.trim(), provenance: 'inference', sourceUrl: null });
    }
  }
  // A set's entry replaces the core one with the same id, in its place.
  const byId = new Map<string, CoreSeed>();
  for (const seed of seeds) byId.set(seed.id, seed);
  return [...byId.values()];
}

/** The built-in note about a family in the given language, for tooltips and the "Ask about this model" message. */
export function familyNote(family: string, language: KnowledgeLanguage): FamilyTexts | null {
  for (const { set } of [...KNOWLEDGE_SETS[language]].reverse()) {
    if (Object.prototype.hasOwnProperty.call(set.families, family)) return set.families[family];
  }
  const pack = CORE_KNOWLEDGE[language].families as Record<string, FamilyTexts | undefined>;
  return pack[family] ?? imageFamilyNote(family, language);
}

/** The built-in note on a link type, a set's correction first; null for a type nobody wrote about. */
export function linkTypeNote(type: string, language: KnowledgeLanguage): CoreTexts | null {
  const id = type.trim().toUpperCase();
  for (const { set } of [...KNOWLEDGE_SETS[language]].reverse()) {
    if (Object.prototype.hasOwnProperty.call(set.linkTypes, id)) return set.linkTypes[id];
  }
  return (CORE_KNOWLEDGE[language].linkTypes as Record<string, CoreTexts | undefined>)[id] ?? null;
}

/** What to put in a field of a class, as a set says it; null when no set does. */
export function fieldNote(classType: string, field: string, language: KnowledgeLanguage): string | null {
  for (const { set } of [...KNOWLEDGE_SETS[language]].reverse()) {
    const note = set.fields[classType]?.[field];
    if (note) return note;
  }
  return null;
}

/** A glossary idea by its id, as a set writes it; null for an idea no set knows. */
export function conceptNote(id: string, language: KnowledgeLanguage): ConceptTexts | null {
  for (const { set } of [...KNOWLEDGE_SETS[language]].reverse()) {
    const note = set.concepts?.[id];
    if (note) return note;
  }
  return null;
}

/** What a pack is for, by its folder name (case does not matter); null for a pack no set knows. */
export function packNote(pack: string, language: KnowledgeLanguage): PackTexts | null {
  const wanted = pack.trim().toLowerCase();
  for (const { set } of [...KNOWLEDGE_SETS[language]].reverse()) {
    const name = Object.keys(set.packs).find((item) => item.toLowerCase() === wanted);
    if (name) return set.packs[name];
  }
  return null;
}
