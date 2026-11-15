[Русский](Read-Only.ru.md)
[Home](../Home.md) › [Trust](README.md)

# ComfyUI is only read

NodeWise Studio reads the ComfyUI catalog without changing models, packs or the queue. Choosing **Choose file…** in a media loader explicitly uploads one selected file to ComfyUI input. Existing files are not overwritten. The assistant cannot select files or initiate uploads.

## What is read

From ComfyUI itself, at the address you saved:

- **The nodes:** every node type with its inputs, outputs and allowed values (`/object_info`), and the versions
  (`/system_stats`).
- **The models:** the model folders and files with their sizes (`/experiment/models`, or `/models` on an older
  ComfyUI), the metadata inside a `.safetensors` header (`/view_metadata`) and the preview picture ComfyUI has for a
  model. Not the model files themselves.
- **The packs:** from ComfyUI-Manager's list of installed packs when it is there (`/customnode/installed`), otherwise
  from the node list.

From an MCP server, only if you added one:

- **Next to a model:** the description and the example picture that model managers keep beside a model file
  (`<name>.metadata.json`, `<name>.civitai.info`, `<name>.png` and the like), at most 16 MB per file.
- **The fingerprint of a model file:** only when you choose Find on the internet in its card. The server computes it;
  the file never travels.
- **About a node pack:** the `pyproject.toml` and the `README.md` at the top of its folder under `custom_nodes`.
- **Model servers your MCP server runs:** their list and the models each one has, for Settings ▸ Assistant ▸ Find
  local servers.

## How the promise is kept

- **One gate for ComfyUI.** Every catalog, metadata and preview request goes through `src/main/comfy/gate.ts`: `GET` only, no
  redirects followed, a size cap and a time limit, and only routes built from a fixed list. `/prompt`, `/queue`,
  `/interrupt`, `/free`, `/history`, uploads, user data, settings and every install or reboot route of
  ComfyUI-Manager are refused before anything is sent, The separate `src/main/comfy/upload.ts` accepts only the selected file for `POST /upload/image`, with `type=input` and `overwrite=false`.
- **One list for MCP servers.** Every MCP call goes through `src/main/mcp/readOnly.ts`. It holds the few read tools
  the app may call and the exact shape of their arguments. A tool that is not on the list, or a call with one extra
  field, is refused before it leaves the app; a server whose tools the app does not know is not called at all.
- **Only reading actions.** Where a server tool can also write (for example a file tool that can read, write and
  delete), only its read action is allowed, and only for the file names above.
- **No running.** The app has no button and no assistant tool that queues a workflow. You run the result in ComfyUI
  yourself: [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).
- **Tested.** Unit tests try every refused route, tool, action and path. This is checked against test servers that
  speak ComfyUI's routes, not yet against a real ComfyUI install.

## What this means for you

- Your ComfyUI, its models, its node packs and its queue stay exactly as they were.
- Missing nodes or models are named, never installed. Install them in ComfyUI.
- The graph you build lives in NodeWise until you save it as a workflow and open it in ComfyUI.

A call that would write is a security problem: please report it privately ([Security](Security.md)).

## See also

- [Trust](README.md)
- [Privacy](Privacy.md)
- [Security](Security.md)
- [Reading ComfyUI](../dev/Reading-ComfyUI.md)

## A loader file selection

**Choose file…** opens selection on this device, including a phone browser. The selected file, up to 64 MiB, goes to the configured ComfyUI input folder. Only a successful server response changes the node value. Cancellation or failure keeps the previous value. This is the only separate write path; the general read-only gate and the ban on queuing workflows remain.
