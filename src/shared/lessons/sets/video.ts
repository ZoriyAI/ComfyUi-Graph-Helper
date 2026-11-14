import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';
import type { LessonGroup } from '../engine';

/**
 * Video beyond the Wan 2.2 pair and the WanVideoWrapper pack, used by the lesson list (lessons.ts registers this set):
 * the small Wan 2.2 model, the anchor picture thread (start image, first and last frame, a reference for the whole
 * clip, a longer video in parts), video
 * guided by another video, speech-driven video, LTX-2 with sound, HunyuanVideo 1.5, Kandinsky 5, more frames between
 * frames, a larger video, loading and cutting with VideoHelperSuite, removing an object, and what to change when a
 * video graph does not fit in memory.
 *
 * Every graph is the one of an official ComfyUI template (comfyui workflow_templates) or of the pack's own example,
 * named above each lesson. Class, input and output names are ComfyUI's own (comfy_extras) and the packs' own; the
 * numbers are the templates' numbers, and each number a step's text names is the preferred value of its rule.
 */

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer });
const differs = (role: string, name: string): FieldTest => ({ kind: 'differs', role, field: name });
const same = (role: string, name: string): FieldTest => ({ kind: 'same', role, field: name });
const text = (minChars: number): FieldTest => ({ kind: 'text', minChars });

/** What may stand on the way of a model to where it is used: a LoRA, a cache that skips steps. */
const MODEL_VIA = ['LoraLoaderModelOnly', 'EasyCache'];
/** What may stand between the frames of a video and what reads them: a resize, a cut of the batch, a control made of them. */
const FRAMES_VIA = ['ImageScale', 'ImageScaleBy', 'ImageFromBatch', 'ImageResizeKJv2', 'ImageResizeKJ', 'GetImageRangeFromBatch', 'ResizeImageMaskNode'];
const CONTROL_VIA = [...FRAMES_VIA, 'Canny', 'CannyEdgePreprocessor', 'DepthAnythingV2Preprocessor', 'DWPreprocessor', 'OpenposePreprocessor', 'LineArtPreprocessor'];

/** A loader for one model file, a text encoder of a type, a VAE, and the two prompts it reads. */
function readers(clipType: string, clipStep = 'text-encoder') {
  return [
    { id: clipStep, roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals(clipType))] },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(3))],
    },
  ];
}

/** The noise shift every Wan graph has, on the way from its loader. */
const shiftOf = (from: string, prefer: number, min = 5, max = 8) => ({
  id: 'shift',
  roles: [node('shift', 'ModelSamplingSD3')],
  links: [link(from, 'MODEL', 'shift', 'model', MODEL_VIA)],
  fields: [field('shift', 'shift', between(min, max, prefer))],
});

/** A KSampler fed by a model and by a node that gives the prompts and the empty clip together. */
const samplerFrom = (start: string, model = 'shift') => ({
  id: 'sampler',
  roles: [node('sampler', 'KSampler')],
  links: [
    link(model, 'MODEL', 'sampler', 'model', MODEL_VIA),
    link(start, 'positive', 'sampler', 'positive'),
    link(start, 'negative', 'sampler', 'negative'),
    link(start, 'latent', 'sampler', 'latent_image'),
  ],
});

/** The decoder, and the clip saved at the frame rate the model draws, with a sound track when one is named. */
function out(fps: number, sound?: { from: string; output: string }) {
  return [
    { id: 'decode', roles: [node('decode', 'VAEDecode', 'VAEDecodeTiled')], links: [link('sampler', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae')] },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [
        link('decode', 'IMAGE', 'video', 'images'),
        ...(sound ? [link(sound.from, sound.output, 'video', 'audio')] : []),
        link('video', 'VIDEO', 'save', 'video'),
      ],
      fields: [field('video', 'fps', equals(fps))],
    },
  ];
}

/**
 * Wan 2.2 TI2V 5B: one model, its own VAE, a start that may carry a picture. Template: video_wan2_2_5B_ti2v.json.
 */
const videoSmall: Lesson = {
  id: 'video-small',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    ...readers('wan'),
    shiftOf('model', 8),
    {
      id: 'latent',
      roles: [node('latent', 'Wan22ImageToVideoLatent')],
      links: [link('vae', 'VAE', 'latent', 'vae')],
      fields: [field('latent', 'width', between(640, 1280, 1280)), field('latent', 'height', between(352, 1280, 704)), field('latent', 'length', between(49, 121, 121))],
    },
    { id: 'picture', read: true },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(10, 30, 20)),
        field('sampler', 'cfg', between(4, 6, 5)),
        field('sampler', 'sampler_name', equals('uni_pc')),
        field('sampler', 'scheduler', equals('simple')),
      ],
    },
    ...out(24),
    { id: 'run', read: true },
  ],
};

/**
 * Wan 2.2 14B first and last frame: the image-to-video pair with WanFirstLastFrameToVideo in place of the
 * one-picture start. Template: video_wan2_2_14B_flf2v.json (20 steps split at 10, cfg 4, shift 8, 640×640, 81 frames).
 */
