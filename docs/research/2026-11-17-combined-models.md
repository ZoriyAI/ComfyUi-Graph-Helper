# Actual combined-model resource qualification

Date: 2026-11-17. NVIDIA GeForce RTX 4060; ComfyUI 0.45.3, native Ollama 0.34.2. Isolated model process and Ollama endpoint, existing weights read without modification. The owner's ComfyUI queue and assistant on the other GPU were not used.

The actual exported NodeWiseOllamaVisionPrompt source (SHA256 `0cf7185b8d7a78b3011c351c4f992cfcbf9a732e90f107f7afd8be705364c593`) described the application's icon with `huihui_ai/qwen3-vl-abliterated:4b-instruct`. Its returned text was passed to actual Comfy CLIPTextEncode, then KSampler and VAEDecode using `XenoMORPH-v2.safetensors` (2,136,831,206 bytes), seed 314159, 512 × 512, batch 1, four Euler/normal steps, CFG 5, denoise 1.

| Stage | Seconds | Sampled whole-device VRAM maximum, MiB |
| --- | ---: | ---: |
| Vision, including load | 8.62 | 5537 |
| Checkpoint load | 4.35 | 204 |
| Conditioning | 0.44 | 474 |
| Sampling | 3.20 | 2422 |
| Decode | 0.52 | 2668 |
| Release, including delayed samples | — | 3054 |

The 250 ms sampling labels are observation windows, not precise attribution to an allocator. Shorter peaks can be missed. Background before the sequence and after process exit was 105 MiB. Peak Comfy Python RSS was 5066.9 MiB; this excludes the separate Ollama server. PyTorch's sampling peak was 2036 MiB allocated / 2184 MiB reserved. These figures describe different scopes and must not be summed or substituted for one another.

The vision stage used keep_alive=0. Native /api/ps was empty before checkpoint loading and after the entire sequence. A real finite `[1,512,512,3]` image was produced and visually inspected: blue concentric shapes, not a faithful reconstruction of the original icon. Four steps qualify execution, not image quality or general model suitability. PNG SHA256: `180f97fe307742cfa76dfab687207f1923154c73cddcdb6c52615134c8fc8ce4`.

An initial harness assumed three checkpoint return values; current Comfy returns four. The harness selected the first three and reran the entire sequence. No application fix was inferred from that setup error. Comfy printed ModelPatcher destructor warnings during Python teardown after successful output and resource release; no owner runtime was changed to suppress them.

**Product boundary:** Hardware and combined models displays file-based estimates and free-memory snapshots, with dimensions and a link to this measured explanation. It does not claim to predict the runtime peak or guarantee that an arbitrary mixed graph fits. Sequential unload, resolution/frame/batch reduction and tiled VAE are offered as concrete options to try.

На русском: выполнена настоящая цепочка vision → текст → CLIP → sampler → изображение. Пик всей цепочки5537МиБ, файлcheckpoint2,14ГБ, фон105МиБ; эти величины нельзя смешивать. Полученный результат подтверждает выполнение, а не качество и не совместимость любого другого графа. Подробное объяснение доступно в русской справке приложения.
