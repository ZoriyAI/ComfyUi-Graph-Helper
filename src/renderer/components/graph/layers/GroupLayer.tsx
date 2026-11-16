/**
 * The group layer of the canvas: ComfyUI groups drawn as translucent frames behind their member nodes, with a title
 * that can be renamed in place and dragged to move the whole group. CanvasFlow mounts it. Groups are not React Flow
 * nodes, so they never count as graph nodes; their geometry comes from lib/geometry.ts groupRect.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { liftGroups } from '../../../../shared/workflow/codec';
import { useProjectionStore } from '../../../services/commands/projection';
import { useTranslation } from 'react-i18next';
import { useNodes, useReactFlow, ViewportPortal } from '@xyflow/react';
import { useGraphStore } from '../../../state/graphState';
import { useCanvasStore } from '../canvasStore';
import { commitManual } from '../commit';
import { groupRect, type PositionedNode } from '../lib/geometry';
import styles from './GroupLayer.module.css';

/** Same limit as the `rename-group` mutation. */
const TITLE_MAX = 500;

/**
 * The group title, renamed in place: a double-click turns it into a field, Enter saves through the engine
 * (`rename-group`, so it is undoable and in the revision history), Escape or leaving with no change cancels.
 * Not while a replay is showing: the replay is read-only.
 */
function GroupTitle({ id, title, editable, members }: { id: string; title: string; editable: boolean; members: string[] }) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  // A drag of the title moves the whole group: its members follow the pointer and land as one step.
  const drag = useRef<{ x: number; y: number; zoom: number; from: Map<string, { x: number; y: number }>; moved: boolean; dx: number; dy: number; levelId: string | null; projectId: string; graphKey: string } | null>(null);
  // No group drag while nodes are pinned in place, during a replay, or for a group without members.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !editable || useCanvasStore.getState().nodesPinned || members.length === 0) return;
    event.stopPropagation();
    const nodes = flow.getNodes();
    const from = new Map(nodes.filter((node) => members.includes(node.id)).map((node) => [node.id, { ...node.position }]));
    const { projectId, graphKey } = useProjectionStore.getState();
    drag.current = { x: event.clientX, y: event.clientY, zoom: flow.getZoom(), from, moved: false, dx: 0, dy: 0, levelId: useGraphStore.getState().activeSubgraphId, projectId, graphKey };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.x) / state.zoom;
    const dy = (event.clientY - state.y) / state.zoom;
    // Under 3 screen pixels the pointer has not really moved: a double-click to rename must not nudge the group.
    if (!state.moved && Math.hypot(dx * state.zoom, dy * state.zoom) < 3) return;
    state.moved = true;
    state.dx = dx; state.dy = dy;
    // React Flow updates the visible level locally; one command is saved at release.
    flow.setNodes((nodes) => nodes.map((node) => {
      const start = state.from.get(node.id);
      return start ? { ...node, position: { x: start.x + dx, y: start.y + dy } } : node;
    }));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (state.levelId !== useGraphStore.getState().activeSubgraphId) return;
    const moves = [...state.from].map(([nodeId, position]) => ({ nodeId, x: Math.round(position.x + state.dx), y: Math.round(position.y + state.dy) }));
    if (moves.length > 0) void commitManual({ type: 'move-nodes', moves }, 'move-group', { context: { projectId: state.projectId, graphKey: state.graphKey } });
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  // Saved or cancelled once: blur after Enter or Escape must not save again.
  const settled = useRef(false);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const start = (event: React.SyntheticEvent) => {
    // The canvas would zoom on a double-click; this one is for the title.
    event.stopPropagation();
    event.preventDefault();
    if (!editable) return;
    settled.current = false;
    setDraft(title);
    setEditing(true);
  };
  const finish = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    const next = draft.trim();
    if (save && next !== title.trim()) void commitManual({ type: 'rename-group', groupId: id, title: next }, 'rename-group');
  };

  if (editing) {
    return (
      <input
        ref={input}
        className={`${styles.title} ${styles.titleInput} nodrag nopan nowheel`}
        data-group-id={id}
        aria-label={String(t('canvas.groupTitle'))}
        value={draft}
        maxLength={TITLE_MAX}
        spellCheck={false}
        size={Math.max(8, Math.min(48, draft.length + 2))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Keys belong to the field while it is open (no canvas delete, no app shortcuts).
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            finish(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      />
    );
  }
  return (
    <div
      className={`${styles.title} ${editable ? styles.titleMovable : ''} nodrag nopan`}
      data-group-id={id}
      data-group-title={id}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={(event) => { if (event.key === 'Enter') start(event); }}
      title={editable ? String(t('canvas.groupMoveHint')) : undefined}
      onDoubleClick={start}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        const state = drag.current; drag.current = null;
        if (state?.moved && state.levelId === useGraphStore.getState().activeSubgraphId) flow.setNodes((nodes) => nodes.map((node) => {
          const position = state.from.get(node.id); return position ? { ...node, position } : node;
        }));
      }}
    >
      <span>{title || '—'}</span>
      {editable ? <button type="button" className={styles.menu} aria-label={`${t('contextMenu.label')}: ${title || '—'}`}
        onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left, clientY: box.bottom }));
        }}><MoreHorizontal size={16} aria-hidden="true" /></button> : null}
    </div>
  );
}

/**
 * Groups as translucent rounded rectangles behind their members, with the title on top. Bounds follow the
 * members as they move (measured sizes from React Flow), else the stored native bounding.
 * Not React Flow nodes, so they never count as graph nodes. On the root and inside a definition.
 */
export default function GroupLayer() {
  const rootGroups = useGraphStore((state) => state.groups);
  const definition = useGraphStore((state) => state.subgraphs.find((item) => item.id === state.activeSubgraphId));
  const groups = useMemo(() => definition ? definition.groups ?? liftGroups(definition.raw.groups, definition.nodes) : rootGroups, [definition, rootGroups]);
  const replay = useCanvasStore((state) => state.replay);
  const nodes = useNodes() as PositionedNode[];
  if (groups.length === 0) return null;
  return (
    <ViewportPortal>
      {groups.map((group) => {
        const rect = groupRect(group, nodes);
        if (!rect) return null;
        return (
          <div
            key={`${definition?.id ?? 'root'}:${group.id}`}
            className={styles.group}
            data-group-id={group.id}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              ...(group.color ? { '--canvas-group': group.color } : {}),
            } as React.CSSProperties}
          >
            <GroupTitle id={group.id} title={group.title} editable={!replay} members={group.nodeIds} />
          </div>
        );
      })}
    </ViewportPortal>
  );
}
