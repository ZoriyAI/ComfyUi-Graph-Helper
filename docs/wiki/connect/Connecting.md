[Русский](Connecting.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# Connecting to ComfyUI

Start with the address that opens ComfyUI in your browser. No MCP server is required.

1. Open Settings ▸ Connection and enter the ComfyUI address, including scheme and port: for example `http://127.0.0.1:8188`. ComfyUI Desktop usually uses port 8000. These are examples; use your actual address.
2. "Find on this computer" searches common local addresses. "Check" tests the typed address without queuing anything.
3. Save settings, then choose Read ComfyUI or Sync ▸ Sync now. Read the result and any gaps reported by the sync indicator.

For another computer, use that computer's reachable address rather than `127.0.0.1` (which always means the computer running this app). The direct reader uses an HTTP(S) origin; a URL that redirects to a browser sign-in page will not work as a direct ComfyUI endpoint.

## Optional MCP

Add an MCP server in its separate section when you want information ComfyUI does not expose: sidecar model descriptions, pack README files and file fingerprints. The server must offer suitable read tools; an MCP server that only queues prompts is not a catalog source.

Enter the MCP server's own URL, often ending in `/mcp`, and choose Check. Use the detected access mode: no sign-in, token or browser sign-in. Save settings; for browser sign-in, then sign in. Credentials belong to that MCP address. Remote MCP uses HTTPS; loopback MCP can use HTTP.

Every ComfyUI and MCP operation in this app is read-only: no queueing, uploads, installations or external graph edits.

## See also

- [What each way shows](What-Each-Way-Shows.md)
- [Connection settings](../interface/Settings-Connection.md)
