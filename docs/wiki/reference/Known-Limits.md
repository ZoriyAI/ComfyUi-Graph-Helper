[Русский](Known-Limits.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Known limitations

What the app does not do, and where it is weak today. NodeWise Studio is an experimental project; this list says plainly
what to expect. Wishes go to the project's Discussions, problems to its Issues.

## By design

- **It never runs a workflow.** It builds and explains; ComfyUI runs. [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md)
- **It does not install nodes or models or queue prompts.** Explicit image uploads and supported local service controls are available.
  [ComfyUI is only read](../trust/Read-Only.md)
- **Two languages:** English and Russian.

## Systems and packages

- **Packages for Linux only**, 64-bit x86: `.deb`, `.rpm`, AppImage and a `.tar.gz`. There is no ARM package for
  Linux and no Flatpak.
- **Windows and macOS are installed from source by a script**: `install-windows.ps1` (Windows 10 22H2 and 11, x64)
  and `install-macos.sh` (macOS 13 or newer, Apple silicon or Intel) build the app on your computer and install it
  for your user. The app is not signed by a publisher on either system. The Linux packages are built, installed and
  started on the build server for every release; the Windows and macOS scripts are checked on GitHub's Windows and
  macOS machines on every change and **not yet tried on a range of real computers**. Reports in the project's Issues,
  with the script's log and your system version, are welcome.
  [Installing on Windows](../start/Installing-On-Windows.md), [Installing on macOS](../start/Installing-On-macOS.md)
- On Windows and macOS some texts still speak of Linux: the keychain setting and its hints name GNOME Keyring and
  KWallet, while Windows uses DPAPI and macOS the Keychain. On macOS the app's own menus stay inside the window; the
  menu bar at the top of the screen has only the standard app, Edit and Window menus.
- No automatic updates: install a new version from the project's Releases yourself. Settings ▸ Privacy ▸ Check for
  new versions can tell you when there is one. [Updating](../start/Updating.md)
- Not tried yet on a real desktop: installing the `.deb` with apt, the `.rpm` with dnf on Fedora, the final AppImage
  file. These are checked on CI only.

## Connection and reading

- Not tried yet on a real install: the connection was checked against test servers that answer the way ComfyUI
  does, not against a real ComfyUI, ComfyUI on Windows, the ComfyUI desktop app or a real MCP server.
- Straight from ComfyUI there are no descriptions next to model files, no pack READMEs and no fingerprints, so Find on
  the internet searches by file name only. An MCP server that reads files adds them.
  [What each way shows](../connect/What-Each-Way-Shows.md)
- An older ComfyUI lists model names only, without sizes or pictures.
- The official `comfy-mcp` of Comfy Org runs as a local command and cannot be connected yet; an MCP server whose tools
  the app does not know is not used.
- Context is read from available Ollama, LM Studio, llama.cpp or vLLM APIs. Automatic configuration and model load/unload require Ollama's native API. Start/stop/restart of supported local Linux systemd services is available in [Services](../interface/Settings-Services.md). Other operating systems, containers and arbitrary remote service administration are not supported.
- Model lookup: Civitai finds a file exactly by its fingerprint; Hugging Face is searched by the file name, and the
  card says it is a guess. Computing the fingerprint of a large file takes the server minutes, so sync does not do it.
- A node pack is described from its `pyproject.toml` and the start of its README; a pack without them shows only its
  name and version.
- When the cloud model has no web search of its own, the assistant searches through DuckDuckGo's HTML page, which can
  stop working when that page changes.

## Size of a graph

- **About a thousand nodes is slow.** On a graph of about 1000 nodes, dragging and zooming run at about 5 frames per
  second, and the first drawing takes many seconds.
- **The cap is 1500 nodes and 3000 links**, subgraphs counted. A larger workflow or project is refused before
  anything changes: "This graph is too large to open…". The largest of 1335 real workflows the app was tried on has
  603 nodes.
- If the canvas did not finish drawing a graph at the last start, the app asks once whether to start with an empty
  canvas (the graph stays in the history) or to open the graph again.

## The graph

- Subgraphs and groups can be created and edited on inner levels. Dissolving a nested instance preserves boundary links, inner frames and resolvable promoted controls. An ambiguous or unknown control mapping is refused without changing the graph.
- A workflow saved in the older format (0.4) cannot hold a subgraph; the app says so. Open it in a current ComfyUI and
  save it again, or copy its nodes into a new project (which uses format 1). [Subgraphs](../graph/Subgraphs.md)
- Legacy group nodes of older workflows are shown as one unknown node; they are saved back as they were.
- Inputs that grow as you connect them, and list marks on inputs, are not shown yet.
- Native reroute points of ComfyUI are drawn and saved back, but cannot be moved. Add reroute in the menu of a link adds
  a Reroute node instead.
- **A group frame follows its nodes.** You cannot resize it by hand: add nodes to it or take them out (Add to group,
  Take out of group).
- A picture or video opens only when ComfyUI wrote the workflow into it. A picture from elsewhere, or one sent
  through a chat app, usually has none.

## The assistant and lessons

- The assistant builds only on the main canvas. If a subgraph is open, the canvas returns to the main level and says
  so. Lessons also run only on the main canvas.
- A pause at a pause point (the step limit) does not survive a restart of the app: ask again after the restart.
- The quality of answers depends on the model. Small local models with a small context window lose track of long
  builds. [The context window](../assistant/Context-Window.md)
- The video lessons on WanVideoWrapper cover a part of that pack; the rest of its features have no lesson.
- A lesson the assistant drafted is gone after a restart unless you kept it in My lessons.

## Accessibility

- The arrow keys do not move the focus between nodes: they move the selected node, and `Tab` steps through the nodes.
- Not tried yet with a real screen reader.
- At 200 percent interface size on a 1080p screen the window does not fit.

More: [Accessibility](../trust/Accessibility.md).

## See also

- [Reference](README.md)
- [Troubleshooting](Troubleshooting.md)
- [Questions and answers](../start/FAQ.md)
