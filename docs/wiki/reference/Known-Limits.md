[Русский](Known-Limits.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Known limitations

What the app does not do, and where it is weak today. NodeWise Studio is an experimental project; this list says plainly
what to expect. Wishes go to the project's Discussions, problems to its Issues.

## By design

- **It never runs a workflow.** It builds and explains; ComfyUI runs. [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md)
- **It does not install nodes or models or queue prompts.** Explicit image uploads and supported local service controls are available.
  [Catalog reads and selected-file uploads](../trust/Read-Only.md)
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
- The constructor can upgrade an older workflow to format 1 inside the app. Existing subgraphs saved by current ComfyUI in a 0.4 envelope are also imported and preserved. [Subgraphs](../graph/Subgraphs.md)
- Legacy group nodes of older workflows are shown as one unknown node; they are saved back as they were.
- Native DynamicCombo modes, Autogrow sockets, DynamicGroup row counts, MatchType constraints and list marks are supported when the synced node definition declares them. Custom frontend JavaScript can still add controls whose serialization is unknown; those values are preserved and the app explains why editing is unavailable. [Dynamic fields and inputs](../graph/Adding-Nodes.md#dynamic-fields-and-inputs)
- Wrapping nodes moves their routing points into the subgraph; shared chains are kept on both levels. Dissolving restores the paths with independent point IDs.
- Modern subgraph files without legacy `proxyWidgets` keep their exposed settings and named values through import, editing and export.
- Native routing points support drag, arrow keys, tap menus and Undo on root and inner graphs. Removing a point keeps node connections. **Add routing point** in a link menu creates a native point; **Add legacy Reroute node** creates the older editor node.
- Group frames support mouse/touch/keyboard resizing and **Fit frame to its nodes**. Resizing is undoable and works inside subgraphs; native ComfyUI rectangles and unknown fields are preserved. ComfyUI recomputes membership from the exported rectangle; see [Groups](../graph/Groups.md).
- A picture or video opens only when ComfyUI wrote the workflow into it. A picture from elsewhere, or one sent
  through a chat app, usually has none.

- MP4, MOV, MKV and WebM can exceed the ordinary 64 MiB file limit: NodeWise seeks through headers and reads text metadata, skipping encoded frames. This also works in the paired browser; only metadata goes to the computer. Reading can be cancelled. Metadata is limited to 8 MiB, total reads to 16 MiB and 10 seconds; unsupported or damaged layouts ask for exported workflow JSON. Compressed MOV metadata is not inflated.

## The assistant and lessons

- The assistant can construct and edit native inner graphs, including definitions from earlier turns. Lessons check the displayed canvas or subgraph copy, with separately saved answers for each nested instance. Promoted settings belong to the selected copy; the definition’s structure and unpromoted fields are shared.
- A task paused at a step limit or repeated failures is saved with chat history. After restart, **Check and continue** reads the current graph and starts a fresh turn for the remaining work. Previous commands are not replayed. A different graph or incomplete saved task requires **Review the current graph** first. With chat history disabled, the task remains only in the open window.
- The quality of answers depends on the model. Small local models with a small context window lose track of long
  builds. [The context window](../assistant/Context-Window.md)
- The video lessons on WanVideoWrapper cover a part of that pack; the rest of its features have no lesson.
- Pending lesson and extension drafts survive restart when chat history storage is enabled. Each project keeps the newest 20 lesson drafts and 12 extension drafts. Accept a lesson or download an extension ZIP for a separate copy; clearing the chat also removes its pending drafts.

## Accessibility

- The arrow keys do not move the focus between nodes: they move the selected node, and `Tab` steps through the nodes.
- Not tried yet with a real screen reader.
- At 200 percent interface size on a 1080p screen the window does not fit.

More: [Accessibility](../trust/Accessibility.md).

## See also

- [Reference](README.md)
- [Troubleshooting](Troubleshooting.md)
- [Questions and answers](../start/FAQ.md)
