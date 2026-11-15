[Русский](Connection-Problems.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# Connection problems

Every message about the connection, what causes it and what to do. They appear under the address in Settings ▸
Connection, in the sync indicator's popover and as notices.

<!-- verify: checked against test servers that speak ComfyUI's routes; not yet run against a real ComfyUI install. -->

## The ComfyUI address

| The message begins | Cause | What to do |
| --- | --- | --- |
| "Enter the ComfyUI address first…" | No address. | Enter it, or Find on this computer. |
| "No address is set…" | Neither a ComfyUI nor an MCP address is saved. | Enter the ComfyUI address in Settings ▸ Connection. |
| "This is not an address…" | The text is not an address. | Copy it from the browser's address bar when ComfyUI is open. |
| "Add http:// or https:// in front of the address…" | An address of another computer without a scheme. | Write `http://` in front. |
| "The address must start with http:// or https://…" | A typo in the scheme. | Fix the first letters. |
| "Remove the user name and password from the address." | `user:password@` in the address. | Remove it: ComfyUI has no password. |
| "The address has a typo: … cannot be a computer address." | For example `127.0.0.l` or `192.168.1`. | Check the numbers and letters. |
| "ComfyUI does not answer at …" | ComfyUI is not running, the port is wrong, or (another computer) it was started without `--listen`. | Start ComfyUI; check the port; see [ComfyUI on another computer](Another-Computer.md). |
| "No computer named … was found." | The name does not resolve. | Write the address in numbers. |
| "ComfyUI answers too slowly: nothing came within … s." | No answer in time (20 s for the check, 180 s for the list of nodes); ComfyUI may be busy generating. | Try again in a minute. |
| "This is the address of an MCP server, not of ComfyUI…" | The address ends in `/mcp` or `/sse`. | Put it in the MCP server field; here goes ComfyUI's own address. |
| "Something answers at this address, but it is not ComfyUI…" | A wrong port or another program. | ComfyUI usually uses 8188, the desktop app 8000. |
| "ComfyUI answered, but its list of nodes could not be read…" | ComfyUI is still starting. | Wait until it has started, then try again. |
| "The address sends the app to another page…" | A redirect, for example a proxy with a sign-in page. | Enter the address of ComfyUI itself. |
| "Catalog snapshot is too large." | The list of nodes is larger than 512 MB. | Report it in Issues. |

## Warnings after a read

These do not stop the read; the rest of the library is updated.

| The message begins | Cause |
| --- | --- |
| "ComfyUI did not list its model folders…" | The model folders could not be listed; the list of models was not updated. |
| "This ComfyUI is older and lists model names only…" | An older ComfyUI: names without sizes and pictures. Update ComfyUI to see them. |
| "The model folder … could not be read…" | One model folder failed; the library keeps its previous list. Sync again. |

## The MCP server

| The message begins | Cause | What to do |
| --- | --- | --- |
| "This is the address of ComfyUI itself…" | ComfyUI's address in the MCP field. | Move it to the ComfyUI address field. |
| "Something answers at this address, but there is no MCP server at this path…" | A wrong path. | An MCP address usually ends with `/mcp`. |
| "Something answers at this address, but it is not an MCP server…" | A wrong port or path. | Copy the address the server shows when it starts. |
| "The MCP server URL must use https unless the server runs on this computer." | Plain `http` to another computer. | Use `https`, or run the server on this computer. |
| "The MCP server requires sign-in…" | The server needs access. | Choose Access token or Sign in through the browser. |
| "The MCP server refused the token…" | A wrong or expired token. | Paste the token again. |
| "MCP server unreachable: …" | The server is not running or the address is wrong. | Start it; check the address. |
| "The MCP server answers, but the app does not know its tools…" | An unknown server and no ComfyUI address. | Enter the ComfyUI address: everything is then read from ComfyUI. |
| "The app does not know the tools of this MCP server, so everything was read from ComfyUI itself." | An unknown server, with a ComfyUI address. | Nothing; or remove the MCP address. |
| "The models were read through the MCP server, but not the nodes: this server does not list them…" | A model-list server without a ComfyUI address. | Enter the ComfyUI address. |
| "The models were read through the MCP server, but not the nodes: ComfyUI did not answer…" | A model-list server, and ComfyUI did not answer. | See the ComfyUI messages above. |
| "The MCP tool … is not on the read-only list, so it was not called." | The app refused a call that is not a read. | Nothing to do. |

## See also

- [Connecting](README.md)
- [Troubleshooting](../reference/Troubleshooting.md)
- [Messages and what to do](../reference/Messages.md)
