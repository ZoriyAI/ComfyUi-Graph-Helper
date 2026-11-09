import React, { useId, useRef } from 'react';
import styles from './RadioCards.module.css';
import { cx } from './cx';

export interface RadioCardOption {
  value: string;
  /** The card's name; it is the radio's accessible name. */
  title: string;
  description?: string;
  /** Drawn before the title (a swatch, a status dot). Decorative. */
  leading?: React.ReactNode;
  /** Drawn under the description (a status badge). Not part of the accessible name. */
  trailing?: React.ReactNode;
}

export interface RadioCardsProps {
  /** Accessible name of the group (and its visible label unless `hideLabel`). */
  label: string;
  hideLabel?: boolean;
  value: string;
  options: RadioCardOption[];
  onChange: (value: string) => void;
  /** Card grid columns at full width; cards wrap on narrow panels. */
  columns?: 2 | 3 | 4;
  compact?: boolean;
  className?: string;
}

/**
 * A radio group drawn as cards. Arrow keys move and select (roving tab stop, as native radios do);
 * Space or Enter selects the focused card. Each card is a button with role="radio".
 */
export default function RadioCards({ label, hideLabel, value, options, onChange, columns = 3, compact, className }: RadioCardsProps) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <div className={cx(styles.group, className)}>
      <span id={`${base}-label`} className={cx(styles.label, hideLabel && 'sr-only')}>{label}</span>
      <div role="radiogroup" aria-labelledby={`${base}-label`} className={cx(styles.cards, styles[`cols${columns}`], compact && styles.compact)}>
        {options.map((option, index) => {
          const checked = option.value === value;
          const titleId = `${base}-${index}-title`;
          const descriptionId = option.description ? `${base}-${index}-description` : undefined;
          return (
            <button
              key={option.value || '__none__'}
              ref={(element) => { refs.current[index] = element; }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              data-value={option.value}
              tabIndex={index === selected ? 0 : -1}
              className={cx(styles.card, checked && styles.checked)}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  move(index, 1);
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  move(index, -1);
                }
              }}
            >
              <span className={styles.head}>
                <span className={styles.mark} aria-hidden="true" />
                {option.leading ? <span className={styles.leading} aria-hidden="true">{option.leading}</span> : null}
                <span id={titleId} className={styles.title}>{option.title}</span>
              </span>
              {option.description ? <span id={descriptionId} className={styles.description}>{option.description}</span> : null}
              {option.trailing ? <span className={styles.trailing}>{option.trailing}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
