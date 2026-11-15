# User guide

Graph Helper for ComfyUI helps people who are new to ComfyUI. The app reads which nodes and models you have and helps you build a graph and understand it. You save the finished graph as an ordinary workflow and open it in ComfyUI.

## Installing

You need Linux x64. For a Debian-based system, use the `.deb` asset if it is attached to your chosen release. The source also has builders for `.rpm`, AppImage and a portable `.tar.gz` with a per-user `install.sh`; source support does not mean every published release contains every format. ARM builds are not provided. Desktop and OS compatibility still need checks on the target system.

```
sudo apt install ./comfyui-graph-builder_*.deb
```

The app appears in the menu as "Graph Helper for ComfyUI". From a terminal it starts with `comfyui-graph-builder`.

## First start

On an empty canvas the app shows three steps and marks the ones already done.

1. **Connect ComfyUI.** Choose "Connect…". In "Settings ▸ Connection", enter the address that opens ComfyUI in your browser, for example `http://127.0.0.1:8188` (ComfyUI Desktop usually uses port 8000). "Find on this computer" searches local addresses; "Check" checks the chosen address. Save the settings.
2. **Read ComfyUI.** Choose "Read ComfyUI" or "Sync ▸ Sync now". When the indicator at the top right says "Up to date", your nodes and models are in the library on the left.
3. **Choose who answers.** This is the model that explains and builds. A cloud model needs a key. A model on this computer (Ollama, LM Studio, vLLM) needs none: "Find local servers" finds it for you.

## Connecting to ComfyUI

The app reads ComfyUI directly over HTTP. No MCP server is required. It reads node classes and ports, model file names, and the headers and previews ComfyUI exposes. Older ComfyUI versions may provide only file names. Direct access does not provide sidecar model descriptions, pack README files or file fingerprints.

An optional MCP server with file-reading capabilities can add those details. Enter its own address in the separate MCP section and check the access it requires:

- "No sign-in": nothing to do. This is usual when the server is on this computer.
- "Token": paste the token the server gave you into "Access token". The app applies it at once and checks it with the server. Such a token lasts until the app restarts; "Remember on this computer" stores it in the system password store.
- "Sign in through the browser": first "Save settings", then "Sign in". A browser opens, you sign in to the server, and the app keeps the sign-in fresh by itself.

A token or a sign-in belongs to its server address. If you change the address, the old token is not sent to the new server.

If the server sits behind a gateway that adds its own prefix to tool names, the app still recognises the tools it needs.

## Three ways to work with the assistant

The switch under the input field of the assistant panel:

- **Ask.** The assistant answers and suggests. Its suggestions stand on the canvas in grey; only what you accept goes into the graph.
- **Build.** The assistant changes the graph step by step and writes next to each node why it is there.
- **Learn.** You build it yourself and the app tells you what to do and why. No model is needed for this.

Right-click a node, a port or a link: "Ask the assistant" about that part of the graph.

## Lessons

"Learn" has 45 lessons grouped by topic: a first picture from text, how a model reads a description, video on Wan 2.2, LoRA, video with the WanVideoWrapper pack and more. Related lessons are linked as suggestions; completion is not a prerequisite. A lesson is available when its required node classes and ports fit your ComfyUI. The lesson looks at the graph and sees by itself that a step is done. If something is wrong, it says in words what. "Show me where" and "Do this for me" are there where the choice is not yours to make.

## Canvas, nodes and subgraphs

- Nodes come from the library on the left: drag one, or choose "Add to canvas".
- Node fields change right on the node and in the "Properties" panel. Lists are read from your ComfyUI.
- "Graph ▸ Arrange the graph" (`Ctrl+Shift+L`) lays the graph out from left to right. One `Ctrl+Z` puts it back.
- A subgraph is edited from the inside, like the main canvas: enter it, add and delete nodes, change links. `Escape` takes you back out.
- "Check graph" compares the graph with the current catalog: classes, ports, links, required values, known model families and prompt advice. Success means these static checks found no problem; it does not prove execution, output quality or available GPU memory. Unknown metadata and incomplete/stale catalogs remain limits.
- Undo groups consecutive assistant steps from one run. It stops at a manual edit; another undo can undo that manual edit separately.

## Saving and exporting

