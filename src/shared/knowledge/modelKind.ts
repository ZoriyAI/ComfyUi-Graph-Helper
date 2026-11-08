import type { ModelKind } from '../contracts/knowledge';

/** ComfyUI folder_paths names and the kind of file each loader expects there. */
const BY_DIRECTORY: Record<string, ModelKind> = {
  checkpoints: 'checkpoint',
  loras: 'lora',
  vae: 'vae',
  vae_approx: 'vae',
  controlnet: 'controlnet',
  t2i_adapter: 'controlnet',
  upscale_models: 'upscale',
  latent_upscale_models: 'upscale',
  clip: 'clip',
  clip_vision: 'clip_vision',
  unet: 'unet',
  diffusion_models: 'unet',
  text_encoders: 'text_encoder',
  embeddings: 'embedding',
  style_models: 'style',
  ipadapter: 'ipadapter',
};

export function kindFromDirectory(directory: string): ModelKind {
  const top = directory.split(/[\\/]/)[0]?.toLowerCase() ?? '';
  return BY_DIRECTORY[top] ?? 'other';
}

/**
 * The folder decides unless the header proves a LoRA: people do drop LoRAs into checkpoints/,
 * and a LoRA loaded as a checkpoint fails in a confusing way.
 */
export function inferModelKind(directory: string, metadata?: Record<string, string> | null): ModelKind {
  const architecture = metadata?.['modelspec.architecture'] ?? '';
  if (/\/lora\b/i.test(architecture)) return 'lora';
  if (metadata && typeof metadata.ss_network_module === 'string' && /lora|lycoris/i.test(metadata.ss_network_module)) return 'lora';
  return kindFromDirectory(directory);
}
