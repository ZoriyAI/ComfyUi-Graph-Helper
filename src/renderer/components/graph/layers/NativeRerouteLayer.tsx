/** Native link points: pointer drag, keyboard movement, and a tap menu, on the currently displayed graph. */
import React, { useEffect, useRef } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import type { ReroutePoint } from '../../../../shared/workflow/comfyLook';
import { useGraphStore } from '../../../state/graphState';
import { useProjectionStore } from '../../../services/commands/projection';
import { useCanvasStore } from '../canvasStore';
import { captureEditOrigin, commitAtOrigin, originIsCurrent, type EditOrigin } from '../lib/editOrigin';
import { useNativeReroutes, useReroutePreview } from '../lib/nativeReroutes';
import styles from './NativeRerouteLayer.module.css';

function Point({ point, readOnly }: { point: ReroutePoint; readOnly: boolean }) {
  const { t } = useTranslation(); const flow = useReactFlow();
  const preview = useReroutePreview(state => state.value?.id === point.id ? state.value : null);
  const shown = preview?.id === point.id && originIsCurrent(preview.origin) ? preview : point;
  const gesture = useRef<{ x: number; y: number; zoom: number; origin: EditOrigin; start: ReroutePoint; next: ReroutePoint; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const clear = () => { gesture.current = null; useReroutePreview.setState({ value: null }); };
  useEffect(() => () => { if (gesture.current) useReroutePreview.setState({ value: null }); }, []);
  const menu = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.right, clientY: box.bottom }));
  };
  return <button type="button" className={`${styles.point} nodrag nopan`} data-native-reroute={point.id} data-reroute-point={point.id}
    aria-label={String(t('canvas.reroutePoint', { id: point.id }))} title={String(t('canvas.rerouteHint'))}
    style={{ left: shown.x, top: shown.y }}
    onPointerDown={event => {
      if (event.button !== 0 || readOnly) return;
      event.stopPropagation();
      suppressClick.current = false;
      gesture.current = { x: event.clientX, y: event.clientY, zoom: flow.getZoom(), origin: captureEditOrigin(), start: point, next: point, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const state = gesture.current;
      if (!state || !originIsCurrent(state.origin)) return;
      const dx = event.clientX - state.x; const dy = event.clientY - state.y;
      if (!state.moved && Math.hypot(dx, dy) < 3) return;
      state.moved = true; suppressClick.current = true;
      state.next = { ...state.start, x: Math.round(state.start.x + dx / state.zoom), y: Math.round(state.start.y + dy / state.zoom) };
      useReroutePreview.setState({ value: { ...state.next, origin: state.origin } });
    }}
    onPointerUp={event => {
      const state = gesture.current; gesture.current = null;
      if (!state) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (state.moved) {
        const pendingPreview = useReroutePreview.getState().value;
        void commitAtOrigin(state.origin, { type: 'move-native-reroute', rerouteId: point.id, x: state.next.x, y: state.next.y }).finally(() => {
          if (!gesture.current && useReroutePreview.getState().value === pendingPreview) useReroutePreview.setState({ value: null });
        });
      }
      else {
        clear();
        // The canvas can suppress compatibility clicks after a touch gesture. Open on the actual tap release.
        if (event.pointerType === 'touch' || event.pointerType === 'pen') { suppressClick.current = true; menu(event.currentTarget); }
      }
    }}
    onPointerCancel={() => { suppressClick.current = true; clear(); }}
    onClick={event => { event.stopPropagation(); if (!suppressClick.current) menu(event.currentTarget); suppressClick.current = false; }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); suppressClick.current = true; clear(); return; }
      if (readOnly) return;
      const step = event.shiftKey ? 50 : 10;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (delta) { event.preventDefault(); event.stopPropagation(); void commitAtOrigin(captureEditOrigin(), { type: 'move-native-reroute', rerouteId: point.id, x: point.x + delta[0], y: point.y + delta[1] }); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); void commitAtOrigin(captureEditOrigin(), { type: 'remove-native-reroute', rerouteId: point.id }); }
    }}><span aria-hidden="true" /></button>;
}

export default function NativeRerouteLayer() {
  const points = useNativeReroutes(); const replay = useCanvasStore(state => state.replay);
  const graphKey = useProjectionStore(state => state.graphKey);
  const scope = useGraphStore(state => `${state.activeSubgraphId}:${JSON.stringify(state.subgraphInstancePath)}`);
  return <ViewportPortal>{points.map(point => <Point key={`${graphKey}:${scope}:${point.id}`} point={point} readOnly={Boolean(replay)} />)}</ViewportPortal>;
}
