[Русский](What-Each-Way-Shows.ru.md)
[Home](../Home.md) › [Connecting](README.md)

# What each way shows

| Data | Direct ComfyUI address | Optional MCP |
|---|---|---|
| Node classes, inputs, outputs and defaults | `/object_info` | If the server offers a node catalog; otherwise direct ComfyUI can supply it |
| Model file names | ComfyUI model routes | If the server lists model folders |
| Sizes, safetensors headers, previews | When exposed by that ComfyUI version | Depends on server read capabilities |
| Sidecar model descriptions and examples | Not exposed | A server with suitable file-reading tools |
| Pack README files and file fingerprints | Not exposed | A server with suitable file-reading tools |

Older ComfyUI versions may expose names without sizes or previews. Missing information remains unknown; a successful connection does not prove every source was read. The sync indicator reports gaps and which address supplied the library.

Graph checks compare the graph against this catalog. They do not run a workflow, verify output quality, establish GPU memory requirements, or prove compatibility when metadata is unknown.
