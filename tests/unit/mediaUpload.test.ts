/** User-selected uploads use one fixed route and return an input identity; failure never invents a local path. */
import { describe, expect, it, vi } from 'vitest';
import { uploadComfyMedia } from '../../src/main/comfy/upload';
import { MEDIA_UPLOAD_MAX_BYTES } from '../../src/shared/contracts/media';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { fieldSpecOf } from '../../src/shared/catalog/fieldSpec';

const bytes = new Uint8Array([137, 80, 78, 71]);
const origin = () => 'http://127.0.0.1:8188';

describe('selected media upload', () => {
  it('sends only a selected file to input, keeps overwrite off and uses the returned filename', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('manual');
      const form = init!.body as FormData;
      expect(form.get('type')).toBe('input'); expect(form.get('overwrite')).toBe('false');
      const file = form.get('image') as File;
      expect(file.name).toBe('my photo.png'); expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
      return Response.json({ name: 'my photo (1).png', subfolder: 'selected', type: 'input' });
    });
    expect(await uploadComfyMedia(origin, 'my photo.png', bytes, fetcher)).toEqual({ ok: true, name: 'selected/my photo (1).png' });
    expect(String(fetcher.mock.calls[0][0])).toBe('http://127.0.0.1:8188/upload/image');
  });
  it.each(['../a.png', 'a/b.png', 'a\\b.png', '.', '', 'x\0.png'])('refuses an invalid filename %j before network access', async (name) => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await uploadComfyMedia(origin, name, bytes, fetcher)).toEqual({ ok: false, error: 'invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses absent connection, empty or oversized data', async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await uploadComfyMedia(() => '', 'a.png', bytes, fetcher)).toEqual({ ok: false, error: 'unavailable' });
    expect(await uploadComfyMedia(origin, 'a.png', new Uint8Array(), fetcher)).toEqual({ ok: false, error: 'invalid' });
    expect(await uploadComfyMedia(origin, 'a.png', new Uint8Array(MEDIA_UPLOAD_MAX_BYTES + 1), fetcher)).toEqual({ ok: false, error: 'large' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([302, 413, 500])('reports status %i without following a redirect', async (status) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('', { status, headers: { location: 'https://example.invalid' } }));
    expect(await uploadComfyMedia(origin, 'a.png', bytes, fetcher)).toEqual({ ok: false, error: status === 413 ? 'large' : 'failed' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects an unsafe returned path or a changed connection', async () => {
    const unsafe = vi.fn<typeof fetch>(async () => Response.json({ name: 'a.png', subfolder: '../outside' }));
    expect(await uploadComfyMedia(origin, 'a.png', bytes, unsafe)).toEqual({ ok: false, error: 'failed' });
    let address = origin();
    const changed = vi.fn<typeof fetch>(async () => { address = 'http://127.0.0.1:9199'; return Response.json({ name: 'a.png' }); });
    expect(await uploadComfyMedia(() => address, 'a.png', bytes, changed)).toEqual({ ok: false, error: 'changed' });
  });
  it('exposes upload controls for media metadata and core audio, but keeps ordinary model combos unchanged', () => {
    const catalog = parseObjectInfo({
      LoadImage: { input: { required: { image: [['old.png'], { image_upload: true }] } }, output: ['IMAGE'] },
      LoadVideo: { input: { required: { file: [['old.mp4'], { video_upload: true }] } }, output: ['VIDEO'] },
      LoadAudio: { input: { required: { audio: [['old.wav']] } }, output: ['AUDIO'] },
      Model: { input: { required: { model: [['a.safetensors']] } }, output: ['MODEL'] },
    });
    const upload = catalog.nodes.map((node) => fieldSpecOf(node.inputs[0], node.classType)?.fileUpload);
    expect(upload).toEqual(['image', 'video', 'audio', undefined]);
    expect(catalog.nodes[2].widgetOrder).toEqual(['audio']);
  });
});
