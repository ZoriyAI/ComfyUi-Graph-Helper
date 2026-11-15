/**
 * Link ports of a node card: the typed React Flow handle with the connect assist and keyboard linking, the port row
 * around it, and the set of a node's linked handles. NodeCard, FieldRow, EditorNodes, ComfyNode and SubgraphNode use
 * them. The focused port is not scoped to a subgraph here; CanvasFlow scopes it when it builds the selection.
 */
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
import { shortPortType } from '../../../../shared/workflow/comfyLook';
import styles from './Node.module.css';

/** What NodeCard passes for one link port row. */
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

/** What a port row or a field row passes to its handle. */
interface HandleProps {
  nodeId: string;
  port: PortDefinition;
  side: 'input' | 'output';
  connected: boolean;
  focusable: boolean;
  /** A field row's handle: smaller and quiet until hovered, so the row reads as a field, not a socket. */
  quiet?: boolean;
}

/**
 * A typed React Flow handle with a glow on hover and focus, and when "what connects here" lights it up.
 * Focus or Alt+hover starts the connect assist for this port; Enter then commits the best suggestion.
 * Shared by port rows and field rows (a widget input can still take a link).
 */
export function PortHandle({ nodeId, port, side, connected, focusable, quiet = false }: HandleProps) {
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
  // Accessibility: an empty required input says so in words, not only by its warning glow.
  const label = String(side === 'input'
    ? t('node.portInput', { name: port.name, type: port.dataType, state })
    : t('node.portOutput', { name: port.name, type: port.dataType, state })) + (empty ? `, ${String(t('a11y.requiredEmpty'))}` : '');
  const start = (pin = false) => {
    if (view.readOnly) return;
    setConnectFrom({ nodeId, handle: port.id, direction: side, dataType: port.dataType }, pin);
  };
  // A pinned assist (chosen from the context menu) outlives hover and blur; only Escape or a pane click ends it.
  const stop = () => {
    const current = useCanvasStore.getState();
    if (!current.connectPinned && current.connectFrom?.nodeId === nodeId && current.connectFrom.handle === port.id) setConnectFrom(null);
  };
  const className = [
    styles.handle,
    quiet ? styles.handleQuiet : '',
    isOrigin || isCompatible ? styles.handleLit : '',
    isBest ? styles.handleBest : '',
    empty ? styles.handleWarn : '',
    connected ? styles.handleConnected : '',
  ].filter(Boolean).join(' ');
  return (
    <Handle
      type={side === 'input' ? 'target' : 'source'}
      position={side === 'input' ? Position.Left : Position.Right}
      id={port.id}
      className={className}
      data-port-type={port.dataType}
      tabIndex={focusable ? 0 : -1}
      // A port is pressed (Enter links to the suggested match, Shift+F10 opens its menu): a button to a screen reader.
      role="button"
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
  );
}

/** One link port: handle, name, and the data type when the name does not already say it. */
export function PortRow({ nodeId, port, side, connected, focusable, live = true }: PortRowProps) {
  return (
    <li
      className={`${styles.port} ${side === 'input' ? styles.portIn : styles.portOut}`}
      data-port-type={port.dataType}
      data-port-side={side}
      data-port-handle={port.id}
      style={{ '--canvas-port': typeColor(port.dataType) } as React.CSSProperties}
    >
      {live
        ? <PortHandle nodeId={nodeId} port={port} side={side} connected={connected} focusable={focusable} />
        : <span className={`${styles.handle} ${styles.dot}`} aria-hidden="true" />}
      <span className={`${styles.portName} port-name`}>{port.name}</span>
      {port.name.toLowerCase() === port.dataType.toLowerCase() ? null : <span className={`${styles.portType} port-type`} title={port.dataType} data-full-type={port.dataType}>{shortPortType(port.dataType)}</span>}
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
