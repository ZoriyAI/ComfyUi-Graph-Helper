[Русский](Settings-Connection.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Connection

**ComfyUI connection**: "How the app reaches your ComfyUI. Every call is read-only; nothing is queued or installed." The steps to connect, for every kind of setup, are in [Connecting](../connect/Connecting.md); this page lists the fields.

<!-- verify: the connection branch makes a plain running ComfyUI the main way to connect and MCP servers optional; this section will be rebuilt -->

## Fields, from top to bottom

| Field | What it is |
|---|---|
| **MCP server URL** | The address of the MCP server next to ComfyUI, as the server shows it, for example `http://127.0.0.1:9000/mcp`. The list of the field offers addresses the app knows ("named by the MCP server", "saved in Settings", "used before", "found on this computer"). |
| **Check** (next to it) | Asks the server whether it needs a sign-in and picks the right option below: "The server answers without sign-in. “No sign-in” is selected." If you left out `http://`, the app adds it and says so. |
| **Access to the server** | **No sign-in**, **Token** or **Sign in through the browser**. "The choice takes effect after “Save settings”." |
| **Access token** (with Token) | Paste the token; it is checked at once: "Token accepted: the server answers (14 tools). It is kept while the app is open." **Remember on this computer** keeps it in the password store; **Forget token** removes it. |
| **Sign in** (with Sign in through the browser) | First **Save settings**, then **Sign in**: the browser opens. "Signed in until 18:40." **Sign in again**, **Sign out**. |
| **ComfyUI address** | Optional. The address you open ComfyUI at in the browser, for example `http://127.0.0.1:8188`. Fill it in when ComfyUI runs on another computer or you read it without the server. **Look on this computer** searches for it. |
| **MCP state** | A badge with the sync state, for example "MCP state: Up to date". |

## Buttons at the bottom

These work on saved settings only (they are grey while the draft has changes):

- **Read through MCP**: a sync, with the same summary as its message.
- **Read ComfyUI**: reads the ComfyUI address directly: "Read ComfyUI 0.3.60. Devices: 1. Nodes: 812."
- **Check this graph**: "Missing nodes: none. Missing models: none."

## What the app says about the address

- "Add http:// or https:// in front of the address, for example http://192.168.1.5:9000/mcp."
- "This is the address of ComfyUI itself. The app needs the address of the MCP server next to ComfyUI; the server shows it when it starts."
- "Something answers at this address, but there is no MCP server at this path. An MCP server address usually ends with /mcp."
- "The MCP server URL must use https unless the server runs on this computer."
- "Remove the user name and password from the address."

More in [Connection problems](../connect/Connection-Problems.md).

## See also

- [Connecting](../connect/Connecting.md)
- [MCP servers](../connect/MCP-Servers.md)
- [Settings: Sync](Settings-Sync.md)
- [The sync indicator](Sync-Indicator.md)
