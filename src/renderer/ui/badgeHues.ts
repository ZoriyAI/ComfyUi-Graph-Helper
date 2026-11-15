import type { BaseModelFamily, ModelKind, Provenance } from '../../shared/contracts';

/** Hue names map to Badge.module.css classes; the colours themselves are tokens. */
export type BadgeHue = 'model' | 'clip' | 'vae' | 'conditioning' | 'latent' | 'image' | 'mask' | 'controlnet' | 'accent' | 'ai' | 'warn' | 'none';

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

export function familyHue(family: BaseModelFamily): BadgeHue {
  return FAMILY_HUES[family] ?? 'none';
}

export function kindHue(kind: ModelKind): BadgeHue {
  return KIND_HUES[kind] ?? 'none';
}

export const PROVENANCE_TONES: Record<Provenance, 'ok' | 'ai' | 'accent' | 'warn'> = {
  fact: 'ok',
  inference: 'ai',
  web: 'accent',
  user: 'warn',
  // Written by whoever made a project file: not vouched for, so no reassuring colour.
  file: 'warn',
};
