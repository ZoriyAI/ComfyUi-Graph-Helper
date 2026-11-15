[Русский](Sync-Indicator.ru.md)
[Home](../Home.md) › [The window](README.md)

# The sync indicator

The sync indicator sits at the right end of the menu bar: a coloured dot and a few words that say whether the app has read your ComfyUI. A click opens a popover with the numbers, automatic sync and **Sync now**.

<!-- picture: the indicator "Up to date" with its popover open -->

## The states

| The indicator says | It means |
|---|---|
| "ComfyUI not read yet" | nothing has been read so far |
| "Starting…", "Syncing…" | a sync is running |
| "Reading models: 120 / 331" | the node list is read; the headers of model files are still being read |
| "Up to date" | the last sync worked |
| "Read with gaps" | the last sync read only part; the popover names what is missing |
| "Sync failed" | the last sync did not work; the popover says why |
| "Needs a token" | the MCP server needs a sign-in |
| "Library from another address" | the address was changed and the library still shows the old server: "Press “Sync now” to read the new one." |

## The popover

- The state, and while a sync runs the phase: "Reading nodes, packs, and models: 3 of 5".
- Where the library came from: "Read from ComfyUI at 127.0.0.1:8188.", "Read through the MCP server at …", or "Models read through the MCP server, nodes from ComfyUI at …". Read straight from ComfyUI, a second line says what that cannot give: "Straight from ComfyUI there are no description files next to models, no pack README files and no fingerprints; an MCP server that reads files adds them."
- **Nodes**, **Node types with known inputs and outputs**, **Node packs**, **Models**, **Model files read** ("330 / 330").
- **Last run**, **Duration**, **Next run** ("Off" without automatic sync), and "Last sync: …".
- Warnings and the last error, in words, for example "ComfyUI does not answer at 127.0.0.1:8188. Check that ComfyUI is running and the port is right. On another computer, ComfyUI must be started with --listen." Every sentence and its cause: [Connection problems](../connect/Connection-Problems.md).
- If the last sync did not finish, the popover says that automatic sync waits until you press **Sync now**.
- **Sync automatically** and **Interval, minutes** (at least 5). These apply at once. "At least 5 minutes. Only read-only tools are used; nothing changes in ComfyUI."
- **Sign in** when the server wants a browser sign-in, **Pause metadata reading** while model files are read, and **Sync now**.

With no address set, a press on the indicator says "The ComfyUI address is not set" with **Open connection settings**.

When a sync ends, a message at the bottom right says what was read: "Read from ComfyUI. Nodes: 75, packs: 5, model files: 331." A screen reader hears the start and the end of a sync. With warnings: "Synced with warnings".

## See also

- [Sync menu](Sync-Menu.md)
- [Settings: Sync](Settings-Sync.md)
- [Connection problems](../connect/Connection-Problems.md)
- [The library](Library.md)
