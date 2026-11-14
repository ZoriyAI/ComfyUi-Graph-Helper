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
| "Needs a token" | the server needs a sign-in |
| "Library from another address" | the address was changed and the library still shows the old server: "Press “Sync now” to read the new one." |

## The popover

- The state, and while a sync runs the phase: "Reading nodes, packs, and models: 3 of 5".
- **Nodes**, **Classes with known ports**, **Node packs**, **Models**, **Model files read** ("330 / 330").
- **Last run**, **Duration**, **Next run** ("Off" without automatic sync), and "Last sync: …".
- Warnings and the last error, in words, for example "ComfyUI is not running at 127.0.0.1:8188, so node inputs and outputs were not updated. Start ComfyUI and sync again."
- **Sync automatically** and **Interval, minutes** (at least 5). These apply at once. "At least 5 minutes. Only read-only tools are used; nothing changes in ComfyUI."
- **Sign in** when the server wants a browser sign-in, **Pause metadata reading** while model files are read, and **Sync now**.

When a sync ends, a message at the bottom right says what was read: "Read 75 nodes, 5 packs and 331 model files." With warnings: "Synced with warnings".

<!-- verify: the connection branch changes the states, the phases and the messages for a plain ComfyUI connection -->

## See also

- [Sync menu](Sync-Menu.md)
- [Settings: Sync](Settings-Sync.md)
- [Connection problems](../connect/Connection-Problems.md)
- [The library](Library.md)
