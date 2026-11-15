/**
 * Built-in knowledge on picture techniques, English; image-techniques.ts turns it into a knowledge set. The Russian
 * file says the same things. Facts are checked against ComfyUI's nodes.py and comfy_extras, docs.comfy.org and the
 * repositories of the packs (image-techniques.ts names the source of each class).
 */
import type { TechniqueTexts } from './image-techniques';

export const IMAGE_TECHNIQUES_KNOWLEDGE_EN: TechniqueTexts = {
  nodes: {
    ImageScaleToTotalPixels: {
      what: 'Scale Image to Total Pixels: resizes a picture so that it holds about the given number of megapixels, keeping its proportions.',
      why: 'Brings a loaded picture to the size a model was trained at before it is encoded: 1 megapixel for SDXL and newer models, about 0.25 for SD 1.5.',
      connect: 'Inputs: image (IMAGE), upscale_method, megapixels, resolution_steps. Output: IMAGE, usually into VAE Encode or the inpainting node.',
      risk: 'A mask that goes with the picture must end at the same size; ComfyUI\'s inpainting node stretches it to the picture itself.',
    },
    ImagePadForOutpaint: {
      what: 'Pad Image for Outpainting: adds an empty frame on the chosen sides of a picture and gives the mask of that frame.',
      why: 'The first node of outpainting: the frame is what the model draws, the mask tells it where.',
      connect: 'Inputs: image, left, top, right, bottom (pixels, in steps of 8) and feathering (a soft border into the picture). Outputs: IMAGE into pixels and MASK into mask of the inpainting node or VAE Encode (for Inpainting).',
      risk: 'The new frame is grey and holds nothing to keep, so the sampler needs denoise 1. Add little at a time: a model fills a strip better than a wide border on every side.',
    },
    SAM3_Detect: {
      what: 'SAM3 Detect: finds in a picture what a text names (or what points or boxes mark) and gives its exact mask.',
      why: 'A mask without painting by hand: write "hat" and get the mask of the hat for inpainting, a background change or a detailer.',
      connect: 'Inputs: model (MODEL from a SAM3 checkpoint loaded with Load Checkpoint), image, conditioning (CLIP Text Encode with the word, using the CLIP of the same checkpoint), optional bboxes, positive_coords and negative_coords, threshold, refine_iterations, individual_masks. Outputs: masks (MASK) and bboxes.',
      risk: 'The mask fits the picture the node saw: give it the picture at the size the next node uses. A tight mask leaves seams in inpainting; widen it with Grow Mask.',
    },
    LoadBackgroundRemovalModel: {
      what: 'Load Background Removal Model: loads a model that tells the subject of a picture from its background, such as BiRefNet, from models/background_removal.',
      why: 'The first half of removing a background with ComfyUI\'s own nodes.',
      connect: 'Input: bg_removal_name. Output: bg_model, into Remove Background.',
    },
    RemoveBackground: {
      what: 'Remove Background: runs a background removal model on a picture and gives the mask of the subject.',
      why: 'The mask is white on the subject; with Invert Mask and Join Image with Alpha the background becomes transparent.',
      connect: 'Inputs: bg_removal_model (from Load Background Removal Model) and image. Output: mask (MASK).',
      risk: 'Join Image with Alpha reads its mask as what to hide, so ComfyUI\'s own template turns the mask inside out first with Invert Mask.',
    },
    InvertMask: {
      what: 'Invert Mask: turns a mask inside out, so that what was covered is free and the other way round.',
      why: 'Used when a node gives the mask of the subject and the next one needs the mask of the background, or the other way.',
      connect: 'Input: mask. Output: MASK.',
    },
    JoinImageWithAlpha: {
      what: 'Join Image with Alpha: adds a mask to a picture as its transparency.',
      why: 'The last step of removing a background: the picture with transparency is saved as PNG.',
      connect: 'Inputs: image and alpha (MASK; where it is white the picture becomes transparent). Output: IMAGE with four channels, into Save Image.',
      risk: 'A format without transparency, such as JPEG, fills the transparent part with a colour.',
    },
    GrowMask: {
      what: 'Grow Mask: makes a mask wider by a number of pixels (a negative number makes it narrower).',
      why: 'A mask from a finder hugs the object; a few more pixels give the model room to blend the edge when it draws again.',
      connect: 'Inputs: mask, expand (pixels), tapered_corners. Output: MASK.',
    },
    ImageCompositeMasked: {
      what: 'Image Composite Masked: puts one picture onto another at a place, through a mask.',
      why: 'Puts a cut-out subject on a new background, or a redrawn part back onto the whole picture.',
      connect: 'Inputs: destination (the picture below), source (the picture on top), x, y, resize_source and an optional mask (where source shows). Output: IMAGE.',
    },
    MaskPreview: {
      what: 'Preview Mask: shows a mask on the node as a black and white picture, without saving it.',
      why: 'To see what a finder or a hand-drawn mask really covers before anything is drawn.',
      connect: 'Input: mask. No outputs.',
    },
    ConditioningSetMask: {
      what: 'Conditioning (Set Mask): limits a description (conditioning) to the area of a mask, with a strength.',
      why: 'Different descriptions for different parts of one picture, drawn by hand or found by a model; the parts are joined with Conditioning (Combine).',
      connect: 'Inputs: conditioning, mask, strength, set_cond_area (default, or "mask bounds" to work out the description inside the box of the mask only). Output: CONDITIONING.',
      risk: 'The parts of the picture outside every mask still need a description of their own, usually the whole scene combined in.',
    },
    ConditioningSetAreaPercentage: {
      what: 'Conditioning (Set Area with Percentage): limits a description to a rectangle given as parts of the picture, from 0 to 1.',
      why: 'The same as Conditioning (Set Area), but the rectangle stays in place when the size of the picture changes.',
      connect: 'Inputs: conditioning, width, height, x, y (0 to 1) and strength. Output: CONDITIONING, usually into Conditioning (Combine).',
    },
    DifferentialDiffusion: {
      what: 'Differential Diffusion: makes a soft mask act softly, so that a grey edge of a mask is drawn again only in part.',
      why: 'Hides the seam of inpainting and outpainting; ComfyUI\'s Flux Fill templates put it before the sampler.',
      connect: 'Inputs: model and strength. Output: MODEL, into the sampler.',
    },
    StyleModelLoader: {
      what: 'Load Style Model: loads a style model from models/style_models, such as Flux.1 Redux.',
      why: 'The first half of using a picture as a sample of style or content.',
      connect: 'Input: style_model_name. Output: STYLE_MODEL, into Apply Style Model.',
      risk: 'A style model belongs to one family: Redux is made for Flux.1 dev and schnell.',
    },
    StyleModelApply: {
      what: 'Apply Style Model: adds what a vision model saw in a sample picture to a description.',
      why: 'The model then draws with the look of the sample: colours, materials, mood, often the content too.',
      connect: 'Inputs: conditioning (the description), style_model, clip_vision_output (from CLIP Vision Encode), strength, strength_type (multiply scales the added part; attn_bias weighs it in the model\'s attention instead). Output: CONDITIONING, into the positive input of the sampler or into another Apply Style Model.',
      risk: 'At strength 1 Redux tends to copy the sample and forget the words; lower it to about 0.5 to give the description back its say.',
    },
    FluxKontextImageScale: {
      what: 'FluxKontextImageScale: brings a picture to the nearest size an editing model was trained at, about one megapixel, keeping its proportions.',
      why: 'The Flux.1 Kontext and Qwen-Image-Edit templates put it right after Load Image, so that the picture is neither cut nor distorted.',
      connect: 'Input: image. Output: IMAGE, into the text node of the editing model and into VAE Encode.',
    },
    TextEncodeQwenImageEditPlus: {
      what: 'Text Encode Qwen Image Edit Plus: reads an editing instruction together with up to three pictures for Qwen-Image-Edit 2509 and 2511.',
      why: 'The text reader of these models sees pictures, so the instruction is understood about the picture itself: "make the sofa green".',
      connect: 'Inputs: clip (CLIPLoader with type qwen_image), prompt, vae, image1, image2, image3. Output: CONDITIONING, into the sampler; a second node with an empty prompt and the same pictures is the negative one.',
      risk: 'The older Text Encode Qwen Image Edit node takes one picture and is for the first Qwen-Image-Edit model.',
    },
    ReferenceLatent: {
      what: 'Set Reference Latent: attaches the latent of a picture to a description, as a picture the model looks at.',
      why: 'This is how Flux.1 Kontext and Flux.2 Klein take the picture to edit or to follow.',
      connect: 'Inputs: conditioning and latent (from VAE Encode). Output: CONDITIONING, into the guidance node or the sampler.',
    },
    VAEEncodeTiled: {
      what: 'VAE Encode (Tiled): turns a large picture into a latent piece by piece.',
      why: 'The second pass over a large picture when VAE Encode runs out of memory.',
      connect: 'Inputs: pixels, vae, tile_size, overlap. Output: LATENT.',
    },
    RepeatLatentBatch: {
      what: 'Repeat Latent Batch: repeats a latent several times to make a batch.',
      why: 'Several variants of a picture from a picture in one run: each copy gets its own noise.',
      connect: 'Inputs: samples and amount. Output: LATENT, into the sampler.',
    },
    LatentFromBatch: {
      what: 'Latent From Batch: takes one or a few latents out of a batch by their number, counted from 0.',
      why: 'To work on with the one variant of a batch you liked, with the same noise it had.',
      connect: 'Inputs: samples, batch_index, length. Output: LATENT.',
    },
    LoadImageMask: {
      what: 'Load Image (as Mask): loads one channel of a picture (alpha, red, green or blue) as a mask.',
      why: 'For masks painted in another program and saved as a picture.',
      connect: 'Inputs: image and channel. Output: MASK.',
    },
    SetUnionControlNetType: {
      what: 'SetUnionControlNetType: tells a "union" ControlNet which kind of control picture it gets: canny, depth, openpose and others.',
      why: 'A union ControlNet reads several kinds in one file; this node says which one is coming.',
      connect: 'Inputs: control_net (from Load ControlNet Model) and type. Output: CONTROL_NET, into Apply ControlNet.',
    },
    ImageStitch: {
      what: 'Image Stitch: puts two pictures side by side or one above the other.',
      why: 'To compare a result with the original in one picture, or to give an editing model two pictures as one.',
      connect: 'Inputs: image1, direction, match_image_size, spacing_width, spacing_color, image2. Output: IMAGE.',
    },
    DepthAnythingV2Preprocessor: {
      what: 'Depth Anything V2 - Relative (comfyui_controlnet_aux): turns a picture into a depth map, near light and far dark.',
      why: 'Makes the control picture for a depth ControlNet, so that a new picture keeps the space of the sample.',
      connect: 'Inputs: image, ckpt_name (vitl by default), resolution. Output: IMAGE, into Apply ControlNet.',
      risk: 'The node fetches its model itself the first time it runs. The depth map needs a ControlNet for depth, not one for edges.',
    },
    CannyEdgePreprocessor: {
      what: 'Canny Edge (comfyui_controlnet_aux): finds the edges of a picture, like ComfyUI\'s own Detect Edges (Canny), at a set resolution.',
      why: 'The control picture for a canny ControlNet, in the same form as the other preprocessors of the pack.',
      connect: 'Inputs: image, low_threshold and high_threshold (0 to 255), resolution. Output: IMAGE.',
    },
    AIO_Preprocessor: {
      what: 'AIO Aux Preprocessor (comfyui_controlnet_aux): every preprocessor of the pack behind one list.',
      why: 'Switch between depth, lines and pose without changing nodes; ComfyUI\'s templates use it with Depth Anything V2.',
      connect: 'Inputs: image, preprocessor, resolution. Output: IMAGE.',
    },
    IPAdapterUnifiedLoader: {
      what: 'IPAdapter Unified Loader (ComfyUI_IPAdapter_plus): loads an IP-Adapter model and its vision model by a preset.',
      why: 'Saves choosing two files by hand: the preset names the strength and the kind (PLUS, FACE and others).',
      connect: 'Inputs: model and preset. Outputs: model and ipadapter, into IPAdapter or IPAdapter Advanced.',
      risk: 'It finds the files by their exact names in models/ipadapter and models/clip_vision; a renamed file is not found.',
    },
    IPAdapter: {
      what: 'IPAdapter (ComfyUI_IPAdapter_plus): makes the model draw in the manner of a sample picture.',
      why: '"A LoRA from one picture" for SD 1.5 and SDXL: style, content or both.',
      connect: 'Inputs: model and ipadapter (from the unified loader), image, weight, start_at, end_at, weight_type (standard, prompt is more important, style transfer), optional attn_mask. Output: MODEL, into the sampler.',
      risk: 'It changes the model, not the description, so it stands on the way of the model. Works with SD 1.5 and SDXL only.',
    },
    IPAdapterAdvanced: {
      what: 'IPAdapter Advanced (ComfyUI_IPAdapter_plus): the same as IPAdapter with every setting: more weight types, how several pictures are combined, a picture of what is unwanted.',
      why: 'When the simple node is not enough: composition only, a strong style, a fine balance of several samples.',
      connect: 'Inputs: model, ipadapter, image, weight, weight_type, combine_embeds, start_at, end_at, embeds_scaling, optional image_negative, attn_mask, clip_vision. Output: MODEL.',
    },
    FaceDetailer: {
      what: 'FaceDetailer (ComfyUI-Impact-Pack): finds faces (or other objects, by the detector) in a finished picture, enlarges each, draws it again and puts it back.',
      why: 'Small faces of a full-length picture come out sharp; with a hand detector the same is done for hands. It draws again the face that is there; it does not put another person\'s face in its place.',
      connect: 'Inputs: image, model, clip, vae, positive, negative (the same as the picture\'s), bbox_detector (from UltralyticsDetectorProvider), guide_size, denoise and the usual sampler settings, optional sam_model_opt. Outputs: image (the fixed picture), the cut-out faces, mask.',
      risk: 'Above denoise 0.6 a face may turn into another one. guide_size 512 suits SD 1.5, 1024 SDXL.',
    },
    SAMLoader: {
      what: 'SAMLoader (ComfyUI-Impact-Pack): loads a SAM model from models/sams for the detailers.',
      why: 'With it a detailer\'s mask follows the outline of a face instead of a box, and leaves fewer seams.',
      connect: 'Inputs: model_name and device_mode. Output: SAM_MODEL, into sam_model_opt of FaceDetailer.',
    },
    UltralyticsDetectorProvider: {
      what: 'UltralyticsDetectorProvider (ComfyUI-Impact-Subpack): loads a YOLO detector of faces, hands or people from models/ultralytics.',
      why: 'The detectors tell FaceDetailer and the other detailers where the faces or hands are.',
      connect: 'Input: model_name (bbox/... for boxes, segm/... for outlines). Outputs: BBOX_DETECTOR and SEGM_DETECTOR.',
      risk: 'The detectors are .pt files, which can run code when loaded: take them only from the page the pack names.',
    },
    InpaintCropImproved: {
      what: '✂️ Inpaint Crop (ComfyUI-Inpaint-CropAndStitch): cuts out the area around a mask, with some room around it, and brings it to a size the model likes.',
      why: 'A small part of a large picture is drawn at the model\'s own size and looks sharp; the rest of the picture is not touched at all.',
      connect: 'Inputs: image, mask, the size and blend settings. Outputs: a stitcher (for ✂️ Inpaint Stitch), the cropped picture and its mask, into the inpainting graph.',
    },
    InpaintStitchImproved: {
      what: '✂️ Inpaint Stitch (ComfyUI-Inpaint-CropAndStitch): puts the drawn crop back into the original picture with a soft border.',
      why: 'The second half of crop and stitch: only the masked part of the original changes.',
      connect: 'Inputs: stitcher (from ✂️ Inpaint Crop) and the drawn picture from VAE Decode. Output: IMAGE.',
    },
    DownloadAndLoadSAM2Model: {
      what: '(Down)Load SAM2Model (ComfyUI-segment-anything-2): loads a SAM2 model, fetching it into models/sam2 the first time.',
      why: 'The finder for Sam2Segmentation.',
      connect: 'Inputs: model, segmentor (single_image for pictures, video for clips), device, precision. Output: sam2_model.',
    },
    Sam2Segmentation: {
      what: 'Sam2Segmentation (ComfyUI-segment-anything-2): outlines an object marked by points or by boxes and gives its mask.',
      why: 'With Florence2 boxes it makes a mask by words; with points from a points editor, a mask by clicks.',
      connect: 'Inputs: sam2_model, image, optional coordinates_positive, coordinates_negative, bboxes, individual_objects. Output: mask.',
    },
    DownloadAndLoadFlorence2Model: {
      what: 'DownloadAndLoadFlorence2Model (ComfyUI-Florence2): loads a Florence-2 model, fetching it into models/LLM the first time.',
      why: 'The model for Florence2Run: captions, boxes by words, text in pictures.',
      connect: 'Inputs: model, precision, attention. Output: florence2_model.',
    },
    Florence2Run: {
      what: 'Florence2Run (ComfyUI-Florence2): runs a Florence-2 task on a picture: a caption, a detailed caption, boxes of what a text names, and more.',
      why: 'caption_to_phrase_grounding finds boxes by words for SAM2; more_detailed_caption describes a picture in words a model understands.',
      connect: 'Inputs: image, florence2_model, text_input, task and its settings. Outputs: image, mask, caption, data (boxes as JSON, into Florence2 Coordinates).',
    },
    'WD14Tagger|pysssss': {
      what: 'WD14 Tagger (ComfyUI-WD14-Tagger): lists the tags a WD14 model sees in a picture, as a line of words.',
      why: 'Shows how anime models (and the Pony and Illustrious families) would describe a picture: a ready description to start from.',
      connect: 'Inputs: image, model, threshold, character_threshold and settings of the text. Output: STRING, for example into a text node or a preview.',
      risk: 'The tags describe what is seen, including things you may not want in a description; read them before you use them.',
    },
    DetailDaemonSamplerNode: {
      what: 'Detail Daemon Sampler (ComfyUI-Detail-Daemon): wraps a sampler so that it removes a little less noise in the middle steps, which adds fine detail.',
      why: 'Less blurred backgrounds and more texture, especially with Flux.',
      connect: 'Inputs: sampler (from KSamplerSelect), detail_amount, start, end, bias, exponent and others. Output: SAMPLER, into SamplerCustom or SamplerCustomAdvanced.',
      risk: 'It works with the assembled samplers, not with KSampler. Too high a detail_amount over-sharpens: for SDXL stay below about 0.25.',
    },
    PCLazyTextEncode: {
      what: 'PC: Schedule prompt (comfyui-prompt-control): a text node that understands a schedule in the text, such as [cat:dog:0.5], and LoRAs written in it.',
      why: 'One description changes over the steps: one thing at first, another at the end, without building extra nodes.',
      connect: 'Inputs: clip and text. Output: CONDITIONING, into the sampler.',
    },
  },
  packs: {
    comfyui_controlnet_aux: {
      what: 'Makes control pictures for ControlNet from ordinary ones: depth, lines, edges, the pose of a person, normal maps, segmentation.',
      nodes: 'Depth Anything V2 - Relative, Canny Edge, LineArt, OpenPose Pose, DWPose, AIO Aux Preprocessor (all of them behind one list).',
      risk: 'Most nodes fetch their models themselves the first time they run.',
    },
    'ComfyUI-Advanced-ControlNet': {
      what: 'Finer ControlNet: strength that changes over the steps and over a batch, masks of where it acts, soft weights in the manner of other programs.',
      nodes: 'Apply Advanced ControlNet, Load Advanced ControlNet Model, Timestep Keyframe, Latent Keyframe.',
    },
    ComfyUI_IPAdapter_plus: {
      what: 'IP-Adapter for SD 1.5 and SDXL: a sample picture steers the style, the composition or a face.',
      nodes: 'IPAdapter Unified Loader, IPAdapter, IPAdapter Advanced, IPAdapter Style & Composition, the FaceID nodes.',
      risk: 'The author keeps it in maintenance mode. The unified loader needs files named exactly as the pack\'s page says. Carrying a face is only for the face of someone who agrees.',
    },
    'ComfyUI-Impact-Pack': {
      what: 'Detailers that find faces, hands or other objects in a picture and draw them again larger, plus masks by detection and tile tools.',
      nodes: 'FaceDetailer, SAMLoader, Detailer (SEGS), Make Tile SEGS, Simple Detector (SEGS).',
      risk: 'A detailer draws again what is there; it does not put another person\'s face in its place.',
    },
    'ComfyUI-Impact-Subpack': {
      what: 'The YOLO detectors for the Impact Pack.',
      nodes: 'UltralyticsDetectorProvider: face, hand and person detectors from models/ultralytics (bbox and segm).',
      risk: 'The detectors are .pt files, which can run code when loaded.',
    },
    'ComfyUI-Inpaint-CropAndStitch': {
      what: 'Inpainting of a small part of a large picture: the area around the mask is cut out, drawn at the model\'s size and stitched back.',
      nodes: '✂️ Inpaint Crop, ✂️ Inpaint Stitch.',
    },
    'ComfyUI-segment-anything-2': {
      what: 'SAM2 masks: an object outlined from points, boxes or boxes found by Florence2; also for video.',
      nodes: '(Down)Load SAM2Model, Sam2Segmentation, Florence2 Coordinates, Sam2 Video Segmentation.',
    },
    'ComfyUI-Florence2': {
      what: 'Florence-2, a small model that sees pictures: captions, boxes by words, text in pictures.',
      nodes: 'DownloadAndLoadFlorence2Model, Florence2Run.',
    },
    'ComfyUI-RMBG': {
      what: 'Background removal and segmentation with many models (RMBG-2.0, BiRefNet, BEN and others), also for faces, clothes and hair.',
      nodes: 'RMBG (Remove Background) and the Segment nodes of the pack.',
    },
    'ComfyUI-WD14-Tagger': {
      what: 'Tags a picture with the words anime models were trained on, to learn how such a model would describe it.',
      nodes: 'WD14 Tagger; it is also in the right-click menu of nodes that show a picture.',
    },
    'ComfyUI-JoyCaption': {
      what: 'JoyCaption describes a picture in long sentences or in tags, in several styles, with a model that sees pictures.',
      nodes: 'JoyCaption, JoyCaption (Advanced), JoyCaption GGUF, the caption tools for batches.',
      risk: 'The models are large; the GGUF ones need extra libraries.',
    },
    'ComfyUI-Detail-Daemon': {
      what: 'Adds fine detail by changing how much noise is removed in the middle steps.',
      nodes: 'Detail Daemon Sampler, Detail Daemon Sampler GUI, Detail Daemon Graph Sigmas, Multiply Sigmas, Lying Sigma Sampler.',
    },
    'comfyui-prompt-control': {
      what: 'Schedules in the description: words and LoRAs that change over the steps, regions, written in the text itself.',
      nodes: 'PC: Schedule prompt, PC: Schedule LoRAs.',
    },
    ComfyUI_LayerStyle: {
      what: 'Finishing a picture as in an image editor: shadows, glow, strokes, colour correction, levels, LUTs, masks and layers.',
      nodes: 'DropShadow, OuterGlow, Stroke, ColorBalance, Levels, LUT Apply, AutoAdjust and many more.',
    },
    'comfyui-propost': {
      what: 'Photographic finishing: film grain, vignette, radial blur, blur by depth, LUTs.',
      nodes: 'Film Grain, Vignette, Radial Blur, Depth Map Blur, Apply LUT.',
    },
    'ComfyUI-Lora-Manager': {
      what: 'A library of LoRAs and checkpoints with their pages, preview pictures, trigger words and notes; the app reads a LoRA\'s words and notes from it.',
      nodes: 'Lora Loader (LoraManager), its Lora Stacker and trigger-word nodes, its own Save Image.',
    },
    ComfyUI_UltimateSDUpscale: {
      what: 'Upscales a picture and draws it again in tiles, each at the model\'s size, so that very large pictures get detail without running out of memory.',
      nodes: 'Ultimate SD Upscale and its variant without the upscale step.',
    },
  },
  topics: {
    'inpainting-models': {
      what: 'Models trained to draw under a mask: they see the picture around it and blend the border. SD 1.5 has checkpoints with "inpainting" in the name (models/checkpoints); Flux has Flux.1 Fill (models/diffusion_models, with its own loaders). Any model can inpaint, the border just shows more.',
      risk: 'An inpainting model wants denoise 1. An ordinary one works better at 0.6 to 0.8 with InpaintModelConditioning and its noise mask on.',
    },
    'upscale-models': {
      what: 'Small networks that enlarge pictures 2x or 4x and draw sharp edges (ESRGAN and its kin), from models/upscale_models, loaded with Load Upscale Model. Different ones are trained for photos, drawings or anime.',
      risk: 'Many come as .pth files, which can run code when loaded: take them from the model\'s page or a collection you trust. They do not fix mistakes; a second pass with the sampler does.',
    },
    controlnets: {
      what: 'ControlNet models (models/controlnet) steer drawing with a control picture. Each reads one kind (canny, lineart, depth, openpose, scribble) or several (union ones), and each is trained for one model family.',
      risk: 'An SD 1.5 ControlNet does not work with SDXL, Flux or Qwen-Image; a depth ControlNet does not read edges.',
    },
    'ip-adapter-files': {
      what: 'IP-Adapter models (models/ipadapter) with their vision models (models/clip_vision), for SD 1.5 and SDXL; the FaceID ones also need insightface and a LoRA of their own.',
      risk: 'The unified loader of ComfyUI_IPAdapter_plus finds them only by the exact names on the pack\'s page; .bin files can run code when loaded.',
    },
    'style-models': {
      what: 'Style models (models/style_models) such as Flux.1 Redux turn what a vision model saw in a picture into an addition to the description. Redux needs the sigclip vision model in models/clip_vision.',
      risk: 'Redux is for Flux.1 dev and schnell; at full strength it copies the sample.',
    },
    'editing-models': {
      what: 'Models that change a picture by an instruction. ComfyUI\'s templates show Qwen-Image-Edit 2509 and 2511 (TextEncodeQwenImageEditPlus), Qwen Image 2.1 (its own text node), Flux.1 Kontext dev and Flux.2 Klein (Set Reference Latent). Their files go to models/diffusion_models, models/text_encoders and models/vae.',
      risk: 'Each family has its own text node and settings; a graph of one does not run another. The paid API nodes for editing cost money and send the picture and the words to a cloud service.',
    },
    'background-removal-models': {
      what: 'Models that tell a subject from its background, such as BiRefNet, in models/background_removal for ComfyUI\'s Load Background Removal Model. Packs such as ComfyUI-RMBG bring more.',
    },
    'segmentation-models': {
      what: 'Models that outline objects: SAM3 as a checkpoint for ComfyUI\'s own SAM3 Detect (models/checkpoints), SAM2 for ComfyUI-segment-anything-2 (models/sam2), SAM for the Impact Pack (models/sams).',
    },
    detectors: {
      what: 'YOLO detectors of faces, hands and people for the Impact Pack, in models/ultralytics/bbox (boxes) and models/ultralytics/segm (outlines).',
      risk: '.pt files can run code when loaded: take them only from the page the pack names.',
    },
    'image-loras': {
      what: 'LoRAs for pictures live in models/loras. For SD 1.5 and SDXL they go into Load LoRA, which changes the model and the text reader (strength_model and strength_clip); for Flux, Qwen-Image and Z-Image into LoraLoaderModelOnly. Several can be chained; their effects add up.',
      risk: 'A LoRA works with the family it was trained for; Pony and Illustrious LoRAs act weaker or strangely on each other and on plain SDXL. Many need their trigger words in the description.',
    },
    'lora-kinds': {
      what: 'Kinds of LoRA: a character (one person or figure, the face first), a body (build, proportions, anatomy), clothing, a pose (given loosely), a style, detail (more or less fine detail) and speed-up (fewer steps, with its own steps and cfg). The kind is told by the file\'s card in the "Models" tab (base model, trigger words, the author\'s notes), by the page the file came from and by ComfyUI-Lora-Manager when it is installed; the name of a file is not enough.',
      risk: 'A LoRA of a real person may be used only with that person\'s consent. A pose that must be exact comes from ControlNet, not from a pose LoRA.',
    },
    'lora-strength': {
      what: 'LoRA strength: Load LoRA has two. strength_model says how much the LoRA changes the drawing, strength_clip how much it changes the reading of the words. 1 is the strength it was trained at; most work between 0.6 and 1; LoraLoaderModelOnly has strength_model only. The author\'s page often names the best value.',
      risk: 'Above 1 a LoRA usually burns colours and doubles shapes. A negative strength turns its effect around, which rarely gives what one expects.',
    },
    'lora-several': {
      what: 'Several LoRAs at once: Load LoRA nodes in a chain, each fed by the one before. Their changes add up, so the place in the chain matters little and the strength matters a lot. Tune one at a time with the others at 0, the character first, then the body or clothes, the style last; compare each with and without it on a fixed seed.',
      risk: 'Two or three at full strength fight and break the picture: give each a little less than it would get alone. Keep in the description only the trigger words of the LoRAs that are in the graph.',
    },
    'lora-side-effects': {
      what: 'A LoRA changes more than it promises: it learnt everything in its training pictures, not only its subject. A body or clothing LoRA also pulls faces, light and style towards its pictures; a style LoRA can change faces and anatomy.',
      risk: 'To hold a face: lower the strength of the other LoRA, keep its strength_clip below its strength_model, keep the character LoRA a little stronger, and redraw the face afterwards with a detailer. A LoRA made for another model family does nothing or breaks the picture.',
    },
    'seeds-and-batches': {
      what: 'The seed sets the starting noise. With "control after generate" at fixed the same settings give the same picture, so a change shows what it does; at randomize every run is new. batch_size of the empty latent (or Repeat Latent Batch for a picture from a picture) makes several pictures at once, each with its own noise.',
    },
    'saved-workflow': {
      what: 'Save Image writes the whole graph, descriptions included, into the PNG it saves, and a picture dragged into ComfyUI opens it again. Preview Image keeps pictures in a temporary folder only.',
      risk: 'A shared PNG shares its graph and descriptions. ComfyUI started with the --disable-metadata option writes no graph into the files; converting the picture to another format drops it too.',
    },
    luts: {
      what: 'A LUT (look-up table, a .cube file) is a ready colour look, as in film grading. ComfyUI_LayerStyle and comfyui-propost apply them to a finished picture; they keep them in their own folders or in models/luts.',
    },
  },
  fields: {
    'ImageScaleToTotalPixels.megapixels': 'The size to bring the picture to, in millions of pixels: 1 for SDXL and newer models, about 0.25 for SD 1.5.',
    'InpaintModelConditioning.noise_mask': 'On: only the masked part is drawn again. Off: the whole picture is drawn, and an inpainting model uses the mask as a hint only.',
    'ImagePadForOutpaint.right': 'How many pixels to add on the right, in steps of 8; left, top and bottom work the same. A strip of about 256 at a time is easier for a model than a wide border.',
    'ImagePadForOutpaint.feathering': 'How many pixels of the old picture blend softly into the new frame, so the seam does not show.',
    'ControlNetApplyAdvanced.strength': 'How strictly the model keeps to the control picture: 1 strictly; about 0.6 freer inside the outlines; 0 switches it off.',
    'ControlNetApplyAdvanced.start_percent': 'From which part of the steps the ControlNet acts, 0 to 1. 0.2 lets the model lay out the picture itself first.',
    'ControlNetApplyAdvanced.end_percent': 'Up to which part of the steps the ControlNet acts, 0 to 1. 0.8 leaves the last steps free to draw the detail.',
    'Canny.low_threshold': 'Edges weaker than this are dropped; lower values keep more small detail.',
    'Canny.high_threshold': 'Edges stronger than this are always kept; with low_threshold it decides how many lines the picture gets.',
    'LoraLoader.strength_model': 'How much the LoRA changes the drawing. Usually 0.6 to 1; above 1 pictures often break. Give each of two chained LoRAs a little less than alone.',
    'LoraLoader.strength_clip': 'How much the LoRA changes the reading of words. 1 by default; 0 keeps the words as the model reads them without the LoRA.',
    'LoraLoader.lora_name': 'The LoRA file, from models/loras. It must be made for the family of the model it is loaded on; its card in the "Models" tab says the family and the trigger words.',
    'LoraLoaderModelOnly.lora_name': 'The LoRA file, from models/loras, for models whose text reader is loaded apart (Flux, Qwen-Image, Z-Image, Wan). It must be made for the same family.',
    'LoraLoaderModelOnly.strength_model': 'How much the LoRA changes the drawing; 1 is the strength it was trained at. A speed-up LoRA is used at the strength its page names.',
    'SAM3_Detect.threshold': 'How sure the finder must be: lower finds more, including look-alikes; higher may find nothing. 0.5 by default; 0.3 when the mask comes out empty.',
    'SAM3_Detect.individual_masks': 'On: a separate mask for each found object instead of one for all.',
    'StyleModelApply.strength': 'How much the sample picture weighs: at 1 Redux tends to copy it; about 0.5 leaves room for the words.',
    'StyleModelApply.strength_type': 'multiply scales the part the sample adds; attn_bias weighs it in the model\'s attention instead. Compare both on the same seed.',
    'IPAdapter.weight': 'How much the sample steers the model: 0.8 is a good start; 0.5 only tints; 1 and above presses the sample on the picture.',
    'IPAdapter.weight_type': 'standard takes style and content; style transfer takes the look only (precise with SDXL); prompt is more important lets the description lead.',
    'IPAdapterUnifiedLoader.preset': 'Which IP-Adapter to load: LIGHT is weak, STANDARD medium, PLUS strong, the FACE presets are for portraits. SD1.5-only presets say so in their names.',
    'FaceDetailer.denoise': 'How much a face is drawn again: 0.5 sharpens it and keeps its features; above 0.6 it may turn into another face.',
    'FaceDetailer.guide_size': 'The size a found face is enlarged to before it is drawn: 512 for SD 1.5, 1024 for SDXL.',
    'FaceDetailer.bbox_threshold': 'How sure the detector must be that it found a face; lower finds faces that are small or turned away, and false ones too.',
    'DepthAnythingV2Preprocessor.resolution': 'The size at which the depth is worked out; closer to the size of the picture gives finer detail. 1024 is a good start.',
    'ImageScale.width': 'The width to bring the picture to; 0 keeps the proportions from the height. For a second pass, twice the first picture.',
    'CLIPVisionEncode.crop': 'center cuts a square from the middle of the picture before the vision model sees it; none shows the whole picture squeezed.',
    'SaveImage.filename_prefix': 'The start of the file name; a slash makes a subfolder in output, for example portraits/test.',
  },
};
