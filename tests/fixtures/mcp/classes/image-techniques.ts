/**
 * The node classes of the lessons on picture techniques, as ComfyUI and the packs declare them: ComfyUI's nodes.py
 * and comfy_extras (nodes_post_processing, nodes_upscale_model, nodes_canny, nodes_mask, nodes_compositing,
 * nodes_bg_removal, nodes_sam3, nodes_model_advanced, nodes_flux, nodes_qwen), comfyui_controlnet_aux
 * (node_wrappers/depth_anything_v2.py), ComfyUI_IPAdapter_plus (IPAdapterPlus.py), ComfyUI-Impact-Pack
 * (modules/impact/impact_pack.py) and ComfyUI-Impact-Subpack (modules/subpack_nodes.py).
 *
 * Two shapes of the same facts: one for the lesson tests (inputs with the value a fresh node starts with, link inputs
 * without one), one for the fake MCP server's catalog. Only classes no other fixture (the base list, classes/image-models.ts,
 * classes/video.ts) has are listed: the fake server must not serve a class twice.
 */

type LessonSpec = { inputs: Array<[string, string, unknown?]>; outputs: Array<[string, string]> };

/** The classes in the lesson tests' form, keyed by class type. */
export const IMAGE_TECHNIQUE_LESSON_CLASSES: Record<string, LessonSpec> = {
  ImageScaleToTotalPixels: { inputs: [['image', 'IMAGE'], ['upscale_method', 'COMBO', 'nearest-exact'], ['megapixels', 'FLOAT', 1], ['resolution_steps', 'INT', 1]], outputs: [['IMAGE', 'IMAGE']] },
  InpaintModelConditioning: {
    inputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['vae', 'VAE'], ['pixels', 'IMAGE'], ['mask', 'MASK'], ['noise_mask', 'BOOLEAN', true]],
    outputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent', 'LATENT']],
  },
  ImagePadForOutpaint: { inputs: [['image', 'IMAGE'], ['left', 'INT', 0], ['top', 'INT', 0], ['right', 'INT', 0], ['bottom', 'INT', 0], ['feathering', 'INT', 40]], outputs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
  SAM3_Detect: {
    inputs: [
      ['model', 'MODEL'], ['image', 'IMAGE'], ['conditioning', 'CONDITIONING'], ['bboxes', 'BOUNDING_BOX'], ['positive_coords', 'STRING'], ['negative_coords', 'STRING'],
      ['threshold', 'FLOAT', 0.5], ['refine_iterations', 'INT', 2], ['individual_masks', 'BOOLEAN', false],
    ],
    outputs: [['masks', 'MASK'], ['bboxes', 'BOUNDING_BOX']],
  },
  LoadBackgroundRemovalModel: { inputs: [['bg_removal_name', 'COMBO', 'birefnet.safetensors']], outputs: [['bg_model', 'BACKGROUND_REMOVAL']] },
  RemoveBackground: { inputs: [['bg_removal_model', 'BACKGROUND_REMOVAL'], ['image', 'IMAGE']], outputs: [['mask', 'MASK']] },
  InvertMask: { inputs: [['mask', 'MASK']], outputs: [['MASK', 'MASK']] },
  JoinImageWithAlpha: { inputs: [['image', 'IMAGE'], ['alpha', 'MASK']], outputs: [['IMAGE', 'IMAGE']] },
  UpscaleModelLoader: { inputs: [['model_name', 'COMBO', '4x-upscale.pth']], outputs: [['UPSCALE_MODEL', 'UPSCALE_MODEL']] },
  ImageUpscaleWithModel: { inputs: [['upscale_model', 'UPSCALE_MODEL'], ['image', 'IMAGE']], outputs: [['IMAGE', 'IMAGE']] },
  ImageScale: { inputs: [['image', 'IMAGE'], ['upscale_method', 'COMBO', 'nearest-exact'], ['width', 'INT', 512], ['height', 'INT', 512], ['crop', 'COMBO', 'disabled']], outputs: [['IMAGE', 'IMAGE']] },
  ControlNetLoader: { inputs: [['control_net_name', 'COMBO', 'control-canny.safetensors']], outputs: [['CONTROL_NET', 'CONTROL_NET']] },
  Canny: { inputs: [['image', 'IMAGE'], ['low_threshold', 'FLOAT', 0.4], ['high_threshold', 'FLOAT', 0.8]], outputs: [['IMAGE', 'IMAGE']] },
  ControlNetApplyAdvanced: {
    inputs: [
      ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['control_net', 'CONTROL_NET'], ['image', 'IMAGE'], ['strength', 'FLOAT', 1],
      ['start_percent', 'FLOAT', 0], ['end_percent', 'FLOAT', 1], ['vae', 'VAE'],
    ],
    outputs: [['positive', 'CONDITIONING'], ['negative', 'CONDITIONING']],
  },
  DepthAnythingV2Preprocessor: { inputs: [['image', 'IMAGE'], ['ckpt_name', 'COMBO', 'depth_anything_v2_vitl.pth'], ['resolution', 'INT', 512]], outputs: [['IMAGE', 'IMAGE']] },
  FluxKontextImageScale: { inputs: [['image', 'IMAGE']], outputs: [['IMAGE', 'IMAGE']] },
  TextEncodeQwenImageEditPlus: {
    inputs: [['clip', 'CLIP'], ['prompt', 'STRING', ''], ['vae', 'VAE'], ['image1', 'IMAGE'], ['image2', 'IMAGE'], ['image3', 'IMAGE']],
    outputs: [['CONDITIONING', 'CONDITIONING']],
  },
  CLIPVisionEncode: { inputs: [['clip_vision', 'CLIP_VISION'], ['image', 'IMAGE'], ['crop', 'COMBO', 'center']], outputs: [['CLIP_VISION_OUTPUT', 'CLIP_VISION_OUTPUT']] },
  StyleModelLoader: { inputs: [['style_model_name', 'COMBO', 'flux1-redux-dev.safetensors']], outputs: [['STYLE_MODEL', 'STYLE_MODEL']] },
  StyleModelApply: {
    inputs: [['conditioning', 'CONDITIONING'], ['style_model', 'STYLE_MODEL'], ['clip_vision_output', 'CLIP_VISION_OUTPUT'], ['strength', 'FLOAT', 1], ['strength_type', 'COMBO', 'multiply']],
    outputs: [['CONDITIONING', 'CONDITIONING']],
  },
  // ComfyUI_IPAdapter_plus.
  IPAdapterUnifiedLoader: { inputs: [['model', 'MODEL'], ['preset', 'COMBO', 'LIGHT - SD1.5 only (low strength)'], ['ipadapter', 'IPADAPTER']], outputs: [['model', 'MODEL'], ['ipadapter', 'IPADAPTER']] },
  IPAdapter: {
    inputs: [['model', 'MODEL'], ['ipadapter', 'IPADAPTER'], ['image', 'IMAGE'], ['weight', 'FLOAT', 1], ['start_at', 'FLOAT', 0], ['end_at', 'FLOAT', 1], ['weight_type', 'COMBO', 'standard'], ['attn_mask', 'MASK']],
    outputs: [['MODEL', 'MODEL']],
  },
  // ComfyUI-Impact-Subpack and ComfyUI-Impact-Pack.
  UltralyticsDetectorProvider: { inputs: [['model_name', 'COMBO', 'bbox/face_yolov8m.pt']], outputs: [['BBOX_DETECTOR', 'BBOX_DETECTOR'], ['SEGM_DETECTOR', 'SEGM_DETECTOR']] },
  FaceDetailer: {
    inputs: [
      ['image', 'IMAGE'], ['model', 'MODEL'], ['clip', 'CLIP'], ['vae', 'VAE'], ['guide_size', 'FLOAT', 512], ['guide_size_for', 'BOOLEAN', true], ['max_size', 'FLOAT', 1024],
      ['seed', 'INT', 0], ['steps', 'INT', 20], ['cfg', 'FLOAT', 8], ['sampler_name', 'COMBO', 'euler'], ['scheduler', 'COMBO', 'normal'], ['positive', 'CONDITIONING'],
      ['negative', 'CONDITIONING'], ['denoise', 'FLOAT', 0.5], ['feather', 'INT', 5], ['noise_mask', 'BOOLEAN', true], ['force_inpaint', 'BOOLEAN', true],
      ['bbox_threshold', 'FLOAT', 0.5], ['bbox_dilation', 'INT', 10], ['bbox_crop_factor', 'FLOAT', 3], ['drop_size', 'INT', 10], ['bbox_detector', 'BBOX_DETECTOR'],
      ['cycle', 'INT', 1], ['sam_model_opt', 'SAM_MODEL'], ['segm_detector_opt', 'SEGM_DETECTOR'],
    ],
    outputs: [['image', 'IMAGE'], ['cropped_refined', 'IMAGE'], ['cropped_enhanced_alpha', 'IMAGE'], ['mask', 'MASK'], ['detailer_pipe', 'DETAILER_PIPE'], ['cnet_images', 'IMAGE']],
  },
};

