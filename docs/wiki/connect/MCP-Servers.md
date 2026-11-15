[Русский](MCP-Servers.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# MCP servers

An MCP server is a small program next to ComfyUI that answers questions of other programs. NodeWise Studio does not need
one: the ComfyUI address is enough. A server that can read files adds what ComfyUI itself does not serve: the
descriptions model managers keep next to model files (`.civitai.info`, `.metadata.json`), the README and
`pyproject.toml` of node packs, and a file's fingerprint (for an exact search on Civitai).

<!-- verify: checked against test servers that speak the same tools; not yet run against real MCP servers. -->

## Adding one

1. Settings ▸ Connection ▸ **MCP server (optional)** ▸ **MCP server URL**: paste the address as the server shows it,
   for example `http://127.0.0.1:9000/mcp`. An address on another computer must use `https`.
2. **Check**. The line under the field names the kind of server (below).
3. If the server needs access, choose **Access token** (paste the token) or **Sign in through the browser**; a server
   that needs nothing: **No sign-in**. A token or sign-in belongs to that MCP address only.
4. **Save settings**, then **Read now**.

## The kinds the app knows

The app recognises a server by the tools it lists and calls only the read tools it knows, with fixed arguments.

| Kind | The line says | What it adds |
| --- | --- | --- |
| Full catalog | "This MCP server gives the whole catalog: nodes, packs, models, descriptions and fingerprints." | Everything: nodes, packs, models, side files, pack READMEs, fingerprints. |
| Model list (for example artokun/comfyui-mcp) | "This MCP server lists models only. The nodes come from the ComfyUI address above." | The model files with sizes. Nodes come from ComfyUI. |
| Checkpoint list (for example joenorton/comfyui-mcp-server) | "This MCP server lists checkpoints only. Everything else comes from the ComfyUI address above." | The checkpoints folder. |
| Unknown | "The app does not know the tools of this MCP server and reads nothing through it. The ComfyUI address above is enough." | Nothing; shown in red, never as connected. |

After a read, the sync indicator's popover says where the library came from, for example "Models read through the MCP
server, nodes from ComfyUI at …".

The official `comfy-mcp` of Comfy Org runs as a local command, not at an address, and cannot be connected yet.

## Safety

- Only the read tools on the app's list are called; a tool that is not on it, or a call with an extra argument, is
  refused before it leaves the app. [ComfyUI is only read](../trust/Read-Only.md)
- A ComfyUI address the server names is read only when the server runs on this computer too, or when it is the
  address you saved.

## See also

- [Connecting](README.md)
- [What each way shows](What-Each-Way-Shows.md)
- [Connection problems](Connection-Problems.md)
