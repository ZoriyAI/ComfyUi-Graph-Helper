/**
 * Which core loader a model file from the library becomes when dropped on the canvas or added from its card, and
 * which field of an existing loader takes such a file. Directory names follow ComfyUI folder_paths and
 * shared/catalog/modelFolders.ts (core loaders only). Used by GraphWorkspace (drops on the canvas),
 * library/placeModel.ts and library/ModelCard.tsx.
 */
import { modelDirectoryFor } from '../../../../shared/catalog/modelFolders';

/** Model folder to the core loader class and the field that takes the file name. */
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

/** The add-node fields a library drag stands for: the class, its starting fields and an optional title. */
export interface LoaderDrop {
  nodeType: string;
  parameters: Record<string, unknown>;
  /** The display name the library showed, so a dropped node reads the same as a double-clicked one. */
  title?: string;
}

/** The core loader node for a model file in `directory`; null for a folder with no core loader or an empty name. */
export function loaderForModel(directory: string, name: string): LoaderDrop | null {
  const loader = LOADERS[directory.trim().toLowerCase()];
  if (!loader || name.trim() === '') return null;
  return { nodeType: loader.nodeType, parameters: { [loader.parameter]: name } };
}

/**
 * Field-name hints per folder, for loaders outside the core list (a pack's "lora_name", "ckpt", "vae_name").
 * Folder names as in shared/catalog/modelFolders.ts.
 */
const FIELD_HINTS: Record<string, RegExp> = {
  checkpoints: /ckpt|checkpoint/i,
  loras: /lora|lycoris|locon/i,
  vae: /vae/i,
  diffusion_models: /unet|diffusion/i,
  unet: /unet|diffusion/i,
  controlnet: /control/i,
  upscale_models: /upscale/i,
  text_encoders: /clip|text_?encoder/i,
  clip: /clip|text_?encoder/i,
};

/**
 * Which field of a node on the canvas takes a file from `directory`, so a file from the library can be put
 * into a selected loader. Core loaders by their known field; other classes by a field whose name says it
 * (only widget fields are passed in, so a "lora" socket of a wrapper pack never matches). Null when none does.
 */
export function loaderFieldFor(classType: string, fields: string[], directory: string): string | null {
  const folder = directory.trim().toLowerCase();
  const core = fields.find((field) => modelDirectoryFor(classType, field) === folder);
  if (core) return core;
  const loader = LOADERS[folder];
  if (loader && loader.nodeType === classType) return loader.parameter;
  // A core loader of another folder ("ckpt_name" on CheckpointLoaderSimple) is never a LoRA field.
  if (fields.some((field) => modelDirectoryFor(classType, field) !== undefined)) return null;
  const hint = FIELD_HINTS[folder];
  return hint ? fields.find((field) => hint.test(field)) ?? null : null;
}

/** The model a library drag carries, or null when the drag is a node class or not from the library. */
export function modelFromDrop(read: (type: string) => string): { directory: string; name: string } | null {
  const raw = read(MODEL_DRAG_TYPE);
  if (!raw) return null;
  const value = parse(raw);
  if (typeof value?.directory !== 'string' || typeof value?.name !== 'string' || value.name.trim() === '') return null;
  return { directory: value.directory, name: value.name };
}

/**
 * Drag data types of the library: a node class, and a model file. The one declaration: library/libraryModel.ts
 * re-exports these for the drag side (NodeLibrary, ModelLibrary).
 */
export const NODE_DRAG_TYPE = 'application/x-helper-node';
export const MODEL_DRAG_TYPE = 'application/x-helper-model';

/** A drag payload as a plain object; null for anything else, so a drag from another app cannot break the drop. */
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
    // The title comes from outside the canvas; it is cut to a sane length and dropped when it only repeats the class.
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
