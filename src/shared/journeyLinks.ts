/** Fixed official setup pages, shared by Electron and a paired browser. No arbitrary URL from a renderer. */
export const DOWNLOAD_PAGES = {
  'comfyui-download': 'https://www.comfy.org/download',
  'ollama-download': 'https://ollama.com/download',
  'comfyui-install-windows': 'https://docs.comfy.org/installation/desktop/windows',
  'comfyui-install-mac': 'https://docs.comfy.org/installation/desktop/macos',
  'comfyui-install-manual': 'https://docs.comfy.org/installation/manual_install',
} as const;
export type JourneyLink = 'comfyui' | keyof typeof DOWNLOAD_PAGES;
export function setupPage(kind: unknown): string | null {
  return typeof kind === 'string' && Object.hasOwn(DOWNLOAD_PAGES, kind) ? DOWNLOAD_PAGES[kind as keyof typeof DOWNLOAD_PAGES] : null;
}
