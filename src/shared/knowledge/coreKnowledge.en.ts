/**
 * Built-in teaching knowledge, English. The Russian pack (coreKnowledge.ru.ts) says the same things; coreKnowledge.ts
 * picks the pack of the person's language.
 *
 * A newcomer reads these in node cards and explanations, one text at a time, so each text explains its own terms:
 * latent (the compressed form of a picture), conditioning (the encoded description the sampler follows),
 * inpainting (redrawing part of a picture under a mask) and so on, or uses a plain word instead.
 */
import type { CoreLanguagePack } from './coreKnowledge';

export const CORE_KNOWLEDGE_EN: CoreLanguagePack = {
  nodes: {
    CheckpointLoaderSimple: {
      what: 'Loads a checkpoint file from models/checkpoints: one file that holds the diffusion model (the part that draws), its text encoder (CLIP, the part that reads the description) and its VAE (the part that turns the result into pixels).',
      why: 'The usual first node of an SD 1.5 or SDXL graph: one loader gives you everything a basic text-to-image graph needs.',
      connect: 'No inputs except the file choice (ckpt_name). Three outputs: MODEL goes to LoRA loaders or the sampler, CLIP to the text nodes, VAE to VAE Decode and VAE Encode.',
      risk: 'Newer families (Flux, Qwen-Image, Wan) often come as separate files. Such a file goes into Load Diffusion Model (UNETLoader), with separate loaders for the text encoder and the VAE, not into this node.',
    },
    UNETLoader: {
      what: 'Load Diffusion Model: loads only the diffusion model, the part that draws (a UNet or a transformer), from models/diffusion_models, without a text encoder or a VAE.',
      why: 'Used for families that come as separate files, such as Flux, Qwen-Image, Wan or HunyuanVideo; the text encoders and the VAE come from their own loaders.',
      connect: 'Inputs: the file (unet_name) and the number precision of the weights (weight_dtype; default is fine in most cases). Output: MODEL, which goes to LoRA loaders, nodes that tune the model (such as ModelSamplingFlux) or the sampler.',
      risk: 'The model alone cannot run: it still needs the matching text encoder(s) and VAE of the same family.',
    },
    CLIPLoader: {
      what: 'Load CLIP: loads one text-encoder file (the part that reads the description) from models/text_encoders (or models/clip) and sets which model type it serves.',
      why: 'Used when the diffusion model comes without its text encoder, for families that need a single encoder, such as Wan (umt5) or Qwen-Image (Qwen2.5-VL).',
      connect: 'Inputs: the file (clip_name) and the type (for example sd3, wan, qwen_image). Output: CLIP, which goes to CLIP Text Encode and LoRA loaders.',
      risk: 'The type must match the model family; a wrong type or an encoder from another family gives errors or meaningless images.',
    },
    DualCLIPLoader: {
      what: 'Loads two text-encoder files at once and combines them into one CLIP, for models that read the description with two encoders.',
      why: 'Flux.1 uses it with clip_l and t5xxl; SDXL and HunyuanVideo can use it as well when their encoders are stored separately.',
      connect: 'Inputs: clip_name1, clip_name2 and the type (for example flux, sdxl, hunyuan_video). Output: CLIP, which goes to the text nodes such as CLIP Text Encode.',
      risk: 'Both files and the type must belong to the same family as the diffusion model.',
    },
    VAELoader: {
      what: 'Loads a VAE file from models/vae. A VAE converts a picture in pixels (IMAGE) into the compressed form the model works in (LATENT) and back.',
      why: 'Needed when the model comes without a VAE (Flux, Qwen-Image, Wan), or to replace the VAE built into a checkpoint.',
      connect: 'Input: the file (vae_name). Output: VAE, which goes to VAE Decode, VAE Encode and the nodes that redraw part of a picture (inpainting).',
      risk: 'Each family has its own VAE; a VAE from another family gives broken colours, noise or an error.',
    },
    LoraLoader: {
      what: 'Load LoRA: applies a LoRA file (a small add-on trained on top of a base model) to both the model and the text encoder.',
      why: 'Adds a style, character or concept without changing the base model; several LoRA loaders can be chained.',
      connect: 'Inputs: MODEL and CLIP (from the loader or a previous LoRA), the file, strength_model and strength_clip. Outputs: the changed MODEL and CLIP; further on they take the place of the original ones.',
      risk: 'A LoRA works only with the base family it was trained for (an SDXL LoRA on an SD 1.5 model does not work). Too high a strength distorts the image.',
    },
    LoraLoaderModelOnly: {
      what: 'Applies a LoRA to the diffusion model only, without touching the text encoder.',
      why: 'Used when the LoRA has no text-encoder part or the graph has no CLIP to change, as is common with Flux, Qwen-Image and Wan LoRAs.',
      connect: 'Inputs: MODEL, the LoRA file and strength_model. Output: the changed MODEL, which goes to the sampler or the next LoRA.',
      risk: 'The LoRA must match the base family of the model.',
    },
    CLIPTextEncode: {
      what: 'CLIP Text Encode (Prompt): turns your text description (the prompt) into conditioning, that is, an encoded description the sampler can follow.',
      why: 'Every description in a graph goes through it: usually one node for what you want (positive) and one for what you do not want (negative).',
      connect: 'Inputs: CLIP (from a loader or a LoRA) and the text. Output: CONDITIONING, which goes to the positive or negative input of the sampler, or to nodes that change the encoded description.',
      risk: 'Swapping the links to positive and negative makes the sampler avoid what you asked for.',
    },
    CLIPSetLastLayer: {
      what: 'CLIP Set Last Layer: makes the text encoder stop at an earlier layer, which is called "CLIP skip".',
      why: 'Some SD 1.5 models, especially anime ones, are trained to be used with clip skip 2 (stop_at_clip_layer = -2).',
      connect: 'Inputs: CLIP and stop_at_clip_layer. Output: CLIP, which goes to the text nodes.',
      risk: 'Use it only when the model card asks for it; with -1 it changes nothing.',
    },
    EmptyLatentImage: {
      what: 'Creates an empty latent image, the compressed blank the model draws on, of the given width and height; batch_size sets how many pictures are made at once. This is the blank sheet the sampler starts from.',
      why: 'The starting point of text-to-image with SD 1.5 and SDXL; width and height set the size of the result.',
      connect: 'Inputs: width, height, batch_size. Output: LATENT, which goes to the latent_image input of the sampler.',
      risk: 'Sizes far from the size the model was trained at (512 for SD 1.5, about 1024 for SDXL) often give repeated or broken compositions.',
    },
    EmptySD3LatentImage: {
      what: 'Creates an empty latent (the compressed blank the model draws on) in the 16-channel format used by SD3 and Flux-style models.',
      why: 'The starting blank for text-to-image with SD3, Flux.1 and other models that use a 16-channel latent.',
      connect: 'Inputs: width, height, batch_size. Output: LATENT, which goes to the sampler.',
      risk: 'ComfyUI fits an empty latent to the channels of the model it meets, so Empty Latent Image also runs with Flux; still, use the empty-latent node of the family\'s official template, since it gives the size and format the model was made for.',
    },
    KSampler: {
      what: 'The main sampler: starting from a latent (the compressed form of a picture), it removes noise step by step, guided by the model and by the positive and negative conditioning (the encoded descriptions).',
      why: 'This is where the image is actually made; seed, steps, cfg, sampler and scheduler control the result.',
      connect: 'Inputs: MODEL, positive and negative CONDITIONING, a LATENT (empty for text-to-image, an encoded picture for image-to-image) and the settings. Output: LATENT, which goes to VAE Decode.',
      risk: 'With denoise below 1.0 on an empty latent you get a muddy, grey, unfinished picture: lower denoise is for image-to-image. CFG that is too high burns the image; Flux usually wants cfg 1.0.',
    },
    KSamplerAdvanced: {
      what: 'A KSampler with control over the step range: it can start and end at chosen steps and decide whether to add noise.',
      why: 'Used to split one generation across several samplers or models, for example a base model and a refiner, or the two Wan 2.2 experts.',
      connect: 'The same inputs as KSampler plus add_noise, start_at_step, end_at_step and return_with_leftover_noise. Output: LATENT, which goes to the next sampler or to VAE Decode.',
      risk: 'The step ranges of the chained samplers must line up, and the first one must return leftover noise for the second to continue.',
    },
    SamplerCustom: {
      what: 'A sampler assembled from separate parts: the sampling algorithm (SAMPLER) and the noise schedule (SIGMAS, how much noise is left at each step) come from other nodes.',
      why: 'Gives finer control than KSampler, for example a special schedule or an algorithm with its own settings.',
      connect: 'Inputs: MODEL, positive and negative CONDITIONING (the encoded descriptions), SAMPLER (from KSamplerSelect), SIGMAS (from a scheduler such as BasicScheduler), LATENT, the noise seed and cfg. Two LATENT outputs: output and denoised_output.',
    },
    BasicScheduler: {
      what: 'Computes the noise schedule (SIGMAS) for a model: how much noise remains before and after each step.',
      why: 'Feeds assembled samplers (SamplerCustom, SamplerCustomAdvanced) with a schedule of the chosen type, number of steps and denoise.',
      connect: 'Inputs: MODEL, scheduler, steps, denoise. Output: SIGMAS, which goes to the sigmas input of the sampler.',
    },
    KSamplerSelect: {
      what: 'Picks a sampling algorithm (euler, dpmpp_2m and others) and gives it out as a SAMPLER.',
      why: 'Assembled samplers take the algorithm as an input instead of a setting; this node provides it.',
      connect: 'Input: sampler_name. Output: SAMPLER, which goes to SamplerCustom or SamplerCustomAdvanced.',
    },
    VAEDecode: {
      what: 'VAE Decode: turns the latent made by the sampler (the compressed form of the picture) into a normal image in pixels.',
      why: 'Without it there is nothing to see or save: the sampler works only with the compressed form.',
      connect: 'Inputs: samples (LATENT) and VAE. Output: IMAGE, which goes to Save Image, Preview Image or other image nodes.',
      risk: 'The VAE must match the model family, otherwise colours or details come out wrong.',
    },
    VAEEncode: {
      what: 'VAE Encode: turns a picture into a latent, the compressed form the sampler can work on.',
      why: 'The basis of image-to-image: load a picture, encode it, then run the sampler with denoise below 1.0.',
      connect: 'Inputs: pixels (IMAGE) and VAE. Output: LATENT, which goes to the latent_image input of the sampler.',
    },
    VAEEncodeForInpaint: {
      what: 'Encodes a picture for inpainting, that is, for redrawing the part of it under a mask: the masked area is cleared so the sampler fills it in.',
      why: 'Used with inpainting models (models trained to redraw part of a picture) to redraw only that part.',
      connect: 'Inputs: pixels (IMAGE), VAE, MASK and grow_mask_by. Output: LATENT with the mask, which goes to the sampler.',
      risk: 'It erases the masked area, so it needs denoise 1.0; for a gentle change of an area use SetLatentNoiseMask or InpaintModelConditioning instead.',
    },
    SaveImage: {
      what: 'Saves images to the ComfyUI output folder and shows them on the node.',
      why: 'The usual last node of a graph. It is an output node: ComfyUI runs only the branches that lead to such nodes.',
      connect: 'Inputs: images (IMAGE) and filename_prefix. No outputs.',
    },
    PreviewImage: {
      what: 'Shows images on the node without saving them to the output folder (they go to a temporary folder).',
      why: 'For checking intermediate results or trying settings before saving.',
      connect: 'Input: images (IMAGE). No outputs.',
    },
    LoadImage: {
      what: 'Loads a picture from the ComfyUI input folder (or one you upload) into the graph.',
      why: 'The source picture for image-to-image, inpainting (redrawing part of a picture), ControlNet or upscaling.',
      connect: 'Input: the image file. Outputs: IMAGE and MASK (taken from the transparent areas of the picture, or painted in the mask editor).',
    },
    ImageScale: {
      what: 'Upscale Image: resizes a picture to an exact width and height with a simple method such as bilinear or lanczos, and can crop it.',
      why: 'To fit a picture to the size a model or another node expects.',
      connect: 'Inputs: IMAGE, upscale_method, width, height, crop. Output: IMAGE.',
      risk: 'A width or height of 0 keeps the proportions from the other side; with crop disabled, different proportions stretch the picture.',
    },
    ImageScaleBy: {
      what: 'Upscale Image By: resizes a picture by a factor (for example 1.5 or 2) with a simple method, without a neural network.',
      why: 'A quick size change; for real added detail use an upscale model or a second sampler pass.',
      connect: 'Inputs: IMAGE, upscale_method, scale_by. Output: IMAGE.',
    },
    UpscaleModelLoader: {
      what: 'Loads an upscale model (such as ESRGAN or similar), a neural network that enlarges pictures, from models/upscale_models.',
      why: 'The first half of upscaling with a model; the model itself is applied by Upscale Image (using Model).',
      connect: 'Input: model_name. Output: UPSCALE_MODEL, which goes to ImageUpscaleWithModel.',
    },
    ImageUpscaleWithModel: {
      what: 'Upscale Image (using Model): enlarges a picture with an upscale model, which adds detail instead of just stretching pixels.',
      why: 'For sharper large pictures; often followed by a resize to the final size or a second sampler pass.',
      connect: 'Inputs: upscale_model (UPSCALE_MODEL) and image (IMAGE). Output: IMAGE.',
      risk: 'The scale is fixed by the model (often 4x); large pictures need a lot of memory.',
    },
    ControlNetLoader: {
      what: 'Loads a ControlNet model from models/controlnet: a model that steers the drawing with a control picture such as edges, depth or a pose.',
      why: 'The first step to make the result follow the shapes of a sample picture.',
      connect: 'Input: control_net_name. Output: CONTROL_NET, which goes to Apply ControlNet.',
      risk: 'A ControlNet is trained for one base family; an SD 1.5 ControlNet does not work with SDXL or Flux.',
    },
    ControlNetApplyAdvanced: {
      what: 'Apply ControlNet: adds the ControlNet hint, taken from a control picture, to the positive and negative conditioning (the encoded descriptions).',
      why: 'Makes the sampler follow the edges, depth or pose of the control picture, with a strength and a start and end point.',
      connect: 'Inputs: positive and negative CONDITIONING, CONTROL_NET, image (IMAGE, usually already prepared), an optional VAE, strength, start_percent, end_percent. Outputs: positive and negative CONDITIONING, which go to the sampler.',
      risk: 'The control picture usually has to be prepared first (for example turned into canny edges or a depth map) to match the ControlNet type.',
    },
    ConditioningCombine: {
      what: 'Combines two conditionings (encoded descriptions) so the sampler takes both into account; their effects are mixed.',
      why: 'To merge two descriptions, often together with area or mask settings for different parts of the picture.',
      connect: 'Inputs: conditioning_1 and conditioning_2 (CONDITIONING). Output: CONDITIONING.',
    },
    ConditioningConcat: {
      what: 'Joins two conditionings (encoded descriptions) into one longer description: conditioning_from is appended to conditioning_to.',
      why: 'Another way to join descriptions; it behaves differently from Conditioning (Combine) and can keep ideas more separate.',
      connect: 'Inputs: conditioning_to and conditioning_from (CONDITIONING). Output: CONDITIONING.',
    },
    ConditioningSetArea: {
      what: 'Limits a conditioning (an encoded description) to a rectangular area of the picture, given in pixels, with a strength.',
      why: 'To place different descriptions in different parts of the picture; usually combined with other descriptions afterwards.',
      connect: 'Inputs: CONDITIONING, width, height, x, y, strength. Output: CONDITIONING, usually to Conditioning (Combine).',
    },
    LatentUpscale: {
      what: 'Upscale Latent: resizes a latent (the compressed form of a picture) to a given width and height.',
      why: 'For the "hires fix" method: draw small, enlarge the latent, then run the sampler again with partial denoise to add detail.',
      connect: 'Inputs: samples (LATENT), upscale_method, width, height, crop. Output: LATENT, which goes to the second sampler.',
      risk: 'An enlarged latent must go through the sampler again (denoise around 0.4 to 0.6); decoding it directly looks blurry or broken.',
    },
    LatentUpscaleBy: {
      what: 'Upscale Latent By: resizes a latent (the compressed form of a picture) by a factor.',
      why: 'Same purpose as Upscale Latent (a second sampler pass at a larger size), set by a factor instead of exact sizes.',
      connect: 'Inputs: samples (LATENT), upscale_method, scale_by. Output: LATENT.',
    },
    SetLatentNoiseMask: {
      what: 'Attaches a mask to a latent (the compressed form of a picture) so the sampler changes only the masked area and keeps the rest.',
      why: 'Inpainting, that is redrawing part of a picture, with an ordinary model: encode the picture, set the mask, run the sampler with partial denoise.',
      connect: 'Inputs: samples (LATENT) and MASK. Output: LATENT with the noise mask, which goes to the sampler.',
    },
    InpaintModelConditioning: {
      what: 'Prepares the encoded descriptions and a latent for inpainting (redrawing part of a picture): it encodes the picture and the mask and attaches them to the descriptions.',
      why: 'Used with inpainting models (and with Flux Fill); the redrawn area blends in better than with a plain mask.',
      connect: 'Inputs: positive and negative CONDITIONING, VAE, pixels (IMAGE), MASK. Outputs: positive, negative (CONDITIONING) and latent (LATENT); all three go to the sampler.',
    },
    CLIPVisionLoader: {
      what: 'Loads a CLIP Vision model from models/clip_vision: an image encoder that describes a picture as numbers.',
      why: 'Needed when a picture serves as a hint: unCLIP, style models, IP-Adapter and some image-to-video models (for example Wan 2.1 image-to-video).',
      connect: 'Input: clip_name. Output: CLIP_VISION, which goes to CLIP Vision Encode.',
    },
    CLIPVisionEncode: {
      what: 'Encodes a picture with a CLIP Vision model.',
      why: 'Turns a sample picture into numbers that style, unCLIP or image-to-video nodes use as a hint.',
      connect: 'Inputs: clip_vision (CLIP_VISION), image (IMAGE), crop. Output: CLIP_VISION_OUTPUT.',
    },
    ModelSamplingFlux: {
      what: 'Sets the sampling shift of a Flux model according to the picture size (max_shift, base_shift, width, height).',
      why: 'Used in Flux graphs, especially with Flux dev, to tune how much noise is left at each step for a given size.',
      connect: 'Inputs: MODEL, the shift values and the picture size. Output: MODEL, which goes to the sampler or to a guider (the part that decides how closely the model follows the description).',
      risk: 'Width and height should match the latent you generate.',
    },
    FluxGuidance: {
      what: 'Sets the guidance value: a number that tells Flux models how closely to follow the description. Flux reads it from the conditioning (the encoded description); it is also called "distilled CFG".',
      why: 'Flux dev uses this number instead of a high CFG; around 3.5 is a common starting value.',
      connect: 'Inputs: CONDITIONING and guidance. Output: CONDITIONING, which goes to the positive input of the sampler.',
      risk: 'Keep the sampler cfg at 1.0 with Flux dev; raising both makes the image harsh and slow.',
    },
    Note: {
      what: 'A plain text note on the canvas. It does nothing when the graph runs.',
      why: 'To leave instructions or reminders inside a workflow.',
      connect: 'No inputs or outputs.',
    },
    MarkdownNote: {
      what: 'A note on the canvas with simple formatting in Markdown (headings, lists, links). It does nothing when the graph runs.',
      why: 'For longer instructions, such as which model files a template needs and where to put them.',
      connect: 'No inputs or outputs.',
    },
    Reroute: {
      what: 'A reroute point: passes one link through unchanged so long links can be routed neatly.',
      why: 'Makes the graph tidier or lets one output be pulled to several distant places.',
      connect: 'One input and one output of the same type; it takes the type of what is connected to it.',
    },
    PrimitiveNode: {
      what: 'Primitive: a node that exists only in the ComfyUI editor. It holds a value (number, text, choice) and feeds it to a field of other nodes that was turned into an input.',
      why: 'To share one value, such as a seed or a size, between several nodes, or to control it in one place.',
      connect: 'No inputs; its output takes the type of the field it is connected to (INT, FLOAT, STRING, COMBO).',
      risk: 'It exists only in the editor: in the file ComfyUI actually runs (the API format) its value is written straight into the connected nodes.',
    },
  },
  linkTypes: {
    MODEL: {
      what: 'MODEL: the diffusion model itself (a UNet or a transformer), the part that removes noise and draws.',
      why: 'Every sampler needs one; LoRAs and nodes that tune the model change it on the way.',
      connect: 'Comes from Load Checkpoint, Load Diffusion Model, LoRA nodes or nodes that tune the model; goes to samplers, schedulers, LoRA loaders and model-sampling nodes.',
    },
    CLIP: {
      what: 'CLIP: the text encoder, the part of the model that reads your description.',
      why: 'With it the descriptions are turned into conditioning, the encoded form the sampler follows.',
      connect: 'Comes from Load Checkpoint, Load CLIP, DualCLIPLoader or Load LoRA; goes to CLIP Text Encode and other text nodes.',
    },
    VAE: {
      what: 'VAE: the model that turns pixels into the compressed form the model works in (the latent) and back.',
      why: 'Needed to see the result (decode) or to start from a picture (encode).',
      connect: 'Comes from Load Checkpoint or Load VAE; goes to VAE Decode, VAE Encode and the nodes that redraw part of a picture (inpainting).',
    },
    CONDITIONING: {
      what: 'CONDITIONING: an encoded description (and any extra hints attached to it, such as ControlNet) that steers the sampler.',
      why: 'The positive and negative inputs of a sampler take it.',
      connect: 'Comes from the text nodes and is changed by ControlNet, area, combine and guidance nodes; goes to the positive or negative input of the sampler.',
    },
    LATENT: {
      what: 'LATENT: a picture or a video in compressed form, the form the model works in. Image models usually make it 8 times smaller on each side; video models compress more and in time too (Wan 2.1 and the 14B Wan 2.2: 8 × 8 pixels and 4 frames per cell; Wan 2.2 5B and HunyuanVideo 1.5: 16 × 16 and 4; LTX: 32 × 32 and 8).',
      why: 'Samplers read and write latents; the picture becomes visible only after VAE Decode.',
      connect: 'Comes from an empty latent node, VAE Encode or a sampler; goes to samplers, latent upscale nodes or VAE Decode.',
    },
    IMAGE: {
      what: 'IMAGE: a batch of ordinary pictures in pixels (red, green and blue).',
      why: 'What you save, preview, load, resize or use as a control picture.',
      connect: 'Comes from Load Image, VAE Decode or image nodes; goes to Save Image, Preview Image, VAE Encode, upscalers and ControlNet.',
    },
    MASK: {
      what: 'MASK: a black-and-white map that marks which area to change.',
      why: 'Used for inpainting (redrawing part of a picture) and to limit an effect to part of the picture.',
      connect: 'Comes from Load Image (transparent areas or the mask editor) or mask nodes; goes to SetLatentNoiseMask, VAE Encode (for Inpainting) and InpaintModelConditioning.',
    },
    CONTROL_NET: {
      what: 'CONTROL_NET: a loaded ControlNet model.',
      why: 'Steers the shapes of the result with a control picture.',
      connect: 'Comes from Load ControlNet Model; goes to Apply ControlNet.',
    },
    UPSCALE_MODEL: {
      what: 'UPSCALE_MODEL: a loaded upscale model (ESRGAN-style), a neural network that enlarges pictures.',
      why: 'Enlarges pictures with added detail.',
      connect: 'Comes from Load Upscale Model; goes to Upscale Image (using Model).',
    },
    CLIP_VISION: {
      what: 'CLIP_VISION: a loaded image encoder model.',
      why: 'Used to describe a sample picture for style, unCLIP or image-to-video hints.',
      connect: 'Comes from Load CLIP Vision; goes to CLIP Vision Encode and some image-to-video nodes.',
    },
    CLIP_VISION_OUTPUT: {
      what: 'CLIP_VISION_OUTPUT: one picture encoded as numbers by a CLIP Vision model.',
      why: 'Carries what a sample picture looks like to the nodes that use it as a hint.',
      connect: 'Comes from CLIP Vision Encode; goes to style, unCLIP and image-to-video nodes.',
    },
    SIGMAS: {
      what: 'SIGMAS: the noise schedule, a list of noise levels before and after each sampler step.',
      why: 'Assembled samplers take the schedule as an input instead of a steps setting.',
      connect: 'Comes from scheduler nodes such as BasicScheduler; goes to SamplerCustom or SamplerCustomAdvanced.',
    },
    SAMPLER: {
      what: 'SAMPLER: a sampling algorithm (for example euler or dpmpp_2m) passed as a value.',
      why: 'Assembled samplers take the algorithm as an input.',
      connect: 'Comes from KSamplerSelect or other sampler nodes; goes to SamplerCustom or SamplerCustomAdvanced.',
    },
    GUIDER: {
      what: 'GUIDER: the part that decides how closely the model follows the description: it combines the model and the encoded descriptions into one prediction of the noise (CFG and similar).',
      why: 'SamplerCustomAdvanced takes this part separately, so special guiders can be used.',
      connect: 'Comes from guider nodes such as BasicGuider or CFGGuider; goes to SamplerCustomAdvanced.',
    },
    NOISE: {
      what: 'NOISE: a source of starting noise (with its seed), not the noise itself.',
      why: 'SamplerCustomAdvanced takes the noise as a separate input.',
      connect: 'Comes from noise nodes such as RandomNoise; goes to SamplerCustomAdvanced.',
    },
    INT: {
      what: 'INT: a whole number, such as a seed, steps or a size.',
      why: 'Usually set in a field on the node; it becomes a link when one value is shared or computed.',
      connect: 'Comes from Primitive or math nodes; goes to any INT field that was turned into an input.',
    },
    FLOAT: {
      what: 'FLOAT: a decimal number, such as cfg, denoise or a strength.',
      why: 'Usually a field value; a link lets one value drive several nodes.',
      connect: 'Comes from Primitive or math nodes; goes to any FLOAT field that was turned into an input.',
    },
    STRING: {
      what: 'STRING: text, such as a description or a file name prefix.',
      why: 'A link lets one text feed several nodes or come from a text-processing node.',
      connect: 'Comes from Primitive or text nodes; goes to text inputs such as the text of CLIP Text Encode.',
    },
    BOOLEAN: {
      what: 'BOOLEAN: a yes/no switch.',
      why: 'Turns an option of a node on or off.',
      connect: 'Comes from Primitive or logic nodes; goes to BOOLEAN fields that were turned into inputs.',
    },
    COMBO: {
      what: 'COMBO: a choice from a list, such as a model file name, a sampler or a scheduler.',
      why: 'Most loader and sampler settings are such lists; the list often comes from the files ComfyUI finds.',
      connect: 'Usually a drop-down field; a Primitive connected to it can share the choice with other nodes.',
    },
  },
  families: {
    sd15: {
      what: 'Stable Diffusion 1.5: the classic image model for 512 pixels. Usually a single checkpoint loaded with Load Checkpoint, which gives MODEL, CLIP and VAE.',
      risk: 'LoRAs, ControlNets and embeddings must be made for SD 1.5; SDXL or Flux add-ons do not work with it.',
    },
    sdxl: {
      what: 'Stable Diffusion XL: an image model for about 1024 pixels with two text encoders. Usually a single checkpoint loaded with Load Checkpoint.',
      risk: 'Use SDXL LoRAs and ControlNets only. Pony and Illustrious are built on SDXL, but their LoRAs often work best within their own line.',
    },
    pony: {
      what: 'Pony Diffusion: a line of models trained further from SDXL, loaded like SDXL with Load Checkpoint; it relies on its own score and rating tags in the description.',
      risk: 'Technically SDXL, so SDXL LoRAs load, but LoRAs trained for Pony give the expected results; SD 1.5 or Flux LoRAs do not work.',
    },
    illustrious: {
      what: 'Illustrious XL: an anime-focused line of models trained further from SDXL, loaded like SDXL with Load Checkpoint.',
      risk: 'Technically SDXL, but LoRAs trained for Illustrious (or the models built on it) fit best; SD 1.5 or Flux LoRAs do not work.',
    },
    flux1: {
      what: 'Flux.1 (dev, schnell) by Black Forest Labs: the model loads with Load Diffusion Model, the text encoders clip_l and t5xxl with DualCLIPLoader (type flux), and the VAE ae.safetensors with Load VAE. FLUX.1 Krea [dev] is a Flux.1 dev model trained again by Krea and loads the same way.',
      risk: 'Only Flux.1 LoRAs work with it. Flux dev expects cfg 1.0 with FluxGuidance (its own strength number) instead of a high CFG.',
    },
    flux2: {
      what: 'Flux.2 by Black Forest Labs: the model loads with Load Diffusion Model, the text encoder with Load CLIP, and its own VAE (flux2-vae) with Load VAE. Flux.2 dev reads text with a Mistral-based encoder; Flux.2 Klein with qwen_3_4b (the 4B model) or qwen_3_8b (the 9B model).',
      risk: 'Flux.2 is not compatible with Flux.1 files: LoRAs, text encoders and the VAE must be the Flux.2 ones.',
    },
    chroma: {
      what: 'Chroma: an image model made from Flux.1 schnell; it uses a T5-XXL text encoder without clip_l, and the Flux VAE.',
      risk: 'Use LoRAs made for Chroma; Flux.1 LoRAs may load but often do not behave as expected.',
    },
    'qwen-image': {
      what: 'Qwen-Image by Alibaba Qwen: an image model that is good at text in pictures. The model loads with Load Diffusion Model, the Qwen2.5-VL text encoder with Load CLIP, and qwen_image_vae with Load VAE.',
      risk: 'Only Qwen-Image LoRAs and ControlNets work with it; the editing variants (Qwen-Image-Edit) use their own graphs.',
    },
    'wan2.1': {
      what: 'Wan 2.1 by Alibaba: a video model (text-to-video and image-to-video). The model loads with Load Diffusion Model, the umt5_xxl text encoder with Load CLIP, and wan_2.1_vae with Load VAE; image-to-video also uses clip_vision_h.',
      risk: 'Use LoRAs made for Wan 2.1 and for the same model size (1.3B and 14B are not interchangeable).',
    },
    'wan2.2': {
      what: 'Wan 2.2 by Alibaba: a family of video models. The 14B models come as two experts, high noise and low noise, run one after the other by two samplers (t2v for text, i2v for an image; also first-last frame, Fun Control, Fun Inpaint, S2V for speech and Animate for characters); they use umt5_xxl and wan_2.1_vae and draw 16 fps. The small TI2V 5B model takes text or an image with one sampler, uses wan2.2_vae and draws 24 fps.',
      risk: 'LoRAs made for Wan 2.1 14B often work with the 2.2 14B models (the speed-up LoRAs are used so); check the LoRA\'s page. 1.3B, 5B and 14B LoRAs are not interchangeable, and wan2.2_vae fits only the 5B model.',
    },
    ltx2: {
      what: 'LTX-2 by Lightricks (versions 2.0, 2.3 and 2.5): video models that draw picture and sound together. Text to video, image to video, first and last frame, and control by depth, pose or edges with IC-LoRAs. The templates work in two stages with a latent upscaler between them; the text encoder is Gemma. 2.0 and 2.3 load from one checkpoint; 2.5 comes as separate model, video VAE, audio VAE and text encoder files.',
      risk: 'Files of one version do not mix with another (the upscaler, the VAEs, the text encoder). Frames are of the form 8n + 1 and sides multiples of 32. LoRAs of the old LTX-Video 0.9 do not work.',
    },
    hunyuan: {
      what: 'HunyuanVideo by Tencent: a video model. The model loads with Load Diffusion Model, the text encoders clip_l and llava_llama3 with DualCLIPLoader (type hunyuan_video), and hunyuan_video_vae with Load VAE.',
      risk: 'Use LoRAs made for HunyuanVideo; HunyuanVideo 1.5 and the Hunyuan image models are separate families.',
    },
    zimage: {
      what: 'Z-Image (Turbo) by Alibaba Tongyi: a fast image model. The model loads with Load Diffusion Model, the qwen_3_4b text encoder with Load CLIP, and the Flux VAE ae.safetensors with Load VAE.',
      risk: 'Only Z-Image LoRAs work with it. The Turbo model is meant for few steps and a low CFG.',
    },
    krea: {
      what: 'Krea 2 by Krea AI: an image model trained from scratch, its own architecture. RAW is the base for training LoRAs (about 52 steps); Turbo is distilled to 8 steps. The model goes into models/diffusion_models, the text encoder qwen3vl_4b into text_encoders, and qwen_image_vae into vae.',
      risk: 'Not the same as FLUX.1 Krea [dev], which is a Flux.1 model: Flux LoRAs do not work with Krea 2. LoRAs trained on RAW also work on Turbo.',
    },
    sd3: {
      what: 'Stable Diffusion 3 / 3.5 by Stability AI: an image model with three text encoders (clip_l, clip_g, t5xxl) and a 16-channel latent (EmptySD3LatentImage).',
      risk: 'Only SD3 LoRAs and ControlNets work with it; SD3 Medium and SD3.5 Large are different sizes, so their add-ons do not mix.',
    },
    kolors: {
      what: 'Kolors by Kuaishou: an image model similar to SDXL that uses the ChatGLM text encoder, so it needs its own loader nodes.',
      risk: 'SDXL LoRAs and ControlNets are not reliably compatible; use add-ons made for Kolors.',
    },
    auraflow: {
      what: 'AuraFlow by fal: an open image model built on the flow method; it is usually distributed as a single checkpoint.',
      risk: 'Only add-ons made for AuraFlow work with it.',
    },
    cascade: {
      what: 'Stable Cascade by Stability AI: an image model that works in stages (stage C, then stage B), with its own latent format.',
      risk: 'Its stages and add-ons are not compatible with SD 1.5 or SDXL files.',
    },
  },
};
