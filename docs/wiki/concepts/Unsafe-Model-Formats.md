[Русский](Unsafe-Model-Formats.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Unsafe model formats

Why `.safetensors` is preferred, and why old `.ckpt`, `.pt`, `.pth` and `.bin` files can be dangerous.

## In plain words
A model file is mostly numbers (the weights). How those numbers are stored matters:
- **`.safetensors`** stores only tensors and a small text header. Loading it cannot run code. This is the standard today.
- **`.gguf`** is a quantized format for weights; it also holds data, not code.
- **`.ckpt`, `.pt`, `.pth`, `.bin`** are usually PyTorch "pickle" files. Python's pickle format can contain instructions that run when the file is opened. A file made with bad intent can run a program on your computer the moment it is loaded.

Recent PyTorch and ComfyUI load such files in a restricted "weights only" mode that refuses most code, which lowers the risk a lot. But node packs and other tools may still load them the unsafe way, and restricted modes have had holes before. Treat any pickle file from an unknown source as a program.

## What to do
- Prefer `.safetensors` (or `.gguf`) whenever the same model is offered in it; nearly all current models are.
- Download from the author's official page or a well-known hub.
- Do not open old-format files from random links, chats or re-uploads.
- Keep ComfyUI and PyTorch updated.
- Upscale models and some older add-ons often exist only as `.pth`; take them from known sources.

## How the app helps
The app reads only file names and safetensors headers that your ComfyUI reports; it never opens model files itself and never downloads them. The model card shows the family it could read from the header.

## See also
- [Node packs](Node-Packs.md)
- [Where ComfyUI files live](Where-Files-Live.md)
- [Checkpoint](Checkpoint.md)
- [Security](../trust/Security.md)
