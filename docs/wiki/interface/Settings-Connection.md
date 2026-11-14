[Русский](Settings-Connection.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Connection

The ComfyUI address comes first. Every request is read-only; nothing is queued, uploaded or installed. See [Connecting](../connect/Connecting.md) for the steps and [What each way shows](../connect/What-Each-Way-Shows.md) for limits.

| Field or action | Purpose |
|---|---|
| ComfyUI address | The origin that opens ComfyUI in your browser, including scheme and port |
| Find on this computer | Searches common local ComfyUI addresses; choose your actual server |
| Check beside ComfyUI address | Checks the typed address before saving |
| Connection state | Shows sync status and the source of the library, including gaps |
| Read ComfyUI | Reads using saved settings; save draft changes first |
| Check this graph | Compares this graph with the current catalog; it does not execute it |
| Optional MCP server address | A separate server URL, often ending in `/mcp`, for additional readable metadata |
| Check beside MCP address | Detects required MCP access: none, token or browser sign-in |
| MCP access token / Remember on this computer | Session token, optionally encrypted in the OS password store |
| MCP browser sign-in | Save settings first, then sign in; credentials stay tied to the MCP address |

MCP is not required for plain ComfyUI reads. A remote MCP URL requires HTTPS; direct ComfyUI may use HTTP when reachable. Direct reads use the URL origin; browser redirects/sign-in pages are not supported ComfyUI endpoints. Never put credentials into either URL.
