[Русский](What-Is-ComfyUI.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# What ComfyUI is and how it runs a graph

What ComfyUI is, and what happens between pressing Run and seeing a result.

## In plain words
ComfyUI is a free program that makes pictures, video and sound with open models on your own computer (or on a rented one). You do not press one "generate" button with a few settings. You build a **graph**: boxes called **nodes**, each doing one small job, joined by **links** that carry the result of one node to the next. Loading a model, reading your prompt, removing noise, turning the result into pixels and saving the file are all separate nodes.

ComfyUI has two halves. The **server** (written in Python) holds the models and does the work on the graphics card. The **editor** (a web page in your browser, or the window of ComfyUI Desktop) is where you build and run graphs. NodeWise Studio talks only to the server, and only to read it: which nodes exist, which packs and which model files are installed.

<!-- diagram: a row of boxes from left to right: Load Checkpoint, two CLIP Text Encode, KSampler (with Empty Latent Image below it), VAE Decode, Save Image; an arrow from a "Run" button into a queue, and from the queue to the output folder -->

## How a run works
1. You press **Run** in ComfyUI (or Ctrl+Enter). The editor turns the graph into a job and puts it into the **queue**.
2. The server takes jobs from the queue one at a time.
3. It looks for **output nodes**: nodes such as Save Image, Preview Image or Save Video that produce something you keep. It runs only the nodes these outputs need. A branch that leads to no output node is skipped.
4. It remembers results. When you run again, only the nodes whose inputs or settings changed are computed again. Change the prompt and the model is not loaded a second time; change nothing and nothing runs.
5. Results appear on the output node itself, in ComfyUI's list of finished jobs, and as files in the `output` folder of ComfyUI.

## Where you meet it in the app
The app does not run graphs. You build or study a graph here, save it with **File ▸ Save workflow for ComfyUI…**, open the file in ComfyUI and press Run there. The app reads your ComfyUI so that the node library, the model lists and the lessons match what you really have.

## Typical mistakes
- **"Prompt has no outputs"**: the graph has no output node. Add Save Image or Preview Image.
- **Nothing happens on a second run**: nothing changed, so ComfyUI reused the old result. Change the seed, or set `control_after_generate` to `randomize` (see [Seed](Seed.md)).
- **The first run takes long**: models are being read from disk into memory. Later runs are faster.
- **A red node after opening someone's workflow**: that node comes from a pack you have not installed. See [Node packs](Node-Packs.md).

## How the app helps
- The **Check** button finds what ComfyUI would refuse to run: missing nodes, model files that are not on disk, empty required inputs, links of the wrong type.
- Lessons and node descriptions explain each part before you ever run it; the first lesson, [How ComfyUI works](../lessons/How-ComfyUI-Works.md), starts here.
- The app never installs, downloads, queues or deletes anything in ComfyUI.

## See also
- [Nodes, inputs, outputs and links](Nodes-And-Links.md)
- [Workflow files](Workflow-Formats.md)
- [Where files live](Where-Files-Live.md)
- [Start here](Start-Here.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
- [Save a workflow for ComfyUI](../graph/Saving-Workflows.md)
- [What the app never does](../trust/Read-Only.md)
