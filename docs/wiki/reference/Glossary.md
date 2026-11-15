[Русский](Glossary.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Glossary

The words of ComfyUI and of the app, in short. Help ▸ Glossary opens this page. The first list is the app's own
glossary: lesson steps and the tour of the window underline the first mention of these words with dots and show the
same sentence on hover or `Tab`. A linked word leads to the page that explains it. In brackets: the word the ComfyUI
community uses in English, the one to search for.

## The glossary of the app

- **[API format](../concepts/Workflow-Formats.md)**: A form of workflow file for programs, without positions and notes; ComfyUI saves it with "Export (API)".
- **[assistant](../assistant/Assistant.md)**: The part of this app that answers questions about the graph and can propose changes.
- **[batch](../concepts/Batch.md)**: Several pictures made or passed at once; it multiplies the memory a run needs.
- **block swap**: Keeping some blocks of a model in ordinary memory and bringing each to the card for its turn.
- **[bypass](../concepts/Bypass-And-Mute.md)**: Skipping a node so that its inputs pass straight through (Ctrl+B, purple).
- **[canvas](../interface/Canvas.md)**: The surface where the nodes of a graph stand.
- **[CFG](../concepts/CFG.md)**: How strictly the model follows the prompt.
- **[checkpoint](../concepts/Checkpoint.md)**: One file with a whole model: the part that draws, the text encoder and the VAE.
- **[CLIP](../concepts/Text-Encoders.md)**: A family of text encoders (and of picture encoders, CLIP Vision); in ComfyUI the CLIP link carries any text encoder.
- **[CLIP Vision](../concepts/Reference-Images.md)**: An encoder that reads a picture for IP-Adapter, Redux or image to video.
- **[ComfyUI](../concepts/What-Is-ComfyUI.md)**: The program that runs AI models as a graph of nodes; this app prepares graphs for it.
- **[ComfyUI Manager](../concepts/Node-Packs.md)**: The part of ComfyUI that installs and updates node packs.
- **[conditioning](../concepts/Conditioning.md)**: The encoded prompt that the sampler follows.
- **[ControlNet](../concepts/ControlNet.md)**: A model that makes a picture follow a pose, edges or depth from a guide image.
- **[credits](../concepts/Paid-API-Nodes.md)**: The prepaid units of a Comfy account that partner nodes spend.
- **[data type](../concepts/Data-Types.md)**: What a link carries (MODEL, CLIP, LATENT, IMAGE…); an output connects only to an input of the same type.
- **[denoise](../concepts/Denoise.md)**: How much of the starting latent is replaced with noise: 1 from scratch, less to keep part of a picture.
- **[diffusion model](../concepts/Separate-Loaders.md)** (also: diffusion model (UNet)): Only the part that draws, loaded with Load Diffusion Model; also called the UNet.
- **[distilled model](../concepts/Speed-Up-LoRAs.md)** (also: distilled / turbo / lightning): A model or LoRA trained to work in a few steps (turbo, lightning, lightx2v), usually with cfg 1.
- **[embedding](../concepts/Prompt-Syntax.md)** (also: embedding (textual inversion)): A tiny file that adds a word to the text encoder (textual inversion).
- **[empty latent](../concepts/Latent.md)**: The blank of noise of a set size that text to image starts from.
- **[family](../concepts/Model-Families.md)** (also: base model (architecture)): The base model a file belongs to (SDXL, Flux, Wan…); parts of different families do not mix.
- **[field](../graph/Node-Fields.md)** (also: widget (field)): A setting on a node, such as a number, a text or a file choice.
- **[fine-tune](../concepts/Model-Families.md)** (also: fine-tune (merge)): A model trained further from a base model for a style or a subject; it keeps the family.
- **fp8**: An 8-bit format that halves the memory of a 16-bit model at a small loss.
- **[fps](../concepts/Video-Length-And-Frame-Rate.md)**: Frames per second: how fast the frames of a clip follow each other.
- **[frame](../concepts/Video-Length-And-Frame-Rate.md)**: One picture of a video.
- **[GGUF](../lessons/GGUF.md)**: A file format of quantised models (Q8, Q5, Q4…), read in ComfyUI by the ComfyUI-GGUF pack.
- **[graph](../concepts/Reading-A-Workflow.md)**: Nodes and the links between them: the recipe of a picture, a video or a sound.
- **[graph version](../graph/History-And-Undo.md)**: A saved state of the graph in this app's history, to go back to.
- **[grey drafts](../assistant/Drafts.md)**: Changes the assistant proposes, shown in grey on the canvas until you accept them.
- **[group](../graph/Groups.md)**: A coloured frame with a title around nodes; it only organises the canvas.
- **[hires fix](../concepts/Upscaling.md)**: A second pass that enlarges a picture and redraws it with a low denoise.
- **[image to image](../concepts/Image-To-Image.md)** (also: image to image (i2i)): Redrawing an existing picture with a denoise below 1.
- **[image to video](../concepts/Video-Models.md)** (also: image to video (i2v)): A clip that starts from a given picture.
- **[inpainting](../concepts/Inpainting.md)**: Redrawing only a masked part of a picture.
- **[input](../concepts/Nodes-And-Links.md)** (also: input (socket, slot)): A dot on the left of a node where a link brings data in.
- **[input folder](../concepts/Where-Files-Live.md)**: The folder ComfyUI/input where pictures, videos and sounds you load are kept.
- **[IP-Adapter](../concepts/Reference-Images.md)**: An add-on that carries the look or the face of a reference picture into a new one.
- **[language model](../lessons/LLM-Prompt.md)** (also: LLM (language model)): A model that reads and writes text; in a graph it can write or improve a prompt.
- **[latent](../concepts/Latent.md)**: The compressed form of a picture or a clip that the model works in.
- **[link](../concepts/Nodes-And-Links.md)** (also: link (wire, noodle)): A line from an output of one node to an input of another that carries data.
- **[LoRA](../concepts/LoRA.md)**: A small add-on trained on top of a base model for a style, a character or a speed-up.
- **[mask](../concepts/Inpainting.md)**: A black and white picture that says which part to change.
- **[MCP server](../connect/MCP-Servers.md)**: An optional program next to ComfyUI that lets this app read more of it; a plain ComfyUI address is enough.
- **model**: A trained network in a file that draws, reads text or does another task.
- **[models folder](../concepts/Where-Files-Live.md)**: ComfyUI/models, with one sub-folder per kind of model file.
- **[mute](../concepts/Bypass-And-Mute.md)**: Switching a node off so that it and what depends only on it do not run (Ctrl+M, grey).
- **[negative prompt](../concepts/Negative-Prompt.md)**: The text of what must not be in the result.
- **[node](../concepts/Nodes-And-Links.md)**: One block of a graph that does one thing: loads a model, encodes a prompt, saves a picture.
- **[node pack](../concepts/Node-Packs.md)** (also: custom nodes (node pack)): A folder in custom_nodes that adds nodes to ComfyUI; it runs its author's code.
- **[note](../concepts/Notes-Reroutes-Primitives.md)**: Text on the canvas that never runs; authors put instructions and model files there.
- **[offloading](../concepts/Graphics-Card-Memory.md)**: Keeping parts of the work in ordinary memory and moving them to the card when needed.
- **[out of memory](../concepts/Graphics-Card-Memory.md)** (also: OOM (out of memory)): The error when the graphics card has no room left for a step.
- **[outpainting](../concepts/Outpainting.md)**: Extending a picture beyond its edges.
- **[output](../concepts/Nodes-And-Links.md)**: A dot on the right of a node where its result goes out.
- **[output folder](../concepts/Where-Files-Live.md)**: The folder ComfyUI/output where the save nodes write files.
- **output node**: A node that shows or saves a result; only the part of a graph that leads to one runs.
- **[partner nodes](../concepts/Paid-API-Nodes.md)** (also: partner nodes (API nodes)): Nodes that run commercial models in the cloud for money; the inputs are sent to that service.
- **[pickle file](../concepts/Unsafe-Model-Formats.md)** (also: pickle (.ckpt, .pt, .pth, .bin)): An old model format (.ckpt, .pt, .pth, .bin) that can run code when loaded.
- **precision** (also: precision (fp32, fp16, bf16)): How many bits each number of a model has: fp32, fp16, bf16; fewer bits, a smaller file.
- **[primitive](../concepts/Notes-Reroutes-Primitives.md)**: A node that holds one value and passes it to fields of other nodes.
- **[prompt](../concepts/Prompt.md)**: The text that tells the model what to make.
- **[prompt weight](../concepts/Prompt-Syntax.md)** (also: prompt weighting): More or less pull for words, written (words:1.2).
- **quantization**: Storing a model with fewer bits per number to make it smaller.
- **[queue](../concepts/What-Is-ComfyUI.md)**: The list of graphs ComfyUI will run one after another.
- **[reroute](../concepts/Notes-Reroutes-Primitives.md)**: A dot on a link that only passes data on, to route long links.
- **[Run](../graph/Running-In-ComfyUI.md)** (also: Run (Queue Prompt)): The ComfyUI button (Ctrl+Enter) that puts the graph into the queue; older versions call it Queue Prompt.
- **[safetensors](../concepts/Unsafe-Model-Formats.md)**: The safe model format: it holds only numbers and cannot run code.
- **[sampler](../concepts/Sampler.md)** (also: sampler (KSampler)): The node (KSampler) that removes noise step by step and makes the picture.
- **[sampler method](../concepts/Sampler.md)** (also: sampler (sampler_name)): The method of removing noise chosen in sampler_name: euler, dpmpp_2m and others.
- **[scheduler](../concepts/Scheduler.md)**: How the noise is spread over the steps: karras, normal, simple, beta.
- **[seed](../concepts/Seed.md)**: The number the starting noise is made from; the same seed repeats the result.
- **Set / Get** (also: Set / Get nodes): Nodes of a pack that pass a value by name without a visible link.
- **shift**: A setting of flow models that moves the steps toward composition or toward detail.
- **[steps](../concepts/Steps.md)**: How many times the sampler removes a share of the noise.
- **[subgraph](../concepts/Subgraphs.md)**: A node that holds a whole graph inside.
- **switch**: A node that passes one of two inputs, chosen by a yes/no value.
- **[sync](../interface/Sync-Menu.md)**: This app reading the nodes and models of your ComfyUI anew ("Sync now").
- **[T5](../concepts/Text-Encoders.md)**: A large text encoder that understands sentences, used by Flux.1, SD3 and (as UMT5) by Wan.
- **template** (also: workflow template): A ready workflow that ComfyUI offers in its template browser, with notes about the files it needs.
- **[text encoder](../concepts/Text-Encoders.md)**: The model that turns a prompt into conditioning; CLIP, T5 or a language model.
- **[text to image](../concepts/Text-To-Image.md)** (also: text to image (t2i)): Making a picture from a prompt alone.
- **[text to video](../concepts/Video-Models.md)** (also: text to video (t2v)): A clip made from a prompt alone.
- **tiling** (also: tiled VAE (tiling)): Working on a picture piece by piece to need less memory, as the tiled VAE does.
- **[trigger word](../concepts/LoRA.md)**: A word a LoRA was trained with that switches it on in the prompt.
- **[upscale](../concepts/Upscaling.md)**: Making a picture larger, by a resize, an upscale model or a second pass.
- **[upscale model](../concepts/Upscaling.md)**: A small model (ESRGAN and kin) that enlarges a finished picture in pixels.
- **[VAE](../concepts/VAE.md)**: The model that turns a latent into pixels and back.
- **[VRAM](../concepts/Graphics-Card-Memory.md)**: The memory of the graphics card, where models and the working data of a run must fit.
- **[workflow](../concepts/Workflow-Formats.md)**: A graph saved as a .json file that ComfyUI opens and runs.
- **[workflow in a picture](../concepts/Workflow-Formats.md)** (also: workflow metadata (workflow in PNG)): The workflow ComfyUI writes into every picture it saves; dropping the picture back restores the graph.

## More words of the app

- **Ask, Build, Learn**: the three modes of the assistant panel. Ask answers and suggests grey drafts; Build changes
  the graph; Learn opens the lessons. [Ask](../assistant/Ask.md), [Build](../assistant/Build.md),
  [Learn](../assistant/Learn.md)
- **Catalog**: what the app read from your ComfyUI: node types, node packs and model files.
  [Reading ComfyUI](../dev/Reading-ComfyUI.md)
- **Check**: Graph ▸ Check graph; finds missing nodes and models, wrong links and empty fields before you save.
  [Checking a graph](../graph/Checking-A-Graph.md)
- **Choose the assistant**: who answers for the assistant: a cloud service or your own server.
  [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- **Context window**: how much text a model can read at once, counted in tokens.
  [The context window](../assistant/Context-Window.md)
- **Conversation log**: the record of what was sent to the model and what came back.
  [The conversation log](../assistant/Conversation-Log.md)
- **Description card**: the short card under a node that says what it is and why it is there.
  [Description cards](../interface/Description-Cards.md)
- **Example**: File ▸ Examples; the finished graph of a lesson, made of the nodes and model files you have.
- **Explanation**: the text that tells what a node, a link or the graph does, with its source (built in, from the
  model, from the web, yours). [The explanations tab](../interface/Explain-Panel.md)
- **Lesson**: a task you do by hand on the real canvas, step by step, checked by the app.
  [How lessons work](../lessons/How-Lessons-Work.md)
- **Library**: the left panel with your nodes, models and subgraphs. [The library](../interface/Library.md)
- **My lessons**: the lessons you made, imported or kept from the assistant. [My lessons](../lessons/My-Lessons.md)
- **Pause point**: the assistant stops after the number of steps set in Settings ▸ Assistant and asks whether to
  go on. Not to be confused with a checkpoint model file. [Pause and stop](../assistant/Pause-And-Stop.md)
- **Project file**: a file with the graph and everything the app knows about it (`*.nodewise.json`).
  [Project files](../graph/Project-Files.md)
- **Step**: one action of the assistant: reading the catalog, adding a node, drawing a link.
- **Token**: a piece of a word, the unit models count text in. Also the access token a server asks for: a password
  for programs.
- **Tour**: Graph ▸ Guided tour walks through the graph node by node; Help ▸ Tour of the window shows the parts of
  the window. [The tour of a graph](../graph/Tour.md)

## See also

- [Reference](README.md)
- [Start here](../concepts/Start-Here.md)
- [Code words and screen words](../dev/Code-Words.md)