- "File ▸ Save project" (Ctrl+S) writes a project file `.graph-helper.json`. It holds the graph and the explanations of its nodes and links, so after "Open project" the explanations are back. The first time the app asks where to save and suggests a name made of the graph's title; after that Ctrl+S writes to the same file without asking.
- "File ▸ Save project as…" (Ctrl+Shift+S) always asks where to save. A name typed without an extension gets `.graph-helper.json` (a workflow gets `.json`), so the file shows up in "Open".
- A dot next to the project name means the graph on the canvas is not in a project file as it stands. The app keeps the graph between runs anyway; the dot goes away after a save, and after undoing back to what was saved.
- "Open project", "Open workflow…" and "New project" ask first when the graph on the canvas is not saved to a project file. The previous graph stays in the version history either way.
- "File ▸ Save workflow for ComfyUI…" writes an ordinary workflow JSON. You open it in ComfyUI itself. If the check found errors, the app tells you about them first.
- "File ▸ Open workflow…" opens a workflow saved in ComfyUI. When you save it again, it goes back to ComfyUI exactly as it was, except for what you changed.
- If node fields hold values that look like a key or a token, the app asks before saving the file whether to leave them out.

## What the app reads and what it never does

The app only reads: node classes, node packs, model files and their descriptions. In ComfyUI itself it never installs, downloads, deletes or queues anything.

## Privacy

- The app goes to the internet in three cases, each controlled in "Settings ▸ Privacy". While it answers, the assistant may search the web and read pages: this is on until you turn it off. A model's description is looked up on Civitai and Hugging Face when you press "Find on the internet" in a model card. Looking up descriptions for all files during sync is off until you turn it on.
- A cloud model receives your question and the graph. Keys and tokens never go into that text.
- A cloud model's key goes only to the address you pasted it for. If you change the address, the key is not sent there until you paste it again.
- Keys are kept in the system password store when you chose "Remember on this computer". Otherwise they live until the app closes.

## The conversation log

When the assistant answers oddly or with an error, open "Help ▸ Conversation log…". It shows what the app sent to the model and what the model answered. "Save to a file…" puts the selected questions into one file you can send as a whole. Keys and tokens never go into the log. You can switch it off in "Settings ▸ Privacy ▸ Keep a log of the conversation with the model".

## Reliability

- A project file and a workflow are written whole or not at all: if writing is interrupted, the old file stays as it was.
- The graph history keeps up to 2000 versions per project. Very large graphs keep fewer, never fewer than 200. Older versions are removed by themselves.
- Before the database is upgraded to a new version, the app puts a copy of it next to it (see "Where your data lives" below).
- Undo on a graph of many hundreds of nodes can take a second or more.

## Where your data lives

Everything is in the folder `~/.config/comfyui-graph-builder`:

- `comfyui-desktop.db`: settings, the catalog that was read, the graph's history;
- `logs/`: the app log, `logs/model/`: the conversation log;
- `window-state.json`: the window's size and place;
- `comfyui-desktop.db.before-v16.bak` (the number is the database version): a copy of the database made before the last upgrade. One such copy is kept;
- `comfyui-desktop.db.damaged-<date>`: a damaged database the app put aside with your consent;
- `model-previews/`: example pictures and clips of models, at most 512 MB, the oldest are removed by themselves.

"Open data folder" in "Help ▸ About" opens this folder.

## Upgrading

Install the new package over the old one with the same command:

```
sudo apt install ./comfyui-graph-builder_*.deb
```

Settings, keys and projects are kept.

## Uninstalling

```
sudo apt remove comfyui-graph-builder
```

The data folder stays. To remove it too, first choose "Settings ▸ Privacy ▸ Forget all keys and tokens" (the app asks before it deletes anything), then delete the folder:

```
rm -rf ~/.config/comfyui-graph-builder
```

## Subject choice and adult learning

The assistant teaches graph construction and technical choices without an app-authored subject ban in its system prompt. Each model or provider has its own rules and capabilities. Adult lessons use factual, non-graphic explanations for lawful consensual 18+ use: obtain consent for real likenesses and voices, exclude minors and underage-looking subjects, and follow local law and sharing rules. Preview and example visibility remains your choice in Settings ▸ Privacy and in each model card.
