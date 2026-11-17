[Русский](Opening-Workflows.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Opening a workflow

A workflow is the graph ComfyUI saves, without explanations. Open one here to understand it, change it, or learn from it. The app shows it on the canvas and tells you at once what your ComfyUI is missing to run it. File formats: [Workflow formats](../concepts/Workflow-Formats.md).

## What you can open

- A workflow file (`.json`) saved by ComfyUI with **Workflow ▸ Save**.
- A workflow in the API format (saved with **Export (API)** in ComfyUI). It has no positions, so the app lays the nodes out from left to right. Node numbers and titles are kept.
- A picture or a video that ComfyUI saved: ComfyUI writes the workflow into the file. PNG and WebP pictures and MP4, WebM, MKV and MOV videos are read. JPEG, GIF and sound files are looked into the same way, but this was not tested.
- A project file of this app opens too (see [Project files](Project-Files.md)).

The file is read as data only. Nothing in it is run.

## Large videos

For MP4, MOV, MKV and WebM, the file size does not require loading the video into memory. The app reads its metadata and skips frames. On a paired phone or tablet, select the video from that device: only the extracted metadata is sent to the computer. **Cancel reading** stops a slow read without replacing the graph. If someone changes the graph during reading, those changes are kept and the import asks you to try again. A video without embedded workflow data needs a separate workflow JSON.

## Ways to open

- **File ▸ Open workflow…** (`Ctrl+I`), **Import** on the toolbar, or **Open a ComfyUI workflow** on the welcome card. The dialog **Open a workflow** lists workflows, pictures and videos.
- Drag a file from your file manager and drop it anywhere on the window. A text field and the canvas's own drops (a node or a model from the library) keep working as before.
- **File ▸ Open recent**: the last 10 files you opened or saved. While there are none it says "Nothing opened yet". The welcome card shows up to two recent files too.
- **File ▸ Examples**: see below.
- On the command line: `nodewise-studio file.png` (a workflow, a project, a picture or a video). If the app is already open, the file opens in the window that is open.

Every way opens the file the same way and gives the same message. If the graph on the canvas is not saved to a project file as it stands, the app first asks "Open a workflow?" with **Open workflow** and **Cancel**. The current graph stays in the history of graph versions.

## Examples

**File ▸ Examples** lists the finished graph of every lesson your ComfyUI can build, named after the lesson. Each one is built from your own nodes and model files. Fields only you can fill get the first fitting model file and a neutral English prompt.

- Until the app has read your ComfyUI the list says "Read ComfyUI first: examples are built from your nodes".
- An opened example says "An example: the finished graph of a lesson, made of the nodes and model files you have."
- Lessons for adults give no example.

## What you see after opening

1. The graph replaces the canvas. A message says what is missing, for example:
   "Workflow opened. Missing nodes: WanVideoSampler, WanVideoDecode. Missing models: loras/detail.safetensors."
   or "Workflow opened. No missing nodes. No missing models." When many are missing, it names two and says how many more. **Open check** opens the check.
2. The message also says where the workflow came from, for example "Read from the picture: ComfyUI keeps the workflow inside the pictures it saves." or "This file was in the API format, which has no positions: the app laid the nodes out from left to right."
3. If the node list of your ComfyUI has not been read yet, the message says so and offers **Sync now**: until then the app cannot tell which nodes are missing.
4. Once a node list has been read, the check runs by itself and marks what will not run.
5. Read the graph: press **Tour**, or select a node and look at its card.

The untitled graph is named after the file it came from, in the top bar and in the window title. Opening is one step of the history: `Ctrl+Z` brings the earlier graph back.

## How the file is drawn

- Each node keeps the size and colour the file gives it. Collapsed nodes are drawn as one title row; `Alt+C` or the node menu opens or collapses them.
- If nodes of the file cover each other, the app moves them down so that none covers another, and says how many it moved: "Nodes moved apart so none covers another". Columns and their order stay as the author made them. `Ctrl+Z` puts them back. This is not done inside subgraphs.
- The first view is the view saved in the file when it shows a node at a usable zoom. Otherwise the app fits the graph. A large graph opens at no less than 30 %.
- Reroute, Primitive, Note and Markdown Note nodes are drawn as in ComfyUI. Links in a note are shown as text. Set and Get nodes: select one, and a dashed line leads to its partner.
- Native routing points on links can be added, dragged, moved with arrow keys and removed. Tap a point to open its menu; Delete removes only the point and keeps the links. Undo restores the previous chain. Shared points move every link through them; the same controls work inside subgraphs.

## What the message means

- **Missing nodes**: node classes your ComfyUI does not have. They stay in the graph with a dashed frame and the mark **Not installed**, and show their saved values. The check calls them "Nodes that are not installed". Install the pack in ComfyUI yourself and sync.
- **Missing models**: model files named in the workflow that are not in your folders.
- "Saved for ComfyUI as they are, but shown differently here: group nodes show as one unknown node: 2." The app cannot draw old group nodes the way ComfyUI does, but it keeps them and writes them back unchanged.

## Saving it again

When you save it with **File ▸ Save workflow for ComfyUI…**, it goes back to ComfyUI exactly as it was, except for what you changed: positions, colours, groups, links and values you did not touch stay as they were. A workflow opened from the API format is saved as an ordinary canvas workflow.

## What can go wrong

- "There is no workflow in this file. ComfyUI writes one into the pictures and videos it saves itself; a picture from elsewhere, or one sent through a chat app, usually has none."
- "This kind of file cannot be opened here. Open a workflow (.json), a project, or a picture or video saved by ComfyUI."
- "This file does not look like a ComfyUI workflow (format 1 or the older 0.4 is expected). Open a workflow saved from ComfyUI."
- "This file is not a workflow: its text could not be read." The file is damaged or not JSON.
- "This file is too large to open."
- "This graph is too large to open (… nodes, … links). The app opens graphs of up to 1500 nodes and 3000 links, so that the canvas stays responsive. Nothing was changed." Nodes inside subgraphs count too. The largest real workflows have about 600 nodes.
- "This file is no longer there: it was moved or deleted." A recent file was moved.
- "This example needs nodes or model files your ComfyUI does not have."

On a graph of about 1000 nodes, moving around and zooming are slow.

## If the graph did not open last time

If the window closed before it finished drawing the graph, the next start asks once: "The graph did not open last time". **Start with an empty canvas** is the default: the graph stays in the history, and **Edit ▸ Undo** brings it back. **Open the graph again** tries once more.

## See also

- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [Checking a graph](Checking-A-Graph.md)
- [The tour of a graph](Tour.md)
- [File menu](../interface/File-Menu.md)
- [File formats](../reference/File-Formats.md)
