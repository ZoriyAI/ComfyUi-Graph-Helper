/** Original starter sources, offered for review/download only. No import, subprocess or network request here. */
import type { ExtensionProposal } from '../../shared/contracts/extensions';
export const OLLAMA_STARTER: ExtensionProposal = {
  slug: 'nodewise_ollama', name: 'NodeWise Ollama: Vision, Chat and Embeddings',
  purpose: 'Photo → text prompt, text → chat, text → embedding vectors and vector cosine similarity.',
  inputs: [{ name: 'image', type: 'IMAGE' }, { name: 'text', type: 'STRING' }],
  outputs: [{ name: 'text', type: 'STRING' }, { name: 'vectors', type: 'NODEWISE_EMBEDDINGS' }, { name: 'similarity', type: 'FLOAT' }],
  dependencies: ['Running Ollama with a manually installed suitable vision/chat/embedding model', 'ComfyUI with Pillow, NumPy and Torch for IMAGE conversion'],
  files: [{ path: '__init__.py', content: 'from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS\n\n__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]\n' }, {
    path: 'nodes.py', content: String.raw`"""Native ComfyUI V1 nodes. Schema discovery has no network/GPU/install side effects."""
import base64
import io
import json
import math
import urllib.error
import urllib.parse
import urllib.request

CAP = 8 * 1024 * 1024

def post(base_url, endpoint, payload):
    parsed = urllib.parse.urlsplit(base_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Use the Ollama server origin, e.g. http://127.0.0.1:11434")
    body = json.dumps(payload, allow_nan=False).encode("utf-8")
    if len(body) > CAP:
        raise ValueError("Ollama request exceeds 8 MiB")
    request = urllib.request.Request(base_url.rstrip("/") + endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read(CAP + 1)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Ollama HTTP %s. Check the model name, server and model capability." % error.code) from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Ollama is unavailable or timed out. Check the configured server.") from None
    if len(raw) > CAP:
        raise ValueError("Ollama response exceeds 8 MiB")
    result = json.loads(raw)
    if not isinstance(result, dict) or result.get("error"):
        raise RuntimeError("Ollama rejected the request. Check the model and its capability.")
    return result

def settings():
    # Never request /api/tags during INPUT_TYPES: object_info is read during synchronization.
    return {"model": ("STRING", {"default": ""}), "base_url": ("STRING", {"default": "http://127.0.0.1:11434"}), "keep_alive": (["0", "5m", "10m"], {"default": "0"})}

def model_name(model):
    if not model.strip() or len(model) > 200:
        raise ValueError("Enter the exact installed Ollama model tag; models are never downloaded automatically")
    return model.strip()

def chat(base_url, model, messages, keep_alive):
    result = post(base_url, "/api/chat", {"model": model_name(model), "messages": messages, "stream": False, "keep_alive": keep_alive, "options": {"num_predict": 1024, "temperature": 0.2}})
    message = result.get("message", {})
    text = message.get("content") if isinstance(message, dict) else None
    if not isinstance(text, str) or not text.strip() or result.get("done") is not True:
        raise ValueError("The model returned no complete text; choose a suitable chat/vision model")
    if result.get("done_reason") == "length":
        raise ValueError("The response reached its token limit; shorten the task")
    return text.strip()

class NodeWiseOllamaChat:
    CATEGORY = "NodeWise/Ollama"
    FUNCTION = "run"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"multiline": True, "default": ""}), "system": ("STRING", {"multiline": True, "default": "You are a helpful assistant."}), **settings()}}
    def run(self, text, system, model, base_url, keep_alive):
        return (chat(base_url, model, [{"role": "system", "content": system}, {"role": "user", "content": text}], keep_alive),)

class NodeWiseOllamaVisionPrompt:
    CATEGORY = "NodeWise/Ollama"
    FUNCTION = "run"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"image": ("IMAGE",), "task": ("STRING", {"multiline": True, "default": "Describe the visible image as a concise image-generation prompt. Return only the prompt."}), **settings()}}
    def run(self, image, task, model, base_url, keep_alive):
        # ComfyUI IMAGE is a float NHWC tensor. One image only, so batches cannot silently lose items.
        if len(image.shape) != 4 or image.shape[0] != 1 or image.shape[-1] not in (1, 3, 4):
            raise ValueError("Vision expects one NHWC IMAGE; select one image from a batch first")
        from PIL import Image
        import numpy as np
        array = np.clip(image[0].detach().cpu().numpy(), 0, 1)
        if array.shape[-1] == 1:
            array = array[:, :, 0]
        picture = Image.fromarray((array * 255).round().astype(np.uint8)).convert("RGB")
        picture.thumbnail((1536, 1536))
        stream = io.BytesIO()
        picture.save(stream, format="JPEG", quality=90)
        encoded = base64.b64encode(stream.getvalue()).decode("ascii")
        return (chat(base_url, model, [{"role": "user", "content": task, "images": [encoded]}], keep_alive),)

class NodeWiseOllamaEmbeddings:
    CATEGORY = "NodeWise/Ollama"
    FUNCTION = "run"
    RETURN_TYPES = ("NODEWISE_EMBEDDINGS", "STRING")
    RETURN_NAMES = ("vectors", "json",)
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"multiline": True, "default": ""}), **settings()}}
    def run(self, text, model, base_url, keep_alive):
        result = post(base_url, "/api/embed", {"model": model_name(model), "input": text, "truncate": False, "keep_alive": keep_alive})
        vectors = result.get("embeddings")
        if not isinstance(vectors, list) or len(vectors) != 1 or not isinstance(vectors[0], list) or not vectors[0] or len(vectors[0]) > 131072 or not all(type(v) in (int, float) and math.isfinite(v) for v in vectors[0]):
            raise ValueError("The model did not return a finite embedding vector; use an embedding model")
        return (vectors, json.dumps(vectors, ensure_ascii=False, allow_nan=False))

class NodeWiseEmbeddingCosine:
    CATEGORY = "NodeWise/Ollama"
    FUNCTION = "run"
    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("similarity",)
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"a": ("NODEWISE_EMBEDDINGS",), "b": ("NODEWISE_EMBEDDINGS",)}}
    def run(self, a, b):
        if not isinstance(a, list) or not isinstance(b, list) or len(a) != 1 or len(b) != 1 or not isinstance(a[0], list) or not isinstance(b[0], list) or not a[0] or len(a[0]) != len(b[0]):
            raise ValueError("Use one vector of equal dimension from the same embedding model on each input")
        x, y = a[0], b[0]
        if not all(type(v) in (int, float) and math.isfinite(v) for v in x + y):
            raise ValueError("Embedding vectors must contain finite numbers")
        nx = math.hypot(*x)
        ny = math.hypot(*y)
        if nx == 0 or ny == 0:
            raise ValueError("Cannot compare a zero embedding vector")
        score = sum((u / nx) * (v / ny) for u, v in zip(x, y))
        return (max(-1.0, min(1.0, score)),)

NODE_CLASS_MAPPINGS = {cls.__name__: cls for cls in (NodeWiseOllamaChat, NodeWiseOllamaVisionPrompt, NodeWiseOllamaEmbeddings, NodeWiseEmbeddingCosine)}
NODE_DISPLAY_NAME_MAPPINGS = {"NodeWiseOllamaChat": "Ollama Chat (NodeWise)", "NodeWiseOllamaVisionPrompt": "Image to Prompt (Ollama, NodeWise)", "NodeWiseOllamaEmbeddings": "Ollama Embeddings (NodeWise)", "NodeWiseEmbeddingCosine": "Embedding Cosine (NodeWise)"}
` }, { path: 'README.md', content: `# NodeWise Ollama starter / Начальный пакет Ollama

Review these sources before installing. This download does not install or run anything. NodeWise checks the package format, not the runtime or quality of model output.
Проверьте исходники перед установкой. Скачивание ничего не устанавливает и не запускает. Проверяется формат пакета; реальная генерация и качество требуют проверки в вашей среде.

## Install / Установка
1. Review nodes.py and dependencies. ComfyUI V1 NODE_CLASS_MAPPINGS remains supported. No pip installer, network call or GPU initialization occurs at import or INPUT_TYPES.
2. Extract the nodewise_ollama folder into your ComfyUI/custom_nodes directory. Restart ComfyUI yourself, then synchronize NodeWise. Install Ollama and the desired model separately; this package never pulls models.
3. Enter the exact installed model tag in model and the Ollama origin in base_url. localhost refers to the computer running ComfyUI, even when you edit from a phone. Image captioning requires a vision-capable model; embeddings require an embedding model.

Папку nodewise_ollama поместите в ComfyUI/custom_nodes, самостоятельно перезапустите ComfyUI и выполните синхронизацию NodeWise. В model укажите точное имя установленной модели. Адрес localhost относится к компьютеру ComfyUI, а не к телефону. Vision и embeddings требуют подходящих моделей; автоматического скачивания нет.

## Example graphs / Примеры связей
- LoadImage.IMAGE → NodeWiseOllamaVisionPrompt.image → prompt STRING → CLIPTextEncode.text → conditioning → sampler. Select compatible ComfyUI generation models independently. The vision model receives only one image (resized to at most1536px); no silent batch truncation.
- Text → NodeWiseOllamaChat → text STRING → prompt/text processing.
- Two NodeWiseOllamaEmbeddings nodes with the SAME model → vectors a/b → NodeWiseEmbeddingCosine → similarity FLOAT.
- Embeddings are NODEWISE_EMBEDDINGS vectors, not CLIP CONDITIONING. They cannot replace CLIPTextEncode output.

Фото → описание/промпт → CLIPTextEncode → генерация. Две embeddings-ноды с одной моделью → Cosine → сходство. Вектор embeddings не является CONDITIONING.

## Resources / Ресурсы
keep_alive defaults to0 to release Ollama model memory after the request;5m/10m keep it for reuse. This does not coordinate GPU leases with other servers or guarantee graph memory fit. Run model stages sequentially and review VRAM/RAM. HTTP requests occur only when the node executes in ComfyUI, with180s timeout and8MiB request/response caps. Ollama authentication is not implemented. No keys should be embedded in workflows or code.

По умолчанию keep_alive=0 освобождает память модели Ollama после запроса. Совместное использование GPU и пиковая память требуют проверки. Вызовы происходят только при выполнении нод в ComfyUI. Секреты в исходники/воркфлоу не добавляйте.

Sources: https://docs.ollama.com/api/chat https://docs.ollama.com/api/embed https://docs.ollama.com/capabilities/vision https://docs.comfy.org/custom-nodes/backend/server_overview
` }],
};
