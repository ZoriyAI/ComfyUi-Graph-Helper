[Русский](Read-Only.ru.md)
[Home](../Home.md) › [Trust](README.md)

# ComfyUI is only read

CozyGraph reads your ComfyUI to learn which nodes and models it has. It never changes it: it does not install,
download, delete, write, move or queue anything there. This page says what is read and how that promise is kept in
the code.

## What is read

<!-- verify: connection chapter. The list of ways to connect is being rebuilt; the reads below are the ones the
current build allows. -->

- **The nodes:** every node type ComfyUI knows, with its inputs, outputs and allowed values (`/object_info`), and the
  versions of ComfyUI and Python (`/system_stats`).
- **The models:** the names of the model files in each model folder. Not the files themselves.
- **Next to a model:** the description and the example picture that model managers keep beside a model file
  (`<name>.metadata.json`, `<name>.civitai.info`, `<name>.png` and the like), at most 16 MB per file.
- **The fingerprint of a model file:** only when you choose Find on the internet in its card. The server computes it;
  the file never travels.
- **About a node pack:** the `pyproject.toml` and the `README.md` at the top of its folder under `custom_nodes`.
- **Model servers your MCP server runs:** their list and the models each one has, for Settings ▸ Assistant ▸ Find
  local servers.

## How the promise is kept

- **One list of allowed calls.** Every call to an MCP server goes through one gate in the code
  (`src/main/mcp/readOnly.ts`). It holds the few read tools the app may call and the exact shape of their arguments.
  A tool that is not on the list, or a call with one extra field, is refused before it leaves the app.
- **Only reading actions.** Where a server tool can also write (for example a file tool that can read, write and
  delete), only its read action is allowed, and only for the file names above.
- **Only two addresses of ComfyUI itself.** When the app talks to ComfyUI without an MCP server, it sends only
  `GET /object_info` and `GET /system_stats`.
- **No running.** The app has no button and no assistant tool that queues a workflow. You run the result in ComfyUI
  yourself: [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).
- **Tested.** Unit tests check that every other tool, every other action and every other path is refused.

## What this means for you

- Your ComfyUI, its models, its node packs and its queue stay exactly as they were.
- Missing nodes or models are named, never installed. Install them in ComfyUI.
- The graph you build lives in CozyGraph until you save it as a workflow and open it in ComfyUI.

A call that would write is a security problem: please report it privately ([Security](Security.md)).

## See also

- [Trust](README.md)
- [Privacy](Privacy.md)
- [Security](Security.md)
- [Reading ComfyUI](../dev/Reading-ComfyUI.md)
