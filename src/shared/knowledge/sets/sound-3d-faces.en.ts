/**
 * Built-in knowledge of sound and speech, 3D, faces and characters, English; coreKnowledge.ts reads it for the
 * English interface. The Russian file says the same.
 * Everything about putting a face or a voice onto someone starts with the rule: a real person only with their
 * consent; never in explicit content; never anyone who looks like a minor.
 */
import type { KnowledgeSet } from '../coreKnowledge';

const RULE = 'A real person\'s face or voice only with their consent; never in explicit content; never anyone who looks like a minor.';
const PACK_CODE = 'A pack runs other people\'s code: install it yourself through ComfyUI\'s manager, and only one you trust.';
const OLD_FORMAT = 'Files in the old formats (.ckpt, .pt, .pth, .bin) can run code when they are loaded: take them only from the model\'s official page.';

export const SOUND_3D_FACES_KNOWLEDGE_EN: KnowledgeSet = {
  nodes: {
    // ComfyUI itself: sound.
    'TextEncodeAceStepAudio1.5': {
      what: 'Encodes the description of a song for ACE-Step 1.5: the style in `tags`, the sung words in `lyrics`, and the tempo, length, metre, key and language of the song.',
      why: 'The only text node an ACE-Step 1.5 graph needs: everything the song should be is said here.',
      connect: 'Input: CLIP from the ACE-Step checkpoint or from a DualCLIPLoader of the type ace. Output: CONDITIONING for the positive input of the sampler and for Conditioning Zero Out, which makes the negative.',
      risk: 'Its duration must equal the seconds of the empty latent, or the song ends early or breaks off.',
    },
    'EmptyAceStep1.5LatentAudio': {
      what: 'Creates an empty sound latent, the compressed blank ACE-Step 1.5 writes on, of the given length in seconds.',
      why: 'The starting point of a song: its seconds set how long the song is.',
      connect: 'Inputs: seconds and batch_size. Output: LATENT for the latent_image input of the sampler.',
      risk: 'ACE-Step 1.0 has its own empty latent (EmptyAceStepLatentAudio); the two are not interchangeable.',
    },
    VAEDecodeAudio: {
      what: 'VAE Decode Audio: turns a sound latent from the sampler into a sound wave (AUDIO).',
      why: 'The last model step of every sound graph built on the sampler: ACE-Step, Stable Audio.',
      connect: 'Inputs: samples from the sampler and the VAE of the same model. Output: AUDIO for a saver, a preview or Create Video.',
      risk: 'The VAE must come from the same model family; a picture VAE does not decode sound.',
    },
    EmptyLatentAudio: {
      what: 'Creates an empty sound latent for Stable Audio of the given length in seconds.',
      why: 'The starting blank of a Stable Audio graph.',
      connect: 'Inputs: seconds and batch_size. Output: LATENT for the sampler.',
      risk: 'Stable Audio Open 1.0 was trained on pieces of up to about 47 seconds; a longer blank fills with silence or noise.',
    },
    SaveAudioAdvanced: {
      what: 'Save Audio (Advanced): saves a sound into the output folder (output/audio by default) as FLAC, MP3 or Opus.',
      why: 'The saver the current official sound templates use; it replaced the separate FLAC, MP3 and Opus savers.',
      connect: 'Inputs: audio, filename_prefix and format (with a quality for MP3 and Opus). Output: the same AUDIO, for a node that goes on with it.',
    },
    PreviewAudio: {
      what: 'Plays a sound on the node in ComfyUI without keeping it.',
      why: 'For trying settings before saving anything.',
      connect: 'Input: AUDIO. Nothing is written to the output folder.',
    },
    TrimAudioDuration: {
      what: 'Cuts a piece out of a sound: from start_index (seconds; negative counts from the end) for duration seconds.',
      why: 'To take the part of a recording you need, for example a clean voice sample.',
      connect: 'Inputs: audio, start_index, duration. Output: AUDIO.',
    },
    AudioConcat: {
      what: 'Concatenate Audio: puts one sound after (or before) another.',
      why: 'To join pieces of speech or music made in several runs.',
      connect: 'Inputs: audio1, audio2 and direction (after or before). Output: AUDIO. A mono sound is made stereo, and sample rates are matched.',
    },
    AudioMerge: {
      what: 'Merge Audio: lays two sounds over each other (add, mean, subtract or multiply).',
      why: 'To mix a voice with music or effects.',
      connect: 'Inputs: audio1, audio2 and merge_method. Output: AUDIO.',
      risk: 'Adding two loud sounds can clip; lower one with Adjust Audio Volume first.',
    },
    AudioAdjustVolume: {
      what: 'Adjust Audio Volume: makes a sound louder or quieter by a number of decibels (0 is no change, +6 about twice as loud, -6 half).',
      why: 'To balance a voice against music before they are mixed.',
      connect: 'Inputs: audio and volume. Output: AUDIO.',
    },
    PreviewAny: {
      what: 'Preview as Text: shows any value as text on the node, for example the text Whisper wrote down.',
      why: 'To see a result that is not a picture or a sound.',
      connect: 'Input: source, of any type. Output: the same as STRING.',
    },
    // ComfyUI itself: 3D.
    ImageOnlyCheckpointLoader: {
      what: 'Loads a checkpoint of a model that reads pictures instead of text, from models/checkpoints: the model, its picture reader (CLIP_VISION) and its VAE.',
      why: 'Hunyuan3D 2 and picture-to-video models of the SVD kind come as such files.',
      connect: 'Input: ckpt_name. Outputs: MODEL for the sampler (through the noise shift), CLIP_VISION for CLIP Vision Encode, VAE for the decoder.',
    },
    Hunyuan3Dv2Conditioning: {
      what: 'Turns the encoded picture into the positive and negative conditioning Hunyuan3D 2 needs.',
      why: 'In a Hunyuan3D graph the picture is the whole description: nothing is written by hand.',
      connect: 'Input: clip_vision_output from CLIP Vision Encode. Outputs: positive and negative for the sampler.',
    },
    EmptyLatentHunyuan3Dv2: {
      what: 'Creates the empty latent of a Hunyuan3D 2 shape; resolution sets how finely the shape is worked out.',
      why: 'The starting blank of a Hunyuan3D graph: the template of 2.0 uses 3072, that of 2.1 uses 4096.',
      connect: 'Inputs: resolution and batch_size. Output: LATENT for the sampler.',
    },
    VAEDecodeHunyuan3D: {
      what: 'Hunyuan 3D VAE Decode: turns the shape latent into a voxel grid, space cut into small cubes that are inside or outside the object.',
      why: 'The step between the sampler and the mesh.',
      connect: 'Inputs: samples and the VAE of the Hunyuan3D checkpoint; num_chunks and octree_resolution trade memory for detail. Output: VOXEL.',
      risk: 'A larger octree_resolution needs much more memory.',
    },
    VoxelToMesh: {
      what: 'Voxel to Mesh: turns a voxel grid into a mesh, a surface of triangles.',
      why: 'A mesh is what 3D programs open.',
      connect: 'Inputs: voxel, algorithm (surface net is smoother, basic is blocky) and threshold (where the inside ends). Output: MESH.',
    },
    SaveGLB: {
      what: 'Save 3D Model: saves a mesh or a 3D file into the output folder (3d/ComfyUI by default); a mesh is written as .glb.',
      why: 'The end of a 3D graph; ComfyUI also shows the saved model on the node.',
      connect: 'Inputs: mesh (a MESH or a 3D file) and filename_prefix. A .glb opens in Blender, in game engines and in any glTF viewer.',
    },
    // ComfyUI itself: characters and faces.
    PhotoMakerLoader: {
      what: 'Loads a PhotoMaker file from models/photomaker.',
      why: 'PhotoMaker keeps one face through many SDXL pictures, taken from a few pictures of that face.',
      connect: 'Input: photomaker_model_name. Output: PHOTOMAKER for PhotoMaker Encode.',
      risk: RULE,
    },
    PhotoMakerEncode: {
      what: 'Mixes the face of a picture into a description: the word "photomaker" in the text stands for that face.',
      why: 'The text node of a PhotoMaker graph.',
      connect: 'Inputs: photomaker, image (the face), clip (of an SDXL model) and text. Output: CONDITIONING for the sampler.',
      risk: RULE,
    },
    // ComfyUI-MMAudio.
    MMAudioModelLoader: {
      what: 'Loads an MMAudio model from models/mmaudio.',
      why: 'MMAudio makes the sound of a video in time with its frames.',
      connect: 'Inputs: mmaudio_model and base_precision. Output: mmaudio_model for MMAudio Sampler.',
      risk: 'A 44k model needs the 44k decoder and mode 44k in the feature utils loader.',
    },
    MMAudioFeatureUtilsLoader: {
      what: 'Loads the helper models of MMAudio from models/mmaudio: the sound decoder (vae_model), the model that matches sound to frames (synchformer_model) and the one that sees the frames (clip_model).',
      why: 'The sampler needs all three.',
      connect: 'Inputs: the three files, mode (16k or 44k) and precision; optionally a BigVGAN vocoder. Output: mmaudio_featureutils for the sampler.',
      risk: 'The mode must match the model and the decoder.',
    },
    MMAudioSampler: {
      what: 'Makes the sound: watches the frames (images), reads an optional prompt, and returns AUDIO of the given duration.',
      why: 'The heart of an MMAudio graph.',
      connect: 'Inputs: mmaudio_model, feature_utils, images (optional), duration, steps, cfg, seed, prompt and negative_prompt. Output: audio for a saver or a video combiner.',
      risk: 'The model was trained on clips of about 8 seconds; much longer ones lose quality.',
    },
    // ComfyUI-VideoHelperSuite.
    // ComfyUI_Fill-ChatterBox.
    FL_ChatterboxTTS: {
      what: 'Reads a text aloud with Chatterbox; given a short voice recording, speaks in that voice.',
      why: 'Speech from text on your own computer, with a voice of your choice.',
      connect: 'Inputs: text, exaggeration, cfg_weight, temperature, seed; optionally audio_prompt (the voice), use_cpu and keep_model_loaded. Outputs: audio and a message.',
      risk: `${RULE} This node speaks English; the pack's multilingual node speaks 23 languages.`,
    },
    // ComfyUI-Whisper.
    'Apply Whisper': {
      what: 'Writes down speech with OpenAI Whisper: the text, and the time of every phrase and every word.',
      why: 'Transcripts and subtitles.',
      connect: 'Inputs: audio, model (tiny to large-v3 and turbo), language (or auto) and prompt. Outputs: text, segments_alignment and words_alignment.',
      risk: 'The pack\'s license allows no commercial use.',
    },
    'Save SRT': {
      what: 'Saves the timings of Whisper as an SRT subtitle file into output/srt.',
      why: 'SRT is read by every video player and editor.',
      connect: 'Inputs: alignment (segments or words from Apply Whisper) and name. Output: the path of the file.',
    },
    // ComfyUI-ReActor.
    ReActorRestoreFace: {
      what: 'Restore Face of ReActor: finds the faces in a picture and redraws them sharp with a restoration model (CodeFormer, GFPGAN, GPEN).',
      why: 'For old, small or blurred photos, and after a model drew a face badly.',
      connect: 'Inputs: image, facedetection, model (from models/facerestore_models), visibility and codeformer_weight. Output: IMAGE.',
      risk: 'The model guesses the details: the result is a likeness, not a record. With model set to none nothing happens.',
    },
    ReActorFaceSwap: {
      what: 'Fast Face Swap of ReActor: puts the face from a source picture (or a saved face model) onto the faces of another picture.',
      why: 'To keep one invented character\'s face in pictures drawn separately, or to put your own face into a picture.',
      connect: 'Inputs: input_image (where the face goes), source_image or face_model (whose face), swap_model, facedetection, face_restore_model and the face indexes. Outputs: the swapped picture, the face model and the original.',
      risk: `${RULE} The pack has a detector that refuses explicit pictures. The InsightFace models it uses are for non-commercial research only.`,
    },
    IPAdapterUnifiedLoaderFaceID: {
      what: 'IPAdapter Unified Loader FaceID: loads a FaceID adapter, its LoRA, the picture reader and InsightFace by a preset name, and applies the LoRA to the model.',
      why: 'One node instead of four loaders for the FaceID graph.',
      connect: 'Inputs: model, preset (FACEID, FACEID PLUS V2, FACEID PORTRAIT...), lora_strength and provider. Outputs: MODEL with the LoRA and ipadapter, both for IPAdapter FaceID.',
      risk: `${RULE} It looks for its files by name in models/ipadapter, models/loras, models/clip_vision and models/insightface.`,
    },
    IPAdapterFaceID: {
      what: 'IPAdapter FaceID: makes the model draw the face of a photo; the face is read by InsightFace.',
      why: 'The same face in a new picture without training anything.',
      connect: 'Inputs: model and ipadapter from the FaceID loader, image (the face), weight, weight_faceidv2, start_at and end_at. Output: MODEL for the sampler.',
      risk: `${RULE} A weight too high burns the picture: harsh contrast, broken colours, a stiff face.`,
    },
  },
  linkTypes: {
    MESH: {
      what: 'A 3D surface made of triangles: the points (vertices) and the triangles (faces) between them, sometimes with colours or a texture.',
      why: 'What a picture-to-3D graph produces and what 3D programs open.',
      connect: 'Comes out of Voxel to Mesh and the 3D model nodes; goes into Save 3D Model, which writes a .glb file.',
    },
    VOXEL: {
      what: 'A grid of small cubes in space, each either inside the object or outside: the raw shape a 3D model decodes to.',
      why: 'The step between a 3D model\'s latent and a mesh.',
      connect: 'Comes out of Hunyuan 3D VAE Decode; goes into Voxel to Mesh.',
    },
  },
  families: {
    'ace-step': {
      what: 'ACE-Step: open music models that write whole songs from tags and lyrics. Version 1.5 comes as one checkpoint (ace_step_1.5_turbo_aio) or as separate files: a diffusion model, two Qwen text encoders for DualCLIPLoader of the type ace, and a VAE.',
      risk: 'Version 1.0 and 1.5 have their own text nodes and empty latents; do not mix them in one graph.',
    },
    'stable-audio': {
      what: 'Stable Audio Open 1.0: a model for short sounds and music loops from text. A checkpoint in models/checkpoints and the t5-base text encoder loaded with CLIPLoader of the type stable_audio.',
      risk: 'No speech, no singing, and pieces of up to about 47 seconds.',
    },
    mmaudio: {
      what: 'MMAudio: makes the sound of a video from its frames and an optional text. Files in models/mmaudio: the model (16k or 44k), its VAE, Synchformer and a CLIP model.',
      risk: 'Pick all files of one sample rate (all 44k or all 16k).',
    },
    'hunyuan-foley': {
      what: 'HunyuanVideo-Foley: Tencent\'s model for the sound of a video, larger than MMAudio. The pack ComfyUI-HunyuanVideo-Foley loads it from models/foley, with fp8 files for cards of about 8 GB.',
      risk: 'About 10 to 12 GB of video memory at full precision for a 5-second clip.',
    },
    chatterbox: {
      what: 'Chatterbox by Resemble AI: speech from text with voice cloning from a few seconds of a recording. Standard and Turbo speak English; Multilingual speaks 23 languages.',
      risk: RULE,
    },
    'qwen-tts': {
      what: 'Qwen3-TTS by the Qwen team: speech from text in ten languages, with preset voices, a voice described in words, and voice cloning. The ComfyUI-Qwen-TTS pack reads it from models/qwen-tts.',
      risk: RULE,
    },
    whisper: {
      what: 'Whisper by OpenAI: speech to text in many languages, from tiny to large-v3 and turbo. The ComfyUI-Whisper pack downloads the chosen model to models/stt/whisper.',
      risk: 'Models whose names end in .en know English only.',
    },
    hunyuan3d: {
      what: 'Hunyuan3D 2 by Tencent: a 3D shape from one picture (2.0, 2.1) or from several views (2mv). A checkpoint in models/checkpoints loaded with Image Only Checkpoint Loader; the result is an untextured mesh.',
      risk: 'Each version has its own numbers in the template (resolution, steps, cfg); copy them from the template of your version.',
    },
    trellis2: {
      what: 'TRELLIS.2 by Microsoft: a 3D model with its texture from a picture. ComfyUI has its own nodes for it; the official template is large: shape, refinement and texture in three sampling stages.',
      risk: 'Much more memory and time than Hunyuan3D; start from the official template, not from an empty canvas.',
    },
    'flux-kontext': {
      what: 'FLUX.1 Kontext dev: a FLUX.1 model that changes a picture by a sentence and keeps the rest, the same character included. A diffusion model in models/diffusion_models with the FLUX.1 text encoders and VAE.',
      risk: 'Only the Kontext file reads the reference picture; a plain FLUX.1 dev ignores it. The dev license allows no commercial use of the model itself without a license.',
    },
    'face-restore': {
      what: 'Face restoration models: CodeFormer, GFPGAN, GPEN, RestoreFormer. Files in models/facerestore_models, read by ReActor and facerestore_cf.',
      risk: `${OLD_FORMAT} CodeFormer's license allows no commercial use.`,
    },
    photomaker: {
      what: 'PhotoMaker: keeps one face through SDXL pictures from a few pictures of that face. The file goes into models/photomaker; the nodes are ComfyUI\'s own.',
      risk: RULE,
    },
    infiniteyou: {
      what: 'InfiniteYou by ByteDance: one face kept in FLUX pictures. The ComfyUI_InfiniteYou pack needs its files in models/infinite_you and InsightFace AntelopeV2 in models/insightface.',
      risk: `${RULE} About 24 GB of video memory with FP8; the model is for academic research only.`,
    },
    'ipadapter-faceid': {
      what: 'IP-Adapter FaceID: the face variants of IP-Adapter for SD 1.5 and SDXL in the ComfyUI_IPAdapter_plus pack. They need InsightFace (models/insightface), their own files in models/ipadapter and usually a FaceID LoRA.',
      risk: `${RULE} The InsightFace models are for non-commercial use.`,
    },
    instantid: {
      what: 'InstantID: one face from a photo in SDXL pictures, with the angle of the head. The ComfyUI_InstantID pack needs an InstantID adapter in models/instantid, its ControlNet in models/controlnet and InsightFace AntelopeV2 in models/insightface.',
      risk: `${RULE} SDXL only; the InsightFace models are for non-commercial use.`,
    },
    pulid: {
      what: 'PuLID: one face from a photo, with packs for SDXL and for Flux. A PuLID file in models/pulid, InsightFace AntelopeV2 and an EVA-CLIP model the pack downloads.',
      risk: `${RULE} Each pack serves one family; a PuLID file for Flux does not work with SDXL.`,
    },
  },
  packs: {
    'ComfyUI-MMAudio': {
      what: 'Sound for a video with MMAudio: the model watches the frames and makes the sound in time with them.',
      nodes: 'MMAudio ModelLoader, MMAudio FeatureUtilsLoader, MMAudio VoCoderLoader, MMAudio Sampler.',
      risk: `About 8 seconds per run work best. Files in models/mmaudio. ${PACK_CODE}`,
    },
    'ComfyUI-HunyuanVideo-Foley': {
      what: 'Sound for a video, or sound from text, with Tencent\'s HunyuanVideo-Foley.',
      nodes: 'Hunyuan-Foley Model Loader, Hunyuan-Foley Dependencies Loader, Hunyuan-Foley Sampler; optional Torch Compile and BlockSwap Settings.',
      risk: `About 10 to 12 GB of video memory at fp16, under 8 GB with fp8. Files in models/foley. ${PACK_CODE}`,
    },
    'ComfyUI-Qwen-TTS': {
      what: 'Speech from text with Qwen3-TTS: preset voices, a voice described in words, voice cloning, dialogues of several roles.',
      nodes: 'Qwen3-TTS Custom Voice, Voice Design, Voice Clone, Multi-role Dialogue, Load Speaker, Save Voice.',
      risk: `${RULE} Ten languages. Files in models/qwen-tts. ${PACK_CODE}`,
    },
    'ComfyUI-Whisper': {
      what: 'Speech to text and subtitles with Whisper.',
      nodes: 'Apply Whisper, Save SRT, Add Subtitles To Frames, Add Subtitles To Background.',
      risk: `Models download to models/stt/whisper on first use. The license allows no commercial use. ${PACK_CODE}`,
    },
    'ComfyUI_AudioTools': {
      what: 'Everyday sound tools: loading, volume, joining, removing silence, cleaning a voice, a watermark.',
      nodes: 'Load Audio (MW), Adjust Audio, Audio Concatenate, Remove Silence, ClearVoice, Audio Add Watermark, and more.',
      risk: `ComfyUI itself already trims, joins, mixes and changes the volume of sound; the pack adds the rest. ${PACK_CODE}`,
    },
    'ComfyUI_Fill-ChatterBox': {
      what: 'Speech from text and voice conversion with Chatterbox.',
      nodes: 'FL Chatterbox TTS, Turbo TTS, Multilingual TTS, Dialog TTS, VC (voice conversion).',
      risk: `${RULE} About 40 seconds per run; models download to models/chatterbox on first use. ${PACK_CODE}`,
    },
    'ComfyUI-3D-Pack': {
      what: 'A large set of 3D tools: picture to 3D with many models (Hunyuan3D, TRELLIS, TripoSG, StableFast3D and more), meshes, textures, Gaussian splats.',
      nodes: 'Loaders and samplers per model, mesh and splat savers (.obj, .ply, .glb), orbit renders, texture baking.',
      risk: `Hard to install: prebuilt parts exist only for some versions of Python, CUDA and torch, and some nodes compile at runtime. ${PACK_CODE}`,
    },
    'ComfyUI-Trellis2': {
      what: 'A wrapper of Microsoft TRELLIS.2 with extra mesh tools: texturing, cleaning, remeshing, export.',
      nodes: 'Export Mesh, Voxel to Mesh, Smooth Mesh, Simplify, Weld Vertices, Render MultiView, and others.',
      risk: `ComfyUI now has its own TRELLIS.2 nodes and an official template; the pack is for what those do not do. Needs access to the DINOv3 model. ${PACK_CODE}`,
    },
    'ComfyUI-UniRig': {
      what: 'Automatic rigging: puts a skeleton into a character mesh and binds the skin to it (UniRig, or Make it Animatable for humanoids).',
      nodes: 'Skeleton extraction, skinning, posing and export of the rigged model.',
      risk: `It installs its own environment (Blender included) with an experimental installer. Models in models/unirig. ${PACK_CODE}`,
    },
    'ComfyUI_InfiniteYou': {
      what: 'One face kept through FLUX pictures (ByteDance InfiniteYou).',
      nodes: 'InfuseNet Loader, InfuseNet Apply, ID Embedding Model Loader, Extract ID Embedding, Extract Face Pose Image.',
      risk: `${RULE} About 43 GB of video memory at bf16, about 24 GB with FP8; academic research only. ${PACK_CODE}`,
    },
    'ComfyUI-ReActor': {
      what: 'Face swap and face restoration.',
      nodes: 'Fast Face Swap, Face Swap [Options], Face Booster, Restore Face, Restore Face Advanced, Build / Save / Load Face Model, Masking Helper.',
      risk: `${RULE} The pack refuses explicit pictures with its own detector. The InsightFace and CodeFormer models are for non-commercial use. ${PACK_CODE}`,
    },
    facerestore_cf: {
      what: 'Face restoration with CodeFormer and GFPGAN, the same idea as the face restore option of other programs.',
      nodes: 'A model loader and a restore node with a CodeFormer fidelity setting.',
      risk: `Models in models/facerestore_models; face detection models download to models/facedetection. ${OLD_FORMAT}`,
    },
    'ComfyUI_InstantID': {
      what: 'InstantID for SDXL: a face from one photo kept in new pictures, with the angle of the head.',
      nodes: 'InstantID Model Loader, InstantID Face Analysis, Apply InstantID.',
      risk: `${RULE} SDXL only. Files in models/instantid, models/controlnet and models/insightface. ${PACK_CODE}`,
    },
  },
  fields: {
    'TextEncodeAceStepAudio1.5': {
      tags: 'The style of the song in short words separated by commas: genre, mood, instruments, voice.',
      lyrics: 'The sung words, with the parts of the song in square brackets on their own lines ([Verse 1], [Chorus]).',
      bpm: 'Beats a minute: about 70 for a ballad, 120 to 130 for dance music.',
      duration: 'The length the model plans, in seconds; set it equal to seconds of the empty latent.',
      language: 'The language the lyrics are sung in.',
    },
    'EmptyAceStep1.5LatentAudio': {
      seconds: 'The real length of the song in seconds; the template uses 120.',
    },
    EmptyLatentAudio: {
      seconds: 'The length of the sound; Stable Audio Open 1.0 makes up to about 47 seconds.',
    },
    ModelSamplingAuraFlow: {
      shift: 'The noise shift: 3 for ACE-Step 1.5, 1 for Hunyuan3D 2, as their templates set it.',
    },
    MMAudioSampler: {
      duration: 'The length of the sound in seconds: the length of the clip, about 8 at best.',
      prompt: 'Optional words about the sound; the frames lead.',
      mask_away_clip: 'On: the model ignores the frames and follows the text alone.',
    },
    MMAudioFeatureUtilsLoader: {
      mode: '16k or 44k: the sample rate of the model and its VAE; all files must match.',
    },
    FL_ChatterboxTTS: {
      exaggeration: 'How lively the speech is; 0.5 is the default, higher is more expressive and less steady.',
      cfg_weight: 'How closely the model follows the voice sample; lower is slower and calmer. Default 0.5.',
      temperature: 'How much the readings vary from run to run. Default 0.8.',
    },
    'Apply Whisper': {
      model: 'The size of Whisper: tiny and base are fast, large-v3 and turbo accurate; names ending in .en know English only.',
      language: 'The language of the speech, or auto to let the model find it.',
    },
    EmptyLatentHunyuan3Dv2: {
      resolution: 'How finely the shape is worked out: 3072 in the template of 2.0, 4096 in that of 2.1.',
    },
    VoxelToMesh: {
      threshold: 'Where the inside of the object ends: lower makes it fatter, higher thinner and with holes. 0.6 in the templates.',
      algorithm: 'surface net gives a smooth surface, basic a blocky one.',
    },
    FluxGuidance: {
      guidance: 'How strongly a FLUX model follows the description; FLUX.1 Kontext uses 2.5.',
    },
    ReActorRestoreFace: {
      visibility: 'How strongly the restored face covers the old one; lower blends them.',
      codeformer_weight: 'For CodeFormer only: near 0 sharper and less alike, near 1 more alike and softer.',
      facedetection: 'How faces are found: retinaface_resnet50 is the most careful, YOLOv5n the fastest.',
    },
    IPAdapterUnifiedLoaderFaceID: {
      preset: 'Which FaceID adapter and LoRA to load; FACEID PLUS V2 is the pack example\'s choice.',
      lora_strength: 'The strength of the FaceID LoRA; 0.6 in the pack\'s example. Higher presses the face harder and stiffens the picture.',
    },
    IPAdapterFaceID: {
      weight: 'How strongly the face is pressed into the picture; 1 in the example, lower towards 0.7 when the picture burns.',
      weight_faceidv2: 'For the V2 adapters only: how closely the face follows the photo; 2 in the example.',
    },
    ReActorFaceSwap: {
      face_restore_visibility: 'How strongly the restored face covers the swapped one; 1 covers fully, lower blends.',
      input_faces_index: 'Which faces of the picture are changed, counted from 0 at the left.',
    },
  },
  concepts: {
    identity: {
      term: 'Identity: adapter, LoRA or swap: which to choose',
      text: `${RULE}\n\nThree ways keep one face or one character:\n- an adapter (IP-Adapter FaceID, InstantID, PuLID, or a reference picture in Kontext): one photo, nothing to train, a new picture is drawn around the face; it keeps the face but not the hair, age or light;\n- a LoRA trained on the character: a dozen or more pictures and a training run; then the face, the body and the clothes hold in every picture, and the LoRA works with its own model family only;\n- a swap (ReActor): a picture that already exists keeps its pose, light and clothes, and only the face is replaced; quick, but the face is small and needs restoring.\n\nStart with the words of the description and a fixed seed, then an adapter; train a LoRA when a long series must hold; use a swap to fix a single finished picture.`,
    },
    'models-mmaudio': {
      term: 'models/mmaudio',
      text: 'MMAudio files: the model, its VAE, Synchformer and the CLIP model (ComfyUI-MMAudio adds this folder).',
    },
    'models-foley': {
      term: 'models/foley',
      text: 'HunyuanVideo-Foley files: the model, Synchformer and the DAC-VAE (ComfyUI-HunyuanVideo-Foley).',
    },
    'models-hunyuan_foley': {
      term: 'models/hunyuan_foley',
      text: 'HunyuanVideo-Foley files in a folder some installs use; the current pack reads models/foley.',
    },
    'models-qwen-tts': {
      term: 'models/qwen-tts',
      text: 'Qwen3-TTS models, the tokenizer and saved voices (ComfyUI-Qwen-TTS).',
    },
    'models-stt': {
      term: 'models/stt',
      text: 'Speech-to-text models; ComfyUI-Whisper keeps Whisper in models/stt/whisper.',
    },
    'models-chatterbox': {
      term: 'models/chatterbox',
      text: 'Chatterbox speech models, downloaded there by ComfyUI_Fill-ChatterBox.',
    },
    'models-audio_encoders': {
      term: 'models/audio_encoders',
      text: 'Sound encoders read by ComfyUI\'s own Audio Encoder Loader, such as wav2vec2, for video models that listen to a voice.',
    },
    'models-demucs': {
      term: 'models/demucs',
      text: 'Demucs models that split a song into vocals, drums, bass and the rest; read by stem-separation packs.',
    },
    'models-facerestore_models': {
      term: 'models/facerestore_models',
      text: 'Face restoration models (CodeFormer, GFPGAN, GPEN), read by ReActor and facerestore_cf.',
    },
    'models-facedetection': {
      term: 'models/facedetection',
      text: 'Face detection models of the face restoration packs.',
    },
    'models-facexlib': {
      term: 'models/facexlib',
      text: 'Face detection and parsing models of the facexlib library, used by some face packs.',
    },
    'models-insightface': {
      term: 'models/insightface',
      text: 'InsightFace face analysis models (AntelopeV2, buffalo_l) and ReActor\'s swap model; needed by face swap, FaceID and InfiniteYou.',
    },
    'models-photomaker': {
      term: 'models/photomaker',
      text: 'PhotoMaker files for SDXL (nodes of ComfyUI itself).',
    },
    'models-ipadapter': {
      term: 'models/ipadapter',
      text: 'IP-Adapter files, the FaceID ones included (ComfyUI_IPAdapter_plus).',
    },
    'models-infinite_you': {
      term: 'models/infinite_you',
      text: 'InfiniteYou files (ComfyUI_InfiniteYou).',
    },
    'models-reswapper': {
      term: 'models/reswapper',
      text: 'ReSwapper face swap models for ReActor.',
    },
    'models-unirig': {
      term: 'models/unirig',
      text: 'UniRig rigging models (ComfyUI-UniRig).',
    },
    'models-ultralytics': {
      term: 'models/ultralytics',
      text: 'YOLO detectors (bbox and segm) of ComfyUI-Impact-Subpack, such as bbox/face_yolov8m.pt.',
    },
    'models-sams': {
      term: 'models/sams',
      text: 'Segment Anything models, such as sam_vit_b_01ec64.pth, for the Impact Pack and ReActor.',
    },
    'models-instantid': {
      term: 'models/instantid',
      text: 'The InstantID adapter (ComfyUI_InstantID).',
    },
    'models-pulid': {
      term: 'models/pulid',
      text: 'PuLID files of the PuLID packs.',
    },
  },

};
