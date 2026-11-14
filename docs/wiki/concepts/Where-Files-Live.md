[Русский](Where-Files-Live.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Where ComfyUI files live

The folders of ComfyUI: where to put each kind of model, where pictures come from and where results go.

## The main folders
Inside the ComfyUI folder (for ComfyUI Desktop, inside the folder you chose at install):

| Folder | What lives there |
|---|---|
| `models/` | All model files, sorted by kind (below). |
| `input/` | Pictures, videos and sounds that Load Image, Load Video and Load Audio list. An upload in the editor lands here. |
| `output/` | What Save Image, Save Video and other output nodes write. |
| `temp/` | What Preview Image shows; cleaned up by ComfyUI. |
| `custom_nodes/` | Installed node packs, one folder each. |
| `user/` | Your settings and saved workflows (`user/default/workflows`). |

## Model folders
| Folder | Files | Read by |
|---|---|---|
| `models/checkpoints` | Whole checkpoints (SD 1.5, SDXL, Pony, Illustrious, some others) | Load Checkpoint |
| `models/diffusion_models` (older name `unet`) | Diffusion models alone (Flux, Qwen-Image, Z-Image, Wan, HunyuanVideo) | Load Diffusion Model |
| `models/text_encoders` (older name `clip`) | Text encoders (clip_l, t5xxl, umt5_xxl, Qwen) | Load CLIP, DualCLIPLoader |
| `models/vae` | VAE files | Load VAE |
| `models/loras` | LoRA files | Load LoRA and LoraLoaderModelOnly |
| `models/controlnet` | ControlNet models | Load ControlNet Model |
| `models/upscale_models` | ESRGAN-style upscalers | Load Upscale Model |
| `models/clip_vision` | Image encoders (clip_vision_h and others) | Load CLIP Vision |
| `models/embeddings` | Textual inversions | `embedding:name` in a prompt |
| `models/style_models`, `models/audio_encoders` and others | Special-purpose models | Their own loader nodes |

Packs often add folders of their own (for example `models/detection` for pose models, `models/wav2vec2` for speech models, or a GGUF folder), and their README says which.

Subfolders are fine: a file in `models/loras/wan/` appears in the list as `wan/name.safetensors`.

To keep models elsewhere (a second disk, or shared with another program), ComfyUI reads `extra_model_paths.yaml` in its folder (ComfyUI Desktop sets this in its own settings). Restart ComfyUI after changing it.

## Typical mistakes
- **A file in the wrong folder**: it does not appear in the loader's list. Move it and refresh (press R in the ComfyUI editor) or restart.
- **A model folder named by another program** (`Stable-diffusion`, `Lora`): ComfyUI does not look there unless `extra_model_paths.yaml` says so.
- **Expecting files in `output` from Preview Image**: preview files go to `temp`.

## How the app helps
The app reads the lists of model files from your ComfyUI; after you add files, choose **Sync ▸ Sync now**. The **Models** tab of the library shows them, and **Check** names a model a graph asks for that is not on disk, with its folder. The app never downloads or moves files.

## See also
- [Separate loaders](Separate-Loaders.md)
- [Node packs](Node-Packs.md)
- [Unsafe model formats](Unsafe-Model-Formats.md)
- [The model library](../interface/Model-Library.md)
- [The Sync menu](../interface/Sync-Menu.md)
- [Getting ComfyUI](../start/ComfyUI.md)
