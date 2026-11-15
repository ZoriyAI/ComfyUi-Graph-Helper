/**
 * A number input with step buttons. Who uses it: settings sections Canvas and Assistant, and the sync settings.
 */
import React, { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import styles from './NumberField.module.css';
import { cx } from './cx';

/** Props of NumberField; the two button labels are their accessible names. */
export interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Unit after the value, e.g. "ms". Decorative; put the unit in the label too. */
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  className?: string;
}

/** Rounds `value` to the step grid from `min` and keeps it in range; anything not a number becomes `min`. */
export function clampNumber(value: number, min: number, max: number, step = 1): number {
  if (!Number.isFinite(value)) return min;
  const stepped = Math.round((value - min) / step) * step + min;
  // Three decimals remove float noise from fractional steps (0.1 + 0.2).
  return Math.max(min, Math.min(max, Math.round(stepped * 1000) / 1000));
}

/**
 * A labelled number with − and + buttons. Typing is free; the value is clamped to the range and step on
 * blur or Enter, and the buttons step within it. The input is a native spinbutton (arrow keys work too).
 */
export default function NumberField({ label, value, min, max, step = 1, unit, hint, onChange, decreaseLabel, increaseLabel, className }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const next = clampNumber(Number(raw), min, max, step);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.control}>
        <button type="button" className={styles.step} aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(clampNumber(value - step, min, max, step))}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = Number(event.target.value);
            // A value in range takes effect while typing; anything else waits for blur or Enter.
            if (event.target.value !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(clampNumber(parsed, min, max, step));
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
          }}
        />
        <button type="button" className={styles.step} aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(clampNumber(value + step, min, max, step))}>
          <Plus size={14} aria-hidden="true" />
        </button>
        {unit ? <span className={styles.unit} aria-hidden="true">{unit}</span> : null}
        <span className={styles.range} aria-hidden="true">{min}–{max}</span>
      </div>
      {hint ? <p id={`${id}-hint`} className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
