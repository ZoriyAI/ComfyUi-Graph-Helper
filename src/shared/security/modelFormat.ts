/**
 * Model file formats that can run code when they are loaded. `.ckpt`, `.pt`, `.pth` and `.bin` are Python pickles:
 * loading one can run whatever its author put in it. `.safetensors` and `.gguf` hold numbers only. ComfyUI loads
 * pickles with a safe mode on recent versions, but a newcomer cannot tell an old install, so the app says it.
 */
const CODE_FORMATS = /\.(?:ckpt|pt|pth|bin|pkl|pickle)$/i;

export function formatCanRunCode(fileName: string): boolean {
  return typeof fileName === 'string' && CODE_FORMATS.test(fileName.trim());
}
