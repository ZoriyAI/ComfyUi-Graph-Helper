[Русский](How-ComfyUI-Works.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# How ComfyUI works

<!-- lesson: comfy-basics -->
Lesson "comfy-basics", in the group **ComfyUI basics** of the lesson list. Steps: 10.

## What you will be able to do
You learn what a graph, the queue and the models folder are, and find a node, an output and a model file yourself.

## What you need
- Nodes: Load Image, Preview Image, Load Checkpoint.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Two programs** (reading)

   ComfyUI is the program that runs AI models: it draws pictures, makes videos and sounds on your graphics card. This app is the place where you build and read graphs for it.

   This app never runs anything. It reads which nodes and models your ComfyUI has, helps you build a graph and explains it, and saves it as a file. You run the file in ComfyUI. So the app cannot break or slow down your ComfyUI, and you always see what will run.

   This lesson is mostly reading, with three small practices on the canvas.

2. **A graph of nodes** (reading)

   In ComfyUI everything is a graph: nodes joined by links.

   - A node does one thing: loads a model, encodes a prompt, removes noise, saves a picture.
   - Its outputs are on the right, its inputs on the left. A link goes from an output to an input and carries the result on.
   - The colour of a link shows what it carries: a model, a prompt, a picture. An output connects only to an input of the same type.
   - Fields on a node are its settings: a number, a text, a file.

   A graph reads from left to right: loaders on the left, the result on the right. A saved graph is called a workflow, a .json file.

3. **Practice: find a node**

   Find the **Load Image** node and add it to the canvas. There are two ways: type its name into the search of the library on the left and double-click it, or press the "Node" button on the canvas toolbar.

   The search finds parts of names too: "load image" or just "image".

   Its `image` field chooses a picture from the input folder of ComfyUI. Any picture is fine here.

4. **Practice: an output**

   Add a **Preview Image** node and drag a link from the `IMAGE` output of **Load Image** to its `images` input.

   This is the smallest graph that runs: it loads a picture and shows it. **Preview Image** is an output node: it shows a result. Without an output node ComfyUI has nothing to run for and refuses the graph.

5. **The queue: what runs and in which order** (reading)

   In ComfyUI the Run button (Ctrl+Enter; older versions call it Queue Prompt) puts the graph into the queue. ComfyUI works the queue off one graph after another.

   - Only what leads to an output node runs: Save Image, Preview Image, Save Video. A node whose result goes nowhere is skipped.
   - The order follows the links, not the place on the canvas: a node runs when everything it needs is ready.
   - ComfyUI remembers results. Run the same graph again and only what you changed is worked out again; with nothing changed the run ends at once.

6. **Where results appear** (reading)

   - Save Image and Save Video write files into the output folder of ComfyUI (ComfyUI/output).
   - Preview Image only shows the picture on the node; it keeps it in a temporary folder.
   - The queue panel of ComfyUI lists every run with its pictures.
   - What you load comes from the input folder.

   ComfyUI writes the whole workflow into every picture it saves. Drop such a picture onto ComfyUI, or open it in this app, and you get the graph that made it.

7. **The models folder** (reading)

   Model files lie in ComfyUI/models, one sub-folder per kind:
   - checkpoints: whole models of the SD 1.5 and SDXL kind;
   - diffusion_models: only the part that draws, for Flux, Wan, Qwen-Image and most new families;
   - text_encoders: the part that reads the prompt;
   - vae: the part that turns the result into pixels;
   - loras: small add-ons for a style or a character;
   - controlnet, upscale_models, clip_vision and more.

   Each loader node lists only its own folder. A file in the wrong folder is not an error: it is simply not in the list. The library on the left shows the files by folder.

8. **Practice: find a model file**

   Add a **Load Checkpoint** node and open its `ckpt_name` field. The list shows the files of the checkpoints folder of your ComfyUI. Choose any.

   If the list is empty, your ComfyUI has no checkpoint yet. The app downloads nothing: take a model from its official page, put the file into ComfyUI/models/checkpoints, refresh ComfyUI and choose "Sync ▸ Sync now" here.

9. **Node packs** (reading)

   A node pack (custom nodes) adds nodes ComfyUI does not have: other models, tools, conveniences. It is a folder in ComfyUI/custom_nodes.

   People install packs through ComfyUI Manager, which is built into current ComfyUI: open the manager, search the pack by name, press Install, restart ComfyUI. When a workflow uses nodes you do not have, the manager offers to install the missing packs. Then choose "Sync ▸ Sync now" here.

   A pack runs its author's code on your computer. Install packs that many people use. Old model formats (.ckpt, .pt, .pth, .bin) can run code too: prefer .safetensors.

10. **From here to ComfyUI** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   In ComfyUI drag the saved file onto the canvas, or open it from the Workflow menu, and press Run. The result appears on the output node and, for the save nodes, in the output folder.

   If ComfyUI shows a red error, it names the node that failed. The usual messages (out of memory, a missing file, a missing node) are explained in this app's knowledge.

   Next: "A first picture from text" builds a real graph.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **Practice: find a node**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 4, **Practice: an output**:
  - a **Preview Image** node.
  - `IMAGE` of **Load Image** into `images` of **Preview Image**.
- Step 8, **Practice: find a model file**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint**: a value is chosen.

## What next
These lessons go on from this one: [Reading someone else's workflow](Reading-A-Workflow.md).

## See also
- [What ComfyUI is and how it runs a graph](../concepts/What-Is-ComfyUI.md)
- [Nodes, inputs, outputs, links and types](../concepts/Nodes-And-Links.md)
- [Data types](../concepts/Data-Types.md)
- [Reading someone else's workflow](../concepts/Reading-A-Workflow.md)
- [How lessons work](How-Lessons-Work.md)