const videoFlf: Lesson = {
  id: 'video-flf',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'models',
      roles: [node('high', 'UNETLoader'), node('low', 'UNETLoader')],
      fields: [field('high', 'unet_name', chosen), field('low', 'unet_name', differs('high', 'unet_name'))],
    },
    ...readers('wan'),
    {
      id: 'shift',
      roles: [node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3')],
      links: [link('high', 'MODEL', 'shiftHigh', 'model', MODEL_VIA), link('low', 'MODEL', 'shiftLow', 'model', MODEL_VIA)],
      fields: [field('shiftHigh', 'shift', between(5, 8, 8)), field('shiftLow', 'shift', between(5, 8, 8))],
    },
    {
      id: 'pictures',
      roles: [node('first', 'LoadImage'), node('last', 'LoadImage')],
      fields: [field('first', 'image', chosen), field('last', 'image', differs('first', 'image'))],
    },
    {
      id: 'start',
      roles: [node('start', 'WanFirstLastFrameToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('first', 'IMAGE', 'start', 'start_image', FRAMES_VIA),
        link('last', 'IMAGE', 'start', 'end_image', FRAMES_VIA),
      ],
      fields: [field('start', 'width', between(480, 1280, 640)), field('start', 'height', between(480, 1280, 640)), field('start', 'length', between(49, 121, 81))],
    },
    {
      id: 'first-pass',
      roles: [node('pass1', 'KSamplerAdvanced')],
      links: [
        link('shiftHigh', 'MODEL', 'pass1', 'model', MODEL_VIA),
        link('start', 'positive', 'pass1', 'positive'),
        link('start', 'negative', 'pass1', 'negative'),
        link('start', 'latent', 'pass1', 'latent_image'),
      ],
    },
    {
      id: 'second-pass',
      roles: [node('sampler', 'KSamplerAdvanced')],
      links: [
        link('shiftLow', 'MODEL', 'sampler', 'model', MODEL_VIA),
        link('start', 'positive', 'sampler', 'positive'),
        link('start', 'negative', 'sampler', 'negative'),
        link('pass1', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'split',
      fields: [
        field('pass1', 'add_noise', equals('enable')),
        field('pass1', 'steps', between(10, 40, 20)),
        field('pass1', 'cfg', between(1, 5, 4)),
        field('pass1', 'start_at_step', equals(0)),
        field('pass1', 'end_at_step', between(1, 20, 10)),
        field('pass1', 'return_with_leftover_noise', equals('enable')),
        field('sampler', 'add_noise', equals('disable')),
        field('sampler', 'steps', same('pass1', 'steps')),
        field('sampler', 'cfg', same('pass1', 'cfg')),
        field('sampler', 'start_at_step', same('pass1', 'end_at_step')),
        field('sampler', 'return_with_leftover_noise', equals('disable')),
      ],
    },
    ...out(16),
    { id: 'between', read: true },
    { id: 'loop', read: true },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Wan 2.2 Fun Control 5B: a reference picture says what is drawn, a control video (depth, pose, edges) says how
 * it moves. Template: video_wan2_2_5B_fun_control.json (the Canny there is optional and switched off).
 */
const videoControl: Lesson = {
  id: 'video-control',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    ...readers('wan'),
    shiftOf('model', 8),
    {
      id: 'source',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    { id: 'control', read: true },
    { id: 'reference', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'start',
      roles: [node('start', 'Wan22FunControlToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('picture', 'IMAGE', 'start', 'ref_image', FRAMES_VIA),
        link('frames', 'images', 'start', 'control_video', CONTROL_VIA),
      ],
      fields: [field('start', 'width', between(480, 1280, 704)), field('start', 'height', between(480, 1280, 704)), field('start', 'length', between(49, 121, 121))],
    },
    samplerFrom('start'),
    {
      id: 'settings',
      fields: [field('sampler', 'steps', between(10, 30, 20)), field('sampler', 'cfg', between(4, 6, 5)), field('sampler', 'sampler_name', equals('uni_pc'))],
    },
    ...out(24),
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * HuMo: a person in a picture speaks the words of a sound file. One 17B model with the lightx2v speed-up LoRA,
 * the Whisper audio encoder, 640×640, 97 frames at 25 fps, 6 steps, cfg 1. Template: video_humo.json.
 */
const videoSpeech: Lesson = {
  id: 'video-speech',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'lora',
      roles: [node('lora', 'LoraLoaderModelOnly')],
      links: [link('model', 'MODEL', 'lora', 'model')],
      fields: [field('lora', 'lora_name', chosen), field('lora', 'strength_model', between(0.5, 1, 1))],
    },
    shiftOf('lora', 8),
    ...readers('wan'),
    {
      id: 'voice',
      roles: [node('voice', 'LoadAudio'), node('listener', 'AudioEncoderLoader'), node('heard', 'AudioEncoderEncode')],
      links: [link('listener', 'AUDIO_ENCODER', 'heard', 'audio_encoder'), link('voice', 'AUDIO', 'heard', 'audio')],
      fields: [field('voice', 'audio', chosen), field('listener', 'audio_encoder_name', chosen)],
    },
    { id: 'portrait', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'start',
      roles: [node('start', 'WanHuMoImageToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('heard', 'AUDIO_ENCODER_OUTPUT', 'start', 'audio_encoder_output'),
        link('picture', 'IMAGE', 'start', 'ref_image', FRAMES_VIA),
      ],
      fields: [field('start', 'width', between(480, 1280, 640)), field('start', 'height', between(480, 1280, 640)), field('start', 'length', between(25, 97, 97))],
    },
    samplerFrom('start'),
    { id: 'settings', fields: [field('sampler', 'steps', between(4, 10, 6)), field('sampler', 'cfg', equals(1))] },
    ...out(25, { from: 'voice', output: 'AUDIO' }),
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/** The sigmas of the LTX-2.5 template: eight steps for the first stage, three for the second. */
export const LTX_SIGMAS_FIRST = '1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0';
export const LTX_SIGMAS_SECOND = '0.85, 0.7250, 0.4219, 0.0';

/**
 * LTX-2.5 text to video with sound: one distilled model, video and sound drawn together in one latent, a first
 * stage at half size and a second after a latent upscaler. Template: video_ltx2_5_t2v.json. There each stage has
 * its own copy of the noise, the sampler choice and the guider with the same settings; one of each serves both here.
 */
const videoLtx: Lesson = {
  id: 'video-ltx',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'readers',
      roles: [node('clip', 'CLIPLoader'), node('vae', 'VAELoader'), node('soundVae', 'VAELoader')],
      fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('ltxv')), field('vae', 'vae_name', chosen), field('soundVae', 'vae_name', differs('vae', 'vae_name'))],
    },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(40))],
    },
    {
      id: 'rate',
      roles: [node('rate', 'LTXVConditioning')],
      links: [link('positive', 'CONDITIONING', 'rate', 'positive'), link('negative', 'CONDITIONING', 'rate', 'negative')],
      fields: [field('rate', 'frame_rate', equals(24))],
    },
    {
      id: 'size',
      roles: [node('latent', 'EmptyLTXVLatentVideo')],
      fields: [field('latent', 'width', between(512, 960, 768)), field('latent', 'height', between(288, 544, 512)), field('latent', 'length', between(49, 121, 121))],
    },
    {
      id: 'silence',
      roles: [node('silence', 'LTXVEmptyLatentAudio'), node('join', 'LTXVConcatAVLatent')],
      links: [link('soundVae', 'VAE', 'silence', 'audio_vae'), link('latent', 'LATENT', 'join', 'video_latent'), link('silence', 'LATENT', 'join', 'audio_latent')],
      fields: [field('silence', 'frames_number', same('latent', 'length')), field('silence', 'frame_rate', same('rate', 'frame_rate'))],
    },
    {
      id: 'parts',
      roles: [node('noise', 'RandomNoise'), node('pick', 'KSamplerSelect'), node('sigmas', 'ManualSigmas')],
      fields: [field('pick', 'sampler_name', equals('euler_ancestral')), field('sigmas', 'sigmas', equals(LTX_SIGMAS_FIRST))],
    },
    {
      id: 'guider',
      roles: [node('guider', 'LTXVDualCFGGuider')],
      links: [link('model', 'MODEL', 'guider', 'model', MODEL_VIA), link('rate', 'positive', 'guider', 'positive'), link('rate', 'negative', 'guider', 'negative')],
      fields: [field('guider', 'video_cfg', equals(1)), field('guider', 'audio_cfg', equals(1))],
    },
    {
      id: 'first-stage',
      roles: [node('stage1', 'SamplerCustomAdvanced')],
      links: [
        link('noise', 'NOISE', 'stage1', 'noise'),
        link('guider', 'GUIDER', 'stage1', 'guider'),
        link('pick', 'SAMPLER', 'stage1', 'sampler'),
        link('sigmas', 'SIGMAS', 'stage1', 'sigmas'),
        link('join', 'LATENT', 'stage1', 'latent_image'),
      ],
    },
    {
      id: 'upscale',
      roles: [node('split1', 'LTXVSeparateAVLatent'), node('upscaler', 'LatentUpscaleModelLoader'), node('larger', 'LTXVLatentUpsampler'), node('rejoin', 'LTXVConcatAVLatent')],
      links: [
        link('stage1', 'output', 'split1', 'av_latent'),
        link('split1', 'video_latent', 'larger', 'samples'),
        link('upscaler', 'LATENT_UPSCALE_MODEL', 'larger', 'upscale_model'),
        link('vae', 'VAE', 'larger', 'vae'),
        link('larger', 'LATENT', 'rejoin', 'video_latent'),
        link('split1', 'audio_latent', 'rejoin', 'audio_latent'),
      ],
      fields: [field('upscaler', 'model_name', chosen)],
    },
    {
      id: 'second-stage',
      roles: [node('sigmas2', 'ManualSigmas'), node('stage2', 'SamplerCustomAdvanced')],
      links: [
        link('noise', 'NOISE', 'stage2', 'noise'),
        link('guider', 'GUIDER', 'stage2', 'guider'),
        link('pick', 'SAMPLER', 'stage2', 'sampler'),
        link('sigmas2', 'SIGMAS', 'stage2', 'sigmas'),
        link('rejoin', 'LATENT', 'stage2', 'latent_image'),
      ],
      fields: [field('sigmas2', 'sigmas', equals(LTX_SIGMAS_SECOND))],
    },
    {
      id: 'decode',
      roles: [node('split2', 'LTXVSeparateAVLatent'), node('decode', 'VAEDecodeTiled', 'VAEDecode'), node('sound', 'LTXVAudioVAEDecode')],
      links: [
        link('stage2', 'output', 'split2', 'av_latent'),
        link('split2', 'video_latent', 'decode', 'samples'),
        link('vae', 'VAE', 'decode', 'vae'),
        link('split2', 'audio_latent', 'sound', 'samples'),
        link('soundVae', 'VAE', 'sound', 'audio_vae'),
      ],
    },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('decode', 'IMAGE', 'video', 'images'), link('sound', 'AUDIO', 'video', 'audio'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', equals(24))],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * HunyuanVideo 1.5 720p text to video, its first stage: the custom sampler with BasicScheduler and CFGGuider, shift 7,
 * 20 steps, cfg 6, 1280×720, 121 frames at 24 fps. Template: video_hunyuan_video_1.5_720p_t2v.json, which saves this
 * stage's clip and offers a second, super-resolution stage on top.
 */
const videoHunyuan: Lesson = {
  id: 'video-hunyuan',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'text-encoders',
      roles: [node('clip', 'DualCLIPLoader')],
      fields: [field('clip', 'clip_name1', chosen), field('clip', 'clip_name2', differs('clip', 'clip_name1')), field('clip', 'type', equals('hunyuan_video_15'))],
    },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(3))],
    },
    shiftOf('model', 7, 5, 9),
    {
      id: 'size',
      roles: [node('latent', 'EmptyHunyuanVideo15Latent')],
      fields: [field('latent', 'width', between(640, 1280, 1280)), field('latent', 'height', between(368, 720, 720)), field('latent', 'length', between(33, 121, 121))],
    },
    {
      id: 'parts',
      roles: [node('noise', 'RandomNoise'), node('pick', 'KSamplerSelect'), node('schedule', 'BasicScheduler')],
      links: [link('model', 'MODEL', 'schedule', 'model', MODEL_VIA)],
      fields: [field('pick', 'sampler_name', equals('euler')), field('schedule', 'scheduler', equals('simple')), field('schedule', 'steps', between(8, 50, 20))],
    },
    {
      id: 'guider',
      roles: [node('guider', 'CFGGuider')],
      links: [link('shift', 'MODEL', 'guider', 'model', MODEL_VIA), link('positive', 'CONDITIONING', 'guider', 'positive'), link('negative', 'CONDITIONING', 'guider', 'negative')],
      fields: [field('guider', 'cfg', between(1, 8, 6))],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'SamplerCustomAdvanced')],
      links: [
        link('noise', 'NOISE', 'sampler', 'noise'),
        link('guider', 'GUIDER', 'sampler', 'guider'),
        link('pick', 'SAMPLER', 'sampler', 'sampler'),
        link('schedule', 'SIGMAS', 'sampler', 'sigmas'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
    },
    {
      id: 'decode',
      roles: [node('decode', 'VAEDecode', 'VAEDecodeTiled')],
      links: [link('sampler', 'output', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae')],
    },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('decode', 'IMAGE', 'video', 'images'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', equals(24))],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Kandinsky 5 Lite text to video: one 2B model, Qwen2.5-VL with CLIP-L as text encoders, the HunyuanVideo VAE,
 * shift 5, 50 steps, cfg 5, euler_ancestral with beta, 768×512, 121 frames at 24 fps. Template: video_kandinsky5_t2v.json.
 */
const videoKandinsky: Lesson = {
  id: 'video-kandinsky',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'text-encoders',
      roles: [node('clip', 'DualCLIPLoader')],
      fields: [field('clip', 'clip_name1', chosen), field('clip', 'clip_name2', differs('clip', 'clip_name1')), field('clip', 'type', equals('kandinsky5'))],
    },
    { id: 'vae', roles: [node('vae', 'VAELoader')], fields: [field('vae', 'vae_name', chosen)] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', text(3))],
    },
    shiftOf('model', 5, 3, 8),
    {
      id: 'start',
      roles: [node('start', 'Kandinsky5ImageToVideo')],
      links: [link('positive', 'CONDITIONING', 'start', 'positive'), link('negative', 'CONDITIONING', 'start', 'negative'), link('vae', 'VAE', 'start', 'vae')],
      fields: [field('start', 'width', between(512, 1280, 768)), field('start', 'height', between(320, 768, 512)), field('start', 'length', between(49, 121, 121))],
    },
    samplerFrom('start'),
    {
      id: 'settings',
      fields: [
        field('sampler', 'steps', between(20, 50, 50)),
        field('sampler', 'cfg', between(3, 7, 5)),
        field('sampler', 'sampler_name', equals('euler_ancestral')),
        field('sampler', 'scheduler', equals('beta')),
      ],
    },
    ...out(24),
    { id: 'run', read: true },
  ],
};

/** Built-in frame interpolation: more frames between frames. Template: utility_video_frame_interpolation.json. */
const videoInterpolate: Lesson = {
  id: 'video-interpolate',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'source',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    { id: 'model', roles: [node('interp', 'FrameInterpolationModelLoader')], fields: [field('interp', 'model_name', chosen)] },
    {
      id: 'between',
      roles: [node('more', 'FrameInterpolate')],
      links: [link('interp', 'INTERP_MODEL', 'more', 'interp_model'), link('frames', 'images', 'more', 'images', FRAMES_VIA)],
      fields: [field('more', 'multiplier', between(2, 4, 2))],
    },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('more', 'IMAGE', 'video', 'images'), link('frames', 'audio', 'video', 'audio'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', between(2, 120, 32))],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * ComfyUI-SeedVR2_VideoUpscaler: a larger, sharper video. The pack's example SeedVR2_HD_video_upscale.json
 * (3B model, 32 blocks swapped, tiled VAE, resolution 1080, batch 33, lab colour) and the template
 * utility_seedvr2_video_upscale.json.
 */
const videoUpscale: Lesson = {
  id: 'video-upscale',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'source',
      roles: [node('source', 'LoadVideo'), node('frames', 'GetVideoComponents')],
      links: [link('source', 'VIDEO', 'frames', 'video')],
      fields: [field('source', 'file', chosen)],
    },
    {
      id: 'dit',
      roles: [node('dit', 'SeedVR2LoadDiTModel')],
      fields: [field('dit', 'model', chosen), field('dit', 'blocks_to_swap', between(0, 36, 32)), field('dit', 'offload_device', equals('cpu'))],
    },
    {
      id: 'vae',
      roles: [node('vae', 'SeedVR2LoadVAEModel')],
      fields: [field('vae', 'model', chosen), field('vae', 'encode_tiled', equals(true)), field('vae', 'decode_tiled', equals(true))],
    },
    {
      id: 'upscaler',
      roles: [node('larger', 'SeedVR2VideoUpscaler')],
      links: [link('frames', 'images', 'larger', 'image', FRAMES_VIA), link('dit', 'SEEDVR2_DIT', 'larger', 'dit'), link('vae', 'SEEDVR2_VAE', 'larger', 'vae')],
      fields: [field('larger', 'resolution', between(720, 2160, 1080)), field('larger', 'batch_size', between(5, 81, 33)), field('larger', 'color_correction', equals('lab'))],
    },
    {
      id: 'save',
      roles: [node('video', 'CreateVideo'), node('save', 'SaveVideo')],
      links: [link('larger', 'IMAGE', 'video', 'images'), link('frames', 'audio', 'video', 'audio'), link('video', 'VIDEO', 'save', 'video')],
      fields: [field('video', 'fps', between(1, 120, 24))],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * ComfyUI-VideoHelperSuite: load a piece of a video at a chosen frame rate, and save it with its sound. The pack's
 * tests simple.json and audio.json, and the template utility-frame_interpolation-film.json.
 */
const videoVhs: Lesson = {
  id: 'video-vhs',
  steps: [
    { id: 'intro', read: true },
    { id: 'load', roles: [node('source', 'VHS_LoadVideo')], fields: [field('source', 'video', chosen)] },
    {
      id: 'trim',
      fields: [
        field('source', 'force_rate', between(1, 60, 16)),
        field('source', 'skip_first_frames', between(1, 100000, 16)),
        field('source', 'frame_load_cap', between(1, 1000, 81)),
      ],
    },
    { id: 'size', read: true },
    {
      id: 'combine',
      roles: [node('save', 'VHS_VideoCombine')],
      links: [link('source', 'IMAGE', 'save', 'images', FRAMES_VIA), link('source', 'audio', 'save', 'audio')],
      fields: [field('save', 'frame_rate', same('source', 'force_rate')), field('save', 'format', equals('video/h264-mp4'))],
    },
    { id: 'more', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * ComfyUI_ProPainter_Nodes: an object is removed from a video by a mask video that marks it. The pack's example
 * propainter-inpainting-workflow.json (both videos halved, the mask read from the red channel, 24 frames).
 */
const videoRemove: Lesson = {
  id: 'video-remove',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'source',
      roles: [node('source', 'VHS_LoadVideo', 'VHS_LoadVideoPath')],
      fields: [field('source', 'video', chosen), field('source', 'frame_load_cap', between(1, 300, 24))],
    },
    {
      id: 'mask-video',
      roles: [node('maskSource', 'VHS_LoadVideo', 'VHS_LoadVideoPath')],
      fields: [field('maskSource', 'video', differs('source', 'video')), field('maskSource', 'frame_load_cap', same('source', 'frame_load_cap'))],
    },
    {
      id: 'to-mask',
      roles: [node('mask', 'ImageToMask')],
      links: [link('maskSource', 'IMAGE', 'mask', 'image', FRAMES_VIA)],
      fields: [field('mask', 'channel', equals('red'))],
    },
    {
      id: 'inpaint',
      roles: [node('clean', 'ProPainterInpaint')],
      links: [link('source', 'IMAGE', 'clean', 'image', FRAMES_VIA), link('mask', 'MASK', 'clean', 'mask')],
      fields: [field('clean', 'width', between(64, 2560, 640)), field('clean', 'height', between(64, 2560, 480)), field('clean', 'mask_dilates', between(0, 20, 5))],
    },
    {
      id: 'save',
      roles: [node('save', 'VHS_VideoCombine')],
      links: [link('clean', 'IMAGE', 'save', 'images')],
      fields: [field('save', 'frame_rate', between(1, 60, 24))],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Practice on the graph of "video-small": the model held in fp8, the clip decoded in tiles, a smaller size and
 * fewer frames. VAE Decode (Tiled) is the decoder of the LTX-2 and HunyuanVideo 1.5 templates; weight_dtype is
 * UNETLoader's own field.
 */
const videoMemory: Lesson = {
  id: 'video-memory',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('model', 'UNETLoader'), node('vae', 'VAELoader'), node('latent', 'Wan22ImageToVideoLatent'), node('sampler', 'KSampler'), node('video', 'CreateVideo')],
      links: [link('latent', 'LATENT', 'sampler', 'latent_image')],
    },
    { id: 'where', read: true },
    { id: 'fp8', fields: [field('model', 'weight_dtype', equals('fp8_e4m3fn'))] },
    { id: 'files', read: true },
    {
      id: 'tiles',
      roles: [node('tiled', 'VAEDecodeTiled')],
      links: [link('sampler', 'LATENT', 'tiled', 'samples'), link('vae', 'VAE', 'tiled', 'vae'), link('tiled', 'IMAGE', 'video', 'images')],
      fields: [field('tiled', 'tile_size', between(256, 512, 512)), field('tiled', 'temporal_size', between(16, 64, 32))],
    },
    {
      id: 'smaller',
      fields: [field('latent', 'width', between(480, 960, 960)), field('latent', 'height', between(320, 544, 544)), field('latent', 'length', between(25, 81, 81))],
    },
    { id: 'offload', read: true },
    { id: 'check', read: true },
  ],
};

/**
 * The anchor picture, part 1: the start image of the small Wan model holds the first frame and the look. Template:
 * video_wan2_2_5B_ti2v.json, whose Load Image goes into start_image of Wan22ImageToVideoLatent.
 */
const anchorStart: Lesson = {
  id: 'anchor-start',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('model', 'UNETLoader'), node('latent', 'Wan22ImageToVideoLatent'), node('positive', 'CLIPTextEncode'), node('sampler', 'KSampler')],
      links: [link('latent', 'LATENT', 'sampler', 'latent_image'), link('positive', 'CONDITIONING', 'sampler', 'positive')],
    },
    {
      id: 'picture',
      roles: [node('picture', 'LoadImage')],
      links: [link('picture', 'IMAGE', 'latent', 'start_image', FRAMES_VIA)],
      fields: [field('picture', 'image', chosen)],
    },
    { id: 'holds', read: true },
    { id: 'length', fields: [field('latent', 'length', between(49, 121, 81))] },
    { id: 'trade', read: true },
    { id: 'motion', fields: [field('positive', 'text', text(40))] },
    { id: 'lora', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * The anchor picture, part 3: a reference image held through every frame by Wan VACE, not only the first. Template:
 * video_wan_vace_14B_ref2v.json (VACE 14B with the CausVid LoRA at 0.3, shift 8, 768 × 768, 81 frames, 4 steps,
 * cfg 1, uni_pc, TrimVideoLatent before the decoder, 16 fps).
 */
const anchorReference: Lesson = {
  id: 'anchor-reference',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'lora',
      roles: [node('lora', 'LoraLoaderModelOnly', 'LoraLoader')],
      links: [link('model', 'MODEL', 'lora', 'model')],
      fields: [field('lora', 'lora_name', chosen), field('lora', 'strength_model', between(0.2, 1, 0.3))],
    },
    shiftOf('lora', 8),
    ...readers('wan'),
    { id: 'reference', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'start',
      roles: [node('start', 'WanVaceToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start', 'positive'),
        link('negative', 'CONDITIONING', 'start', 'negative'),
        link('vae', 'VAE', 'start', 'vae'),
        link('picture', 'IMAGE', 'start', 'reference_image', FRAMES_VIA),
      ],
      fields: [field('start', 'width', between(480, 1280, 768)), field('start', 'height', between(480, 1280, 768)), field('start', 'length', between(49, 121, 81)), field('start', 'strength', between(0.5, 1.5, 1))],
    },
    samplerFrom('start'),
    { id: 'settings', fields: [field('sampler', 'steps', between(4, 30, 4)), field('sampler', 'cfg', between(1, 6, 1)), field('sampler', 'sampler_name', equals('uni_pc'))] },
    { id: 'trim', roles: [node('trim', 'TrimVideoLatent')], links: [link('sampler', 'LATENT', 'trim', 'samples')] },
    { id: 'decode', roles: [node('decode', 'VAEDecode', 'VAEDecodeTiled')], links: [link('trim', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae')] },
    out(16)[1],
    { id: 'keeps', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * The anchor picture, part 4: a longer video in parts. The key frame that ends one part starts the next, the parts
 * are joined into one batch of frames. Template: templates-6-key-frames.json (Wan 2.2 FLF2V parts chained by shared
 * key frames, joined with Batch Images); here the second part is built on the graph of "video-flf".
 */
const anchorParts: Lesson = {
  id: 'anchor-parts',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [
        node('shiftHigh', 'ModelSamplingSD3'), node('shiftLow', 'ModelSamplingSD3'), node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode'),
        node('vae', 'VAELoader'), node('last', 'LoadImage'), node('start', 'WanFirstLastFrameToVideo'), node('pass1', 'KSamplerAdvanced'),
        node('sampler', 'KSamplerAdvanced'), node('decode', 'VAEDecode', 'VAEDecodeTiled'), node('video', 'CreateVideo'),
      ],
      links: [
        link('last', 'IMAGE', 'start', 'end_image', FRAMES_VIA),
        link('start', 'latent', 'pass1', 'latent_image'),
        link('pass1', 'LATENT', 'sampler', 'latent_image'),
        link('sampler', 'LATENT', 'decode', 'samples'),
      ],
    },
    { id: 'key', roles: [node('next', 'LoadImage')], fields: [field('next', 'image', differs('last', 'image'))] },
    {
      id: 'start2',
      roles: [node('start2', 'WanFirstLastFrameToVideo')],
      links: [
        link('positive', 'CONDITIONING', 'start2', 'positive'),
        link('negative', 'CONDITIONING', 'start2', 'negative'),
        link('vae', 'VAE', 'start2', 'vae'),
        link('last', 'IMAGE', 'start2', 'start_image', FRAMES_VIA),
        link('next', 'IMAGE', 'start2', 'end_image', FRAMES_VIA),
      ],
      fields: [field('start2', 'width', same('start', 'width')), field('start2', 'height', same('start', 'height')), field('start2', 'length', same('start', 'length'))],
    },
    {
      id: 'passes2',
      roles: [node('pass3', 'KSamplerAdvanced'), node('pass4', 'KSamplerAdvanced')],
      links: [
        link('shiftHigh', 'MODEL', 'pass3', 'model', MODEL_VIA),
        link('start2', 'positive', 'pass3', 'positive'),
        link('start2', 'negative', 'pass3', 'negative'),
        link('start2', 'latent', 'pass3', 'latent_image'),
        link('shiftLow', 'MODEL', 'pass4', 'model', MODEL_VIA),
        link('start2', 'positive', 'pass4', 'positive'),
        link('start2', 'negative', 'pass4', 'negative'),
        link('pass3', 'LATENT', 'pass4', 'latent_image'),
      ],
    },
    {
      id: 'split2',
      fields: [
        field('pass3', 'add_noise', equals('enable')),
        field('pass3', 'steps', same('pass1', 'steps')),
        field('pass3', 'cfg', same('pass1', 'cfg')),
        field('pass3', 'end_at_step', same('pass1', 'end_at_step')),
        field('pass3', 'return_with_leftover_noise', equals('enable')),
        field('pass4', 'add_noise', equals('disable')),
        field('pass4', 'steps', same('pass1', 'steps')),
        field('pass4', 'cfg', same('pass1', 'cfg')),
        field('pass4', 'start_at_step', same('pass3', 'end_at_step')),
        field('pass4', 'return_with_leftover_noise', equals('disable')),
      ],
    },
    { id: 'seed', fields: [field('pass3', 'noise_seed', same('pass1', 'noise_seed'))] },
    { id: 'decode2', roles: [node('decode2', 'VAEDecode', 'VAEDecodeTiled')], links: [link('pass4', 'LATENT', 'decode2', 'samples'), link('vae', 'VAE', 'decode2', 'vae')] },
    {
      id: 'join',
      roles: [node('join', 'ImageBatch')],
      links: [link('decode', 'IMAGE', 'join', 'image1'), link('decode2', 'IMAGE', 'join', 'image2'), link('join', 'IMAGE', 'video', 'images')],
    },
    { id: 'drift', read: true },
    { id: 'chain', read: true },
    { id: 'run', read: true },
  ],
};

/** In the order a person meets them. */
export const VIDEO_LESSONS: readonly Lesson[] = [
  videoSmall, videoMemory,
  anchorStart, videoFlf, anchorReference, anchorParts,
  videoControl, videoSpeech, videoLtx, videoHunyuan, videoKandinsky,
  videoVhs, videoInterpolate, videoUpscale, videoRemove,
];

/** Lessons that stand on the graph of another. */
export const VIDEO_LESSON_AFTER: Readonly<Record<string, string[]>> = {
  'video-memory': ['video-small'],
  'anchor-start': ['video-small'],
  'anchor-parts': ['video-flf'],
};

/** The groups of the lesson list this set uses (LessonGroup is shared with the other sets). */
export const VIDEO_GROUP: LessonGroup = { id: 'video', title: { ru: 'Видео', en: 'Video' } };
export const ANCHOR_GROUP: LessonGroup = { id: 'video-anchor', title: { ru: 'Видео: опорная картинка', en: 'Video: the anchor picture' } };
export const PACKS_GROUP: LessonGroup = { id: 'packs-tools', title: { ru: 'Паки и инструменты', en: 'Packs and tools' } };

/**
 * Where each lesson of the set stands on the learning path (LESSON_PATH in lessons.ts): its group and the lessons
 * it goes on from as knowledge. The graph a lesson stands on, if any, is VIDEO_LESSON_AFTER.
 */
export const VIDEO_PATH: Readonly<Record<string, { group: LessonGroup; follows: string[] }>> = {
  'video-small': { group: VIDEO_GROUP, follows: ['video-text'] },
  'video-memory': { group: VIDEO_GROUP, follows: ['video-small'] },
  'anchor-start': { group: ANCHOR_GROUP, follows: ['video-small'] },
  'video-flf': { group: ANCHOR_GROUP, follows: ['anchor-start'] },
  'anchor-reference': { group: ANCHOR_GROUP, follows: ['video-flf'] },
  'anchor-parts': { group: ANCHOR_GROUP, follows: ['video-flf'] },
  'video-control': { group: VIDEO_GROUP, follows: ['video-small'] },
  'video-speech': { group: VIDEO_GROUP, follows: ['video-image'] },
  'video-ltx': { group: VIDEO_GROUP, follows: ['video-small'] },
  'video-hunyuan': { group: VIDEO_GROUP, follows: ['video-small'] },
  'video-kandinsky': { group: VIDEO_GROUP, follows: ['video-small'] },
  'video-interpolate': { group: VIDEO_GROUP, follows: ['video-small'] },
  'video-vhs': { group: PACKS_GROUP, follows: ['video-small'] },
  'video-upscale': { group: PACKS_GROUP, follows: ['video-vhs'] },
  'video-remove': { group: PACKS_GROUP, follows: ['video-vhs'] },
};

/** The packs the classes of these lessons come from, for "this lesson does not fit". */
export const VIDEO_PACK_OF: ReadonlyArray<readonly [RegExp, string]> = [
  [/^VHS_/, 'ComfyUI-VideoHelperSuite'],
  [/^SeedVR2(?:LoadDiTModel|LoadVAEModel|VideoUpscaler|TorchCompileSettings)$/, 'ComfyUI-SeedVR2_VideoUpscaler'],
  [/^ProPainter/, 'ComfyUI_ProPainter_Nodes'],
  [/^(?:RIFE|FILM|AMT|GMFSS|IFRNet|IFUnet|M2M|Sepconv|STMFNet|FLAVR|CAIN) VFI$/, 'ComfyUI-Frame-Interpolation'],
  [/^CoTracker/, 'comfyui_cotracker_node'],
  [/^(?:ImageResizeKJv2|GetImageRangeFromBatch|ImageBatchMulti|GetImageSizeAndCount|ColorMatch|SetNode|GetNode)$/, 'ComfyUI-KJNodes'],
];

/**
 * What the engine engineer needs to add per lesson: which file a loader must hold (by words in its name) and the
 * reason sentence of each numeric rule. Kept as data so the report and a later engine can read it.
 */
export const VIDEO_FILE_KINDS: Readonly<Record<string, ReadonlyArray<{ role: string; field: string; has: string[]; not?: string[] }>>> = {
  'video-small': [{ role: 'model', field: 'unet_name', has: ['ti2v', '5b'] }, { role: 'clip', field: 'clip_name', has: ['umt5'] }, { role: 'vae', field: 'vae_name', has: ['wan2.2_vae'] }],
  'video-flf': [
    { role: 'high', field: 'unet_name', has: ['i2v', 'high'] }, { role: 'low', field: 'unet_name', has: ['i2v', 'low'] },
    { role: 'clip', field: 'clip_name', has: ['umt5'] }, { role: 'vae', field: 'vae_name', has: ['wan_2.1_vae'] },
  ],
  'video-control': [{ role: 'model', field: 'unet_name', has: ['fun', 'control', '5b'] }, { role: 'clip', field: 'clip_name', has: ['umt5'] }, { role: 'vae', field: 'vae_name', has: ['wan2.2_vae'] }],
  'video-speech': [
    { role: 'model', field: 'unet_name', has: ['humo'] }, { role: 'lora', field: 'lora_name', has: ['lightx2v'] }, { role: 'listener', field: 'audio_encoder_name', has: ['whisper'] },
    { role: 'clip', field: 'clip_name', has: ['umt5'] }, { role: 'vae', field: 'vae_name', has: ['wan_2.1_vae'] },
  ],
  'video-ltx': [
    { role: 'model', field: 'unet_name', has: ['ltx-2'] }, { role: 'clip', field: 'clip_name', has: ['gemma'] }, { role: 'vae', field: 'vae_name', has: ['ltx', 'video'] },
    { role: 'soundVae', field: 'vae_name', has: ['ltx', 'audio'] }, { role: 'upscaler', field: 'model_name', has: ['ltx', 'upscaler'] },
  ],
  'video-hunyuan': [
    { role: 'model', field: 'unet_name', has: ['hunyuanvideo1.5', 't2v'] }, { role: 'clip', field: 'clip_name1', has: ['qwen_2.5_vl'] }, { role: 'clip', field: 'clip_name2', has: ['byt5'] },
    { role: 'vae', field: 'vae_name', has: ['hunyuanvideo15_vae'] },
  ],
  'video-kandinsky': [
    { role: 'model', field: 'unet_name', has: ['kandinsky5', 't2v'] }, { role: 'clip', field: 'clip_name1', has: ['qwen_2.5_vl'] }, { role: 'clip', field: 'clip_name2', has: ['clip_l'] },
    { role: 'vae', field: 'vae_name', has: ['hunyuan_video_vae'] },
  ],
  'video-interpolate': [{ role: 'interp', field: 'model_name', has: ['film'] }],
  'video-upscale': [{ role: 'dit', field: 'model', has: ['seedvr2'] }, { role: 'vae', field: 'model', has: ['vae'] }],
  'video-memory': [],
  'anchor-start': [{ role: 'model', field: 'unet_name', has: ['ti2v', '5b'] }],
  'anchor-reference': [
    { role: 'model', field: 'unet_name', has: ['vace'] }, { role: 'lora', field: 'lora_name', has: ['causvid'] },
    { role: 'clip', field: 'clip_name', has: ['umt5'] }, { role: 'vae', field: 'vae_name', has: ['wan_2.1_vae'] },
  ],
  'anchor-parts': [],
  'video-vhs': [],
  'video-remove': [],
};
