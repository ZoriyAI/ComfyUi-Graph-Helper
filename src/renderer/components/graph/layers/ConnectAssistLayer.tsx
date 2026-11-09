import React from 'react';
import { useTranslation } from 'react-i18next';
import { getBezierPath, Position, useStore, ViewportPortal } from '@xyflow/react';
import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';
import { handlePoint } from '../lib/handles';
import { typeColor } from '../lib/typeColors';
import { useLayoutKey } from '../lib/useLayoutKey';
import styles from './ConnectAssistLayer.module.css';

/**
 * "What connects here": a dashed suggested path from the asked-about port to the best compatible port,
 * with a one-line hint. The glow on compatible ports and the dimming live on the nodes themselves.
 */
export default function ConnectAssistLayer() {
  const { t } = useTranslation();
  const from = useCanvasStore((state) => state.connectFrom);
  const view = useCanvasView();
  const lookup = useStore((state) => state.nodeLookup);
  useLayoutKey();
  if (!from || !view.plan) return null;
  const best = view.plan.best;
  const origin = handlePoint(lookup, from.nodeId, from.handle, from.direction === 'output' ? 'source' : 'target');
  if (!origin) return null;
  const color = typeColor(from.dataType);
  if (!best) {
    return (
      <ViewportPortal>
        <div className={styles.hint} style={{ left: origin.x, top: origin.y + 18 }} role="status">{t('canvas.connectNone')}</div>
      </ViewportPortal>
    );
  }
  const end = handlePoint(lookup, best.nodeId, best.handle, best.direction === 'output' ? 'source' : 'target');
  if (!end) return null;
  const source = from.direction === 'output' ? origin : end;
  const target = from.direction === 'output' ? end : origin;
  const [path] = getBezierPath({
    sourceX: source.x, sourceY: source.y, sourcePosition: Position.Right,
    targetX: target.x, targetY: target.y, targetPosition: Position.Left,
  });
  const node = lookup.get(best.nodeId);
  const ports = (node?.data as { inputs?: Array<{ id: string; name: string }>; outputs?: Array<{ id: string; name: string }> } | undefined);
  const portName = (best.direction === 'input' ? ports?.inputs : ports?.outputs)?.find((item) => item.id === best.handle)?.name ?? best.handle;
  const title = (node?.data as { title?: string; comfyType?: string } | undefined);
  const name = `${title?.title || title?.comfyType || best.nodeId} · ${portName}`;
  return (
    <ViewportPortal>
      <svg className={styles.svg} aria-hidden="true">
        <path d={path} className={styles.path} style={{ stroke: color }} />
      </svg>
      <div className={styles.hint} style={{ left: end.x, top: end.y + 18 }} role="status">{t('canvas.connectHint', { name })}</div>
    </ViewportPortal>
  );
}
