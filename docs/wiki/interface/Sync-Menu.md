[Русский](Sync-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Sync menu

The **Sync** menu reads your ComfyUI: which nodes, node packs and model files it has. Reading changes nothing in ComfyUI. The result fills the [library](Library.md).

## Items

| Item | What it does | Grey when |
|---|---|---|
| **Sync now** | Reads your ComfyUI now. | a sync is already running |
| **Sync automatically** | Reads it again on a timer. A tick means on. The interval is set in Settings ▸ Sync (at least 5 minutes). | the app has never had a sync state (right after the first start, before the connection is set) |
| **Sync settings…** | Opens [Settings ▸ Sync](Settings-Sync.md). | never |

## What the app says

- No address yet: a message "The MCP server address is not set" with the button **Open connection settings**.
- Model files are still being read: "Model metadata is still being read (12 / 300). Sync now works again when it finishes, or after you pause it."
- When a sync ends, a message at the bottom right says what was read, for example "Read 812 nodes, 41 packs and 96 model files."

The [sync indicator](Sync-Indicator.md) at the right end of the menu bar shows the state all the time.

<!-- verify: the connection branch makes a plain running ComfyUI the main way to connect; the names of sync states and the messages above may change -->

## See also

- [The sync indicator](Sync-Indicator.md)
- [Settings: Sync](Settings-Sync.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
- [Connection problems](../connect/Connection-Problems.md)
