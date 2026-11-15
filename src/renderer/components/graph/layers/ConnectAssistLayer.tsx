/**
 * "What connects here": a dashed suggested path from the asked-about port to the best compatible port,
 * with a one-line hint. The glow on compatible ports and the dimming live on the nodes themselves.
 * While a link is dragged from a port (motion package) the same dashed path runs from that port to the best place
 * for it, without the words: the person's own line under the pointer is the main thing then.
 * CanvasFlow mounts it; the plan (lib/connectAssist.ts) is computed there and passed through CanvasContext.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getBezierPath, Panel, Position, useStore, ViewportPortal } from '@xyflow/react';
import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';
import { handlePoint } from '../lib/handles';
import { typeColor } from '../lib/typeColors';
import { useLayoutKey } from '../lib/useLayoutKey';
import styles from './ConnectAssistLayer.module.css';

/** Draws the suggestion for the asked-about or dragged port; the plan comes from the canvas view context. */
export default function ConnectAssistLayer() {
  const { t } = useTranslation();
  const asked = useCanvasStore((state) => state.connectFrom);
  const dragged = useCanvasStore((state) => state.linkDrag);
  const from = asked ?? dragged;
  const words = Boolean(asked);
  const view = useCanvasView();
  const lookup = useStore((state) => state.nodeLookup);
  // Re-render when nodes move or handles are measured: the path ends follow them.
  useLayoutKey();
  if (!from || !view.plan) return null;
  const best = view.plan.best;
  const origin = handlePoint(lookup, from.nodeId, from.handle, from.direction === 'output' ? 'source' : 'target');
  if (!origin) return null;
  const color = typeColor(from.dataType);
  if (!best) {
    if (!words) return null;
    return (
      <Panel position="top-center" className={`nopan nowheel nodrag ${styles.panel}`}>
        <div className={`connect-hint ${styles.hint}`} role="status">{t('canvas.connectNone')}</div>
      </Panel>
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
    <>
      <ViewportPortal>
        <svg className={styles.svg} aria-hidden="true">
          <path d={path} className={styles.path} style={{ stroke: color }} data-connect-hint={words ? 'asked' : 'drag'} />
        </svg>
      </ViewportPortal>
      {/* The words stand under the canvas toolbar, where they are read whole at any zoom; the dashed line shows where. */}
      {words ? <Panel position="top-center" className={`nopan nowheel nodrag ${styles.panel}`}>
        <div className={`connect-hint ${styles.hint}`} role="status">{t('canvas.connectHint', { name })}</div>
      </Panel> : null}
    </>
  );
}
