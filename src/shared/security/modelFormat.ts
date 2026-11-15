/**
 * Model file formats that can run code when they are loaded. `.ckpt`, `.pt`, `.pth` and `.bin` are Python pickles:
 * loading one can run whatever its author put in it. `.safetensors` and `.gguf` hold numbers only. ComfyUI loads
 * pickles with a safe mode on recent versions, but a newcomer cannot tell an old install, so the app says it.
 * The model card warns with it (renderer/components/library/ModelCard.tsx).
 */
const CODE_FORMATS = /\.(?:ckpt|pt|pth|bin|pkl|pickle)$/i;

/** True when the file name ends in a format that can run code when loaded. */
export function formatCanRunCode(fileName: string): boolean {
  return typeof fileName === 'string' && CODE_FORMATS.test(fileName.trim());
}
