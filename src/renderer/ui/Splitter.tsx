import React, { useRef, useState } from 'react';
import styles from './Splitter.module.css';
import { cx } from './cx';

export interface SplitterProps {
  /** Current size of the panel this splitter resizes, in px. */
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Accessible name, e.g. "Resize tools". */
  label: string;
  /** id of the resized panel. */
  controls: string;
  /** Which way the pointer/arrow moves to grow the panel. A right-hand dock grows to the left. */
  grow: 'left' | 'right';
  /** Which edge of the panel the handle sits on. */
  edge?: 'left' | 'right';
  step?: number;
  className?: string;
}

export function clampSize(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Vertical separator with pointer drag and keyboard (arrows, Home = min, End = max). */
export default function Splitter({ value, min, max, onChange, label, controls, grow, edge = grow === 'left' ? 'left' : 'right', step = 16, className }: SplitterProps) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const sign = grow === 'left' ? -1 : 1;
  const set = (next: number) => onChange(clampSize(next, min, max));
  return (
    <div
      className={cx(styles.splitter, edge === 'left' ? styles.atLeft : styles.atRight, className)}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, value };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        set(start.value + sign * (event.clientX - start.x));
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={(event) => {
        const growKey = grow === 'left' ? 'ArrowLeft' : 'ArrowRight';
        const shrinkKey = grow === 'left' ? 'ArrowRight' : 'ArrowLeft';
        if (event.key === growKey) set(value + step);
        else if (event.key === shrinkKey) set(value - step);
        else if (event.key === 'Home') set(min);
        else if (event.key === 'End') set(max);
        else return;
        event.preventDefault();
      }}
    />
  );
}
