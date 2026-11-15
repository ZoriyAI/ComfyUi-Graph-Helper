import type { FieldSpec, FieldTest, Lesson, LinkSpec, RoleSpec } from '../engine';

/**
 * Lessons of the domain "sound, speech, 3D, faces and characters". Each graph is the one an official ComfyUI
 * template or the pack's own example builds (the template or file is named above each lesson), cut down to the
 * nodes a person needs to understand it: the notes, the previews and the shared seed of a template are left out.
 *
 * Sound and speech: ACE-Step 1.5 music, Stable Audio Open sound, Chatterbox speech, MMAudio sound for a silent
 * video, Whisper speech to text. 3D: Hunyuan3D 2 picture to model. Faces and characters: the same invented
 * character with FLUX.1 Kontext and in a series, the same face from one photo with IP-Adapter FaceID, a face put
 * onto a picture with ReActor, a face restored with ReActor (a small face redrawn with FaceDetailer is the
 * picture-techniques lesson 'detailer'). Every lesson
 * that gives, keeps or changes a face says the consent rule first.
 */

const node = (role: string, ...classes: string[]): RoleSpec => ({ role, classes });
const link = (from: string, output: string, to: string, input: string, via?: string[]): LinkSpec => (via ? { from, output, to, input, via } : { from, output, to, input });
const field = (role: string, name: string, test: FieldTest): FieldSpec => ({ role, field: name, test });
const chosen: FieldTest = { kind: 'chosen' };
const equals = (value: string | number | boolean): FieldTest => ({ kind: 'equals', value });
const between = (min: number, max: number, prefer: number): FieldTest => ({ kind: 'between', min, max, prefer });

/** The savers of a sound: the template's own, the older ones it replaced, and a preview that keeps nothing. */
const AUDIO_OUT = ['SaveAudioAdvanced', 'SaveAudio', 'SaveAudioMP3', 'PreviewAudio'];

/**
 * Music from text with ACE-Step 1.5: template "ACE-Step 1.5 Music Generation AIO" (audio_ace_step_1_5_checkpoint).
 * One file in checkpoints; the noise shift of AuraFlow at 3; a text node that holds the style and the lyrics; an
 * empty sound of the song's length; the sampler at 8 steps and cfg 1; the negative is the description zeroed out.
 */
