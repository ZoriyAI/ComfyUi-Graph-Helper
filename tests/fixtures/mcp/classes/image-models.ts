/**
 * The node classes the lessons on picture model families use beyond those every test already has, as ComfyUI and
 * ComfyUI-GGUF declare them: nodes.py and comfy_extras (nodes_sd3.py, nodes_flux.py, nodes_model_advanced.py,
 * nodes_custom_sampler.py) of ComfyUI, nodes.py of ComfyUI-GGUF. Inputs in the order the class declares them, with
 * the value a fresh node starts with; link inputs have none.
 *
 * One list serves two fixtures: the lesson tests' table of classes and the fake ComfyUI's /object_info.
 */

export interface FixtureClass {
  classType: string;
  display: string;
  category: string;
  /** The pack, by name. */
  pack: 'comfy-core' | 'ComfyUI-GGUF';
  /** [name, type, start value, choices of a list]. */
  inputs: Array<[string, string, unknown?, string[]?]>;
  /** [name, type]. */
  outputs: Array<[string, string]>;
}

const SAMPLERS = ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'res_multistep', 'er_sde', 'lcm', 'uni_pc'];

export const IMAGE_MODEL_CLASSES: readonly FixtureClass[] = [
  {
    classType: 'DualCLIPLoader', display: 'DualCLIPLoader', category: 'advanced/loaders', pack: 'comfy-core',
    inputs: [['clip_name1', 'COMBO', 'clip_l.safetensors', ['clip_l.safetensors', 't5xxl_fp16.safetensors']], ['clip_name2', 'COMBO', 'clip_l.safetensors', ['clip_l.safetensors', 't5xxl_fp16.safetensors']], ['type', 'COMBO', 'sdxl', ['sdxl', 'sd3', 'flux', 'hunyuan_video', 'hidream']]],
    outputs: [['CLIP', 'CLIP']],
  },
  { classType: 'ConditioningZeroOut', display: 'ConditioningZeroOut', category: 'advanced/conditioning', pack: 'comfy-core', inputs: [['conditioning', 'CONDITIONING']], outputs: [['CONDITIONING', 'CONDITIONING']] },
  { classType: 'EmptySD3LatentImage', display: 'EmptySD3LatentImage', category: 'latent/sd3', pack: 'comfy-core', inputs: [['width', 'INT', 1024], ['height', 'INT', 1024], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  { classType: 'FluxGuidance', display: 'FluxGuidance', category: 'advanced/conditioning/flux', pack: 'comfy-core', inputs: [['conditioning', 'CONDITIONING'], ['guidance', 'FLOAT', 3.5]], outputs: [['CONDITIONING', 'CONDITIONING']] },
  { classType: 'ModelSamplingAuraFlow', display: 'ModelSamplingAuraFlow', category: 'advanced/model', pack: 'comfy-core', inputs: [['model', 'MODEL'], ['shift', 'FLOAT', 1.73]], outputs: [['MODEL', 'MODEL']] },
  { classType: 'EmptyFlux2LatentImage', display: 'Empty Flux 2 Latent', category: 'latent', pack: 'comfy-core', inputs: [['width', 'INT', 1024], ['height', 'INT', 1024], ['batch_size', 'INT', 1]], outputs: [['LATENT', 'LATENT']] },
  { classType: 'Flux2Scheduler', display: 'Flux2Scheduler', category: 'sampling/custom_sampling/schedulers', pack: 'comfy-core', inputs: [['steps', 'INT', 20], ['width', 'INT', 1024], ['height', 'INT', 1024]], outputs: [['SIGMAS', 'SIGMAS']] },
  { classType: 'CFGGuider', display: 'CFG Guider', category: 'sampling/custom_sampling/guiders', pack: 'comfy-core', inputs: [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['cfg', 'FLOAT', 8]], outputs: [['GUIDER', 'GUIDER']] },
  { classType: 'KSamplerSelect', display: 'KSamplerSelect', category: 'sampling/custom_sampling/samplers', pack: 'comfy-core', inputs: [['sampler_name', 'COMBO', 'euler', SAMPLERS]], outputs: [['SAMPLER', 'SAMPLER']] },
  { classType: 'RandomNoise', display: 'RandomNoise', category: 'sampling/custom_sampling/noise', pack: 'comfy-core', inputs: [['noise_seed', 'INT', 0]], outputs: [['NOISE', 'NOISE']] },
  {
    classType: 'SamplerCustomAdvanced', display: 'SamplerCustomAdvanced', category: 'sampling/custom_sampling', pack: 'comfy-core',
    inputs: [['noise', 'NOISE'], ['guider', 'GUIDER'], ['sampler', 'SAMPLER'], ['sigmas', 'SIGMAS'], ['latent_image', 'LATENT']],
    outputs: [['output', 'LATENT'], ['denoised_output', 'LATENT']],
  },
  { classType: 'UnetLoaderGGUF', display: 'Unet Loader (GGUF)', category: 'bootleg', pack: 'ComfyUI-GGUF', inputs: [['unet_name', 'COMBO', 'flux1-dev-Q4_K_S.gguf', ['flux1-dev-Q4_K_S.gguf', 'z_image_turbo-Q8_0.gguf']]], outputs: [['MODEL', 'MODEL']] },
];

type LessonSpec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };

/** The classes in the form of the lesson tests' table. */
export function imageModelLessonSpecs(): Record<string, LessonSpec> {
  return Object.fromEntries(IMAGE_MODEL_CLASSES.map((item) => [item.classType, {
    inputs: item.inputs.map(([name, type, value]) => (value === undefined ? [name, type] : [name, type, value]) as [string, string, unknown?]),
    outputs: item.outputs,
  }]));
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN']);

type InputSpec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];

/**
 * The classes in the form of the fake ComfyUI's class list. `packIndex` turns a pack name into its place in that
 * fixture's list of packs.
 */
export function imageModelClassDefs(packIndex: (name: string) => number) {
  return IMAGE_MODEL_CLASSES.map((item) => ({
    classType: item.classType,
    pack: packIndex(item.pack),
    display: item.display,
    category: item.category,
    required: Object.fromEntries(item.inputs.map(([name, type, value, choices]): [string, InputSpec] => [
      name,
      choices ? [choices, { default: value }] : WIDGET_TYPES.has(type) ? [type, { default: value }] : [type],
    ])),
    output: item.outputs.map(([, type]) => type),
    outputName: item.outputs.map(([name]) => name),
  }));
}