/** The packs these classes come from, as the fake server lists packs. */
export const IMAGE_TECHNIQUE_PACKS = [
  { name: 'ComfyUI_IPAdapter_plus', module: 'custom_nodes.ComfyUI_IPAdapter_plus', version: '2.0.0', commit: null },
  { name: 'ComfyUI-Impact-Pack', module: 'custom_nodes.ComfyUI-Impact-Pack', version: '8.0.0', commit: null },
  { name: 'ComfyUI-Impact-Subpack', module: 'custom_nodes.ComfyUI-Impact-Subpack', version: '1.3.0', commit: null },
];

type Spec = [string, Record<string, unknown>?] | [string[], Record<string, unknown>?];
interface ClassDef {
  classType: string;
  pack: number;
  display: string;
  category: string;
  required?: Record<string, Spec>;
  optional?: Record<string, Spec>;
  output: string[];
  outputName?: string[];
  outputNode?: boolean;
}

/**
 * The same classes for the fake server's catalog. `packIndex` gives the index of a pack in the server's list
 * (comfy-core and comfyui_controlnet_aux are there already; the three packs above are appended to it).
 */
export function imageTechniqueClassDefs(packIndex: (name: string) => number, files: (category: string) => string[]): ClassDef[] {
  const core = packIndex('comfy-core');
  const ipadapter = packIndex('ComfyUI_IPAdapter_plus');
  const impact = packIndex('ComfyUI-Impact-Pack');
  const subpack = packIndex('ComfyUI-Impact-Subpack');
  const methods = ['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos'];
  return [
    { classType: 'ImageScaleToTotalPixels', pack: core, display: 'Scale Image to Total Pixels', category: 'image/upscaling', required: { image: ['IMAGE'], upscale_method: [methods], megapixels: ['FLOAT', { default: 1, min: 0.01, max: 16, step: 0.01 }], resolution_steps: ['INT', { default: 1, min: 1, max: 256 }] }, output: ['IMAGE'] },
    { classType: 'InpaintModelConditioning', pack: core, display: 'InpaintModelConditioning', category: 'conditioning/inpaint', required: { positive: ['CONDITIONING'], negative: ['CONDITIONING'], vae: ['VAE'], pixels: ['IMAGE'], mask: ['MASK'], noise_mask: ['BOOLEAN', { default: true }] }, output: ['CONDITIONING', 'CONDITIONING', 'LATENT'], outputName: ['positive', 'negative', 'latent'] },
    { classType: 'ImagePadForOutpaint', pack: core, display: 'Pad Image for Outpainting', category: 'image', required: { image: ['IMAGE'], left: ['INT', { default: 0, min: 0, step: 8 }], top: ['INT', { default: 0, min: 0, step: 8 }], right: ['INT', { default: 0, min: 0, step: 8 }], bottom: ['INT', { default: 0, min: 0, step: 8 }], feathering: ['INT', { default: 40, min: 0 }] }, output: ['IMAGE', 'MASK'] },
    { classType: 'SAM3_Detect', pack: core, display: 'SAM3 Detect', category: 'detection', required: { model: ['MODEL'], image: ['IMAGE'], threshold: ['FLOAT', { default: 0.5, min: 0, max: 1, step: 0.01 }], refine_iterations: ['INT', { default: 2, min: 0, max: 5 }], individual_masks: ['BOOLEAN', { default: false }] }, optional: { conditioning: ['CONDITIONING'], bboxes: ['BOUNDING_BOX'], positive_coords: ['STRING', { forceInput: true }], negative_coords: ['STRING', { forceInput: true }] }, output: ['MASK', 'BOUNDING_BOX'], outputName: ['masks', 'bboxes'] },
    { classType: 'LoadBackgroundRemovalModel', pack: core, display: 'Load Background Removal Model', category: 'loaders', required: { bg_removal_name: [files('background_removal')] }, output: ['BACKGROUND_REMOVAL'], outputName: ['bg_model'] },
    { classType: 'RemoveBackground', pack: core, display: 'Remove Background', category: 'image/background removal', required: { bg_removal_model: ['BACKGROUND_REMOVAL'], image: ['IMAGE'] }, output: ['MASK'], outputName: ['mask'] },
    { classType: 'InvertMask', pack: core, display: 'Invert Mask', category: 'mask', required: { mask: ['MASK'] }, output: ['MASK'] },
    { classType: 'JoinImageWithAlpha', pack: core, display: 'Join Image with Alpha', category: 'mask/compositing', required: { image: ['IMAGE'], alpha: ['MASK'] }, output: ['IMAGE'] },
    { classType: 'Canny', pack: core, display: 'Detect Edges (Canny)', category: 'image/filters', required: { image: ['IMAGE'], low_threshold: ['FLOAT', { default: 0.4, min: 0.01, max: 0.99, step: 0.01 }], high_threshold: ['FLOAT', { default: 0.8, min: 0.01, max: 0.99, step: 0.01 }] }, output: ['IMAGE'] },
    { classType: 'FluxKontextImageScale', pack: core, display: 'FluxKontextImageScale', category: 'advanced/conditioning/flux', required: { image: ['IMAGE'] }, output: ['IMAGE'] },
    { classType: 'TextEncodeQwenImageEditPlus', pack: core, display: 'Text Encode Qwen Image Edit Plus', category: 'advanced/conditioning', required: { clip: ['CLIP'], prompt: ['STRING', { multiline: true, dynamicPrompts: true }] }, optional: { vae: ['VAE'], image1: ['IMAGE'], image2: ['IMAGE'], image3: ['IMAGE'] }, output: ['CONDITIONING'] },
    { classType: 'CLIPVisionEncode', pack: core, display: 'CLIP Vision Encode', category: 'conditioning', required: { clip_vision: ['CLIP_VISION'], image: ['IMAGE'], crop: [['center', 'none']] }, output: ['CLIP_VISION_OUTPUT'] },
    { classType: 'StyleModelLoader', pack: core, display: 'Load Style Model', category: 'loaders', required: { style_model_name: [files('style_models')] }, output: ['STYLE_MODEL'] },
    { classType: 'StyleModelApply', pack: core, display: 'Apply Style Model', category: 'conditioning/style_model', required: { conditioning: ['CONDITIONING'], style_model: ['STYLE_MODEL'], clip_vision_output: ['CLIP_VISION_OUTPUT'], strength: ['FLOAT', { default: 1, min: 0, max: 10, step: 0.001 }], strength_type: [['multiply', 'attn_bias']] }, output: ['CONDITIONING'] },
    { classType: 'IPAdapterUnifiedLoader', pack: ipadapter, display: 'IPAdapter Unified Loader', category: 'ipadapter', required: { model: ['MODEL'], preset: [['LIGHT - SD1.5 only (low strength)', 'STANDARD (medium strength)', 'VIT-G (medium strength)', 'PLUS (high strength)', 'PLUS FACE (portraits)', 'FULL FACE - SD1.5 only (portraits stronger)']] }, optional: { ipadapter: ['IPADAPTER'] }, output: ['MODEL', 'IPADAPTER'], outputName: ['model', 'ipadapter'] },
    { classType: 'IPAdapter', pack: ipadapter, display: 'IPAdapter', category: 'ipadapter', required: { model: ['MODEL'], ipadapter: ['IPADAPTER'], image: ['IMAGE'], weight: ['FLOAT', { default: 1, min: -1, max: 3, step: 0.05 }], start_at: ['FLOAT', { default: 0, min: 0, max: 1, step: 0.001 }], end_at: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.001 }], weight_type: [['standard', 'prompt is more important', 'style transfer']] }, optional: { attn_mask: ['MASK'] }, output: ['MODEL'] },
    { classType: 'UltralyticsDetectorProvider', pack: subpack, display: 'UltralyticsDetectorProvider', category: 'ImpactPack', required: { model_name: [['bbox/face_yolov8m.pt', 'bbox/hand_yolov8s.pt']] }, output: ['BBOX_DETECTOR', 'SEGM_DETECTOR'] },
    { classType: 'FaceDetailer', pack: impact, display: 'FaceDetailer', category: 'ImpactPack/Simple', required: { image: ['IMAGE'], model: ['MODEL'], clip: ['CLIP'], vae: ['VAE'], guide_size: ['FLOAT', { default: 512, min: 64, step: 8 }], seed: ['INT', { default: 0, min: 0 }], steps: ['INT', { default: 20, min: 1 }], cfg: ['FLOAT', { default: 8, min: 0, max: 100 }], positive: ['CONDITIONING'], negative: ['CONDITIONING'], denoise: ['FLOAT', { default: 0.5, min: 0.0001, max: 1, step: 0.01 }], bbox_detector: ['BBOX_DETECTOR'] }, optional: { sam_model_opt: ['SAM_MODEL'], segm_detector_opt: ['SEGM_DETECTOR'] }, output: ['IMAGE', 'IMAGE', 'IMAGE', 'MASK', 'DETAILER_PIPE', 'IMAGE'], outputName: ['image', 'cropped_refined', 'cropped_enhanced_alpha', 'mask', 'detailer_pipe', 'cnet_images'] },
  ];
}
