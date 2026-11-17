[Русский](Connecting.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# Connecting to ComfyUI

NodeWise Studio learns which nodes and models you have by reading a running ComfyUI. All it needs is the address you open
ComfyUI at in the browser. An MCP server is optional and adds a few things ComfyUI itself does not serve.

Not tried yet on a real install: this chapter was checked against test servers that answer the way ComfyUI does.
The first run against a real ComfyUI is on the release checklist.

## The three cases

| Your situation | What to do | Page |
| --- | --- | --- |
| ComfyUI runs on this computer | Find on this computer, or enter `http://127.0.0.1:8188` (the desktop app: port 8000) | [ComfyUI on this computer](This-Computer.md) |
| ComfyUI runs on another computer | Start it there with `--listen`, enter `http://<its address>:8188` | [ComfyUI on another computer](Another-Computer.md) |
| You also have an MCP server | Optional: add its address below the ComfyUI address | [MCP servers](MCP-Servers.md) |

## Settings ▸ Connection, from top to bottom

1. **ComfyUI address**, with **Check ComfyUI** next to it.
2. **Find on this computer**: asks this computer at ports 8188 and 8000 and fills the address in.
3. A hint; for an address on another computer, also a hint about `--listen` and about plain `http`.
4. The state, then **Read now** (reads ComfyUI with what is saved) and **Check this graph**.
5. **MCP server (optional)**: a short text, the **MCP server address** field with **Test server**, a line that names the kind of
   server once it is read, and the choice of access (No sign-in, Token, Sign in through the browser).

Save the settings after you change an address: the app reads ComfyUI with what is saved.

## The first time

1. On the empty canvas, step 1 **Connect ComfyUI** ▸ **Connect…** opens Settings ▸ Connection.
2. Enter the address or choose **Find on this computer**, then **Check ComfyUI**. It says, for example, "ComfyUI 0.45.0
   answers at this address. Save the settings, and the app reads it."
3. **Save settings**, then step 1 **Read ComfyUI** (or Sync ▸ Sync now).
4. The sync indicator at the top right ends at **Up to date**; its popover says where the library was read from. Your
   nodes and models are in the library on the left; lessons and the check use them.

Everything stays after a restart. To read again later: Sync ▸ Sync now, or switch on Sync automatically in Settings ▸
Sync.

## What the app never does there

Synchronization uses read-only requests through a fixed route allowlist. The separate media loader uploads only a file you explicitly select, to input without overwriting existing files. It does not queue workflows or install models and packs. [Access details](../trust/Read-Only.md)

## See also

- [Connecting](README.md)
- [What each way shows](What-Each-Way-Shows.md)
- [Connection problems](Connection-Problems.md)
- [Settings: Connection](../interface/Settings-Connection.md)
