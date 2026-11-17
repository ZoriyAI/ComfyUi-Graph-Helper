# Actual Ollama starter execution — 17 November 2026

The exported `nodewise_ollama` starter was executed with real models in an isolated environment. Its `nodes.py` SHA256 was `0cf7185b8d7a78b3011c351c4f992cfcbf9a732e90f107f7afd8be705364c593`. The existing ComfyUI installation and custom-node directories were not modified.

Environment: Ollama 0.34.2 on a private loopback port and RTX 4060; ComfyUI 0.45.3's Python environment, actual `CLIPTextEncode` and installed `clip_l.safetensors` on CPU. The input was the project's 512 × 512 application icon, converted to a native IMAGE tensor `[1,512,512,3]`.

| Executed path | Observed result |
| --- | --- |
| IMAGE → `NodeWiseOllamaVisionPrompt`, model `huihui_ai/qwen3-vl-abliterated:4b-instruct` | A nonempty description identifying the blue speech bubble, connected purple/orange dots and dark rounded background; about 55.2 seconds including cold loading |
| Returned prompt → actual ComfyUI `CLIPTextEncode` | Finite CPU CONDITIONING tensor `[1,77,768]`; about 0.33 seconds for CLIP loading/encoding after imports |
| Two texts → `NodeWiseOllamaEmbeddings`, model `embeddinggemma:300m` | Two finite vectors of 768 values; JSON round-trip preserved them |
| Vectors → `NodeWiseEmbeddingCosine` | Identical vector score 1.0; different texts score 0.3426644; about 41.2 seconds for both embedding calls including cold loading |
| `keep_alive=0` after vision and the last embedding request | Native running-model list empty after each stage |

The Python process peaked at approximately 1291 MiB RSS. This is the measured process cost of this example, not the GPU peak of an arbitrary combined graph. The CLIP loader reported a missing `text_projection.weight`; token conditioning remained finite. Image generation and the visual quality of a downstream diffusion model were not tested by this scenario.

The test used the actual exported Python implementations. No canned HTTP responses or replacement CLIP encoder were used. EmbeddingGemma was downloaded into the private qualification directory; the owner's model store was unchanged.

For a workflow, connect the vision node's STRING output to the converted `CLIPTextEncode.text` input. Keep the CLIP model compatible with the downstream generation model. Embedding vectors use the distinct `NODEWISE_EMBEDDINGS` type and cannot replace CONDITIONING. Compare vectors produced by the same embedding model.

The starter still requires a suitable installed model and a reachable Ollama origin. Import and schema discovery do not download models or start inference. A phone's `localhost` is not the ComfyUI host. Wrong model capability, an incomplete response, excessive input, or an unreachable server produces an error rather than an invented result. This qualification covers the named models and versions; arbitrary model quality and a complete diffusion/video pipeline need separate checks.

Primary references: [vision API](https://docs.ollama.com/api/chat), [embedding API](https://docs.ollama.com/api/embed), [EmbeddingGemma model](https://ollama.com/library/embeddinggemma).
