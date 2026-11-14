[Русский](README.ru.md)
[Home](../Home.md) › ComfyUI concepts

# ComfyUI concepts

An encyclopedia of ComfyUI for a newcomer, one idea per page. New here? Read [Start here](Start-Here.md) first: it orders these pages and pairs them with the lessons.

## Basics
- [Start here](Start-Here.md): The pages in the order a newcomer needs them.
- [What ComfyUI is](What-Is-ComfyUI.md): The server, the editor, the queue, output nodes and where results appear.
- [Nodes and links](Nodes-And-Links.md): How a graph is made of nodes joined by links.
- [Data types](Data-Types.md): MODEL, CLIP, VAE, LATENT, IMAGE, CONDITIONING and others.
- [Workflow formats](Workflow-Formats.md): The workflow file, the API format and pictures with a workflow inside.
- [Where ComfyUI files live](Where-Files-Live.md): models/, input/, output/ and custom_nodes/.

## Making a picture
- [Text to image](Text-To-Image.md): The basic seven-node graph.
- [Checkpoint](Checkpoint.md): The main model file.
- [Separate loaders](Separate-Loaders.md): Diffusion model, text encoder and VAE as separate files.
- [Text encoders](Text-Encoders.md): CLIP, T5 and why some models have two.
- [Conditioning](Conditioning.md): The encoded prompt the sampler follows.
- [The prompt](Prompt.md): How models read text: tags or sentences, order, length.
- [Prompt syntax and weights](Prompt-Syntax.md): What ComfyUI understands in a prompt, and what it does not.
- [The negative prompt](Negative-Prompt.md): Saying what you do not want.
- [Latent](Latent.md): The compressed picture the model works on.
- [VAE](VAE.md): Turning a latent into a picture and back.
- [Sampler](Sampler.md): The node that makes the picture step by step, and the sampler names.
- [Scheduler](Scheduler.md): How the noise is removed over the steps.
- [Steps](Steps.md): How many steps and what more of them changes.
- [CFG](CFG.md): How strictly the model follows the prompt; Flux guidance.
- [Seed](Seed.md): The number that makes a result repeatable.
- [Denoise](Denoise.md): How much of the starting picture is redrawn.
- [Resolution](Resolution.md): Picture sizes each family likes.
- [Batch](Batch.md): Several pictures in one run.

## Picture techniques
- [Picture to picture](Image-To-Image.md): Starting from a picture instead of noise.
- [Inpainting](Inpainting.md): Redrawing only part of a picture, and masks.
- [Outpainting](Outpainting.md): Extending a picture beyond its edges.
- [LoRA](LoRA.md): A small add-on that changes style or subject.
- [ControlNet](ControlNet.md): Guiding a picture with a pose, depth or edges; preprocessors.
- [Reference images](Reference-Images.md): IP-Adapter, Redux and editing models.
- [Upscaling](Upscaling.md): Making a picture larger.

## Model families
- [Model families](Model-Families.md): SD 1.5, SDXL, Pony, Flux, Wan and the rest; what fits with what.
- [Why families do not mix](Why-Families-Do-Not-Mix.md): What happens when files of different families meet.
- [SD 1.5](Family-SD15.md): The classic 512-pixel model.
- [SDXL](Family-SDXL.md): The 1024-pixel model with two text encoders.
- [Pony](Family-Pony.md): An SDXL line with score tags.
- [Illustrious](Family-Illustrious.md): An anime SDXL line.
- [SD 3 and 3.5](Family-SD3.md): Three text encoders, 16-channel latent.
- [Flux.1](Family-Flux1.md): dev, schnell and the tool models.
- [Flux.1 Krea](Family-Krea.md): A Flux.1 dev retrained for realism.
- [Flux.2](Family-Flux2.md): The second Flux generation, dev and Klein.
- [Chroma](Family-Chroma.md): An open model made from Flux.1 schnell.
- [Qwen-Image](Family-Qwen-Image.md): Text in pictures, and editing.
- [Z-Image](Family-Z-Image.md): A fast 6B image model.
- [Kolors](Family-Kolors.md): An SDXL-like model with a ChatGLM encoder.
- [AuraFlow](Family-AuraFlow.md): An open flow model.
- [Stable Cascade](Family-Stable-Cascade.md): A model that works in stages.
- [Wan 2.1](Family-Wan21.md): Open video, 1.3B and 14B.
- [Wan 2.2](Family-Wan22.md): The video model of the lessons.
- [HunyuanVideo](Family-HunyuanVideo.md): Tencent's video model.
- [LTX-2](Family-LTX2.md): Video with sound.

## Video and sound
- [Video models](Video-Models.md): How video generation differs from pictures.
- [Video length and frame rate](Video-Length-And-Frame-Rate.md): Frames, length and fps per model.
- [Wan 2.2 two passes](Wan-Two-Passes.md): Two experts, two samplers, one generation.
- [Speed-up LoRAs](Speed-Up-LoRAs.md): Four steps instead of twenty.
- [First and last frame](First-And-Last-Frame.md): A clip between two pictures.
- [Video to video](Video-To-Video.md): Motion, depth or camera from another video.
- [Pose animation](Pose-Animation.md): A character moves like a person in a video.
- [Talking portraits](Talking-Portraits.md): A face speaks a recording, with consent.
- [Audio](Audio.md): Sound in ComfyUI.

## Practice
- [Graphics card memory](Graphics-Card-Memory.md): Why memory runs out and what helps.
- [Node packs](Node-Packs.md): Custom nodes, installing them with ComfyUI Manager, and the risk.
- [Unsafe model formats](Unsafe-Model-Formats.md): Why .safetensors, and why old formats can run code.
- [Paid API nodes](Paid-API-Nodes.md): Partner Nodes that send data out and cost credits.
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md): Helper nodes and groups.
- [Bypass and mute](Bypass-And-Mute.md): Switching a node off without deleting it.
- [Subgraphs](Subgraphs.md): Several nodes packed into one.
- [Reading a workflow](Reading-A-Workflow.md): A method for someone else's graph.

## See also
- [Home](../Home.md)
- [Lessons](../lessons/README.md)
