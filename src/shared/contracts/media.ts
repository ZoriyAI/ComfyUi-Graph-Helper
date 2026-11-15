/** Explicit user-selected media transfer to ComfyUI's input folder; never a host filesystem path. */
export const MEDIA_UPLOAD_MAX_BYTES = 64 * 1024 * 1024;
export type MediaUploadResult =
  | { ok: true; name: string }
  | { ok: false; error: 'unavailable' | 'large' | 'invalid' | 'timeout' | 'failed' | 'changed' };
