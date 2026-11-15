/**
 * A text field with a list of suggestions. Who uses it: settings sections Connection (ComfyUI and MCP addresses)
 * and Assistant (models of the person's own server).
 */
import React, { useEffect, useId, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import Badge, { type BadgeTone } from './Badge';
import Button from './Button';
import { CLOSE_OPEN_SELECT } from './SelectField';
import styles from './SuggestField.module.css';
import { cx } from './cx';

/** One entry of the list. */
export interface Suggestion {
  value: string;
  /** Main line; the value when absent. */
  label?: string;
  /** Second line: where it came from, size, family. */
  detail?: string;
  badges?: Array<{ text: string; tone: BadgeTone }>;
}

/** A line under the field (for example "Found 3 models"), coloured by `tone`. */
export interface SuggestStatus {
  text: string;
  tone?: 'neutral' | 'good' | 'bad';
}

/** Props of SuggestField. */
export interface SuggestFieldProps {
  /** Visible label and the text input's accessible name. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is chosen; defaults to onChange. */
  onPick?: (value: string) => void;
  /** aria-invalid / aria-describedby and the like for the text input. */
  inputProps?: Record<string, string | boolean>;
  suggestions: Suggestion[];
  /** Accessible name of the list (a combobox). Must differ from `label`. */
  pickerLabel: string;
  /** Shown in the list button when the typed value is not one of the suggestions. */
  placeholder: string;
  /** Shown in the list button when there is nothing to pick yet. */
  emptyText: string;
  action?: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean; icon?: React.ReactNode };
  status?: SuggestStatus | null;
  container?: HTMLElement | null;
  className?: string;
}

/** The list's value when the typed text matches no suggestion. */
const NOTHING = '';

/**
 * A text field with a list to pick from: what the app could read (a server's models, detected servers, addresses
 * used before) is offered, and anything else can still be typed. The list is a Radix select with the legacy
 * `select-trigger` / `select-content` / `select-item` classes the settings Escape handling and e2e tests look for.
 */
export default function SuggestField({
  label, value, onChange, onPick, inputProps, suggestions, pickerLabel, placeholder, emptyText, action, status, container, className,
}: SuggestFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_OPEN_SELECT, close);
    return () => window.removeEventListener(CLOSE_OPEN_SELECT, close);
  }, []);
  const trimmed = value.trim();
  const matched = suggestions.some((item) => item.value === trimmed) ? trimmed : NOTHING;
  const empty = suggestions.length === 0;
  return (
    <div className={cx(styles.root, className)}>
      <label htmlFor={`${id}-input`}>{label}</label>
      {/* One control: the list opens from a chevron inside the field, the field's placeholder says what it offers. */}
      <div className={styles.inputWrap}>
        <input
          id={`${id}-input`}
          className={styles.input}
          aria-label={label}
          value={value}
          spellCheck={false}
          placeholder={empty ? emptyText : placeholder}
          onChange={(event) => onChange(event.target.value)}
          {...inputProps}
        />
        <Select.Root
          open={open}
          onOpenChange={setOpen}
          value={matched}
          disabled={empty}
          onValueChange={(next) => {
            if (next !== NOTHING) (onPick ?? onChange)(next);
          }}
        >
          <Select.Trigger className={cx(styles.trigger, 'select-trigger')} aria-label={pickerLabel} title={empty ? emptyText : pickerLabel} data-value={matched} data-count={suggestions.length}>
            <span className={styles.value}><Select.Value placeholder={empty ? emptyText : placeholder} /></span>
            <Select.Icon className={cx(styles.icon, 'select-icon')} aria-hidden="true"><ChevronDown size={16} /></Select.Icon>
          </Select.Trigger>
          <Select.Portal container={container ?? undefined}>
            <Select.Content className={cx(styles.content, 'select-content')} position="popper" side="bottom" align="end" alignOffset={-3} sideOffset={6} collisionPadding={8}>
              <Select.Viewport className={styles.viewport}>
                {suggestions.map((item) => (
                  <Select.Item key={item.value} className={cx(styles.item, 'select-item')} value={item.value}>
                    <span className={styles.itemText}>
                      <Select.ItemText>{item.label ?? item.value}</Select.ItemText>
                      {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                    </span>
                    {item.badges && item.badges.length > 0 ? (
                      <span className={styles.badges}>
                        {item.badges.map((badge) => <Badge key={badge.text} tone={badge.tone}>{badge.text}</Badge>)}
                      </span>
                    ) : null}
                    <Select.ItemIndicator className={styles.check} aria-hidden="true"><Check size={14} /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
      {action ? (
        <div className={styles.row}>
          <Button size="sm" variant="subtle" icon={action.icon} loading={action.loading} disabled={action.disabled || action.loading} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
      {status && status.text ? (
        <p className={cx(styles.status, status.tone === 'good' && styles.good, status.tone === 'bad' && styles.bad, 'field-hint')} role="status">{status.text}</p>
      ) : null}
    </div>
  );
}
