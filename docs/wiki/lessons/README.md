[Русский](README.ru.md)
[Home](../Home.md) › Lessons

# Lessons

Learn mode holds the built-in lessons, in groups by topic, and after them the group **My lessons** with the lessons you make or import. This chapter has one page per built-in lesson, in the order of the list in the app.

## What Learn mode is
In Learn mode you build real graphs by hand on the canvas while the app leads you step by step: what to do, why, where it is on the canvas. It sees from the canvas when a step is done. No assistant model is needed. Lessons use only the nodes your ComfyUI has, and they never download model files: you bring those to ComfyUI yourself. How it all works: [How lessons work](How-Lessons-Work.md).

A lesson card may say that the lesson goes on from another one. That is a hint, not a lock: any lesson can be started on its own.

## The lessons by group

### Start and a reliable setup
Level 0, before everything else: choose how to run ComfyUI, install it and prove it with a first picture, keep a model
library, install a first pack safely, and update with a way back. The app reads ComfyUI and never changes it: what you
do in ComfyUI is your own word.

- [Desktop, Portable, a manual install or Cloud](Choose-Setup.md): lesson "choose-setup". A written choice of how you run ComfyUI, with its limits, made before anything is installed.
- [Install and a first run without errors](First-Run.md): lesson "first-run". A working install proven by a first picture, and an environment card: system, graphics card, version, way of install and folders.
- [A model library and shared folders](Model-Library.md): lesson "model-library". Models in the folders ComfyUI looks in, one copy of each, and a manifest of the important files with their hashes.
- [The Manager: a first node pack, safely](First-Pack.md): lesson "first-pack". A first node pack installed through the Manager, its source and version checked, the import log clean, and a run that uses its node.
- [Snapshots, updates and the way back](Snapshots.md): lesson "snapshots". An update made with a tested point to return to, the control workflow run before and after, and a written way back.

### ComfyUI basics

