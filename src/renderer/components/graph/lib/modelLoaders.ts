/**
 * Which core loader a model file from the library becomes when dropped on the canvas.
 * Directory names follow ComfyUI folder_paths and shared/catalog/modelFolders.ts (core loaders only).
 */
const LOADERS: Record<string, { nodeType: string; parameter: string }> = {
  checkpoints: { nodeType: 'CheckpointLoaderSimple', parameter: 'ckpt_name' },
  loras: { nodeType: 'LoraLoader', parameter: 'lora_name' },
  vae: { nodeType: 'VAELoader', parameter: 'vae_name' },
  diffusion_models: { nodeType: 'UNETLoader', parameter: 'unet_name' },
  unet: { nodeType: 'UNETLoader', parameter: 'unet_name' },
  controlnet: { nodeType: 'ControlNetLoader', parameter: 'control_net_name' },
  upscale_models: { nodeType: 'UpscaleModelLoader', parameter: 'model_name' },
  text_encoders: { nodeType: 'CLIPLoader', parameter: 'clip_name' },
  clip: { nodeType: 'CLIPLoader', parameter: 'clip_name' },
};

export interface LoaderDrop {
  nodeType: string;
  parameters: Record<string, unknown>;
  /** The display name the library showed, so a dropped node reads the same as a double-clicked one. */
  title?: string;
}

export function loaderForModel(directory: string, name: string): LoaderDrop | null {
  const loader = LOADERS[directory.trim().toLowerCase()];
  if (!loader || name.trim() === '') return null;
  return { nodeType: loader.nodeType, parameters: { [loader.parameter]: name } };
}

export const NODE_DRAG_TYPE = 'application/x-helper-node';
export const MODEL_DRAG_TYPE = 'application/x-helper-model';

function parse(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Reads a library drag payload into the add-node fields it stands for, or null when it is not one. */
export function dropToAddNode(read: (type: string) => string): LoaderDrop | null {
  const node = read(NODE_DRAG_TYPE);
  if (node) {
    const value = parse(node);
    const classType = value?.classType;
    if (typeof classType !== 'string' || classType === '') return null;
    const title = typeof value?.title === 'string' ? value.title.trim().slice(0, 200) : '';
    return title !== '' && title !== classType ? { nodeType: classType, parameters: {}, title } : { nodeType: classType, parameters: {} };
  }
  const model = read(MODEL_DRAG_TYPE);
  if (model) {
    const value = parse(model);
    if (typeof value?.directory !== 'string' || typeof value?.name !== 'string') return null;
    return loaderForModel(value.directory, value.name);
  }
  return null;
}
