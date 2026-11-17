[Русский](What-Each-Way-Shows.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# What each way shows

Not tried yet on a real install: this page was checked against test servers that answer the way ComfyUI does.

| What | ComfyUI address only | With a full-catalog MCP server |
| --- | --- | --- |
| Nodes with their inputs, outputs and defaults | yes | yes |
| Node packs | yes; versions only when ComfyUI-Manager is installed | yes |
| Model files with size, kind and family | yes | yes |
| Metadata inside a `.safetensors` file (title, trigger words, base model) | yes | yes |
| The pictures ComfyUI finds for a model | yes | yes |
| Descriptions next to models (`.civitai.info`, `.metadata.json`): Civitai trigger words and descriptions | no | yes |
| A pack's README and `pyproject.toml` description | no | yes |
| A file's fingerprint (Find on the internet searches Civitai exactly) | no: the search goes by file name only | yes |

An older ComfyUI, without the newer model routes, shows model names only, without sizes or pictures ("This ComfyUI is
older and lists model names only…"). Update ComfyUI to see them.

A model-list or checkpoint-list MCP server adds its list of models; everything else still comes from ComfyUI.
[MCP servers](MCP-Servers.md)

## Versions the reading was built against

From the public sources: ComfyUI 0.45.0 (its routes `/system_stats`, `/object_info`, `/models`, `/experiment/models`,
`/view_metadata`), the ComfyUI desktop app (port 8000), ComfyUI-Manager (its list of installed packs),
artokun/comfyui-mcp 0.52.206 and joenorton/comfyui-mcp-server.

## See also

- [Connecting](README.md)
- [Connecting to ComfyUI](Connecting.md)
- [Catalog reads and selected-file uploads](../trust/Read-Only.md)
