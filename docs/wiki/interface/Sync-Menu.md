[Русский](Sync-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Sync menu

The **Sync** menu reads your ComfyUI: which nodes, node packs and model files it has. The app reads it straight from the ComfyUI address, or through an MCP server when you set one. Reading changes nothing in ComfyUI. The result fills the [library](Library.md).

## Items

| Item | What it does | Grey when |
|---|---|---|
| **Sync now** | Reads your ComfyUI now. | a sync is already running |
| **Sync automatically** | Reads it again on a timer. A tick means on. The interval is set in Settings ▸ Sync (at least 5 minutes). It works with the ComfyUI address or with an MCP server. | the app has never had a sync state (right after the first start, before the connection is set) |
| **Sync problems and repairs** | Separate report of warnings, excluded files, retry and direct selected-file header repair. | never |
| **Sync settings…** | Opens [Settings ▸ Sync](Settings-Sync.md). | never |

## What the app says

- No address yet: a message "The ComfyUI address is not set" ("Enter the ComfyUI address in Settings ▸ Connection first.") with the button **Open connection settings**.
- Model files are still being read: "Model metadata is still being read (12 / 300). “Sync now” is available again when it finishes, or after you pause it."
- When a sync ends, a message at the bottom right says what was read, for example "Read from ComfyUI. Nodes: 812, packs: 41, model files: 96."
- If the last sync did not finish (the app closed or stopped answering), automatic sync waits: "The last sync did not finish: the app closed or stopped answering during it. Automatic sync waits until you start one with Sync now."

The [sync indicator](Sync-Indicator.md) at the right end of the menu bar shows the state all the time.

## See also

- [The sync indicator](Sync-Indicator.md)
- [Settings: Sync](Settings-Sync.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
- [Connection problems](../connect/Connection-Problems.md)
