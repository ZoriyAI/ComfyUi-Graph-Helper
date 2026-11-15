/**
 * Which colour a model badge gets: hues by base-model family and by model kind, tones by provenance.
 * Who uses it: ui/Badge.tsx (FamilyBadge, KindBadge, ProvenanceBadge).
 * Why fixed tables: a family keeps the same colour in every list, so a person learns it once.
 */
import type { BaseModelFamily, ModelKind, Provenance } from '../../shared/contracts';

/** Hue names map to Badge.module.css classes; the colours themselves are tokens. */
export type BadgeHue = 'model' | 'clip' | 'vae' | 'conditioning' | 'latent' | 'image' | 'mask' | 'controlnet' | 'accent' | 'ai' | 'warn' | 'none';

/** Base-model family → hue. */
const FAMILY_HUES: Record<BaseModelFamily, BadgeHue> = {
  sd15: 'image',
  sd2: 'image',
  sdxl: 'accent',
  pony: 'latent',
  illustrious: 'latent',
  sd3: 'conditioning',
  flux1: 'ai',
  flux2: 'ai',
  chroma: 'ai',
  'qwen-image': 'controlnet',
  'wan2.1': 'warn',
  'wan2.2': 'warn',
  ltx2: 'clip',
  hunyuan: 'vae',
  zimage: 'mask',
  krea: 'model',
  kolors: 'conditioning',
  pixart: 'image',
  auraflow: 'controlnet',
  cascade: 'clip',
  unknown: 'none',
};

/** Model kind → hue. */
const KIND_HUES: Record<ModelKind, BadgeHue> = {
  checkpoint: 'model',
  unet: 'model',
  lora: 'latent',
  vae: 'vae',
  controlnet: 'controlnet',
  upscale: 'image',
  clip: 'clip',
  text_encoder: 'clip',
  clip_vision: 'clip',
  embedding: 'conditioning',
  style: 'conditioning',
  ipadapter: 'mask',
  other: 'none',
};

/** The hue of a family; 'none' for one the table does not know. */
export function familyHue(family: BaseModelFamily): BadgeHue {
  return FAMILY_HUES[family] ?? 'none';
}

/** The hue of a model kind; 'none' for one the table does not know. */
export function kindHue(kind: ModelKind): BadgeHue {
  return KIND_HUES[kind] ?? 'none';
}

/** Where a piece of knowledge came from → the badge tone: a fact is green, an inference is the AI colour. */
export const PROVENANCE_TONES: Record<Provenance, 'ok' | 'ai' | 'accent' | 'warn'> = {
  fact: 'ok',
  inference: 'ai',
  web: 'accent',
  user: 'warn',
  // Written by whoever made a project file: not vouched for, so no reassuring colour.
  file: 'warn',
};
