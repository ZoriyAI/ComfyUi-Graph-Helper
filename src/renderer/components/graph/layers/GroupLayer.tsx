import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNodes, ViewportPortal } from '@xyflow/react';
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
function GroupTitle({ id, title, editable }: { id: string; title: string; editable: boolean }) {
  const { t } = useTranslation();
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

  const start = (event: React.MouseEvent) => {
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
      className={`${styles.title} nodrag nopan`}
      data-group-id={id}
      title={editable ? String(t('canvas.groupRenameHint')) : undefined}
      onDoubleClick={start}
    >
      {title || '—'}
    </div>
  );
}

/**
 * Groups as translucent rounded rectangles behind their members, with the title on top. Bounds follow the
 * members as they move (measured sizes from React Flow), else the stored native bounding.
 * Not React Flow nodes, so they never count as graph nodes. Only on the root level.
 */
export default function GroupLayer() {
  const groups = useGraphStore((state) => state.groups);
  const inDefinition = useGraphStore((state) => state.activeSubgraphId !== null);
  const replay = useCanvasStore((state) => state.replay);
  const nodes = useNodes() as PositionedNode[];
  if (inDefinition || groups.length === 0) return null;
  return (
    <ViewportPortal>
      {groups.map((group) => {
        const rect = groupRect(group, nodes);
        if (!rect) return null;
        return (
          <div
            key={group.id}
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
            <GroupTitle id={group.id} title={group.title} editable={!replay} />
          </div>
        );
      })}
    </ViewportPortal>
  );
}
