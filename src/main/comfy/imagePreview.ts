/** A bounded raster preview from ComfyUI input, proxied through desktop for paired browsers. */
import { isPlainRelativeName } from '../../shared/mcp/serverPaths';
import { COMFY_ROUTES, comfyGet, comfyOriginOf } from './gate';
export async function inputImagePreview(address: () => string, name: unknown, fetchImpl: typeof fetch = globalThis.fetch): Promise<string | null> {
  if (typeof name !== 'string' || !isPlainRelativeName(name) || name.includes('\\') || !/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(name)) return null;
  const base = comfyOriginOf(address()); if (!base) return null;
  const result = await comfyGet(base, COMFY_ROUTES.inputImage(name), fetchImpl);
  if (!result.ok || !('image' in result) || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(result.mime)) return null;
  if (comfyOriginOf(address())?.origin !== base.origin) return null;
  return `data:${result.mime};base64,${result.image.toString('base64')}`;
}
