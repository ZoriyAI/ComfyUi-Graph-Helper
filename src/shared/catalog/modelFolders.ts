/**
 * Core loader folders from ComfyUI_frontend
 * src/platform/assets/mappings/modelNodeMappings.ts at 98700cfc,
 * the "ComfyUI core loaders" section only.
 * object_info combo lists are filenames. The folder name is not a field on the input spec
 * (ComfyUI server.py node_info / comfy.comfy_types.node_typing.InputTypeOptions).
 * https://github.com/Comfy-Org/ComfyUI_frontend/blob/98700cfc/src/platform/assets/mappings/modelNodeMappings.ts
 * Used to sort a catalog's model files into folders (objectInfo.ts, main/knowledge/repository.ts), to check that a
 * graph's models exist (graph/compatibility.ts) and to find loaders on the canvas (renderer graph/lib/modelLoaders.ts).
 */
const CORE_MODEL_WIDGETS: ReadonlyArray<readonly [string, string, string]> = [
  ['checkpoints', 'CheckpointLoaderSimple', 'ckpt_name'],
  ['checkpoints', 'ImageOnlyCheckpointLoader', 'ckpt_name'],
  ['loras', 'LoraLoader', 'lora_name'],
  ['loras', 'LoraLoaderModelOnly', 'lora_name'],
  ['vae', 'VAELoader', 'vae_name'],
  ['controlnet', 'ControlNetLoader', 'control_net_name'],
  ['diffusion_models', 'UNETLoader', 'unet_name'],
  ['upscale_models', 'UpscaleModelLoader', 'model_name'],
  ['style_models', 'StyleModelLoader', 'style_model_name'],
  ['gligen', 'GLIGENLoader', 'gligen_name'],
  ['clip_vision', 'CLIPVisionLoader', 'clip_name'],
  ['text_encoders', 'CLIPLoader', 'clip_name'],
  ['audio_encoders', 'AudioEncoderLoader', 'audio_encoder_name'],
  ['model_patches', 'ModelPatchLoader', 'name'],
  ['latent_upscale_models', 'LatentUpscaleModelLoader', 'model_name'],
  ['background_removal', 'LoadBackgroundRemovalModel', 'bg_removal_name'],
  ['frame_interpolation', 'FrameInterpolationModelLoader', 'model_name'],
  ['geometry_estimation', 'LoadMoGeModel', 'model_name'],
  ['optical_flow', 'OpticalFlowLoader', 'model_name'],
];

const byWidget = new Map<string, string>();
for (const [directory, classType, inputName] of CORE_MODEL_WIDGETS) {
  const key = `${classType}\0${inputName}`;
  if (!byWidget.has(key)) byWidget.set(key, directory);
}

/** The models folder a core loader's file field reads from, or undefined for any other field. */
export function modelDirectoryFor(classType: string, inputName: string): string | undefined {
  return byWidget.get(`${classType}\0${inputName}`);
}
