/**
 * The preview that lies next to a model file, as something an <img> or a <video> can show. Main hands the bytes
 * over; the window keeps them as an object URL for as long as the preview is among the most recently shown.
 * Used by ModelLibrary.tsx (row thumbnails) and ModelCard.tsx (the large preview).
 */
import { useEffect, useState } from 'react';
import type { ModelSummary } from '../../../shared/contracts';
import { modelKey } from './libraryModel';


/** What a component shows for a preview: nothing, a wait, a failure, or the object URL. */
export type ModelPreviewState =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; url: string; kind: 'image' | 'video' };

/** A preview held in memory; null records a file that has no readable preview, so it is not asked again. */
type Held = { url: string; kind: 'image' | 'video' } | null;

/** How many previews stay ready. The ones on screen are always the most recent, so none of them is dropped. */
const HELD_MOST = 240;
/** Held previews by model key, oldest first (a Map keeps insertion order). */
const held = new Map<string, Held>();
/** Reads in flight, so two rows of one file share one request. */
const waiting = new Map<string, Promise<Held>>();

/** Marks a preview as the most recent and lets the oldest go past HELD_MOST, freeing their object URLs. */
function remember(key: string, value: Held): void {
  held.delete(key);
  held.set(key, value);
  for (const [oldest, item] of held) {
    if (held.size <= HELD_MOST) break;
    held.delete(oldest);
    if (item) URL.revokeObjectURL(item.url);
  }
}

/** After a sync a preview may be another file: what is held is let go and read again when next shown. */
export function clearModelPreviewCache(): void {
  for (const item of held.values()) if (item) URL.revokeObjectURL(item.url);
  held.clear();
}

/** A lookup on the internet may have found another sample for this file: what is held is read again. */
export function forgetModelPreview(key: string): void {
  const item = held.get(key);
  held.delete(key);
  if (item) URL.revokeObjectURL(item.url);
}

/** Reads one preview from main once; callers of the same file wait on the same promise. */
function load(model: Pick<ModelSummary, 'directory' | 'name'>, key: string): Promise<Held> {
  const running = waiting.get(key);
  if (running) return running;
  const work = window.electronAPI.modelPreview(model.directory, model.name)
    .then((preview): Held => {
      if (!preview || !preview.bytes || preview.bytes.byteLength === 0) return null;
      // A copy: what comes over IPC may sit in a larger buffer.
      const bytes = new Uint8Array(preview.bytes);
      return { url: URL.createObjectURL(new Blob([bytes], { type: preview.mime })), kind: preview.kind };
    })
    .catch((): Held => null)
    .then((value) => {
      remember(key, value);
      return value;
    })
    .finally(() => waiting.delete(key));
  waiting.set(key, work);
  return work;
}

/** The preview of `model`, read when first asked for. `null` asks for nothing (no preview, or one not to show). */
export function useModelPreview(model: Pick<ModelSummary, 'directory' | 'name' | 'preview'> | null): ModelPreviewState {
  const key = model && model.preview ? modelKey(model) : '';
  const [, setTick] = useState(0);
  // Read again when it was let go meanwhile (forgetModelPreview) while the same file stays shown.
  const missing = key !== '' && !held.has(key);
  useEffect(() => {
    if (!key || !model || held.has(key)) return undefined;
    let live = true;
    void load(model, key).then(() => {
      if (live) setTick((value) => value + 1);
    });
    return () => {
      live = false;
    };
    // `key` names the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, missing]);
  if (!key) return { state: 'none' };
  if (!held.has(key)) return { state: 'loading' };
  const value = held.get(key) ?? null;
  if (value) {
    // Shown again: it is the most recent one.
    remember(key, value);
    return { state: 'ready', url: value.url, kind: value.kind };
  }
  return { state: 'failed' };
}
