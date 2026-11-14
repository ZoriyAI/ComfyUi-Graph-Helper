import type { KnowledgeSet } from '../knowledgeSets';
import { SOUND_3D_FACES_KNOWLEDGE_EN } from './sound-3d-faces.en';
import { SOUND_3D_FACES_KNOWLEDGE_RU } from './sound-3d-faces.ru';

/**
 * Built-in knowledge of sound and speech, 3D, faces and characters. Facts come from ComfyUI's own source (0.45),
 * docs.comfy.org, the official workflow templates and the packs' own code and README; the provenance rule of
 * coreKnowledge.ts holds: `what` and `connect` are facts, `why` and `risk` advice. Nodes the picture-model set
 * describes (ModelSamplingAuraFlow, ConditioningZeroOut) are not repeated here.
 */

const DOCS = 'https://docs.comfy.org';
const node = (classType: string) => `${DOCS}/built-in-nodes/${classType}`;
/** A pack's node, or a core node without a docs page, cites the repository it comes from. */
const repo = (path: string) => `https://github.com/${path}`;

export const SOUND_3D_FACES_KNOWLEDGE: KnowledgeSet = {
  id: 'sound-3d-faces',
  docs: {
    nodes: {
      'TextEncodeAceStepAudio1.5': node('TextEncodeAceStepAudio1.5'),
      'EmptyAceStep1.5LatentAudio': node('EmptyAceStep1.5LatentAudio'),
      VAEDecodeAudio: node('VAEDecodeAudio'),
      EmptyLatentAudio: node('EmptyLatentAudio'),
      SaveAudioAdvanced: node('SaveAudioAdvanced'),
      PreviewAudio: node('PreviewAudio'),
      LoadAudio: node('LoadAudio'),
      TrimAudioDuration: node('TrimAudioDuration'),
      AudioConcat: node('AudioConcat'),
      AudioMerge: node('AudioMerge'),
      AudioAdjustVolume: node('AudioAdjustVolume'),
      PreviewAny: repo('comfyanonymous/ComfyUI'),
      ImageOnlyCheckpointLoader: node('ImageOnlyCheckpointLoader'),
      Hunyuan3Dv2Conditioning: node('Hunyuan3Dv2Conditioning'),
      EmptyLatentHunyuan3Dv2: node('EmptyLatentHunyuan3Dv2'),
      VAEDecodeHunyuan3D: node('VAEDecodeHunyuan3D'),
      VoxelToMesh: node('VoxelToMesh'),
      SaveGLB: node('SaveGLB'),
      FluxKontextImageScale: node('FluxKontextImageScale'),
      ReferenceLatent: node('ReferenceLatent'),
      PhotoMakerLoader: node('PhotoMakerLoader'),
      PhotoMakerEncode: node('PhotoMakerEncode'),
      MMAudioModelLoader: repo('kijai/ComfyUI-MMAudio'),
      MMAudioFeatureUtilsLoader: repo('kijai/ComfyUI-MMAudio'),
      MMAudioSampler: repo('kijai/ComfyUI-MMAudio'),
      VHS_LoadVideo: repo('Kosinkadink/ComfyUI-VideoHelperSuite'),
      VHS_VideoCombine: repo('Kosinkadink/ComfyUI-VideoHelperSuite'),
      FL_ChatterboxTTS: repo('filliptm/ComfyUI_Fill-ChatterBox'),
      'Apply Whisper': repo('yuvraj108c/ComfyUI-Whisper'),
      'Save SRT': repo('yuvraj108c/ComfyUI-Whisper'),
      ReActorRestoreFace: repo('Gourieff/ComfyUI-ReActor'),
      ReActorFaceSwap: repo('Gourieff/ComfyUI-ReActor'),
      IPAdapterUnifiedLoaderFaceID: repo('cubiq/ComfyUI_IPAdapter_plus'),
      IPAdapterFaceID: repo('cubiq/ComfyUI_IPAdapter_plus'),
      UltralyticsDetectorProvider: repo('ltdrdata/ComfyUI-Impact-Subpack'),
      SAMLoader: repo('ltdrdata/ComfyUI-Impact-Pack'),
      FaceDetailer: repo('ltdrdata/ComfyUI-Impact-Pack'),
    },
    families: {
      'ace-step': `${DOCS}/tutorials/audio/ace-step/ace-step-v1-5`,
      'stable-audio': `${DOCS}/tutorials/audio/stable-audio/stable-audio-1`,
      mmaudio: null,
      'hunyuan-foley': null,
      chatterbox: null,
      'qwen-tts': null,
      whisper: null,
      hunyuan3d: `${DOCS}/tutorials/3d/hunyuan3D-2`,
      trellis2: `${DOCS}/tutorials/3d/trellis2`,
      'flux-kontext': `${DOCS}/tutorials/flux/flux-1-kontext-dev`,
      'face-restore': null,
      photomaker: null,
      infiniteyou: null,
      'ipadapter-faceid': null,
      instantid: null,
      pulid: null,
    },
  },
  en: SOUND_3D_FACES_KNOWLEDGE_EN,
  ru: SOUND_3D_FACES_KNOWLEDGE_RU,
};
