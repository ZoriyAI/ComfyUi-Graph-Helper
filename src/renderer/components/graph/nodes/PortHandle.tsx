import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position } from '@xyflow/react';
import type { PortDefinition } from '../../../types/graph';
import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';
import { connectMutation, portKey } from '../lib/connectAssist';
import { portRef } from '../lib/selection';
import { typeColor } from '../lib/typeColors';
import { commitManual } from '../commit';
import styles from './Node.module.css';

interface PortRowProps {
  nodeId: string;
  port: PortDefinition;
  side: 'input' | 'output';
  connected: boolean;
  /** Handles join the tab order only on the selected node, so the canvas stays one stop per node. */
  focusable: boolean;
  /** Ghost cards draw a dot instead of a live React Flow handle. */
  live?: boolean;
}

/**
 * One port: a typed handle with a glow on hover and focus, and when "what connects here" lights it up.
 * Focus or Alt+hover starts the connect assist for this port; Enter then commits the best suggestion.
 */
export function PortRow({ nodeId, port, side, connected, focusable, live = true }: PortRowProps) {
  const { t } = useTranslation();
  const view = useCanvasView();
  const from = useCanvasStore((state) => state.connectFrom);
  const pinned = useCanvasStore((state) => state.connectPinned);
  const setConnectFrom = useCanvasStore((state) => state.setConnectFrom);
  const setFocusedPort = useCanvasStore((state) => state.setFocusedPort);
  const key = portKey(nodeId, port.id);
  const isOrigin = from?.nodeId === nodeId && from.handle === port.id;
  const isCompatible = view.plan?.compatible.has(key) ?? false;
  const isBest = view.plan?.best?.nodeId === nodeId && view.plan.best.handle === port.id;
  const empty = side === 'input' && !connected && view.emptyRequired.has(`${nodeId}:${port.name}`);
  const state = connected ? t('node.connected') : t('node.notConnected');
  const label = String(side === 'input'
    ? t('node.portInput', { name: port.name, type: port.dataType, state })
    : t('node.portOutput', { name: port.name, type: port.dataType, state }));
  const start = (pin = false) => {
    if (view.readOnly) return;
    setConnectFrom({ nodeId, handle: port.id, direction: side, dataType: port.dataType }, pin);
  };
  const stop = () => {
    const current = useCanvasStore.getState();
    if (!current.connectPinned && current.connectFrom?.nodeId === nodeId && current.connectFrom.handle === port.id) setConnectFrom(null);
  };
  const className = [
    styles.handle,
    isOrigin || isCompatible ? styles.handleLit : '',
    isBest ? styles.handleBest : '',
    empty ? styles.handleWarn : '',
    connected ? styles.handleConnected : '',
  ].filter(Boolean).join(' ');
  return (
    <li
      className={`${styles.port} ${side === 'input' ? styles.portIn : styles.portOut}`}
      data-port-type={port.dataType}
      data-port-side={side}
      data-port-handle={port.id}
      style={{ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties}
    >
      {live ? (
        <Handle
          type={side === 'input' ? 'target' : 'source'}
          position={side === 'input' ? Position.Left : Position.Right}
          id={port.id}
          className={className}
          data-port-type={port.dataType}
          tabIndex={focusable ? 0 : -1}
          aria-label={label}
          title={empty ? String(t('node.emptyRequired')) : undefined}
          onFocus={(event) => {
            // Keyboard focus selects and explains the port; a mouse press (drag, right-click) does not.
            if (!event.currentTarget.matches(':focus-visible')) return;
            setFocusedPort(portRef(nodeId, port.id, side, port.name));
            start();
          }}
          onBlur={() => {
            if (useCanvasStore.getState().focusedPort) setFocusedPort(null);
            stop();
          }}
          onMouseEnter={(event) => {
            if (event.altKey) start();
          }}
          onMouseLeave={() => {
            if (!pinned) stop();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && useCanvasStore.getState().connectFrom) {
              event.stopPropagation();
              setConnectFrom(null);
              return;
            }
            if (event.key !== 'Enter') return;
            const current = useCanvasStore.getState().connectFrom;
            const best = view.plan?.best;
            if (!current || !best || view.readOnly) return;
            event.preventDefault();
            event.stopPropagation();
            void commitManual(connectMutation(current, best));
            setConnectFrom(null);
          }}
        />
      ) : <span className={`${styles.handle} ${styles.dot}`} aria-hidden="true" />}
      <span className={`${styles.portName} port-name`}>{port.name}</span>
      {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className={`${styles.portType} port-type`}>{port.dataType}</span>}
    </li>
  );
}

/** Handles of a node that have a link, from the edges of the level on screen. */
export function useConnectedHandles(nodeId: string): Set<string> {
  const view = useCanvasView();
  const set = new Set<string>();
  for (const edge of view.edges) {
    if (edge.source === nodeId && edge.sourceHandle) set.add(`out:${edge.sourceHandle}`);
    if (edge.target === nodeId && edge.targetHandle) set.add(`in:${edge.targetHandle}`);
  }
  return set;
}
