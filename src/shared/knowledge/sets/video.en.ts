/**
 * Built-in knowledge about video, English; coreKnowledge.ts reads it for the English interface. The Russian set
 * (video.ru.ts) says the same things.
 *
 * Sources: ComfyUI's own source (comfy_extras/nodes_wan.py, nodes_lt*.py, nodes_hunyuan.py, nodes_kandinsky5.py,
 * nodes_video.py, nodes_audio*.py, nodes_custom_sampler.py, nodes_frame_interpolation.py, nodes.py), the official
 * workflow templates, and the packs' own repositories. A few entries correct the core knowledge (LATENT, the Wan
 * 2.2 and LTX-2 families): a set's entry replaces the core one with the same owner.
 */
import type { KnowledgeSet } from '../coreKnowledge';

export const VIDEO_KNOWLEDGE_EN: KnowledgeSet = {
  nodes: {
    // Built-in video nodes that the existing video lessons use.
    ModelSamplingSD3: {
      what: 'ModelSamplingSD3: sets the shift of a flow model such as SD3, Wan, HunyuanVideo or Kandinsky 5, that is, how much of the sampling goes to the early, noisy steps.',
      why: 'Video models are run with a shift that the official templates give: 8 for Wan 2.2, 7 for HunyuanVideo 1.5, 5 for Kandinsky 5. A higher shift spends more steps on composition and motion.',
      connect: 'Input: MODEL (from the loader or a LoRA) and shift. Output: MODEL, which goes to the sampler or the guider.',
      risk: 'With too small a shift a video model keeps the composition and the motion worse and the clip comes out sluggish; with too large a one the fine detail suffers.',
    },
    EmptyHunyuanLatentVideo: {
      what: 'Empty Hunyuan Video 1.0 Latent: an empty video latent (the compressed blank the model draws on) of a width, a height and a number of frames.',
      why: 'The starting blank of text-to-video for HunyuanVideo 1.0 and for the Wan 2.1 and 2.2 14B models, which compress video the same way.',
      connect: 'Inputs: width, height, length (frames), batch_size. Output: LATENT, which goes to the latent_image input of the sampler.',
      risk: 'The number of frames must be of the form 4n + 1 (49, 81, 121); the small Wan 2.2 5B model needs Wan22ImageToVideoLatent instead.',
    },
    WanImageToVideo: {
      what: 'WanImageToVideo: puts a start image into the blank of a Wan clip and into both prompts, so the clip starts from that image.',
      why: 'The heart of Wan image-to-video with the i2v models (Wan 2.1 and the 2.2 14B pair).',
      connect: 'Inputs: positive and negative (CONDITIONING), vae, width, height, length, and optionally start_image and clip_vision_output. Outputs: positive, negative and latent, which go to the sampler in place of the plain prompts and blank.',
      risk: 'A sampler still fed by the prompts directly does not learn of the image. The t2v models do not take an image.',
    },
    CreateVideo: {
      what: 'Create Video: joins a batch of frames (IMAGE), and optionally a sound (AUDIO), into one VIDEO at a frame rate.',
      why: 'The step before saving: frames from VAE Decode become a clip that plays at the speed the model drew it.',
      connect: 'Inputs: images, fps and optionally audio. Output: VIDEO, which goes to Save Video.',
      risk: 'fps must match the model: 16 for the Wan 14B models, 24 for Wan 2.2 5B, LTX-2, HunyuanVideo 1.5 and Kandinsky 5, 25 for HuMo and InfiniteTalk. Another number makes the clip run too fast or too slow.',
    },
    SaveVideo: {
      what: 'Save Video: writes a VIDEO to the output folder of ComfyUI as a file (mp4 by default).',
      why: 'The end of a video graph; without it ComfyUI works the clip out and keeps nothing.',
      connect: 'Inputs: video, filename_prefix (may hold a subfolder, such as video/ComfyUI), format and codec. No output to link.',
    },
    LoadVideo: {
      what: 'Load Video: loads a video file from the input folder of ComfyUI as one VIDEO, with its sound and frame rate.',
      why: 'The start of any graph that works on an existing video: a control video, a motion source, a clip to make smoother or larger.',
      connect: 'Input: file. Output: VIDEO, which goes to Get Video Components to get frames, or straight to a node that takes a VIDEO.',
      risk: 'It loads the whole video. To take a piece of it, at a chosen frame rate or size, use the VideoHelperSuite loader or cut the frames afterwards.',
    },
    GetVideoComponents: {
      what: 'Get Video Components: splits a VIDEO into its frames (IMAGE), its sound (AUDIO) and its frame rate (FLOAT).',
      why: 'Frames are what image and video nodes work on; the sound and the rate are kept to put back into the result.',
      connect: 'Input: video. Outputs: images, audio, fps (newer versions also give bit_depth).',
    },
    LoadAudio: {
      what: 'Load Audio: loads a sound file from the input folder of ComfyUI as AUDIO.',
      why: 'The voice of a speech-driven video, or a sound track for Create Video.',
      connect: 'Input: audio (the file). Output: AUDIO, which goes to an audio encoder, to Create Video, or to nodes of the speaking-video packs.',
    },
    // The small Wan model, first and last frame, control, sound, character.
    Wan22ImageToVideoLatent: {
      what: 'Wan22ImageToVideoLatent: the empty latent of the Wan 2.2 5B model, optionally starting from an image.',
      why: 'The 5B model compresses video more strongly than the 14B models (16 × 16 pixels and 4 frames per latent cell), so it has its own blank. Connect an image to start_image for image-to-video.',
      connect: 'Inputs: vae, width, height (multiples of 32), length, batch_size, and optionally start_image. Output: LATENT, which goes to the sampler.',
      risk: 'Only for the 5B model with wan2.2_vae; the 14B models use EmptyHunyuanLatentVideo or WanImageToVideo.',
    },
    WanFirstLastFrameToVideo: {
      what: 'WanFirstLastFrameToVideo: prepares a Wan clip that starts at one image and ends at another.',
      why: 'For transformations and transitions: the model invents the motion between the two frames. The official template runs it on the Wan 2.2 14B i2v pair.',
      connect: 'Inputs: positive, negative, vae, width, height, length, start_image and end_image (and optional CLIP vision outputs of both). Outputs: positive, negative, latent, which go to the samplers.',
      risk: 'Images of different proportions or scenes give a blurred middle.',
    },
    Wan22FunControlToVideo: {
      what: 'Wan22FunControlToVideo: prepares a Wan 2.2 Fun Control clip from a reference image and a control video (depth, pose or edges).',
      why: 'The control video says how things move; the reference image says what is drawn.',
      connect: 'Inputs: positive, negative, vae, width, height, length, ref_image and control_video. Outputs: positive, negative, latent.',
      risk: 'Needs a Fun Control model file (5B or 14B); an ordinary Wan model ignores the control. The control video needs at least length frames.',
    },
    WanFunControlToVideo: {
      what: 'WanFunControlToVideo: the Wan 2.1 Fun Control version of the control node, with a start image and CLIP vision input.',
      why: 'Used with the Wan 2.1 Fun Control models.',
      connect: 'Inputs: positive, negative, vae, width, height, length, and optionally clip_vision_output, start_image, control_video. Outputs: positive, negative, latent.',
    },
    WanVaceToVideo: {
      what: 'WanVaceToVideo: prepares a Wan VACE clip, where one model takes a control video, masks and reference images for many tasks: video from video, inpainting, outpainting, first and last frame.',
      why: 'One node and one VACE model cover what otherwise needs a separate model per task.',
      connect: 'Inputs: positive, negative, vae, width, height, length, strength, and optionally control_video, control_masks, reference_image. Outputs: positive, negative, latent and trim_latent, which TrimVideoLatent uses to cut the reference frames off after sampling.',
      risk: 'With a reference image the output has extra frames at the start; the template cuts them with TrimVideoLatent.',
    },
    WanSoundImageToVideo: {
      what: 'WanSoundImageToVideo: prepares a Wan 2.2 S2V clip, where a person in a reference image moves and speaks with a sound.',
      why: 'Speech-driven video on ComfyUI\'s own nodes; longer clips are made in chunks of 77 frames with WanSoundImageToVideoExtend.',
      connect: 'Inputs: positive, negative, vae, width, height, length, and optionally audio_encoder_output, ref_image, control_video, ref_motion. Outputs: positive, negative, latent.',
      risk: 'Only with the consent of the person whose face and voice are used.',
    },
    WanHuMoImageToVideo: {
      what: 'WanHuMoImageToVideo: prepares a HuMo clip, where a person from a reference image speaks the words of a sound.',
      why: 'HuMo is a 17B speech-to-video model on Wan 2.1; the template runs it with the lightx2v LoRA in 6 steps at cfg 1, 25 fps.',
      connect: 'Inputs: positive, negative, vae, width, height, length (97 by default), and optionally audio_encoder_output (from the Whisper encoder) and ref_image. Outputs: positive, negative, latent.',
      risk: 'Only with the consent of the person whose face and voice are used.',
    },
    WanAnimateToVideo: {
      what: 'WanAnimateToVideo: prepares a Wan 2.2 Animate clip, where a character from a reference image takes the poses and the face of a person in a video, or replaces that person in the video.',
      why: 'Character animation on ComfyUI\'s own sampling nodes. The official template makes the pose and face videos with the comfyui_controlnet_aux pack and the character mask with SAM2.',
      connect: 'Inputs: positive, negative, vae, width, height, length, and optionally clip_vision_output, reference_image, face_video, pose_video, background_video and character_mask (for replacement), continue_motion. Outputs: positive, negative, latent and the trim values for the next piece.',
      risk: 'Only with the consent of the person whose face or body is used.',
    },
    TrimVideoLatent: {
      what: 'TrimVideoLatent: cuts a number of frames off the start of a video latent.',
      why: 'Removes the reference frames that VACE and Animate add at the start.',
      connect: 'Inputs: samples (LATENT) and trim_amount. Output: LATENT, which goes to VAE Decode.',
    },
    AudioEncoderLoader: {
      what: 'Audio Encoder Loader: loads a speech encoder (Whisper or wav2vec2) from models/audio_encoders.',
      why: 'Speech-driven video models listen through it: HuMo uses Whisper, Wan 2.2 S2V uses wav2vec2.',
      connect: 'Input: audio_encoder_name. Output: AUDIO_ENCODER, which goes to Audio Encoder Encode.',
      risk: 'Take the encoder the model\'s template names; another one gives lips out of time or an error.',
    },
    AudioEncoderEncode: {
      what: 'Audio Encoder Encode: turns a sound into what a speech-driven model reads.',
      why: 'The link between Load Audio and the video model\'s start node.',
      connect: 'Inputs: audio_encoder and audio. Output: AUDIO_ENCODER_OUTPUT, which goes to WanHuMoImageToVideo or WanSoundImageToVideo.',
    },
    // LTX-2.
    LTXVConditioning: {
      what: 'LTXVConditioning: adds the frame rate to both prompts of an LTX graph.',
      why: 'LTX needs to know how fast time runs in the clip, for the motion and the sound.',
      connect: 'Inputs: positive, negative and frame_rate. Outputs: positive and negative, which go to the guider.',
      risk: 'The frame rate here, in the empty sound latent and in Create Video must be the same.',
    },
    EmptyLTXVLatentVideo: {
      what: 'EmptyLTXVLatentVideo: the empty video latent of LTX models.',
      why: 'LTX compresses video strongly (32 × 32 pixels and 8 frames per latent cell), so it has its own blank.',
      connect: 'Inputs: width, height (multiples of 32), length (8n + 1: 97, 121), batch_size. Output: LATENT.',
    },
    LTXVEmptyLatentAudio: {
      what: 'Empty LTXV Latent Audio: the empty sound latent of an LTX-2 clip, as long as the video.',
      why: 'LTX-2 draws sound with the picture; the sound needs a blank of its own.',
      connect: 'Inputs: frames_number, frame_rate, batch_size and audio_vae. Output: LATENT, which goes with the video blank into LTXVConcatAVLatent.',
    },
    LTXVConcatAVLatent: {
      what: 'LTXVConcatAVLatent: joins a video latent and a sound latent into one, for LTX-2 to sample together.',
      why: 'The picture and the sound are drawn in one pass and stay in time.',
      connect: 'Inputs: video_latent and audio_latent. Output: latent, which goes to the sampler.',
    },
    LTXVSeparateAVLatent: {
      what: 'LTXVSeparateAVLatent: parts a joined LTX-2 latent into video and sound again.',
      why: 'After sampling: the video goes to the upscaler or the VAE, the sound to its own decoder.',
      connect: 'Input: av_latent. Outputs: video_latent and audio_latent.',
    },
    LTXVDualCFGGuider: {
      what: 'LTXVDualCFGGuider: the guider of LTX-2 with separate strengths for the video and the sound.',
      why: 'The prompt can push the picture and the sound differently. The distilled models take 1 for both.',
      connect: 'Inputs: model, positive, negative, video_cfg, audio_cfg. Output: GUIDER, which goes to SamplerCustomAdvanced.',
    },
    LTXVLatentUpsampler: {
      what: 'LTXVLatentUpsampler: doubles the width and height of an LTX video latent with a latent upscale model.',
      why: 'The two-stage LTX-2 graphs draw at half size and enlarge before the second stage, which is much faster than drawing at full size.',
      connect: 'Inputs: samples (the video latent), upscale_model, vae. Output: LATENT.',
    },
    LatentUpscaleModelLoader: {
      what: 'Load Latent Upscale Model: loads a latent upscaler from models/latent_upscale_models.',
      why: 'LTX-2 and HunyuanVideo 1.5 enlarge their latents with such models between two stages.',
      connect: 'Input: model_name. Output: LATENT_UPSCALE_MODEL.',
      risk: 'An upscaler belongs to its model version: an LTX-2.5 one does not fit LTX-2.0, nor a HunyuanVideo one LTX.',
    },
    LTXVAudioVAEDecode: {
      what: 'LTXV Audio VAE Decode: turns the sound latent of LTX-2 into AUDIO.',
      why: 'The sound counterpart of VAE Decode.',
      connect: 'Inputs: samples (the sound latent) and audio_vae. Output: Audio, which goes to Create Video.',
    },
    LTXVAudioVAELoader: {
      what: 'LTXV Audio VAE Loader: loads the sound VAE that LTX-2.0 and 2.3 keep inside their checkpoint.',
      why: 'For graphs that load LTX from one checkpoint; LTX-2.5 has a separate audio VAE file for Load VAE.',
      connect: 'Input: ckpt_name. Output: Audio VAE.',
    },
    LTXAVTextEncoderLoader: {
      what: 'LTXAVTextEncoderLoader: loads the Gemma text encoder of LTX-2.0 and 2.3 together with the connector stored in the LTX checkpoint.',
      why: 'The text encoder of the checkpoint-based LTX-2 graphs; LTX-2.5 loads its encoder with Load CLIP and type ltxv.',
      connect: 'Inputs: text_encoder, ckpt_name, device. Output: CLIP.',
    },
    // The custom sampler.
    SamplerCustomAdvanced: {
      what: 'SamplerCustomAdvanced: a sampler built of parts: noise, guider, sampler and the list of noise levels (sigmas) come from separate nodes.',
      why: 'Newer families (LTX-2, HunyuanVideo 1.5, Flux) need settings a KSampler does not have: a special guider, a hand-written list of steps.',
      connect: 'Inputs: noise, guider, sampler, sigmas, latent_image. Outputs: output (the result) and denoised_output.',
    },
    RandomNoise: {
      what: 'RandomNoise: the starting noise of a custom sampler, made from a seed.',
      why: 'Holds the seed; the same seed with the same settings gives the same result.',
      connect: 'Input: noise_seed. Output: NOISE.',
    },
    KSamplerSelect: {
      what: 'KSamplerSelect: chooses the sampling method (euler, euler_ancestral, uni_pc…) for a custom sampler.',
      why: 'The same choice as sampler_name in KSampler, as a separate node.',
      connect: 'Input: sampler_name. Output: SAMPLER.',
    },
    ManualSigmas: {
      what: 'ManualSigmas: a list of noise levels written by hand, one per step.',
      why: 'Distilled models are trained for an exact short list of steps; the LTX-2 templates write it here.',
      connect: 'Input: sigmas (numbers separated by commas, from high to 0). Output: SIGMAS.',
      risk: 'Copy the list from the official template; a made-up one gives noise or a blur.',
    },
    BasicScheduler: {
      what: 'BasicScheduler: works out the list of noise levels for a number of steps with a scheduler.',
      why: 'The usual way to give a custom sampler its steps.',
      connect: 'Inputs: model, scheduler, steps, denoise. Output: SIGMAS.',
    },
    CFGGuider: {
      what: 'CFGGuider: the guider of a custom sampler with one cfg strength.',
      why: 'Holds the model and both prompts, as KSampler would.',
      connect: 'Inputs: model, positive, negative, cfg. Output: GUIDER.',
    },
    VAEDecodeTiled: {
      what: 'VAE Decode (Tiled): turns a latent into frames piece by piece, in tiles of space and, for video, of time.',
      why: 'Decoding all frames at once is the memory peak at the end of a video run; tiles keep it low. The LTX-2 and HunyuanVideo 1.5 templates use it.',
      connect: 'Inputs: samples, vae, tile_size, overlap, temporal_size, temporal_overlap. Output: IMAGE.',
      risk: 'Very small tiles can leave faint seams; overlap hides them.',
    },
    EasyCache: {
      what: 'EasyCache: skips part of the work on sampling steps where the result changes little.',
      why: 'Faster video at a small cost in detail; the HunyuanVideo 1.5 template puts it after the loader.',
      connect: 'Input: model and its thresholds. Output: MODEL.',
    },
    // HunyuanVideo 1.5 and Kandinsky 5.
    EmptyHunyuanVideo15Latent: {
      what: 'Empty Hunyuan Video 1.5 Latent: the empty latent of HunyuanVideo 1.5.',
      why: 'Version 1.5 compresses 16 × 16 pixels per cell (1.0 compressed 8 × 8), so it has its own blank.',
      connect: 'Inputs: width, height, length (4n + 1), batch_size. Output: LATENT.',
    },
    HunyuanVideo15ImageToVideo: {
      what: 'HunyuanVideo15ImageToVideo: prepares a HunyuanVideo 1.5 image-to-video clip from a start image.',
      why: 'The image-to-video counterpart of the empty latent, with the i2v model files.',
      connect: 'Inputs: positive, negative, vae, width, height, length, and optionally start_image and clip_vision_output. Outputs: positive, negative, latent.',
    },
    Kandinsky5ImageToVideo: {
      what: 'Kandinsky5ImageToVideo: prepares a Kandinsky 5 clip, from text or from a start image.',
      why: 'The start node of every Kandinsky 5 video graph.',
      connect: 'Inputs: positive, negative, vae, width, height, length, and optionally start_image. Outputs: positive, negative, latent and cond_latent (the encoded start image).',
    },
    // Tools.
    FrameInterpolationModelLoader: {
      what: 'Load Frame Interpolation Model: loads a FILM or RIFE model from models/frame_interpolation.',
      why: 'For making a clip smoother with more frames between frames, on ComfyUI\'s own nodes.',
      connect: 'Input: model_name. Output: INTERP_MODEL, which goes to Frame Interpolate.',
    },
    FrameInterpolate: {
      what: 'Frame Interpolate: draws new frames between each two frames of a batch.',
      why: 'A 16 fps clip with multiplier 2 becomes a smooth 32 fps one; kept at 16 fps it becomes slow motion.',
      connect: 'Inputs: interp_model, images, multiplier (2 to 16). Output: IMAGE.',
      risk: 'Set Create Video\'s fps to the old rate times the multiplier, or the clip plays slower.',
    },
    ImageFromBatch: {
      what: 'Image From Batch: takes a run of frames out of a batch, from batch_index, length frames long.',
      why: 'Cuts a clip shorter before slow work such as upscaling.',
      connect: 'Inputs: image, batch_index, length. Output: IMAGE.',
    },
    ImageToMask: {
      what: 'Convert Image to Mask: takes one colour channel of an image (or of every frame) as a MASK.',
      why: 'Turns a painted mask video into the mask that video inpainting reads.',
      connect: 'Inputs: image and channel (red, green, blue, alpha). Output: MASK.',
    },
    Canny: {
      what: 'Canny: draws the edges of an image or of every frame of a video.',
      why: 'A built-in way to make a control video of edges for Fun Control or VACE.',
      connect: 'Inputs: image, low_threshold, high_threshold. Output: IMAGE.',
    },
    ImageBatch: {
      what: 'Batch Images: joins two batches of frames into one, the second after the first.',
      why: 'Joins the parts of a longer video made one after another; the newer Batch Images node of the templates takes more inputs and does the same.',
      connect: 'Inputs: image1 and image2 (frames of the same size). Output: IMAGE, which goes to Create Video.',
      risk: 'Both parts must have the same width and height.',
    },
    // ComfyUI-VideoHelperSuite.
    VHS_LoadVideo: {
      what: 'Load Video (Upload) of VideoHelperSuite: loads frames of a video from the input folder, with control over which and how many.',
      why: 'Takes a piece of a video at a chosen frame rate and size: force_rate, skip_first_frames, frame_load_cap, select_every_nth, custom_width and custom_height.',
      connect: 'Outputs: IMAGE (the frames), frame_count, audio (cut to the same piece) and video_info.',
      risk: 'Frames are counted after force_rate changes the rate. A long video at full size can fill the memory: cap the frames.',
    },
    VHS_LoadVideoPath: {
      what: 'Load Video (Path) of VideoHelperSuite: the same loader, for a video given by its path or address.',
      why: 'For videos that are not in the input folder.',
      connect: 'The same fields and outputs as Load Video (Upload).',
    },
    VHS_VideoCombine: {
      what: 'Video Combine of VideoHelperSuite: saves frames as a video (mp4, webm, ProRes…) or an animated gif or webp, with sound.',
      why: 'The most used video saver of published graphs; it also previews the result on the node.',
      connect: 'Inputs: images, frame_rate, loop_count, filename_prefix, format, pingpong, save_output, and optionally audio. Output: Filenames.',
      risk: 'frame_rate must match the frames; with save_output off the file goes to the temporary folder only.',
    },
    VHS_VideoInfo: {
      what: 'Video Info of VideoHelperSuite: the frame rate, frame count, duration and size of a loaded video, before and after loading.',
      why: 'To take the frame rate from the source instead of typing it.',
      connect: 'Input: video_info from a VideoHelperSuite loader. Outputs: source_ and loaded_ fps, frame count, duration, width, height.',
    },
    // ComfyUI-SeedVR2_VideoUpscaler.
    SeedVR2LoadDiTModel: {
      what: 'SeedVR2 (Down)Load DiT Model: chooses the SeedVR2 model (3B or 7B, fp16, fp8 or GGUF) and how it is held in memory.',
      why: 'blocks_to_swap keeps part of the model in system memory, so the 3B model runs on modest cards.',
      connect: 'Inputs: model, device, blocks_to_swap, offload_device and others. Output: SEEDVR2_DIT, which goes to SeedVR2 Video Upscaler.',
      risk: 'A missing model is downloaded by the pack itself into models/SEEDVR2 on the first run in ComfyUI.',
    },
    SeedVR2LoadVAEModel: {
      what: 'SeedVR2 (Down)Load VAE Model: loads the SeedVR2 VAE, with optional tiled encoding and decoding.',
      why: 'Tiles keep the memory peak low on large frames.',
      connect: 'Inputs: model, device, encode_tiled, decode_tiled and tile sizes. Output: SEEDVR2_VAE.',
    },
    SeedVR2VideoUpscaler: {
      what: 'SeedVR2 Video Upscaler: redraws the frames of a video larger, restoring detail and keeping neighbouring frames consistent.',
      why: 'Restoration and upscaling of video (and of single images) in one model.',
      connect: 'Inputs: image (the frames), dit, vae, seed, resolution (the shorter side of the result), batch_size (4n + 1 frames together), color_correction and others. Output: IMAGE.',
      risk: 'A larger batch_size keeps motion consistent and needs more memory.',
    },
    // ComfyUI-Frame-Interpolation.
    'RIFE VFI': {
      what: 'RIFE VFI of ComfyUI-Frame-Interpolation: draws frames between frames with a RIFE model.',
      why: 'Fast interpolation; the pack recommends RIFE 4.25 or newer.',
      connect: 'Inputs: ckpt_name, frames, multiplier, clear_cache_after_n_frames, fast_mode, ensemble, scale_factor. Output: IMAGE.',
      risk: 'The pack fetches its models itself on first use; some of them are old .pth files.',
    },
    'FILM VFI': {
      what: 'FILM VFI of ComfyUI-Frame-Interpolation: draws frames between frames with Google\'s FILM model.',
      why: 'Slower than RIFE and good on large motion.',
      connect: 'Inputs: ckpt_name, frames, clear_cache_after_n_frames, multiplier. Output: IMAGE.',
    },
    // ComfyUI_ProPainter_Nodes.
    ProPainterInpaint: {
      what: 'ProPainter Inpainting: removes what a mask covers in every frame of a video and fills it from the other frames.',
      why: 'Removing an object, a logo or a person from a video while the background stays consistent.',
      connect: 'Inputs: image (frames), mask (one per frame), width, height, mask_dilates, flow_mask_dilates, ref_stride, neighbor_length, subvideo_length, raft_iter, fp16. Outputs: IMAGE, FLOW_MASK, MASK_DILATE.',
      risk: 'Memory grows fast with size and frames. A background never seen in the clip can only be guessed.',
    },
    ProPainterOutpaint: {
      what: 'ProPainter Outpainting: widens the frames of a video and fills the new edges.',
      why: 'Changing the proportions of a video without cropping.',
      connect: 'Inputs: image, width, height, width_scale, height_scale and others. Outputs: IMAGE, OUTPAINT_MASK, output_width, output_height.',
    },
    // comfyui_cotracker_node.
    CoTrackerNode: {
      what: 'CoTracker of comfyui_cotracker_node: follows points through the frames of a video (point tracking).',
      why: 'Gives the paths of moving points, for motion-guided video models (such as Wan ATI and Wan Move tracks) or for effects that stick to an object.',
      connect: 'Inputs: images, tracking_points (optional x,y per line), grid_size, max_num_of_points, and optionally tracking_mask. Outputs: tracking_results (text) and image_with_results.',
    },
    // ComfyUI-WanAnimatePreprocess.
    OnnxDetectionModelLoader: {
      what: 'ONNX Detection Model Loader of ComfyUI-WanAnimatePreprocess: loads the ViTPose pose model and the YOLO person finder.',
      why: 'The first step of preparing a driving video for Wan Animate.',
      connect: 'Inputs: vitpose_model, yolo_model (files in models/detection), onnx_device. Output: model, which goes to Pose and Face Detection.',
    },
    PoseAndFaceDetection: {
      what: 'Pose and Face Detection: finds the pose and crops the face in every frame of a video.',
      why: 'Gives Wan Animate the motion of the body and of the face separately.',
      connect: 'Inputs: model, images, width, height. Outputs: pose_data, face_images and boxes.',
    },
    DrawViTPose: {
      what: 'Draw ViT Pose: draws the found poses as stick figures, one frame per frame.',
      why: 'Wan Animate reads the pose as such pictures.',
      connect: 'Inputs: pose_data, width, height. Output: pose_images.',
    },
    // ComfyUI-KJNodes, the helpers video graphs lean on.
    ImageResizeKJv2: {
      what: 'Resize Image v2 of KJNodes: resizes images or frames, keeping proportions by stretching, padding or cropping, to a size divisible by a number.',
      why: 'Video models want sides divisible by 16 or 32; this node gets frames there in one step.',
      connect: 'Inputs: image, width, height, upscale_method, keep_proportion, divisible_by, and optionally mask. Outputs: IMAGE, width, height (and a mask).',
    },
    GetImageRangeFromBatch: {
      what: 'Get Image or Mask Range From Batch of KJNodes: takes num_frames frames from start_index.',
      why: 'Cuts a clip or a mask video to the piece a model needs.',
      connect: 'Inputs: start_index, num_frames, and images or masks. Outputs: IMAGE and MASK.',
    },
    ImageBatchMulti: {
      what: 'Image Batch Multi of KJNodes: joins several images or batches of frames into one batch.',
      why: 'Puts clips or reference images one after another.',
      connect: 'Inputs: inputcount and image_1, image_2, … Output: images.',
    },
    GetImageSizeAndCount: {
      what: 'Get Image Size & Count of KJNodes: passes frames through and reports their width, height and number.',
      why: 'To feed the size and the frame count of a video to the nodes after it.',
      connect: 'Input: image. Outputs: image, width, height, count.',
    },
    ColorMatch: {
      what: 'Color Match of KJNodes: brings the colours of frames to those of a reference image.',
      why: 'Fixes the colour drift of long or stitched video.',
      connect: 'Inputs: image_ref, image_target, method, strength. Output: image.',
    },
    SetNode: {
      what: 'Set of KJNodes: gives a value a name, so a Get node elsewhere on the canvas can take it without a long link.',
      why: 'Large video graphs pass the model, the VAE or the frame count to many places; Set and Get keep the canvas readable.',
      connect: 'One input of any type and a name. It works in the ComfyUI frontend only: in the saved graph the link goes straight from the source to the user.',
    },
    GetNode: {
      what: 'Get of KJNodes: takes the value a Set node with the same name holds.',
      why: 'The other half of Set: a wireless link.',
      connect: 'Chooses a name; one output of the type of what the Set holds.',
    },
  },
  linkTypes: {
    VIDEO: {
      what: 'VIDEO: a whole clip as one value: its frames, its sound and its frame rate.',
      why: 'What Load Video gives and Save Video takes.',
      connect: 'Comes from Load Video or Create Video; goes to Save Video or Get Video Components.',
    },
    AUDIO: {
      what: 'AUDIO: a sound, as a waveform with its sample rate.',
      why: 'A voice for speech-driven video, a track for Create Video, the sound LTX-2 makes.',
      connect: 'Comes from Load Audio, Get Video Components or a sound decoder; goes to an audio encoder, Create Video or a video saver.',
    },
    AUDIO_ENCODER: {
      what: 'AUDIO_ENCODER: a loaded speech encoder (Whisper or wav2vec2).',
      why: 'Speech-driven video models listen through it.',
      connect: 'Comes from Audio Encoder Loader; goes to Audio Encoder Encode.',
    },
    AUDIO_ENCODER_OUTPUT: {
      what: 'AUDIO_ENCODER_OUTPUT: a sound as a speech encoder heard it.',
      why: 'What HuMo and Wan 2.2 S2V read to move the lips.',
      connect: 'Comes from Audio Encoder Encode; goes to WanHuMoImageToVideo or WanSoundImageToVideo.',
    },
    LATENT_UPSCALE_MODEL: {
      what: 'LATENT_UPSCALE_MODEL: a model that enlarges a latent without decoding it.',
      why: 'The two-stage LTX-2 and HunyuanVideo 1.5 graphs use it between stages.',
      connect: 'Comes from Load Latent Upscale Model; goes to LTXVLatentUpsampler or HunyuanVideo15LatentUpscaleWithModel.',
    },
    INTERP_MODEL: {
      what: 'INTERP_MODEL: a loaded frame interpolation model (FILM or RIFE).',
      why: 'For drawing frames between frames.',
      connect: 'Comes from Load Frame Interpolation Model; goes to Frame Interpolate.',
    },
    NOISE: {
      what: 'NOISE: the starting noise of a custom sampler, with its seed.',
      why: 'One of the four parts of SamplerCustomAdvanced.',
      connect: 'Comes from RandomNoise (or DisableNoise for a pass that adds none); goes to SamplerCustomAdvanced.',
    },
    GUIDER: {
      what: 'GUIDER: the model and the prompts with the way they steer sampling (one cfg, or a separate one for video and sound).',
      why: 'One of the four parts of SamplerCustomAdvanced.',
      connect: 'Comes from CFGGuider, LTXVDualCFGGuider and other guiders; goes to SamplerCustomAdvanced.',
    },
    SEEDVR2_DIT: {
      what: 'SEEDVR2_DIT: the settings of a SeedVR2 model (which file, which device, how many blocks swapped).',
      why: 'The model part of the SeedVR2 upscaler.',
      connect: 'Comes from SeedVR2 (Down)Load DiT Model; goes to SeedVR2 Video Upscaler.',
    },
    SEEDVR2_VAE: {
      what: 'SEEDVR2_VAE: the settings of the SeedVR2 VAE.',
      why: 'The VAE part of the SeedVR2 upscaler.',
      connect: 'Comes from SeedVR2 (Down)Load VAE Model; goes to SeedVR2 Video Upscaler.',
    },
    VHS_VIDEOINFO: {
      what: 'VHS_VIDEOINFO: what VideoHelperSuite knows of a loaded video: rate, frames, duration, size.',
      why: 'To reuse the source frame rate further on.',
      connect: 'Comes from a VideoHelperSuite loader; goes to Video Info.',
    },
    VHS_FILENAMES: {
      what: 'VHS_FILENAMES: the names of the files Video Combine wrote.',
      why: 'Rarely linked; some nodes pick a written file by it.',
      connect: 'Comes from Video Combine.',
    },
  },
  families: {
    'wan2.2-5b': {
      what: 'Wan 2.2 TI2V 5B: the small Wan 2.2 model for text and image to video in one file, about 10 GB in fp16. Load Diffusion Model, umt5_xxl with Load CLIP (type wan), wan2.2_vae, Wan22ImageToVideoLatent; 1280 × 704, 121 frames, 24 fps, 20 steps, cfg 5. Runs on 8 GB cards with offloading.',
      risk: 'Needs wan2.2_vae, not wan_2.1_vae. LoRAs of the 14B models do not fit it.',
    },
    'wan-fun': {
      what: 'Wan Fun (Control, InP, Camera) by Alibaba PAI: Wan models trained to follow a control video, to fill between frames, or to follow a camera path. Wan 2.2 Fun Control comes in 5B and 14B; the nodes are Wan22FunControlToVideo and WanFunControlToVideo.',
      risk: 'A Fun model ignores the control unless it goes through its own node; an ordinary Wan model ignores the control altogether.',
    },
    'wan-vace': {
      what: 'Wan VACE: one Wan 2.1 model (1.3B or 14B) that takes control videos, masks and reference images for many tasks: video from video, reference to video, inpainting, outpainting, first and last frame. Node: WanVaceToVideo, with TrimVideoLatent after sampling.',
      risk: 'Uses the Wan 2.1 VAE and text encoder; the reference frames must be trimmed off the result.',
    },
    'wan-animate': {
      what: 'Wan 2.2 Animate 14B: a character from a reference image takes the poses and the face of a person in a video, or replaces that person. Built-in node WanAnimateToVideo; the template prepares the pose with comfyui_controlnet_aux and the mask with SAM2; WanVideoWrapper and ComfyUI-WanAnimatePreprocess do it on the pack side.',
      risk: 'Only with the consent of anyone whose face or body is used. Long clips are made in pieces, and colour may drift between them.',
    },
    'wan-s2v': {
      what: 'Wan 2.2 S2V 14B: speech to video. A person in a reference image speaks and moves with a sound, heard through the wav2vec2 audio encoder. Nodes: WanSoundImageToVideo for the first 77 frames, WanSoundImageToVideoExtend for each further piece; 16 fps.',
      risk: 'Only with the consent of the person whose face and voice are used.',
    },
    humo: {
      what: 'HuMo: a 17B speech-to-video model on Wan 2.1, by Tsinghua University and ByteDance. A person from a reference image speaks the words of a sound heard through Whisper. Node WanHuMoImageToVideo; 640 × 640, 97 frames, 25 fps; with the lightx2v LoRA 6 steps at cfg 1.',
      risk: 'Only with the consent of the person whose face and voice are used. Uses the Wan 2.1 VAE and text encoder.',
    },
    hunyuan15: {
      what: 'HunyuanVideo 1.5 by Tencent: an 8.3B video model, 480p and 720p, text and image to video. qwen_2.5_vl_7b and byt5_small_glyphxl through DualCLIPLoader (type hunyuan_video_15), hunyuanvideo15_vae, EmptyHunyuanVideo15Latent or HunyuanVideo15ImageToVideo, the custom sampler with shift 7, 24 fps; an optional second stage enlarges to 1080p.',
      risk: 'Not compatible with HunyuanVideo 1.0 files (VAE, LoRAs, text encoders).',
    },
    kandinsky5: {
      what: 'Kandinsky 5.0 Video by Sber AI: Lite (2B) and Pro video models, text and image to video. qwen_2.5_vl_7b with clip_l through DualCLIPLoader (type kandinsky5), the HunyuanVideo 1.0 VAE, Kandinsky5ImageToVideo; the Lite template: 768 × 512, 121 frames, 24 fps, shift 5, 50 steps, cfg 5.',
      risk: 'The Lite files are made for 5- or 10-second clips (their names say which); the distilled ones need fewer steps.',
    },
    ltxv: {
      what: 'LTX-Video 0.9 by Lightricks: the earlier, smaller LTX models, video without sound, fast on modest cards. Built-in LTXV nodes, a t5 text encoder with Load CLIP (type ltxv).',
      risk: 'Not compatible with LTX-2 files or LoRAs.',
    },
    seedvr2: {
      what: 'SeedVR2 by ByteDance: a video restoration and upscaling model, 3B or 7B, in fp16, fp8 or GGUF. Used through the ComfyUI-SeedVR2_VideoUpscaler pack (which fetches its files into models/SEEDVR2) or ComfyUI\'s own SeedVR2 nodes.',
      risk: 'Each frame is redrawn: long clips take long. The 7B model is sharper and needs much more memory.',
    },
    'frame-interpolation': {
      what: 'Frame interpolation models (FILM, RIFE and others): small models that draw frames between frames. ComfyUI\'s own Frame Interpolate reads them from models/frame_interpolation; the ComfyUI-Frame-Interpolation pack has a node per model.',
      risk: 'Fast motion gives smeared shapes; old .pth files can run code when loaded.',
    },
  },
  packs: {
    'ComfyUI-VideoHelperSuite': {
      what: 'Loading and saving video with control: a piece of a video at a chosen rate and size, saving to mp4, webm, gif and more, with sound.',
      nodes: 'Load Video (Upload), Load Video (Path), Video Combine, Video Info, Meta Batch Manager, and nodes to split, merge and select frames.',
    },
    'ComfyUI-LTXVideo': {
      what: 'Extra nodes by Lightricks for LTX-2, beyond what ComfyUI itself has: tiled and looping samplers, IC-LoRA guides, prompt enhancement with Gemma, HDR and more.',
      nodes: 'LTXVBaseSampler, LTXVExtendSampler, LTXVLoopingSampler, LTXVTiledSampler, LTXAddVideoICLoRAGuide, LTXVGemmaEnhancePrompt, LTXVSpatioTemporalTiledVAEDecode.',
      risk: 'LTX-2 itself runs on ComfyUI\'s own nodes; the pack is needed only for the graphs that use its nodes. Some of its nodes download models on first use.',
    },
    'ComfyUI-Frame-Interpolation': {
      what: 'Frame interpolation with many models: RIFE, FILM, AMT, GMFSS and others.',
      nodes: 'RIFE VFI, FILM VFI, AMT VFI and one node per model; Make Interpolation State List to skip frames.',
      risk: 'Downloads its models itself on first use; several are .pth files.',
    },
    'ComfyUI-SeedVR2_VideoUpscaler': {
      what: 'Video and image upscaling and restoration with SeedVR2, with block swapping, tiled VAE and GGUF for modest cards.',
      nodes: 'SeedVR2 (Down)Load DiT Model, SeedVR2 (Down)Load VAE Model, SeedVR2 Video Upscaler, SeedVR2 Torch Compile Settings.',
      risk: 'Downloads its models itself into models/SEEDVR2 on first use.',
    },
    ComfyUI_ProPainter_Nodes: {
      what: 'Video inpainting and outpainting with ProPainter: removing objects and widening frames, filled from neighbouring frames.',
      nodes: 'ProPainter Inpainting, ProPainter Outpainting.',
      risk: 'Downloads its models itself on first use. Needs one mask per frame.',
    },
    comfyui_cotracker_node: {
      what: 'Point tracking with CoTracker: the paths of points through a video, for motion-guided generation and effects.',
      nodes: 'CoTracker, with utility nodes for the tracks and a Perlin noise generator.',
    },
    'ComfyUI-WanAnimatePreprocess': {
      what: 'Preparation of a driving video for Wan 2.2 Animate: the pose of the body and the crop of the face in every frame.',
      nodes: 'ONNX Detection Model Loader, Pose and Face Detection, Draw ViT Pose.',
      risk: 'ViTPose and YOLO files go in models/detection.',
    },
    'ComfyUI-KJNodes': {
      what: 'A large toolbox by kijai that many video graphs lean on: resizing, batches of frames, masks, colour matching, and the wireless Set and Get nodes.',
      nodes: 'Resize Image v2, Get Image or Mask Range From Batch, Image Batch Multi, Get Image Size & Count, Color Match, Set, Get, Points Editor, VRAM Debug.',
    },
  },
  fields: {
    ModelSamplingSD3: {
      shift: 'How much of the sampling goes to the early, noisy steps where composition and motion are laid out. Wan 2.2: 8 (5 with some speed-up LoRAs); HunyuanVideo 1.5: 7; Kandinsky 5: 5. Too small a value gives sluggish motion and a weaker composition.',
    },
    CreateVideo: {
      fps: 'Frames per second of the clip. Take the model\'s own: 16 for Wan 14B, 24 for Wan 2.2 5B, LTX-2, HunyuanVideo 1.5 and Kandinsky 5, 25 for HuMo and InfiniteTalk. After interpolation: the old rate times the multiplier.',
    },
    SaveVideo: {
      filename_prefix: 'The start of the file name; may hold a subfolder of output, such as video/ComfyUI.',
      format: 'The container: auto or mp4.',
      codec: 'The codec: auto or h264.',
    },
    EmptyHunyuanLatentVideo: {
      length: 'The number of frames, of the form 4n + 1 (49, 81, 121). 81 frames at 16 fps make five seconds with Wan 14B.',
    },
    WanImageToVideo: {
      length: 'The number of frames, of the form 4n + 1. 81 at 16 fps is five seconds.',
    },
    Wan22ImageToVideoLatent: {
      width: 'A multiple of 32. The model was trained at 1280 × 704 (and 704 × 1280).',
      length: 'The number of frames, of the form 4n + 1. 121 at 24 fps is five seconds.',
    },
    WanFirstLastFrameToVideo: {
      length: 'The number of frames between and including the first and the last image, of the form 4n + 1. 81 in the template.',
    },
    WanHuMoImageToVideo: {
      length: 'The number of frames; 97 at 25 fps is about four seconds. The sound beyond it is not spoken.',
    },
    UNETLoader: {
      weight_dtype: 'How the weights are held in memory. default keeps the file\'s own format; fp8_e4m3fn halves the memory of an fp16 model at a small cost in quality.',
    },
    VAEDecodeTiled: {
      tile_size: 'The side of a square tile in pixels. Smaller saves memory and takes longer; 512 is a safe start, 256 for very small cards.',
      overlap: 'How much the tiles overlap, so no seams show.',
      temporal_size: 'For video: how many frames are decoded at a time. 32 or 64 is usual; lower saves memory.',
      temporal_overlap: 'For video: how many frames neighbouring pieces share.',
    },
    LTXVConditioning: {
      frame_rate: 'The frame rate the clip is drawn for: 24 in the LTX-2.5 templates, 25 in some LTX-2.0 ones. The same number goes into the empty sound latent and Create Video.',
    },
    EmptyLTXVLatentVideo: {
      length: 'The number of frames, of the form 8n + 1 (97, 121). Width and height are multiples of 32.',
    },
    LTXVDualCFGGuider: {
      video_cfg: 'How strongly the prompt steers the picture. 1 for the distilled models; the full models take more.',
      audio_cfg: 'How strongly the prompt steers the sound. 1 for the distilled models.',
    },
    ManualSigmas: {
      sigmas: 'The noise levels, one per step, from high to 0, separated by commas. Copy them from the official template of the model.',
    },
    FrameInterpolate: {
      multiplier: 'How many times more frames: 2 puts one new frame between each two, 4 puts three.',
    },
    SeedVR2LoadDiTModel: {
      blocks_to_swap: 'How many transformer blocks are kept in system memory and brought in when needed: up to 32 for the 3B model, 36 for the 7B. More saves graphics memory and is slower; 0 turns it off.',
    },
    SeedVR2VideoUpscaler: {
      resolution: 'The length of the shorter side of the result, in pixels: 1080 for Full HD.',
      batch_size: 'How many frames are redrawn together, of the form 4n + 1 (5, 21, 33). More keeps the motion consistent and needs more memory.',
      color_correction: 'How the colours are brought back to the original: lab is the recommended default, wavelet keeps fine detail.',
    },
    VHS_LoadVideo: {
      force_rate: 'Take frames as if the video had this frame rate; 0 keeps its own.',
      skip_first_frames: 'How many frames to skip at the start, counted at the forced rate.',
      frame_load_cap: 'At most this many frames; 0 takes all.',
      select_every_nth: 'Take every nth frame: 2 halves the frames.',
      custom_width: 'Resize the frames on loading; 0 keeps the size, one side alone keeps the proportions.',
    },
    VHS_VideoCombine: {
      frame_rate: 'Frames per second of the saved video; the same as the rate the frames were loaded or drawn at.',
      format: 'The file type: video/h264-mp4 for an ordinary mp4, video/webm, image/gif, and more.',
      save_output: 'On: the file goes to the output folder; off: to the temporary folder only.',
    },
    KSamplerAdvanced: {
      noise_seed: 'The seed of the starting noise. The same seed with the same settings gives the same result; parts of a longer video made with one seed change less at the seams.',
    },
    WanVaceToVideo: {
      strength: 'How firmly the reference image and the control video hold: 1 as in the templates; lower lets the prompt change more.',
    },
    TrimVideoLatent: {
      trim_amount: 'How many latent frames to cut off the start. Connect the trim_latent output of WanVaceToVideo, which knows how many the reference added.',
    },
    ImageFromBatch: {
      batch_index: 'The first frame to take, counted from 0; -1 is the last frame, the anchor for the next part of a longer video.',
      length: 'How many frames to take from there.',
    },
    ProPainterInpaint: {
      mask_dilates: 'How many pixels the mask is widened, so the edge of the object does not stay behind. 5 by default.',
      subvideo_length: 'How many frames are worked on at a time; lower saves memory.',
    },
  },
  concepts: {
    'anchor-picture': {
      term: 'Anchor picture',
      text: 'A picture that holds a video to a look: the start image (the first frame), the first and last frames, or a reference image read at every frame. It fixes what it shows; what it does not show the model invents.',
    },
    'identity-drift': {
      term: 'Identity drift',
      text: 'A face or a character slowly changing through a video, as the model draws more from its own idea of a person the further the clip moves from its anchor. It grows with length and with large motion; shorter clips, a reference input, a character LoRA and parts joined on key frames hold it back.',
    },
    'reference-input': {
      term: 'Reference input',
      text: 'An input that a video model reads at every frame to keep a subject the same, such as reference_image of WanVaceToVideo or ref_image of WanHuMoImageToVideo. Unlike a start image it is not the first frame and does not fix the pose or the place.',
    },
  },
};
