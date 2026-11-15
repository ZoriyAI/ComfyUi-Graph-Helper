/**
 * A windowed listbox for thousands of fixed-height rows. NodeLibrary.tsx and ModelLibrary.tsx render their lists
 * with it. A catalog can hold thousands of node classes and model files; drawing only the rows in view keeps the
 * rail fast.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { moveActive, scrollIntoRow, windowRange } from './libraryModel';
import styles from './VirtualList.module.css';

/** Props of VirtualList; every row must have the same `rowHeight`. */
export interface VirtualListProps<T> {
  id: string;
  rows: T[];
  rowHeight: number;
  /** Accessible name of the listbox. */
  label: string;
  getKey: (row: T) => string;
  renderRow: (row: T, state: { active: boolean; index: number }) => React.ReactNode;
  /** Enter / double-click. */
  onActivate?: (row: T, index: number) => void;
  /** Extra keys (ArrowLeft/Right on a header, for example). Return true when handled. */
  onRowKey?: (row: T, event: React.KeyboardEvent) => boolean;
  /** Row is an option (selectable) rather than a group label. */
  isOption?: (row: T) => boolean;
  /** Called when the rendered window changes (for lazy per-row reads). */
  onRangeChange?: (start: number, end: number) => void;
  className?: string;
}

/** Keys the list handles itself to move the active row. */
const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']);

/**
 * Windowed listbox for thousands of fixed-height rows. One tab stop; arrows move the active row
 * (aria-activedescendant), Enter activates. Only the visible rows plus overscan are in the DOM.
 */
export default function VirtualList<T>({ id, rows, rowHeight, label, getKey, renderRow, onActivate, onRowKey, isOption, onRangeChange, className }: VirtualListProps<T>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  // A guess until the first layout measures the real height.
  const [height, setHeight] = useState(400);
  const [active, setActive] = useState(-1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setHeight(element.clientHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A shorter list (a new search) keeps the active row inside it.
  useEffect(() => {
    if (active >= rows.length) setActive(rows.length - 1);
  }, [active, rows.length]);

  const range = windowRange(scrollTop, height, rowHeight, rows.length);
  const rowId = (index: number) => `${id}-row-${index}`;
  // The latest callback in a ref, so a new function each render does not re-run the effect below.
  const onRange = useRef(onRangeChange);
  onRange.current = onRangeChange;
  useEffect(() => {
    onRange.current?.(range.start, range.end);
  }, [range.start, range.end, rows]);

  const focusRow = (index: number) => {
    setActive(index);
    const element = ref.current;
    if (!element || index < 0) return;
    const next = scrollIntoRow(index, element.scrollTop, element.clientHeight, rowHeight);
    if (next != null) {
      element.scrollTop = next;
      setScrollTop(next);
    }
  };

  return (
    <div
      ref={ref}
      id={id}
      className={`${styles.list} ${className ?? ''}`}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={active >= 0 && active < rows.length ? rowId(active) : undefined}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onFocus={() => {
        if (active < 0 && rows.length > 0) setActive(0);
      }}
      onKeyDown={(event) => {
        if (NAV_KEYS.has(event.key)) {
          event.preventDefault();
          const page = Math.max(1, Math.floor(height / rowHeight) - 1);
          focusRow(moveActive(rows as Array<{ kind: string }>, active, event.key as 'ArrowDown', page));
          return;
        }
        const row = rows[active];
        if (row === undefined) return;
        if (onRowKey?.(row, event)) {
          event.preventDefault();
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          onActivate?.(row, active);
        }
      }}
    >
      <div className={styles.spacer} style={{ height: range.total }}>
        <div className={styles.window} style={{ transform: `translateY(${range.offset}px)` }}>
          {rows.slice(range.start, range.end).map((row, offset) => {
            const index = range.start + offset;
            const option = isOption ? isOption(row) : true;
            return (
              <div
                key={getKey(row)}
                id={rowId(index)}
                className={styles.row}
                style={{ height: rowHeight }}
                role={option ? 'option' : 'presentation'}
                aria-selected={option ? index === active : undefined}
                aria-setsize={option ? rows.length : undefined}
                aria-posinset={option ? index + 1 : undefined}
                onMouseDown={() => setActive(index)}
                onDoubleClick={() => onActivate?.(row, index)}
              >
                {renderRow(row, { active: index === active, index })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
