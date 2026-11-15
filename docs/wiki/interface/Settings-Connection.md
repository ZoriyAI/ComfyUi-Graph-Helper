[Русский](Settings-Connection.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Connection

"Where your ComfyUI is. The app only reads from it; nothing is queued or installed." The ComfyUI address comes first and is enough on its own; an MCP server is optional. The steps: [Connecting](../connect/Connecting.md). What each way can show: [What each way shows](../connect/What-Each-Way-Shows.md).

<!-- picture: the Connection section with the ComfyUI address found and checked -->

## From top to bottom

| Field or button | What it does |
|---|---|
| **ComfyUI address** | The address you open ComfyUI at in the browser. On this computer it is usually `http://127.0.0.1:8188`; the ComfyUI desktop app uses port 8000. The list of the field holds the addresses the app knows. |
| **Check ComfyUI** | Asks the typed address before you save: "ComfyUI 0.45.0 answers at this address. Save the settings, and the app reads it." An address typed without `http://` is completed. |
| **Find on this computer** | Looks at ports 8188 and 8000 of this computer and fills the address: "ComfyUI answers on this computer: http://127.0.0.1:8188." If nothing answers: "No ComfyUI answers on this computer at ports 8188 and 8000. Start ComfyUI, or enter its address." |
| hints | For an address on another computer: "ComfyUI on another computer answers only when it was started with --listen, for example --listen 0.0.0.0. Then the whole network can reach it, and ComfyUI has no password of its own: anyone on the network can use it. Do this only on a network you trust." For plain http between two computers: use https where the network is not yours. |
| the state | How the last reading went. |
| **Read now** | Reads ComfyUI with the saved settings. Save your changes first. |
| **Check this graph** | Compares the graph on the canvas with what was read: "Missing nodes: none. Missing models: none." It runs nothing. |

## MCP server (optional)

"ComfyUI does not serve the description files next to models (.civitai.info, .metadata.json), the README of node packs or the fingerprint of a file. An MCP server that reads files adds them. Leave this empty if you do not have one."

| Field or button | What it does |
|---|---|
| **MCP server address** | Paste the address as the server shows it, for example `http://127.0.0.1:9000/mcp`. A server on another computer needs https. |
| **Test server** | Asks the server what it is and which access it needs, and picks the access for you. |
| the kind of server | A line under the field: "This MCP server gives the whole catalog…", "This MCP server lists models only. The nodes come from the ComfyUI address above.", "This MCP server lists checkpoints only…", or, in red, "The app does not know the tools of this MCP server and reads nothing through it. The ComfyUI address above is enough." |
| **Access to the server** | **No sign-in**, **Token** (paste it in **Access token**; **Remember on this computer** keeps it encrypted in the system keychain) or **Sign in through the browser** (save the settings first, then **Sign in**). |

The official comfy-mcp, which runs as a local command, cannot be connected yet.

## Rules

- Never put a user name or password into an address: "Remove the user name and password from the address."
- The app calls only the tools that read. Nothing is started, uploaded or installed in ComfyUI.
- Every error sentence and its cause: [Connection problems](../connect/Connection-Problems.md).

## See also

- [Connecting](../connect/Connecting.md)
- [What each way shows](../connect/What-Each-Way-Shows.md)
- [Settings: Sync](Settings-Sync.md)
- [The sync indicator](Sync-Indicator.md)