- [How ComfyUI works](How-ComfyUI-Works.md): lesson "comfy-basics". You learn what a graph, the queue and the models folder are, and find a node, an output and a model file yourself.
- [Reading someone else's workflow](Reading-A-Workflow.md): lesson "read-workflow". You learn to read groups, notes, reroutes, primitives, Set and Get, bypassed nodes and subgraphs, and give two fields one value.
- [When the graph does not fit the graphics card](Graph-Too-Big.md): lesson "vram". You learn why a graph runs out of memory and what to change, and set the picture graph up to need less of it.

### Pictures: first steps

- [A first picture from text](Image.md): lesson "image". You build a graph of seven nodes that draws a picture from a prompt.
- [The prompt: how a model reads it](Prompt.md): lesson "prompt". You learn what a model does with text and how to steer a picture with words.
- [The sampler's settings](Sampler-Settings.md): lesson "sampler-fields". You set the fields of the sampler the way ComfyUI's own SDXL template sets them, and learn what each one does.
- [Refining with a second model](Refine.md): lesson "refine". A second model redraws a finished picture: the composition comes from the first, the texture and style from the second.

### Video

- [Video from text](Video-Text.md): lesson "video-text". You build a Wan 2.2 graph that makes a five-second clip from a prompt.
- [A prompt for video](Prompt-Video.md): lesson "prompt-video". You learn to describe a clip so that the model understands the motion and the camera.
- [Video from a picture](Video-Image.md): lesson "video-image". You bring a finished picture to life: it becomes the first frame of the clip.
- [LoRA: add a style or a subject](LoRA.md): lesson "lora". You connect a LoRA to both models and put its words into the prompt.
- [Fast video in four steps](Video-Fast.md): lesson "video-fast". You cut twenty steps down to four with a speed-up LoRA.
- [Two models in one graph](Two-Models.md): lesson "two-models". A picture model draws the first frame and Wan brings it to life. Each has its own LoRAs and its own prompt.
- [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md): lesson "video-small". You build a one-model Wan 2.2 graph that makes a five-second 720p clip from a prompt, or from an image.
- [When a video does not fit in memory](Video-Memory.md): lesson "video-memory". You change the graph of the small Wan model so that it needs less graphics memory, and you know what each change costs.
- [Video guided by another video: Wan 2.2 Fun Control](Video-Control.md): lesson "video-control". Your image comes to life with the motion of another video: its depth, its pose or its edges.
- [A portrait that speaks: HuMo](Video-Speech.md): lesson "video-speech". A person from an image says the words of a sound file, with ComfyUI's own nodes, no pack.
- [Video with sound: LTX-2.5](Video-LTX.md): lesson "video-ltx". One run draws a clip and its sound together, from a prompt.
- [Video from text: HunyuanVideo 1.5](Video-Hunyuan.md): lesson "video-hunyuan". You build the HunyuanVideo 1.5 graph with a custom sampler and get a five-second 720p clip.
- [Video from text: Kandinsky 5 Lite](Video-Kandinsky.md): lesson "video-kandinsky". You build a light one-model graph that makes a five-second clip from a prompt.
- [Smoother motion: more frames between frames](Video-Interpolate.md): lesson "video-interpolate". A finished clip gets twice as many frames and plays smoothly at twice the frame rate.

### WanVideoWrapper

- [Video on WanVideoWrapper](Wrapper.md): lesson "wrapper". You build a Wan 2.2 graph on the nodes of the WanVideoWrapper pack and see how it differs from the built-in one.
- [Video from a picture on WanVideoWrapper](Wrapper-Image.md): lesson "wrapper-image". A clip made on WanVideoWrapper nodes starts from your picture.
- [VACE: motion from another video](Wrapper-VACE.md): lesson "wrapper-vace". A clip on WanVideoWrapper repeats the motion, the depth or the outlines of another video.
- [Animation by pose: Wan Animate](Wrapper-Animate.md): lesson "wrapper-animate". The character from your picture repeats the moves and the face of the person in a video.
- [Animation by pose: UniAnimate](Wrapper-UniAnimate.md): lesson "wrapper-unianimate". The character from a picture repeats the moves of a person in a video. A Wan 2.1 model and one LoRA are enough.
- [A talking video: InfiniteTalk](Wrapper-Talk.md): lesson "wrapper-talk". A portrait says the words of a sound file, the lips in time with them.
- [Two people talking: InfiniteTalk](Wrapper-Duo.md): lesson "wrapper-duo". Two people in one picture speak, each with their own voice.
- [A talking portrait: FantasyTalking](Wrapper-Fantasy.md): lesson "wrapper-fantasy". A portrait says a short voice recording. The graph is simpler than InfiniteTalk's, the clip shorter.
- [A video with sound: Ovi](Wrapper-Ovi.md): lesson "wrapper-ovi". One run draws the clip and its sound at once: the character's speech, steps, street noise.
- [Another camera: ReCamMaster](Wrapper-ReCam.md): lesson "wrapper-recam". A finished video is drawn again as if the camera had moved another way.

### Pictures: models

- [SDXL done properly](SDXL.md): lesson "sdxl". You set an SDXL graph to the size and the settings the family was trained for.
- [Pony and Illustrious: tags instead of sentences](Pony-And-Illustrious.md): lesson "tags". You write a tag prompt with the quality words of the model's page and set the size and sampler such models are used with.
- [Choosing a sampler and a scheduler](Choosing-A-Sampler.md): lesson "samplers". You put two samplers side by side that differ in one setting only, and learn to choose by comparing.
- [Which loader for which file](Which-Loader.md): lesson "loaders". You find the right loader for four kinds of model files and learn where ComfyUI looks for each.
- [Flux.1: a picture from separate files](Flux1.md): lesson "flux". You build a Flux graph of ten nodes, where the model, the two text encoders and the VAE come from loaders of their own.
- [Z-Image Turbo: a picture in eight steps](Z-Image-Turbo.md): lesson "zimage-turbo". You build a graph for a distilled model that draws in 8 steps with cfg 1, and learn why its negative prompt does nothing.
- [Qwen-Image: words inside the picture](Qwen-Image.md): lesson "qwen-image". You build a Qwen-Image graph with a real negative prompt, the shift of the family and its own size.
- [Flux.2 Klein: a sampler built from parts](Flux2-Klein.md): lesson "flux2-klein". You build the graph of a small Flux.2 model, where the sampler is put together from five nodes.
- [SD 3.5: one file and a new empty latent](SD35.md): lesson "sd35". You build an SD 3.5 graph from one checkpoint with the empty latent and the settings of this family.
- [A quantised model: GGUF](GGUF.md): lesson "gguf". You put a GGUF model into a graph of separate files, so a large model fits a smaller video card.

### Video: the anchor picture

- [The start picture is the anchor](Anchor-Start.md): lesson "anchor-start". Your picture becomes the first frame of the clip, and you know how to trade motion for likeness.
- [Two anchors: first and last frame](First-And-Last-Frame.md): lesson "video-flf". You give two images, and the model draws the clip that goes from the first to the last.
- [A reference for the whole clip: Wan VACE](Anchor-Reference.md): lesson "anchor-reference". A person or an object from your picture stays itself in every frame, not only in the first.
- [A longer video in parts](Anchor-Parts.md): lesson "anchor-parts". Two parts of a clip join through a shared anchor frame into one longer video.

### Packs and tools

- [Load, cut and save video: VideoHelperSuite](VideoHelperSuite.md): lesson "video-vhs". You load a piece of a video at a chosen frame rate and save it with its sound.
- [A larger, sharper video: SeedVR2](Video-Upscale.md): lesson "video-upscale". A low-resolution clip is redrawn at 1080p with its details restored.
- [Remove an object from a video: ProPainter](Video-Remove.md): lesson "video-remove". An object marked by a mask video disappears, and the background behind it is filled in from the neighbouring frames.
- [ControlNet from a depth map](ControlNet-Depth.md): lesson "controlnet-depth". The comfyui_controlnet_aux pack turns a picture into a depth map, and the model draws a new scene in the same space.
- [A reference picture with IP-Adapter](IP-Adapter.md): lesson "ipadapter". An SD 1.5 or SDXL model takes the style of a sample picture through the ComfyUI_IPAdapter_plus pack.
- [Fixing faces and hands with a detailer](Detailer.md): lesson "detailer". The Impact Pack finds the faces in a finished picture and draws each one again at a larger size, so small faces come out sharp.
- [Two versions of a prompt with one switch](Prompt-Switch.md): lesson "switch". You keep two prompts in one graph and choose between them with one yes/no value, the way ComfyUI's templates do.
- [A language model writes the prompt](LLM-Prompt.md): lesson "llm-prompt". You let a language model inside ComfyUI turn a short idea into a detailed prompt, and compare it with your own by the switch.

### Pictures: techniques

- [A picture from a picture](Image-To-Image.md): lesson "img2img". A picture you already have becomes a new one: the same composition, drawn again by the model as the prompt says.
- [Inpainting: redraw part of a picture](Inpainting.md): lesson "inpaint". You paint a mask over part of a picture, and the model draws only that part again, by a new prompt.
- [Outpainting: a picture beyond its edges](Outpainting.md): lesson "outpaint". A picture gets a new strip on one side, and the model draws what lies beyond the frame.
- [A mask by words](Mask-By-Words.md): lesson "mask-text". ComfyUI finds an object by its name and gives its mask to the inpainting node, with no painting by hand.
- [Upscaling with a model](Upscale.md): lesson "upscale". The finished picture is enlarged by a model that draws sharp detail instead of stretching the pixels.
- [A second pass after upscaling (hires fix)](Hires-Fix.md): lesson "hires-fix". The enlarged picture is drawn once more by the model: sharp detail at a size the model cannot draw in one go.
- [ControlNet: drawing along the edges of a picture](ControlNet.md): lesson "controlnet". The model draws a new picture that keeps the outlines of a sample picture.
- [LoRA for pictures](LoRA-Image.md): lesson "lora-image". Two LoRAs in a chain change the style and the subject of a picture model, each with its own strength.
- [LoRA for a character: face, body, clothes, pose](LoRA-Character.md): lesson "lora-character". Three LoRAs on one picture, each tuned on its own, the face kept while a body or clothing LoRA works.
- [Editing a picture by words](Edit-By-Words.md): lesson "edit-words". A model made for editing changes a picture as an instruction says: "make the sofa green", "remove the cup".
- [A reference picture for style (Flux Redux)](Style-Reference.md): lesson "style-reference". A Flux.1 picture takes its look from a sample picture: colours, materials, mood.
- [Removing a background](Remove-Background.md): lesson "remove-background". A picture whose background is made transparent, saved as PNG.

### Sound and speech

- [Music from text: ACE-Step 1.5](Audio-Music.md): lesson "audio-music". You build a graph that writes a song from a list of styles and your lyrics.
- [A sound from text: Stable Audio](Audio-Sound.md): lesson "audio-sound". You build a graph that makes a sound effect or a short piece of music from a prompt.
- [Speech from text: Chatterbox](Audio-Speech.md): lesson "audio-speech". You build a graph that reads your text aloud in the voice of a short recording.
- [Sound for a silent video: MMAudio](Audio-Foley.md): lesson "audio-foley". You build a graph that listens to the frames of a silent clip and gives it a sound in time with them.
- [Speech to text: Whisper](Audio-Transcribe.md): lesson "audio-transcribe". You build a graph that writes down what is said in a recording and saves subtitles.

### 3D

- [A picture into a 3D model: Hunyuan3D 2](Image-To-3D.md): lesson "3d-image". You build a graph that turns one picture of an object into a 3D model you can open in other programs.

### Faces and characters

- [The same character in a new picture: FLUX.1 Kontext](Character-Kontext.md): lesson "character-kontext". You build a graph that draws your invented character again, in a new place or pose, with the same face and clothes.
- [One character in many pictures](Character-Series.md): lesson "character-series". You learn what holds a character's identity and practise a new pose and new clothes while the face stays.
- [The same face from one photo: IP-Adapter FaceID](Face-From-Photo.md): lesson "face-same-photo". You add IP-Adapter FaceID to the first picture graph so that a photo of a face drives the face of the new picture.
- [Put a face onto a picture: ReActor](Face-Swap.md): lesson "face-swap". You build a graph that puts a face from one picture onto a person in another picture you already have.
- [Restore a face in an old picture: ReActor](Face-Restore.md): lesson "face-restore". You build a graph that redraws blurred or damaged faces in a picture with a face restoration model.

### Experiments and quality
The first lessons of the new standard: a checklist, canvas steps, a check the app makes, a rubric, questions to check
yourself and a task of your own. The app checks the graph; the run and the assessment are your own word.

- [A controlled experiment: one change at a time](One-Factor.md): lesson "one-factor". Two pictures that differ in one setting only, a repeat that gives the same pictures, and a conclusion you can defend.
- [A quality rubric and a blind comparison](Blind-Compare.md): lesson "blind-compare". Criteria written before the run, two variants scored without knowing which is which, and a choice with its cost.
- [Model card: family, parts and license](Reading-A-Model-Card.md): lesson "model-card". A compatibility card for one model with its sources and unknowns, and the model tried with a LoRA of its own family.

### Diagnostics, performance and safety
Lessons of the new standard on finding the cause of a failure, auditing what you run and seeing what leaves your
computer. The app reads and checks; everything done in ComfyUI is your own word.

- [Diagnosing missing nodes, models and IMPORT FAILED](Diagnose-Missing.md): lesson "diagnose-missing". One failure named by its class with evidence, a known-good small graph that runs, and a fix confirmed by a second run.
- [Auditing someone else's workflow and a custom pack](Audit-Workflow.md): lesson "audit-workflow". A written verdict on a workflow and its packs: run, run with limits, or do not run, with the evidence and the unknowns.
- [Partner nodes: data, licenses and the cost of a run](Partner-Cost.md): lesson "partner-cost". A map of what a workflow sends out and under which terms, the cost of a series, and a local alternative that sends nothing.

### The daily work cycle
How you work with ComfyUI from day to day: a template made your own, the queue and the history, running one branch,
the log and a minimal failing example, and the forms of a workflow file. The app checks the graph; what you do in
ComfyUI is your own word.

- [Templates: from a ready workflow to your own](Template-Own.md): lesson "template-own". Your own version of a template, saved apart from it, with its inputs, outputs, models and notes written down and one task changed.
- [Run, queue, history and cancel](Queue-History.md): lesson "queue-history". Several runs queued on purpose, one cancelled while it waited, one stopped while it ran, and a finished one found in the history with its settings.
- [Partial execution and the cache](Partial-Cache.md): lesson "partial-cache". A graph with a cheap preview branch beside the saver, and proof of which branch ran and why a run was faster.

### For adults (18+)
Closed until the switch **Adult content (18+)** in **Settings ▸ Privacy** is on. Technique in general words for lawful adult (18+) work with consent; see [Content rules](../trust/Content-Rules.md).

- [Pictures for adults: what changes](Adult-Image.md): lesson "adult-image". You learn what the content of a picture depends on and check your graph.
- [Adult LoRAs: how to load and balance them](Adult-Lora.md): lesson "adult-lora". You load your own LoRA, check which model it fits and learn to balance two LoRAs.
- [Video for adults: what changes](Adult.md): lesson "adult". You learn what the content of a clip depends on and check your graph.

### My lessons

- [My lessons](My-Lessons.md): make a lesson from a graph, try it, save it, import and export lessons.
- [The lesson file format](Lesson-File-Format.md): what a `.lesson.json` file holds.

## About the lessons
- [How lessons work](How-Lessons-Work.md): choosing, following, Show me where, Do this for me, the next lesson.

For the ideas behind each step, read [ComfyUI concepts](../concepts/README.md).

## See also
- [Home](../Home.md)
- [Learn mode](../assistant/Learn.md)
- [The lessons panel](../interface/Lessons-Panel.md)