const music: Lesson = {
  id: 'audio-music',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    {
      id: 'shift',
      roles: [node('shift', 'ModelSamplingAuraFlow')],
      links: [link('checkpoint', 'MODEL', 'shift', 'model')],
      fields: [field('shift', 'shift', between(2, 4, 3))],
    },
    {
      id: 'style',
      roles: [node('text', 'TextEncodeAceStepAudio1.5')],
      links: [link('checkpoint', 'CLIP', 'text', 'clip')],
      fields: [field('text', 'tags', { kind: 'text', minChars: 10 })],
    },
    { id: 'lyrics', read: true },
    { id: 'tempo', fields: [field('text', 'bpm', between(60, 200, 120))] },
    {
      id: 'length',
      roles: [node('latent', 'EmptyAceStep1.5LatentAudio')],
      fields: [field('latent', 'seconds', between(10, 240, 120)), field('text', 'duration', { kind: 'same', role: 'latent', field: 'seconds' })],
    },
    { id: 'negative', roles: [node('empty', 'ConditioningZeroOut')], links: [link('text', 'CONDITIONING', 'empty', 'conditioning')] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model'),
        link('text', 'CONDITIONING', 'sampler', 'positive'),
        link('empty', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'steps', equals(8)), field('sampler', 'cfg', equals(1))],
    },
    { id: 'decode', roles: [node('decode', 'VAEDecodeAudio')], links: [link('sampler', 'LATENT', 'decode', 'samples'), link('checkpoint', 'VAE', 'decode', 'vae')] },
    { id: 'save', roles: [node('save', ...AUDIO_OUT)], links: [link('decode', 'AUDIO', 'save', 'audio')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A sound from text with Stable Audio Open 1.0: template "Stable Audio 1.0: Text to Audio"
 * (audio_stable_audio_example). The checkpoint draws; a separate T5 file of the type stable_audio reads the text.
 */
const sound: Lesson = {
  id: 'audio-sound',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    { id: 'reader', roles: [node('clip', 'CLIPLoader')], fields: [field('clip', 'clip_name', chosen), field('clip', 'type', equals('stable_audio'))] },
    {
      id: 'prompts',
      roles: [node('positive', 'CLIPTextEncode'), node('negative', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'positive', 'clip'), link('clip', 'CLIP', 'negative', 'clip')],
      fields: [field('positive', 'text', { kind: 'text', minChars: 10 })],
    },
    { id: 'length', roles: [node('latent', 'EmptyLatentAudio')], fields: [field('latent', 'seconds', between(1, 47, 10))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('checkpoint', 'MODEL', 'sampler', 'model'),
        link('positive', 'CONDITIONING', 'sampler', 'positive'),
        link('negative', 'CONDITIONING', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'steps', between(25, 100, 50)), field('sampler', 'cfg', between(3, 7, 5))],
    },
    { id: 'decode', roles: [node('decode', 'VAEDecodeAudio')], links: [link('sampler', 'LATENT', 'decode', 'samples'), link('checkpoint', 'VAE', 'decode', 'vae')] },
    { id: 'save', roles: [node('save', ...AUDIO_OUT)], links: [link('decode', 'AUDIO', 'save', 'audio')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Speech from text in a voice taken from a short recording: template "Chatter Box: Voice Cloning with TTS"
 * (audio-chatterbox_tts), on ComfyUI_Fill-ChatterBox. The rule about voices comes first.
 */
const speech: Lesson = {
  id: 'audio-speech',
  steps: [
    { id: 'intro', read: true },
    { id: 'voice', roles: [node('voice', 'LoadAudio')], fields: [field('voice', 'audio', chosen)] },
    {
      id: 'speech',
      roles: [node('tts', 'FL_ChatterboxTTS')],
      links: [link('voice', 'AUDIO', 'tts', 'audio_prompt')],
      fields: [field('tts', 'text', { kind: 'text', minChars: 10 })],
    },
    {
      id: 'manner',
      fields: [field('tts', 'exaggeration', between(0.25, 1, 0.5)), field('tts', 'cfg_weight', between(0.2, 1, 0.5)), field('tts', 'temperature', between(0.5, 1.2, 0.8))],
    },
    { id: 'save', roles: [node('save', ...AUDIO_OUT)], links: [link('tts', 'audio', 'save', 'audio')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Sound for a silent video with MMAudio: the pack's own example (ComfyUI-MMAudio, example_workflows/
 * mmaudio_test.json). The frames come from Video Helper Suite's loader, the sampler hears them, and the same
 * loader's frames go with the new sound into Video Combine.
 */
const foley: Lesson = {
  id: 'audio-foley',
  steps: [
    { id: 'intro', read: true },
    { id: 'video', roles: [node('video', 'VHS_LoadVideo')], fields: [field('video', 'video', chosen)] },
    { id: 'model', roles: [node('model', 'MMAudioModelLoader')], fields: [field('model', 'mmaudio_model', chosen)] },
    {
      id: 'helpers',
      roles: [node('features', 'MMAudioFeatureUtilsLoader')],
      fields: [
        field('features', 'vae_model', chosen),
        field('features', 'synchformer_model', { kind: 'differs', role: 'features', field: 'vae_model' }),
        field('features', 'clip_model', { kind: 'differs', role: 'features', field: 'synchformer_model' }),
        field('features', 'mode', equals('44k')),
      ],
    },
    {
      id: 'sampler',
      roles: [node('sampler', 'MMAudioSampler')],
      links: [
        link('model', 'mmaudio_model', 'sampler', 'mmaudio_model'),
        link('features', 'mmaudio_featureutils', 'sampler', 'feature_utils'),
        link('video', 'IMAGE', 'sampler', 'images'),
      ],
    },
    { id: 'settings', fields: [field('sampler', 'duration', between(1, 10, 8)), field('sampler', 'steps', between(20, 30, 25)), field('sampler', 'cfg', between(3, 6, 4.5))] },
    { id: 'prompt', read: true },
    {
      id: 'combine',
      roles: [node('combine', 'VHS_VideoCombine')],
      links: [link('video', 'IMAGE', 'combine', 'images'), link('sampler', 'audio', 'combine', 'audio')],
    },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * Speech to text with Whisper: the pack's own example (ComfyUI-Whisper, example_workflows/
 * whisper_video_subtitles_workflow.json), its first half: the sound, Apply Whisper, the text shown, the subtitles
 * saved. The example takes the sound out of a video; here it is a sound file, and the tips say how a video goes in.
 */
const transcribe: Lesson = {
  id: 'audio-transcribe',
  steps: [
    { id: 'intro', read: true },
    { id: 'source', roles: [node('source', 'LoadAudio')], fields: [field('source', 'audio', chosen)] },
    { id: 'whisper', roles: [node('whisper', 'Apply Whisper')], links: [link('source', 'AUDIO', 'whisper', 'audio')], fields: [field('whisper', 'model', chosen)] },
    { id: 'show', roles: [node('show', 'PreviewAny')], links: [link('whisper', 'text', 'show', 'source')] },
    { id: 'subtitles', roles: [node('srt', 'Save SRT')], links: [link('whisper', 'segments_alignment', 'srt', 'alignment')], fields: [field('srt', 'name', chosen)] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A picture into a 3D model with Hunyuan3D 2: templates "HY 3D 2.0" (3d_hunyuan3d_image_to_model) and "HY 3D 2.1:
 * Single View to Model" (3d_hunyuan3d-v2.1), whose subgraph is the same graph with other numbers. The lesson
 * builds the subgraph's nodes on the canvas itself.
 */
const model3d: Lesson = {
  id: '3d-image',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('checkpoint', 'ImageOnlyCheckpointLoader')], fields: [field('checkpoint', 'ckpt_name', chosen)] },
    {
      id: 'shift',
      roles: [node('shift', 'ModelSamplingAuraFlow')],
      links: [link('checkpoint', 'MODEL', 'shift', 'model')],
      fields: [field('shift', 'shift', equals(1))],
    },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'vision',
      roles: [node('vision', 'CLIPVisionEncode')],
      links: [link('checkpoint', 'CLIP_VISION', 'vision', 'clip_vision'), link('picture', 'IMAGE', 'vision', 'image')],
      fields: [field('vision', 'crop', equals('center'))],
    },
    { id: 'condition', roles: [node('condition', 'Hunyuan3Dv2Conditioning')], links: [link('vision', 'CLIP_VISION_OUTPUT', 'condition', 'clip_vision_output')] },
    { id: 'latent', roles: [node('latent', 'EmptyLatentHunyuan3Dv2')], fields: [field('latent', 'resolution', between(3072, 4096, 3072))] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('shift', 'MODEL', 'sampler', 'model'),
        link('condition', 'positive', 'sampler', 'positive'),
        link('condition', 'negative', 'sampler', 'negative'),
        link('latent', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'steps', between(20, 30, 20)), field('sampler', 'cfg', between(5, 8, 8))],
    },
    { id: 'decode', roles: [node('decode', 'VAEDecodeHunyuan3D')], links: [link('sampler', 'LATENT', 'decode', 'samples'), link('checkpoint', 'VAE', 'decode', 'vae')] },
    {
      id: 'mesh',
      roles: [node('mesh', 'VoxelToMesh')],
      links: [link('decode', 'VOXEL', 'mesh', 'voxel')],
      fields: [field('mesh', 'algorithm', equals('surface net')), field('mesh', 'threshold', between(0.5, 0.7, 0.6))],
    },
    { id: 'save', roles: [node('save', 'SaveGLB')], links: [link('mesh', 'MESH', 'save', 'mesh')] },
    { id: 'files', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * The same invented character in a new picture with FLUX.1 Kontext dev: template "Flux Kontext Dev Image Edit"
 * (flux_kontext_dev_basic), whose subgraph the lesson builds on the canvas. The picture of the character is
 * scaled to a size Kontext knows, encoded and given to the description as a reference; the sampler starts from it.
 */
const character: Lesson = {
  id: 'character-kontext',
  steps: [
    { id: 'intro', read: true },
    { id: 'model', roles: [node('model', 'UNETLoader')], fields: [field('model', 'unet_name', chosen)] },
    {
      id: 'readers',
      roles: [node('clip', 'DualCLIPLoader'), node('vae', 'VAELoader')],
      fields: [
        field('clip', 'clip_name1', chosen),
        field('clip', 'clip_name2', { kind: 'differs', role: 'clip', field: 'clip_name1' }),
        field('clip', 'type', equals('flux')),
        field('vae', 'vae_name', chosen),
      ],
    },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    {
      id: 'encode',
      roles: [node('scale', 'FluxKontextImageScale'), node('encode', 'VAEEncode')],
      links: [link('picture', 'IMAGE', 'scale', 'image', ['ImageStitch']), link('scale', 'IMAGE', 'encode', 'pixels'), link('vae', 'VAE', 'encode', 'vae')],
    },
    {
      id: 'prompt',
      roles: [node('prompt', 'CLIPTextEncode')],
      links: [link('clip', 'CLIP', 'prompt', 'clip')],
      fields: [field('prompt', 'text', { kind: 'text', minChars: 20 })],
    },
    {
      id: 'reference',
      roles: [node('reference', 'ReferenceLatent'), node('guidance', 'FluxGuidance')],
      links: [link('prompt', 'CONDITIONING', 'reference', 'conditioning'), link('encode', 'LATENT', 'reference', 'latent'), link('reference', 'CONDITIONING', 'guidance', 'conditioning')],
      fields: [field('guidance', 'guidance', between(2, 3.5, 2.5))],
    },
    { id: 'negative', roles: [node('empty', 'ConditioningZeroOut')], links: [link('prompt', 'CONDITIONING', 'empty', 'conditioning')] },
    {
      id: 'sampler',
      roles: [node('sampler', 'KSampler')],
      links: [
        link('model', 'MODEL', 'sampler', 'model'),
        link('guidance', 'CONDITIONING', 'sampler', 'positive'),
        link('empty', 'CONDITIONING', 'sampler', 'negative'),
        link('encode', 'LATENT', 'sampler', 'latent_image'),
      ],
      fields: [field('sampler', 'steps', between(20, 30, 20)), field('sampler', 'cfg', equals(1))],
    },
    {
      id: 'out',
      roles: [node('decode', 'VAEDecode'), node('save', 'SaveImage', 'PreviewImage')],
      links: [link('sampler', 'LATENT', 'decode', 'samples'), link('vae', 'VAE', 'decode', 'vae'), link('decode', 'IMAGE', 'save', 'images')],
    },
    { id: 'series', read: true },
    { id: 'other-ways', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A face restored in an old or small picture with ReActor's Restore Face node, the separate post-processing node
 * the pack's README describes (ComfyUI-ReActor, nodes.py RestoreFace): a picture in, the same picture with the
 * faces redrawn by a restoration model out.
 */
const restore: Lesson = {
  id: 'face-restore',
  steps: [
    { id: 'intro', read: true },
    { id: 'picture', roles: [node('picture', 'LoadImage')], fields: [field('picture', 'image', chosen)] },
    { id: 'restore', roles: [node('restore', 'ReActorRestoreFace')], links: [link('picture', 'IMAGE', 'restore', 'image')], fields: [field('restore', 'model', chosen)] },
    {
      id: 'settings',
      fields: [
        field('restore', 'facedetection', equals('retinaface_resnet50')),
        field('restore', 'visibility', between(0.5, 1, 1)),
        field('restore', 'codeformer_weight', between(0.3, 0.8, 0.5)),
      ],
    },
    { id: 'save', roles: [node('save', 'SaveImage', 'PreviewImage')], links: [link('restore', 'IMAGE', 'save', 'images')] },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/** What may stand between a checkpoint's model and the sampler in the lessons that go on from the first picture. */
const MODEL_VIA = ['LoraLoader', 'LoraLoaderModelOnly', 'IPAdapterUnifiedLoaderFaceID', 'IPAdapterFaceID'];

/**
 * The same face from one photo with IP-Adapter FaceID: the pack's own example (ComfyUI_IPAdapter_plus,
 * examples/ipadapter_faceid.json). It goes on from the first picture lesson: the unified FaceID loader and the
 * FaceID node stand between the checkpoint and the sampler, and a photo of the face goes into the FaceID node.
 */
const faceSame: Lesson = {
  id: 'face-same-photo',
  steps: [
    { id: 'intro', read: true },
    { id: 'graph', roles: [node('checkpoint', 'CheckpointLoaderSimple'), node('sampler', 'KSampler')], links: [link('checkpoint', 'MODEL', 'sampler', 'model', MODEL_VIA)] },
    { id: 'files', read: true },
    {
      id: 'loader',
      roles: [node('loader', 'IPAdapterUnifiedLoaderFaceID')],
      links: [link('checkpoint', 'MODEL', 'loader', 'model', ['LoraLoader', 'LoraLoaderModelOnly'])],
      fields: [field('loader', 'preset', equals('FACEID PLUS V2')), field('loader', 'lora_strength', between(0.5, 0.7, 0.6))],
    },
    { id: 'face', roles: [node('face', 'LoadImage')], fields: [field('face', 'image', chosen)] },
    {
      id: 'adapter',
      roles: [node('adapter', 'IPAdapterFaceID')],
      links: [
        link('loader', 'MODEL', 'adapter', 'model'),
        link('loader', 'ipadapter', 'adapter', 'ipadapter'),
        link('face', 'IMAGE', 'adapter', 'image'),
        link('adapter', 'MODEL', 'sampler', 'model', ['LoraLoader', 'LoraLoaderModelOnly']),
      ],
    },
    { id: 'strength', fields: [field('adapter', 'weight', between(0.5, 1, 1)), field('adapter', 'weight_faceidv2', between(1, 2, 2))] },
    { id: 'sampler-settings', fields: [field('sampler', 'steps', between(20, 40, 30)), field('sampler', 'cfg', between(4, 7, 6.5))] },
    { id: 'kept', read: true },
    { id: 'other-methods', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * A face put onto a picture you already have with ReActor's Fast Face Swap, the graph the pack's README describes
 * for its main node: the picture to change into input_image, the face into source_image, the result out.
 */
const faceSwap: Lesson = {
  id: 'face-swap',
  steps: [
    { id: 'intro', read: true },
    { id: 'target', roles: [node('target', 'LoadImage')], fields: [field('target', 'image', chosen)] },
    { id: 'source', roles: [node('source', 'LoadImage')], fields: [field('source', 'image', { kind: 'differs', role: 'target', field: 'image' })] },
    {
      id: 'swap',
      roles: [node('swap', 'ReActorFaceSwap')],
      links: [link('target', 'IMAGE', 'swap', 'input_image'), link('source', 'IMAGE', 'swap', 'source_image')],
      fields: [field('swap', 'swap_model', chosen), field('swap', 'facedetection', equals('retinaface_resnet50'))],
    },
    {
      id: 'restore',
      fields: [field('swap', 'face_restore_model', chosen), field('swap', 'face_restore_visibility', between(0.5, 1, 1)), field('swap', 'codeformer_weight', between(0.3, 0.8, 0.5))],
    },
    { id: 'save', roles: [node('save', 'SaveImage', 'PreviewImage')], links: [link('swap', 'SWAPPED_IMAGE', 'save', 'images')] },
    { id: 'which', read: true },
    { id: 'tips', read: true },
    { id: 'run', read: true },
  ],
};

/**
 * One character in many pictures: what holds identity and in which order to reach for it, practised on the graph of
 * the FLUX.1 Kontext lesson (template flux_kontext_dev_basic): a new pose and new clothes in the description while
 * the reference keeps the face.
 */
const characterSeries: Lesson = {
  id: 'character-series',
  steps: [
    { id: 'intro', read: true },
    {
      id: 'graph',
      roles: [node('picture', 'LoadImage'), node('prompt', 'CLIPTextEncode'), node('reference', 'ReferenceLatent'), node('sampler', 'KSampler')],
      links: [link('prompt', 'CONDITIONING', 'reference', 'conditioning')],
    },
    { id: 'order', read: true },
    { id: 'words', read: true },
    { id: 'practice', fields: [field('prompt', 'text', { kind: 'text', minChars: 80 })] },
    { id: 'seed', read: true },
    { id: 'beyond', read: true },
    { id: 'next', read: true },
  ],
};

/** In the order a person meets them. */
export const SOUND_3D_FACES_LESSONS: readonly Lesson[] = [music, sound, speech, foley, transcribe, model3d, character, characterSeries, faceSame, faceSwap, restore];

/** Lessons that stand on the graph of another: said in the list, not enforced. */
export const SOUND_3D_FACES_AFTER: Readonly<Record<string, string[]>> = {
  'face-same-photo': ['image'],
  'character-series': ['character-kontext'],
};

/** The groups of the lesson list these lessons belong to (the list may show them as a learning path). */
export const SOUND_3D_FACES_GROUPS: Readonly<Record<string, { ru: string; en: string }>> = {
  'sound-speech': { ru: 'Звук и речь', en: 'Sound and speech' },
  '3d': { ru: '3D', en: '3D' },
  'faces-characters': { ru: 'Лица и персонажи', en: 'Faces and characters' },
};

/** Lesson id → group id. */
export const SOUND_3D_FACES_LESSON_GROUP: Readonly<Record<string, string>> = {
  'audio-music': 'sound-speech',
  'audio-sound': 'sound-speech',
  'audio-speech': 'sound-speech',
  'audio-foley': 'sound-speech',
  'audio-transcribe': 'sound-speech',
  '3d-image': '3d',
  'character-kontext': 'faces-characters',
  'character-series': 'faces-characters',
  'face-same-photo': 'faces-characters',
  'face-swap': 'faces-characters',
  'face-restore': 'faces-characters',
};

/**
 * Where each lesson stands on the learning path, in the shape of LESSON_PATH (lessons.ts): its group and the lessons
 * it goes on from as knowledge. The face lessons follow the ones that teach the graph or the idea they build on.
 */
const FOLLOWS: Readonly<Record<string, string[]>> = {
  'audio-music': ['image'],
  'audio-sound': ['image'],
  'audio-speech': [],
  'audio-foley': [],
  'audio-transcribe': [],
  '3d-image': ['image'],
  'character-kontext': ['image'],
  'character-series': ['character-kontext'],
  'face-same-photo': ['image'],
  'face-swap': ['face-restore'],
  'face-restore': [],
};

export const SOUND_3D_FACES_PATH: Readonly<Record<string, { group: { id: string; title: { ru: string; en: string } }; follows: string[] }>> = Object.fromEntries(
  Object.entries(SOUND_3D_FACES_LESSON_GROUP).map(([lesson, group]) => [lesson, { group: { id: group, title: SOUND_3D_FACES_GROUPS[group] }, follows: FOLLOWS[lesson] ?? [] }]),
);

/** The packs the nodes of these lessons come from, for "this lesson does not fit" (fit.ts packOf). */
export const SOUND_3D_FACES_PACKS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^MMAudio/, 'ComfyUI-MMAudio'],
  [/^VHS_/, 'ComfyUI-VideoHelperSuite'],
  [/^FL_Chatterbox/, 'ComfyUI_Fill-ChatterBox'],
  [/^(?:Apply Whisper|Save SRT|Add Subtitles To )/, 'ComfyUI-Whisper'],
  [/^ReActor/, 'ComfyUI-ReActor'],
  [/^IPAdapter/, 'ComfyUI_IPAdapter_plus'],
];
