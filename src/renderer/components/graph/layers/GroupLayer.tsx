/**
 * The group layer of the canvas: ComfyUI groups drawn as translucent frames behind their member nodes, with a title
 * that can be renamed in place and dragged to move the whole group. CanvasFlow mounts it. Groups are not React Flow
 * nodes, so they never count as graph nodes; their geometry comes from lib/geometry.ts groupRect.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, MoveDiagonal2 } from 'lucide-react';
import { liftGroups } from '../../../../shared/workflow/codec';
import { groupHasFixedBounds, type GroupRecord } from '../../../../shared/graph/subgraphs';
import { captureEditOrigin, commitAtOrigin, originIsCurrent, type EditOrigin } from '../lib/editOrigin';
import { useTranslation } from 'react-i18next';
import { useNodes, useReactFlow, ViewportPortal } from '@xyflow/react';
import { useGraphStore } from '../../../state/graphState';
import { useProjectionStore } from '../../../services/commands/projection';
import { useCanvasStore } from '../canvasStore';
import { groupRect, type PositionedNode, type Rect } from '../lib/geometry';
import styles from './GroupLayer.module.css';

/** Same limit as the `rename-group` mutation. */
const TITLE_MAX = 500;

/**
 * The group title, renamed in place: a double-click turns it into a field, Enter saves through the engine
 * (`rename-group`, so it is undoable and in the revision history), Escape or leaving with no change cancels.
 * Not while a replay is showing: the replay is read-only.
 */
