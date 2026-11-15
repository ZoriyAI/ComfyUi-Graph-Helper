import { describe, expect, it, vi } from 'vitest';
import { inputImagePreview } from '../../src/main/comfy/imagePreview';
import { COMFY_ROUTES, comfyPathAllowed } from '../../src/main/comfy/gate';
describe('paired input raster preview', () => {
  it('reads only a bounded named input through the fixed GET gate', async () => {
    const fetcher = vi.fn(async (url, init) => { expect(String(url)).toContain('/view?filename=photo.png&type=input&subfolder=folder&preview=webp%3B80'); expect(init?.method).toBe('GET'); expect(init?.redirect).toBe('manual'); return new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'image/webp' } }); });
    expect(comfyPathAllowed(COMFY_ROUTES.inputImage('folder/photo.png').path)).toBe(true); expect(await inputImagePreview(() => 'http://localhost:8188', 'folder/photo.png', fetcher as typeof fetch)).toBe('data:image/webp;base64,AQID');
  });
  it('refuses traversal, SVG, non-images and responses from a changed origin', async () => {
    const fetcher = vi.fn(async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    for (const name of ['../secret.png', '/etc/secret.png','a\\b.png','x.svg']) expect(await inputImagePreview(() => 'http://localhost:8188', name, fetcher as typeof fetch)).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
    expect(await inputImagePreview(() => 'http://localhost:8188','x.png',fetcher as typeof fetch)).toBeNull(); let origin = 'http://localhost:8188';
    expect(await inputImagePreview(() => origin,'x.png', (async () => { origin = 'http://localhost:9999'; return new Response('x', { headers: { 'Content-Type':'image/png' } }); }) as typeof fetch)).toBeNull();
  });
});
