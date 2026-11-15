[Русский](Known-Limits.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Known limitations

What the app does not do, and where it is weak today. NodeWise Studio is an experimental project; this list says plainly
what to expect. Wishes go to the project's Discussions, problems to its Issues.

## By design

- **It never runs a workflow.** It builds and explains; ComfyUI runs. [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md)
- **It never changes ComfyUI.** It does not install nodes or models, download files or queue prompts.
  [ComfyUI is only read](../trust/Read-Only.md)
- **Two languages:** English and Russian.

## Systems and packages

- Only a `.deb` package for 64-bit x86 Linux is built. There is no AppImage, Flatpak, RPM or ARM package.
- Windows and macOS: the app can be built from source; the steps are untested there and each system has its own
  limits. [Windows](../dev/Building-On-Windows.md), [macOS](../dev/Building-On-macOS.md)
- No automatic updates: install a new version from the project's Releases yourself. [Updating](../start/Updating.md)

## Connection and reading

- The connection is checked against test servers that speak ComfyUI's routes; it has not yet been run against a real
  ComfyUI install.
- Straight from ComfyUI there are no descriptions next to model files, no pack READMEs and no fingerprints, so Find on
  the internet searches by file name only. An MCP server that reads files adds them.
  [What each way shows](../connect/What-Each-Way-Shows.md)
- An older ComfyUI lists model names only, without sizes or pictures.
- The official `comfy-mcp` of Comfy Org runs as a local command and cannot be connected yet; an MCP server whose tools
  the app does not know is not used.
- The context window of a model on your own server is read only from Ollama. Other servers do not report it; the app
  then notices a request that did not fit only by the token count of the answer.
- Model lookup: Civitai finds a file exactly by its fingerprint; Hugging Face is searched by the file name, and the
  card says it is a guess. Computing the fingerprint of a large file takes the server minutes, so sync does not do it.
- A node pack is described from its `pyproject.toml` and the start of its README; a pack without them shows only its
  name and version.
- When the cloud model has no web search of its own, the assistant searches through DuckDuckGo's HTML page, which can
  stop working when that page changes.

## The graph

- Inside a subgraph you cannot make a new subgraph or a group, and a nested subgraph cannot be dissolved: do that on
  the main canvas. Groups that came inside a subgraph from ComfyUI are kept on save but not shown.
- A workflow saved in the older format (0.4) cannot hold a subgraph; the app says so. Copy its nodes, start a new
  project (which uses format 1) and paste them there. [Subgraphs](../graph/Subgraphs.md)
- Legacy group nodes of older workflows are shown as one unknown node; they are saved back as they were.
- Inputs that grow as you connect them, and list marks on inputs, are not shown yet.
- Native reroute points are drawn, but cannot be added or moved.
- Dragging nodes is slow on graphs of more than about a hundred nodes.
- Pictures with a workflow inside them are not opened; open the workflow `.json` file.
  <!-- verify: opening a picture with a workflow inside -->

## The assistant and lessons

- The assistant builds only on the main canvas. If a subgraph is open, the canvas returns to the main level and says
  so. Lessons also run only on the main canvas.
- A pause at a checkpoint (the step limit) does not survive a restart of the app: ask again after the restart.
- The quality of answers depends on the model. Small local models with a small context window lose track of long
  builds. [The context window](../assistant/Context-Window.md)
- The video lessons on WanVideoWrapper cover a part of that pack; the rest of its features have no lesson.

## Accessibility

- Nodes and links on the canvas are hard to follow with a screen reader, and the assistant's answer is announced
  piece by piece while it is written.
- Only the canvas zooms; the rest of the window follows your system's text scaling.

More: [Accessibility](../trust/Accessibility.md).

## See also

- [Reference](README.md)
- [Troubleshooting](Troubleshooting.md)
- [Questions and answers](../start/FAQ.md)
