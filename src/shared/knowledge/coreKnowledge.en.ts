import type { CoreLanguagePack } from './coreKnowledge';

/** Built-in teaching knowledge, English. The Russian pack (coreKnowledge.ru.ts) says the same things. */
export const CORE_KNOWLEDGE_EN: CoreLanguagePack = {
  nodes: {
    CheckpointLoaderSimple: {
      what: 'Loads a checkpoint file from models/checkpoints: one file that holds the diffusion model, its text encoder (CLIP) and its VAE together.',
      why: 'The usual first node of an SD 1.5 or SDXL graph: one loader gives you everything a basic text-to-image graph needs.',
      connect: 'No inputs except the file choice (ckpt_name). Outputs MODEL (to LoRA loaders or the sampler), CLIP (to the text encoders) and VAE (to VAE Decode / VAE Encode).',
      risk: 'Newer families (Flux, Qwen-Image, Wan) are often shipped as separate files; such a file goes into Load Diffusion Model (UNETLoader) with separate text-encoder and VAE loaders, not into this node.',
    },
    UNETLoader: {
      what: 'Load Diffusion Model: loads only the diffusion model (UNet or transformer) from models/diffusion_models, without a text encoder or VAE.',
      why: 'Used for families shipped as separate files, such as Flux, Qwen-Image, Wan or HunyuanVideo; the text encoders and the VAE come from their own loaders.',
      connect: 'Inputs: the file (unet_name) and the weight dtype. Output: MODEL, which goes to LoRA loaders, model-sampling nodes or the sampler.',
      risk: 'The model alone cannot run: it still needs the matching text encoder(s) and VAE of the same family.',
    },
    CLIPLoader: {
      what: 'Load CLIP: loads one text-encoder file from models/text_encoders (or models/clip) and sets which model type it serves.',
      why: 'Used when the diffusion model comes without its text encoder, for families that need a single encoder, such as Wan (umt5) or Qwen-Image (Qwen2.5-VL).',
      connect: 'Inputs: the file (clip_name) and the type (for example sd3, wan, qwen_image). Output: CLIP, which goes to CLIP Text Encode and LoRA loaders.',
      risk: 'The type must match the model family; a wrong type or an encoder from another family gives errors or meaningless images.',
    },
    DualCLIPLoader: {
      what: 'Loads two text-encoder files at once and combines them into one CLIP, for models that read the prompt with two encoders.',
      why: 'Flux.1 uses it with clip_l and t5xxl; SDXL and HunyuanVideo can use it as well when their encoders are stored separately.',
      connect: 'Inputs: clip_name1, clip_name2 and the type (for example flux, sdxl, hunyuan_video). Output: CLIP, to the text-encode nodes.',
      risk: 'Both files and the type must belong to the same family as the diffusion model.',
    },
    VAELoader: {
      what: 'Loads a VAE file from models/vae: the part that converts between pixels (IMAGE) and the latent space (LATENT).',
      why: 'Needed when the model comes without a VAE (Flux, Qwen-Image, Wan), or to replace the VAE baked into a checkpoint.',
      connect: 'Input: the file (vae_name). Output: VAE, to VAE Decode, VAE Encode and inpainting nodes.',
      risk: 'Each family has its own VAE; a VAE from another family gives broken colours, noise or an error.',
    },
    LoraLoader: {
      what: 'Load LoRA: applies a LoRA file (a small add-on trained on top of a base model) to both the model and the text encoder.',
      why: 'Adds a style, character or concept without changing the base model; several LoRA loaders can be chained.',
      connect: 'Inputs: MODEL and CLIP (from the loader or a previous LoRA), the file, strength_model and strength_clip. Outputs: the modified MODEL and CLIP, which replace the originals downstream.',
      risk: 'A LoRA works only with the base family it was trained for (an SDXL LoRA on an SD 1.5 model does not work). Too high a strength distorts the image.',
    },
    LoraLoaderModelOnly: {
      what: 'Applies a LoRA to the diffusion model only, without touching the text encoder.',
      why: 'Used when the LoRA has no text-encoder part or the graph has no CLIP to modify, as is common with Flux, Qwen-Image and Wan LoRAs.',
      connect: 'Inputs: MODEL, the LoRA file and strength_model. Output: the modified MODEL, to the sampler or the next LoRA.',
      risk: 'The LoRA must match the base family of the model.',
    },
    CLIPTextEncode: {
      what: 'CLIP Text Encode (Prompt): turns your text prompt into conditioning, the form of the prompt the sampler understands.',
      why: 'Every prompt in a graph goes through it: usually one node for the positive prompt and one for the negative prompt.',
      connect: 'Inputs: CLIP (from a loader or LoRA) and the text. Output: CONDITIONING, to the sampler positive or negative input or to conditioning nodes.',
      risk: 'Swapping the wires to positive and negative makes the sampler avoid what you asked for.',
    },
    CLIPSetLastLayer: {
      what: 'CLIP Set Last Layer: makes the text encoder stop at an earlier layer ("CLIP skip").',
      why: 'Some SD 1.5 models, especially anime ones, are trained to be used with clip skip 2 (stop_at_clip_layer = -2).',
      connect: 'Input: CLIP and stop_at_clip_layer. Output: CLIP, to the text-encode nodes.',
      risk: 'Use it only when the model card asks for it; with -1 it changes nothing.',
    },
    EmptyLatentImage: {
      what: 'Creates an empty latent image of the given width, height and batch size: the blank canvas the sampler starts from.',
      why: 'The starting point of text-to-image with SD 1.5 and SDXL; width and height set the size of the result.',
      connect: 'Inputs: width, height, batch_size. Output: LATENT, to the sampler latent_image input.',
      risk: 'Sizes far from the model training resolution (512 for SD 1.5, about 1024 for SDXL) often give repeated or broken compositions.',
    },
    EmptySD3LatentImage: {
      what: 'Creates an empty latent in the 16-channel format used by SD3 and Flux-style models.',
      why: 'The starting latent for text-to-image with SD3, Flux.1 and other models that use a 16-channel latent.',
      connect: 'Inputs: width, height, batch_size. Output: LATENT, to the sampler.',
      risk: 'The latent format must match the model; check the family template if you are unsure which empty-latent node it uses.',
    },
    KSampler: {
      what: 'The main sampler: starting from a latent, it removes noise step by step, guided by the model and the positive and negative conditioning.',
      why: 'This is where the image is actually generated; seed, steps, cfg, sampler and scheduler control the result.',
      connect: 'Inputs: MODEL, positive and negative CONDITIONING, a LATENT (empty for text-to-image, encoded for image-to-image) and settings. Output: LATENT, to VAE Decode.',
      risk: 'With denoise below 1.0 on an empty latent the result stays noisy; lower denoise is for image-to-image. CFG that is too high burns the image; Flux usually wants cfg 1.0.',
    },
    KSamplerAdvanced: {
      what: 'A KSampler with control over the step range: it can start and end at chosen steps and decide whether to add noise.',
      why: 'Used to split one generation across several samplers or models, for example base and refiner, or the two Wan 2.2 experts.',
      connect: 'Same inputs as KSampler plus add_noise, start_at_step, end_at_step and return_with_leftover_noise. Output: LATENT, to the next sampler or VAE Decode.',
      risk: 'The step ranges of the chained samplers must line up, and the first one must return leftover noise for the second to continue.',
    },
    SamplerCustom: {
      what: 'A sampler built from separate parts: the sampling algorithm (SAMPLER) and the noise schedule (SIGMAS) come from other nodes.',
      why: 'Gives finer control than KSampler, for example a special scheduler or a sampler with its own settings.',
      connect: 'Inputs: MODEL, positive and negative CONDITIONING, SAMPLER (from KSamplerSelect), SIGMAS (from a scheduler such as BasicScheduler), LATENT, noise seed and cfg. Outputs: LATENT (output) and LATENT (denoised_output).',
    },
    BasicScheduler: {
      what: 'Computes the noise schedule (SIGMAS) for a model: how much noise remains before and after each step.',
      why: 'Feeds custom samplers (SamplerCustom, SamplerCustomAdvanced) with a schedule of the chosen type, number of steps and denoise.',
      connect: 'Inputs: MODEL, scheduler, steps, denoise. Output: SIGMAS, to the sampler sigmas input.',
    },
    KSamplerSelect: {
      what: 'Picks a sampling algorithm (euler, dpmpp_2m and others) and outputs it as a SAMPLER.',
      why: 'Custom samplers take the algorithm as an input instead of a setting; this node provides it.',
      connect: 'Input: sampler_name. Output: SAMPLER, to SamplerCustom or SamplerCustomAdvanced.',
    },
    VAEDecode: {
      what: 'VAE Decode: turns the latent produced by the sampler into a normal image (pixels).',
      why: 'Without it there is nothing to see or save: the sampler works in latent space.',
      connect: 'Inputs: samples (LATENT) and VAE. Output: IMAGE, to Save Image, Preview Image or image nodes.',
      risk: 'The VAE must match the model family, otherwise colours or details come out wrong.',
    },
    VAEEncode: {
      what: 'VAE Encode: turns an image into a latent so the sampler can work on it.',
      why: 'The basis of image-to-image: load a picture, encode it, then sample it with denoise below 1.0.',
      connect: 'Inputs: pixels (IMAGE) and VAE. Output: LATENT, to the sampler latent_image input.',
    },
    VAEEncodeForInpaint: {
      what: 'Encodes an image for inpainting: the masked area is cleared so the sampler fills it in.',
      why: 'Used with inpainting models to redraw only part of a picture.',
      connect: 'Inputs: pixels (IMAGE), VAE, MASK and grow_mask_by. Output: LATENT with the mask, to the sampler.',
      risk: 'It erases the masked area, so it needs denoise 1.0; for a gentle change of an area use SetLatentNoiseMask or InpaintModelConditioning instead.',
    },
    SaveImage: {
      what: 'Saves images to the ComfyUI output folder and shows them on the node.',
      why: 'The usual last node of a graph: it is an output node, so it makes ComfyUI run the branch that leads to it.',
      connect: 'Inputs: images (IMAGE) and filename_prefix. No outputs.',
    },
    PreviewImage: {
      what: 'Shows images on the node without saving them to the output folder (they go to a temporary folder).',
      why: 'For checking intermediate results or trying settings before saving.',
      connect: 'Input: images (IMAGE). No outputs.',
    },
    LoadImage: {
      what: 'Loads an image from the ComfyUI input folder (or one you upload) into the graph.',
      why: 'The source picture for image-to-image, inpainting, ControlNet or upscaling.',
      connect: 'Input: the image file. Outputs: IMAGE and MASK (taken from the alpha channel, or painted in the mask editor).',
    },
    ImageScale: {
      what: 'Upscale Image: resizes an image to an exact width and height with a simple method such as bilinear or lanczos, optionally cropping.',
      why: 'To fit a picture to the size a model or another node expects.',
      connect: 'Inputs: IMAGE, upscale_method, width, height, crop. Output: IMAGE.',
      risk: 'A width or height of 0 keeps the aspect ratio from the other side; with crop disabled, a different aspect ratio stretches the picture.',
    },
    ImageScaleBy: {
      what: 'Upscale Image By: resizes an image by a factor (for example 1.5 or 2) with a simple method, without AI.',
      why: 'A quick size change; for real added detail use an upscale model or a second sampling pass.',
      connect: 'Inputs: IMAGE, upscale_method, scale_by. Output: IMAGE.',
    },
    UpscaleModelLoader: {
      what: 'Loads an upscale model (such as ESRGAN or similar) from models/upscale_models.',
      why: 'The first half of AI upscaling; the model is applied by Upscale Image (using Model).',
      connect: 'Input: model_name. Output: UPSCALE_MODEL, to ImageUpscaleWithModel.',
    },
    ImageUpscaleWithModel: {
      what: 'Upscale Image (using Model): enlarges an image with an upscale model, which adds detail instead of just stretching pixels.',
      why: 'For sharper large images; often followed by a resize to the final size or a second sampling pass.',
      connect: 'Inputs: upscale_model (UPSCALE_MODEL) and image (IMAGE). Output: IMAGE.',
      risk: 'The scale is fixed by the model (often 4x); large images need a lot of memory.',
    },
    ControlNetLoader: {
      what: 'Loads a ControlNet model from models/controlnet: a model that steers generation with a control image such as edges, depth or pose.',
      why: 'The first step to make the result follow the structure of a reference picture.',
      connect: 'Input: control_net_name. Output: CONTROL_NET, to Apply ControlNet.',
      risk: 'A ControlNet is trained for one base family; an SD 1.5 ControlNet does not work with SDXL or Flux.',
    },
    ControlNetApplyAdvanced: {
      what: 'Apply ControlNet: adds the ControlNet guidance to the positive and negative conditioning, using a control image.',
      why: 'Makes the sampler follow the edges, depth or pose of the control image, with a strength and a start/end range.',
      connect: 'Inputs: positive and negative CONDITIONING, CONTROL_NET, image (IMAGE, usually already preprocessed), optional VAE, strength, start_percent, end_percent. Outputs: positive and negative CONDITIONING, to the sampler.',
      risk: 'The control image usually has to be preprocessed first (for example to canny edges or a depth map) to match the ControlNet type.',
    },
    ConditioningCombine: {
      what: 'Combines two conditionings so the sampler takes both into account; their predictions are mixed.',
      why: 'To merge two prompts, often together with area or mask conditioning for different parts of the picture.',
      connect: 'Inputs: conditioning_1 and conditioning_2 (CONDITIONING). Output: CONDITIONING.',
    },
    ConditioningConcat: {
      what: 'Concatenates two conditionings into one longer prompt (conditioning_from is appended to conditioning_to).',
      why: 'Another way to join prompts; it behaves differently from Conditioning (Combine) and can keep concepts more separate.',
      connect: 'Inputs: conditioning_to and conditioning_from (CONDITIONING). Output: CONDITIONING.',
    },
    ConditioningSetArea: {
      what: 'Limits a conditioning to a rectangular area of the image, given in pixels, with a strength.',
      why: 'To place different prompts in different parts of the picture; usually combined with other conditionings afterwards.',
      connect: 'Inputs: CONDITIONING, width, height, x, y, strength. Output: CONDITIONING, usually to Conditioning (Combine).',
    },
    LatentUpscale: {
      what: 'Upscale Latent: resizes a latent to a given width and height.',
      why: 'For "hires fix": upscale the latent, then sample it again with partial denoise to add detail.',
      connect: 'Inputs: samples (LATENT), upscale_method, width, height, crop. Output: LATENT, to the second sampler.',
      risk: 'An upscaled latent must be resampled (denoise around 0.4 to 0.6); decoding it directly looks blurry or broken.',
    },
    LatentUpscaleBy: {
      what: 'Upscale Latent By: resizes a latent by a factor.',
      why: 'Same purpose as Upscale Latent (a second sampling pass at a larger size), set by a factor instead of exact sizes.',
      connect: 'Inputs: samples (LATENT), upscale_method, scale_by. Output: LATENT.',
    },
    SetLatentNoiseMask: {
      what: 'Attaches a mask to a latent so the sampler changes only the masked area and keeps the rest.',
      why: 'Inpainting with an ordinary model: encode the picture, set the mask, sample with partial denoise.',
      connect: 'Inputs: samples (LATENT) and MASK. Output: LATENT with the noise mask, to the sampler.',
    },
    InpaintModelConditioning: {
      what: 'Prepares conditioning and a latent for inpainting: it encodes the image and mask and attaches them to the prompt.',
      why: 'Used with inpainting models (and with Flux Fill) for better blending of the redrawn area than plain masking.',
      connect: 'Inputs: positive and negative CONDITIONING, VAE, pixels (IMAGE), MASK. Outputs: positive, negative (CONDITIONING) and latent (LATENT), all to the sampler.',
    },
    CLIPVisionLoader: {
      what: 'Loads a CLIP Vision model from models/clip_vision: an image encoder that describes a picture as numbers.',
      why: 'Needed by image-prompt features such as unCLIP, style models, IP-Adapter and some image-to-video models (for example Wan 2.1 image-to-video).',
      connect: 'Input: clip_name. Output: CLIP_VISION, to CLIP Vision Encode.',
    },
    CLIPVisionEncode: {
      what: 'Encodes an image with a CLIP Vision model.',
      why: 'Turns a reference picture into an embedding that style, unCLIP or image-to-video nodes use as guidance.',
      connect: 'Inputs: clip_vision (CLIP_VISION), image (IMAGE), crop. Output: CLIP_VISION_OUTPUT.',
    },
    ModelSamplingFlux: {
      what: 'Sets the sampling shift of a Flux model according to the image resolution (max_shift, base_shift, width, height).',
      why: 'Used in Flux graphs, especially Flux dev, to tune how the noise schedule behaves at a given size.',
      connect: 'Input: MODEL plus the shift values and the image size. Output: MODEL, to the sampler or guider.',
      risk: 'Width and height should match the latent you generate.',
    },
    FluxGuidance: {
      what: 'Sets the guidance value that Flux models read from the conditioning (the "distilled CFG").',
      why: 'Flux dev uses this guidance instead of a high CFG; around 3.5 is a common starting value.',
      connect: 'Input: CONDITIONING and guidance. Output: CONDITIONING, to the sampler positive input.',
      risk: 'Keep the sampler cfg at 1.0 with Flux dev; raising both makes the image harsh and slow.',
    },
    Note: {
      what: 'A plain text note on the canvas. It does nothing when the graph runs.',
      why: 'To leave instructions or reminders inside a workflow.',
      connect: 'No inputs or outputs.',
    },
    MarkdownNote: {
      what: 'A note on the canvas that renders Markdown (headings, lists, links). It does nothing when the graph runs.',
      why: 'For longer instructions, such as which model files a template needs and where to put them.',
      connect: 'No inputs or outputs.',
    },
    Reroute: {
      what: 'A reroute point: passes one connection through unchanged so long wires can be routed neatly.',
      why: 'Tidies the layout or lets one output be pulled to several distant places.',
      connect: 'One input and one output of the same type; it takes the type of what is connected to it.',
    },
    PrimitiveNode: {
      what: 'Primitive: a frontend-only node that holds a value (number, text, choice) and feeds it to a widget input of other nodes.',
      why: 'To share one value, such as a seed or a size, between several nodes, or to control it in one place.',
      connect: 'No inputs; its output takes the type of the widget input it is connected to (INT, FLOAT, STRING, COMBO).',
      risk: 'It exists only in the editor: in the API prompt its value is written directly into the connected nodes.',
    },
  },
  linkTypes: {
    MODEL: {
      what: 'MODEL: the diffusion model itself (UNet or transformer), the part that removes noise.',
      why: 'Every sampler needs one; LoRAs and model patches change it on the way.',
      connect: 'Comes from Load Checkpoint, Load Diffusion Model or LoRA and patch nodes; goes to samplers, schedulers, LoRA loaders and model-sampling nodes.',
    },
    CLIP: {
      what: 'CLIP: the text encoder that reads your prompt.',
      why: 'Prompts are turned into conditioning with it.',
      connect: 'Comes from Load Checkpoint, Load CLIP, DualCLIPLoader or Load LoRA; goes to CLIP Text Encode and other text-encode nodes.',
    },
    VAE: {
      what: 'VAE: the model that converts between pixels and the latent space.',
      why: 'Needed to see the result (decode) or to start from a picture (encode).',
      connect: 'Comes from Load Checkpoint or Load VAE; goes to VAE Decode, VAE Encode and inpainting nodes.',
    },
    CONDITIONING: {
      what: 'CONDITIONING: an encoded prompt (and any extra guidance attached to it) that steers the sampler.',
      why: 'The positive and negative inputs of a sampler take it.',
      connect: 'Comes from text-encode nodes and is modified by ControlNet, area, combine and guidance nodes; goes to the sampler positive or negative input.',
    },
    LATENT: {
      what: 'LATENT: an image in the compressed latent space the model works in; for most models it is 8 times smaller than the image on each side.',
      why: 'Samplers read and write latents; the picture becomes visible only after VAE Decode.',
      connect: 'Comes from Empty Latent Image, VAE Encode or a sampler; goes to samplers, latent upscale nodes or VAE Decode.',
    },
    IMAGE: {
      what: 'IMAGE: a batch of ordinary pictures in pixels (red, green and blue).',
      why: 'What you save, preview, load, resize or use as a control picture.',
      connect: 'Comes from Load Image, VAE Decode or image nodes; goes to Save Image, Preview Image, VAE Encode, upscalers and ControlNet.',
    },
    MASK: {
      what: 'MASK: a black-and-white map that marks which area to change.',
      why: 'Used for inpainting and to limit effects to part of the picture.',
      connect: 'Comes from Load Image (alpha channel or the mask editor) or mask nodes; goes to SetLatentNoiseMask, VAE Encode (for Inpainting) and InpaintModelConditioning.',
    },
    CONTROL_NET: {
      what: 'CONTROL_NET: a loaded ControlNet model.',
      why: 'Steers the structure of the result with a control image.',
      connect: 'Comes from Load ControlNet Model; goes to Apply ControlNet.',
    },
    UPSCALE_MODEL: {
      what: 'UPSCALE_MODEL: a loaded upscale model (ESRGAN-style).',
      why: 'Enlarges images with added detail.',
      connect: 'Comes from Load Upscale Model; goes to Upscale Image (using Model).',
    },
    CLIP_VISION: {
      what: 'CLIP_VISION: a loaded image encoder model.',
      why: 'Used to describe a reference picture for style, unCLIP or image-to-video guidance.',
      connect: 'Comes from Load CLIP Vision; goes to CLIP Vision Encode and some image-to-video nodes.',
    },
    CLIP_VISION_OUTPUT: {
      what: 'CLIP_VISION_OUTPUT: the encoding of one picture made by a CLIP Vision model.',
      why: 'Carries what a reference picture looks like to the nodes that use it as guidance.',
      connect: 'Comes from CLIP Vision Encode; goes to style, unCLIP and image-to-video conditioning nodes.',
    },
    SIGMAS: {
      what: 'SIGMAS: the noise schedule, a list of noise levels before and after each sampling step.',
      why: 'Custom samplers take the schedule as an input instead of a steps setting.',
      connect: 'Comes from scheduler nodes such as BasicScheduler; goes to SamplerCustom or SamplerCustomAdvanced.',
    },
    SAMPLER: {
      what: 'SAMPLER: a sampling algorithm (for example euler or dpmpp_2m) as an object.',
      why: 'Custom samplers take the algorithm as an input.',
      connect: 'Comes from KSamplerSelect or other sampler nodes; goes to SamplerCustom or SamplerCustomAdvanced.',
    },
    GUIDER: {
      what: 'GUIDER: the part that combines the model and the conditioning into one denoising prediction (CFG and similar).',
      why: 'SamplerCustomAdvanced takes the guidance as a separate piece, which allows special guiders.',
      connect: 'Comes from guider nodes such as BasicGuider or CFGGuider; goes to SamplerCustomAdvanced.',
    },
    NOISE: {
      what: 'NOISE: a source of starting noise (with its seed), not the noise itself.',
      why: 'SamplerCustomAdvanced takes the noise as a separate input.',
      connect: 'Comes from noise nodes such as RandomNoise; goes to SamplerCustomAdvanced.',
    },
    INT: {
      what: 'INT: a whole number, such as a seed, steps or a size.',
      why: 'Usually set as a widget on the node; it becomes a link when one value is shared or computed.',
      connect: 'Comes from Primitive or math nodes; goes to any INT widget input.',
    },
    FLOAT: {
      what: 'FLOAT: a decimal number, such as cfg, denoise or a strength.',
      why: 'Usually a widget value; a link lets one value drive several nodes.',
      connect: 'Comes from Primitive or math nodes; goes to any FLOAT widget input.',
    },
    STRING: {
      what: 'STRING: text, such as a prompt or a file name prefix.',
      why: 'A link lets one text feed several nodes or come from a text-processing node.',
      connect: 'Comes from Primitive or text nodes; goes to text inputs such as the prompt of CLIP Text Encode.',
    },
    BOOLEAN: {
      what: 'BOOLEAN: a true/false switch.',
      why: 'Turns an option of a node on or off.',
      connect: 'Comes from Primitive or logic nodes; goes to BOOLEAN widget inputs.',
    },
    COMBO: {
      what: 'COMBO: a choice from a list, such as a model file name, a sampler or a scheduler.',
      why: 'Most loader and sampler settings are combos; the list often comes from the files ComfyUI finds.',
      connect: 'Usually a dropdown widget; a Primitive connected to it can share the choice with other nodes.',
    },
  },
  families: {
    sd15: {
      what: 'Stable Diffusion 1.5: the classic 512-pixel image model. Usually a single checkpoint loaded with Load Checkpoint, which gives MODEL, CLIP and VAE.',
      risk: 'LoRAs, ControlNets and embeddings must be made for SD 1.5; SDXL or Flux add-ons do not work with it.',
    },
    sdxl: {
      what: 'Stable Diffusion XL: an image model for about 1024 pixels with two text encoders. Usually a single checkpoint loaded with Load Checkpoint.',
      risk: 'Use SDXL LoRAs and ControlNets only. Pony and Illustrious are built on SDXL, but their LoRAs often work best within their own line.',
    },
    pony: {
      what: 'Pony Diffusion: a line of models fine-tuned from SDXL, loaded like SDXL with Load Checkpoint; it relies on its own score and rating tags in the prompt.',
      risk: 'Technically SDXL, so SDXL LoRAs load, but LoRAs trained for Pony give the expected results; SD 1.5 or Flux LoRAs do not work.',
    },
    illustrious: {
      what: 'Illustrious XL: an anime-focused line of models fine-tuned from SDXL, loaded like SDXL with Load Checkpoint.',
      risk: 'Technically SDXL, but LoRAs trained for Illustrious (or its descendants) fit best; SD 1.5 or Flux LoRAs do not work.',
    },
    flux1: {
      what: 'Flux.1 (dev, schnell) by Black Forest Labs: the model loads with Load Diffusion Model, the text encoders clip_l and t5xxl with DualCLIPLoader (type flux), and the VAE ae.safetensors with Load VAE.',
      risk: 'Only Flux.1 LoRAs work with it. Flux dev expects cfg 1.0 with FluxGuidance instead of a high CFG.',
    },
    flux2: {
      what: 'Flux.2 by Black Forest Labs: the model loads with Load Diffusion Model, its own Mistral-based text encoder with Load CLIP, and its own VAE (flux2-vae) with Load VAE.',
      risk: 'Flux.2 is not compatible with Flux.1 files: LoRAs, text encoders and the VAE must be the Flux.2 ones.',
    },
    chroma: {
      what: 'Chroma: an image model derived from Flux.1 schnell; it uses a T5-XXL text encoder without clip_l and the Flux VAE.',
      risk: 'Use LoRAs made for Chroma; Flux.1 LoRAs may load but often do not behave as expected.',
    },
    'qwen-image': {
      what: 'Qwen-Image by Alibaba Qwen: an image model that is good at text in pictures. The model loads with Load Diffusion Model, the Qwen2.5-VL text encoder with Load CLIP, and qwen_image_vae with Load VAE.',
      risk: 'Only Qwen-Image LoRAs and ControlNets work with it; the edit variants (Qwen-Image-Edit) use their own graphs.',
    },
    'wan2.1': {
      what: 'Wan 2.1 by Alibaba: a video model (text-to-video and image-to-video). The model loads with Load Diffusion Model, the umt5_xxl text encoder with Load CLIP, and wan_2.1_vae with Load VAE; image-to-video also uses clip_vision_h.',
      risk: 'Use LoRAs made for Wan 2.1 and for the same model size (1.3B and 14B are not interchangeable).',
    },
    'wan2.2': {
      what: 'Wan 2.2 by Alibaba: a video model. The 14B models come as a high-noise and a low-noise expert run one after the other; they use the umt5_xxl text encoder and wan_2.1_vae, while the 5B model uses wan2.2_vae.',
      risk: 'Use Wan 2.2 LoRAs for the right expert and size; the two 14B experts need two samplers with matching step ranges.',
    },
    ltx2: {
      what: 'LTX-2 by Lightricks: an audio-video model for text-to-video and image-to-video, with its own text encoder and upscaler models; start from the official template for the exact files.',
      risk: 'Only LTX-2 LoRAs work with it; LoRAs for the older LTX-Video models are not compatible.',
    },
    hunyuan: {
      what: 'HunyuanVideo by Tencent: a video model. The model loads with Load Diffusion Model, the text encoders clip_l and llava_llama3 with DualCLIPLoader (type hunyuan_video), and hunyuan_video_vae with Load VAE.',
      risk: 'Use LoRAs made for HunyuanVideo; HunyuanVideo 1.5 and Hunyuan image models are separate families.',
    },
    zimage: {
      what: 'Z-Image (Turbo) by Alibaba Tongyi: a fast image model. The model loads with Load Diffusion Model, the qwen_3_4b text encoder with Load CLIP, and the Flux VAE ae.safetensors with Load VAE.',
      risk: 'Only Z-Image LoRAs work with it. The Turbo model is meant for few steps and low CFG.',
    },
    krea: {
      what: 'FLUX.1 Krea [dev]: a Flux.1 dev model retrained by Krea and Black Forest Labs; it loads exactly like Flux.1 (Load Diffusion Model, DualCLIPLoader with clip_l and t5xxl, ae.safetensors).',
      risk: 'Built on Flux.1 dev, so Flux.1 dev LoRAs usually load, but results can differ from the original model.',
    },
    sd3: {
      what: 'Stable Diffusion 3 / 3.5 by Stability AI: an image model with three text encoders (clip_l, clip_g, t5xxl) and a 16-channel latent (EmptySD3LatentImage).',
      risk: 'Only SD3 LoRAs and ControlNets work with it; SD3 Medium and SD3.5 Large are different sizes, so their add-ons do not mix.',
    },
    kolors: {
      what: 'Kolors by Kuaishou: an SDXL-like image model that uses the ChatGLM text encoder, so it needs its own loader nodes.',
      risk: 'SDXL LoRAs and ControlNets are not reliably compatible; use add-ons made for Kolors.',
    },
    auraflow: {
      what: 'AuraFlow by fal: an open flow-based image model; it is usually distributed as a single checkpoint.',
      risk: 'Only add-ons made for AuraFlow work with it.',
    },
    cascade: {
      what: 'Stable Cascade by Stability AI: an image model that works in stages (stage C, then stage B) with its own latent format.',
      risk: 'Its stages and add-ons are not compatible with SD 1.5 or SDXL files.',
    },
  },
};
