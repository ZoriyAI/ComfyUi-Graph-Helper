/** Explicit image insertion uses the ordinary native LoadImage class; one upload and one undoable add. */
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MEDIA_UPLOAD_MAX_BYTES } from '../../../shared/contracts/media';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useProjectionStore } from '../../services/commands/projection';
import { requestWorkspacePanel } from '../../commands/events';
import { showToast } from '../../ui/toastStore';
import { i18n } from '../../i18n';
import { captureEditOrigin, commitAtOrigin, requireEditOrigin, type EditOrigin } from './lib/editOrigin';
import { placeNewNode } from './placeNode';
import { addedNodeId, revealNewNode } from './lib/reveal';
import { useCanvasStore } from './canvasStore';
import type { ComfyNodeData } from '../../types/graph';
import toolbar from './Toolbar.module.css';
import fields from '../fields/FieldControl.module.css';
import styles from './nodes/Node.module.css';

export async function addImageSource(file: File, point?: { x: number; y: number }, origin: EditOrigin = captureEditOrigin()): Promise<void> {
  if (useCanvasStore.getState().replay || !requireEditOrigin(origin)) return;
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size <= 0 || file.size > MEDIA_UPLOAD_MAX_BYTES) {
    showToast({ id: 'image-source', tone: 'warn', title: String(i18n.t(file.size > MEDIA_UPLOAD_MAX_BYTES ? 'field.uploadError.large' : 'imageSource.invalid')) }); return;
  }
  try {
    const detail = await window.electronAPI.nodeTypeDetail('LoadImage');
    if (!detail?.detailed) throw Error(String(i18n.t('imageSource.syncFirst')));
    if (!requireEditOrigin(origin)) return;
    const result = await window.electronAPI.uploadNodeFile(file.name, await file.arrayBuffer());
    if (!result.ok) throw Error(String(i18n.t(`field.uploadError.${result.error}`)));
    if (!requireEditOrigin(origin)) return;
    const pos = await placeNewNode(point ?? null, { classType: 'LoadImage', parameters: { image: result.name } });
    const committed = await commitAtOrigin(origin, { type: 'add-node', nodeType: 'LoadImage', title: file.name, x: pos.x, y: pos.y, parameters: { image: result.name } }, 'image-source');
    if (requireEditOrigin(origin)) { requestWorkspacePanel('canvas'); revealNewNode(addedNodeId(committed), undefined, origin); }
  } catch (error) { showToast({ id: 'image-source', tone: 'error', title: String(i18n.t('imageSource.failed')), description: error instanceof Error ? error.message : undefined }); }
}

/** A native input is the actual touch target, so phone gallery selection retains browser user activation. */
export function AddImageButton() {
  const { t } = useTranslation(); const origin = useRef<EditOrigin | null>(null); const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const replay = useCanvasStore((s) => Boolean(s.replay));
  return <label role="button" aria-label={String(t('imageSource.add'))} aria-disabled={busy || replay} tabIndex={busy || replay ? -1 : 0} className={`${toolbar.button} ${toolbar.imageAdd} nodrag nopan`} title={String(t('imageSource.hint'))} onKeyDown={(e) => { if (!busy && !replay && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); origin.current = captureEditOrigin(); picker.current?.click(); } }}>
    <ImagePlus size={16} /><span>{t('imageSource.add')}</span><input type="file" ref={picker} className={fields.nativePicker} aria-label={String(t('imageSource.add'))} accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" disabled={busy || replay} tabIndex={-1} onClickCapture={() => { origin.current = captureEditOrigin(); }} onChange={(e) => {
      const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!file || !origin.current) return; setBusy(true); void addImageSource(file, undefined, origin.current).finally(() => setBusy(false));
    }} />
  </label>;
}
const previews = new Map<string, Promise<string | null>>();
function previewOf(key: string, name: string): Promise<string | null> {
  const previous = previews.get(key); if (previous) return previous;
  const task = window.electronAPI.inputImagePreview(name).catch(() => null); previews.set(key, task);
  if (previews.size > 24) previews.delete(previews.keys().next().value!);
  return task;
}
export function ImageSourcePreview({ data }: { data: ComfyNodeData }) {
  const { t } = useTranslation(); const [src, setSrc] = useState<string | null>(null);
  const native = data.comfy && typeof data.comfy === 'object' ? data.comfy as { widgets_values?: unknown[] } : {};
  const name = data.parameters?.image ?? native.widgets_values?.[0];
  const binding = useProjectionStore((s) => `${s.projectId}:${s.graphKey}`); const version = useKnowledgeStore((s) => `${s.sync?.comfyOrigin ?? ''}:${s.sync?.mcpUrl ?? ''}:${s.sync?.lastSyncAt ?? ''}`);
  useEffect(() => { let alive = true; setSrc(null); if (typeof name === 'string' && name) void previewOf(`${binding}:${version}:${name}`, name).then((value) => { if (alive) setSrc(value); }); return () => { alive = false; }; }, [name, binding, version]);
  if (!src) return null;
  return <figure className={styles.imageSource} data-image-source><img src={src} alt={String(t('imageSource.preview', { name }))} draggable={false} loading="lazy" /><figcaption>{t('imageSource.output')}</figcaption></figure>;
}
