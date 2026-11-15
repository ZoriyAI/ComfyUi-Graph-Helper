/**
 * A segmented control (a small radio group of buttons).
 * Who uses it: components/lessons/LessonEditor.tsx.
 */
import React from 'react';
import styles from './Segmented.module.css';
import { cx } from './cx';

/** One option of a Segmented control. */
export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional leading icon (decorative). */
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * A segmented control (radiogroup of buttons): a sunken track, the chosen option raised. Arrow keys move the
 * choice. The chosen option is shown by its surface only, never by a colour of its own.
 */
export default function Segmented<T extends string>({
  label, value, options, onChange, className,
}: {
  /** Accessible name of the group. */
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const enabled = options.filter((option) => !option.disabled);
  const move = (step: number) => {
    const index = enabled.findIndex((option) => option.value === value);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };
  return (
    <div
      className={cx(styles.track, className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          disabled={option.disabled}
          className={styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