function GroupTitle({ id, title, editable, members, offset }: { id: string; title: string; editable: boolean; members: string[]; offset: (x: number, y: number) => void }) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  // A drag of the title moves the whole group: its members follow the pointer and land as one step.
  const drag = useRef<{ x: number; y: number; zoom: number; from: Map<string, { x: number; y: number }>; moved: boolean; dx: number; dy: number; origin: EditOrigin } | null>(null);
  // No group drag while nodes are pinned in place or during a replay.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !editable || useCanvasStore.getState().nodesPinned) return;
    event.stopPropagation();
    const nodes = flow.getNodes();
    const from = new Map(nodes.filter((node) => members.includes(node.id)).map((node) => [node.id, { ...node.position }]));
    drag.current = { x: event.clientX, y: event.clientY, zoom: flow.getZoom(), from, moved: false, dx: 0, dy: 0, origin: captureEditOrigin() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || !originIsCurrent(state.origin)) return;
    const dx = (event.clientX - state.x) / state.zoom;
    const dy = (event.clientY - state.y) / state.zoom;
    // Under 3 screen pixels the pointer has not really moved: a double-click to rename must not nudge the group.
    if (!state.moved && Math.hypot(dx * state.zoom, dy * state.zoom) < 3) return;
    state.moved = true;
    state.dx = dx; state.dy = dy;
    offset(dx, dy);
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
    void commitAtOrigin(state.origin, { type: 'move-group', groupId: id, dx: Math.round(state.dx), dy: Math.round(state.dy) }, 'move-group').finally(() => offset(0, 0));
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  // Saved or cancelled once: blur after Enter or Escape must not save again.
  const settled = useRef(false);
  const renameOrigin = useRef<EditOrigin | null>(null);

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
    renameOrigin.current = captureEditOrigin();
    setDraft(title);
    setEditing(true);
  };
  const finish = (save: boolean) => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    const next = draft.trim();
    if (save && next !== title.trim() && renameOrigin.current) void commitAtOrigin(renameOrigin.current, { type: 'rename-group', groupId: id, title: next }, 'rename-group');
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
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter') start(event);
        const step = event.shiftKey ? 50 : 10;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (delta && editable && !useCanvasStore.getState().nodesPinned) {
          event.preventDefault(); event.stopPropagation();
          void commitAtOrigin(captureEditOrigin(), { type: 'move-group', groupId: id, dx: delta[0], dy: delta[1] }, 'move-group');
        }
      }}
      title={editable ? String(t('canvas.groupMoveHint')) : undefined}
      onDoubleClick={start}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        const state = drag.current; drag.current = null; offset(0, 0);
        if (state?.moved && originIsCurrent(state.origin)) flow.setNodes((nodes) => nodes.map((node) => {
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

/** A pointer gesture changes only the frame. Its nodes keep their positions and membership. */
function GroupFrame({ group, nodes, editable }: { group: GroupRecord; nodes: PositionedNode[]; editable: boolean }) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const [preview, setPreview] = useState<Rect | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; zoom: number; rect: Rect; next: Rect; origin: EditOrigin } | null>(null);
  const base = groupRect(group, nodes);
  if (!base) return null;
  const fixed = groupHasFixedBounds(group) || !group.nodeIds.length;
  const rect = preview ?? { ...base, x: base.x + (fixed ? offset.x : 0), y: base.y + (fixed ? offset.y : 0) };
  const save = (next: Rect, origin: EditOrigin) => commitAtOrigin(origin, {
    type: 'set-group-bounds', groupId: group.id, bounding: [next.x, next.y, next.width, next.height],
  }, 'resize-group');
  return <div className={styles.group} data-group-id={group.id} data-group-bounds-mode={groupHasFixedBounds(group) ? 'manual' : 'auto'}
    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, ...(group.color ? { '--canvas-group': group.color } : {}) } as React.CSSProperties}>
    <GroupTitle id={group.id} title={group.title} editable={editable} members={group.nodeIds} offset={(x, y) => setOffset({ x, y })} />
    {editable ? <button type="button" className={`${styles.resize} nodrag nopan`} data-group-resize={group.id}
      aria-label={String(t('canvas.groupResizeLabel', { name: group.title || '—' }))} title={String(t('canvas.groupResizeHint'))}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        drag.current = { x: event.clientX, y: event.clientY, zoom: flow.getZoom(), rect, next: rect, origin: captureEditOrigin() };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state || !originIsCurrent(state.origin)) return;
        const width = Math.max(80, Math.round(state.rect.width + (event.clientX - state.x) / state.zoom));
        const height = Math.max(60, Math.round(state.rect.height + (event.clientY - state.y) / state.zoom));
        state.next = { ...state.rect, width, height }; setPreview(state.next);
      }}
      onPointerUp={event => {
        const state = drag.current; drag.current = null;
        if (!state) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (state.rect.width === state.next.width && state.rect.height === state.next.height) { setPreview(null); return; }
        void save(state.next, state.origin).finally(() => setPreview(null));
      }}
      onPointerCancel={() => { drag.current = null; setPreview(null); }}
      onKeyDown={event => {
        const step = event.shiftKey ? 50 : 10;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (event.key === 'Escape') { drag.current = null; setPreview(null); event.stopPropagation(); }
        if (!delta) return;
        event.preventDefault(); event.stopPropagation();
        void save({ ...rect, width: Math.max(80, rect.width + delta[0]), height: Math.max(60, rect.height + delta[1]) }, captureEditOrigin());
      }}><MoveDiagonal2 size={16} aria-hidden="true" /></button> : null}
    {preview ? <output className={styles.dimensions}>{Math.round(rect.width)} × {Math.round(rect.height)}</output> : null}
  </div>;
}

/** Groups on the root and inside a definition. Automatic frames follow members; manual frames retain their size. */
export default function GroupLayer() {
  const rootGroups = useGraphStore(state => state.groups);
  const definition = useGraphStore(state => state.subgraphs.find(item => item.id === state.activeSubgraphId));
  const instanceKey = useGraphStore(state => JSON.stringify(state.subgraphInstancePath));
  const graphKey = useProjectionStore(state => state.graphKey);
  const groups = useMemo(() => definition ? definition.groups ?? liftGroups(definition.raw.groups, definition.nodes) : rootGroups, [definition, rootGroups]);
  const replay = useCanvasStore(state => state.replay);
  const nodes = useNodes() as PositionedNode[];
  if (!groups.length) return null;
  return <ViewportPortal>{groups.map(group => <GroupFrame key={`${graphKey}:${definition?.id ?? 'root'}:${instanceKey}:${group.id}`} group={group} nodes={nodes} editable={!replay} />)}</ViewportPortal>;
}
