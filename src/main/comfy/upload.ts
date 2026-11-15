/** A user-selected upload only. Catalog reads retain their closed read-only gate; no arbitrary write route exists. */
import { MEDIA_UPLOAD_MAX_BYTES, type MediaUploadResult } from '../../shared/contracts/media';
import { isPlainRelativeName } from '../../shared/mcp/serverPaths';
import { comfyOriginOf } from './gate';

/** Send one selected file to the configured ComfyUI input folder without replacing an existing file. */
export async function uploadComfyMedia(
  address: () => string, name: unknown, data: unknown, fetchImpl: typeof fetch = globalThis.fetch,
): Promise<MediaUploadResult> {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..') return { ok: false, error: 'invalid' };
  if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return { ok: false, error: 'invalid' };
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (bytes.byteLength === 0) return { ok: false, error: 'invalid' };
  if (bytes.byteLength > MEDIA_UPLOAD_MAX_BYTES) return { ok: false, error: 'large' };
  const origin = comfyOriginOf(address());
  if (!origin) return { ok: false, error: 'unavailable' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  timer.unref?.();
  try {
    const body = new FormData();
    body.append('image', new Blob([new Uint8Array(bytes).buffer], { type: 'application/octet-stream' }), name);
    body.append('type', 'input');
    body.append('overwrite', 'false');
    const response = await fetchImpl(new URL('/upload/image', origin), { method: 'POST', body, redirect: 'manual', signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, error: response.status === 413 ? 'large' : 'failed' };
    }
    // An upload returns only a short identity, never an unbounded page or stream.
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, error: 'failed' };
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 16 * 1024) { await reader.cancel(); return { ok: false, error: 'failed' }; }
      chunks.push(part.value);
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object') return { ok: false, error: 'failed' };
    const item = result as { name?: unknown; subfolder?: unknown; type?: unknown };
    if (typeof item.name !== 'string' || /[\\/\x00-\x1f\x7f]/.test(item.name) || !isPlainRelativeName(item.name)
      || (item.type !== undefined && item.type !== 'input') || (item.subfolder !== undefined && typeof item.subfolder !== 'string')) return { ok: false, error: 'failed' };
    const value = item.subfolder ? `${item.subfolder}/${item.name}` : item.name;
    if (!isPlainRelativeName(value)) return { ok: false, error: 'failed' };
    if (comfyOriginOf(address())?.origin !== origin.origin) return { ok: false, error: 'changed' };
    return { ok: true, name: value };
  } catch { return { ok: false, error: controller.signal.aborted ? 'timeout' : 'failed' }; }
  finally { clearTimeout(timer); }
}
