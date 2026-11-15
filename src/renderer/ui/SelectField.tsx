/**
 * A labelled drop-down list. Who uses it: settings sections, components/shell/Toolbar.tsx (the provider choice)
 * and components/library/ModelLibrary.tsx (kind, family and order).
 */
import React, { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, Settings2 } from 'lucide-react';
import styles from './SelectField.module.css';
import { cx } from './cx';

/** A window event that closes any open SelectField or SuggestField list (SettingsPanel sends it on Escape). */
export const CLOSE_OPEN_SELECT = 'close-open-select';

/** One choice of the list. */
export interface SelectOption {
  value: string;
  label: string;
}

/** A row under the options that runs something instead of choosing a value ("Set up…"). */
export interface SelectAction {
  label: string;
  onSelect: () => void;
}

/** Radix select values: an action row is `__action__:<index>`; '' (Radix refuses it) is stored as `__empty__`. */
const ACTION_PREFIX = '__action__:';

const EMPTY = '__empty__';

/**
 * Labelled Radix select. Keeps the legacy `field`, `select-trigger`, `select-content` and `select-item`
 * classes that e2e tests and the settings Escape handling look for.
 */
export default function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  container,
  className,
  icon,
  display,
  actions,
  note,
}: {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  container?: HTMLElement | null;
  className?: string;
  /** Drawn before the value inside the trigger (a bare svg, so the value stays the trigger's first span). */
  icon?: React.ReactNode;
  /** What the closed trigger reads, when it should say more than the chosen option's label. */
  display?: React.ReactNode;
  /** Rows after a rule at the end of the list; choosing one runs it and keeps the value. */
  actions?: SelectAction[];
  /** A sentence at the top of the open list, about the current choice (where the helper's key is). */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_OPEN_SELECT, close);
    return () => window.removeEventListener(CLOSE_OPEN_SELECT, close);
  }, []);
  return (
    <div className={cx(styles.field, 'field', className)}>
      <span className="field-label" id={id ? `${id}-label` : undefined}>{label}</span>
      <Select.Root
        open={open}
        onOpenChange={setOpen}
        value={value === '' ? EMPTY : value}
        onValueChange={(next) => {
          if (next.startsWith(ACTION_PREFIX)) {
            actions?.[Number(next.slice(ACTION_PREFIX.length))]?.onSelect();
            return;
          }
          const stored = next === EMPTY ? '' : next;
          if (stored !== value) onChange(stored);
        }}
      >
        <Select.Trigger id={id} className={cx(styles.trigger, 'select-trigger')} aria-label={label} data-value={value}>
          {icon}
          {display === undefined ? <Select.Value /> : <Select.Value>{display}</Select.Value>}
          <Select.Icon className={cx(styles.icon, 'select-icon')} aria-hidden="true"><ChevronDown size={14} /></Select.Icon>
        </Select.Trigger>
        <Select.Portal container={container ?? undefined}>
          <Select.Content className={cx(styles.content, 'select-content')} position="popper" sideOffset={4} collisionPadding={8}>
            <Select.Viewport>
              {note ? <Select.Group><Select.Label className={cx(styles.note, 'select-note')}>{note}</Select.Label></Select.Group> : null}
              {options.map((option) => (
                <Select.Item key={option.label} className={cx(styles.item, 'select-item')} value={option.value === '' ? EMPTY : option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className={cx(styles.check, 'select-check')} aria-hidden="true"><Check size={14} /></Select.ItemIndicator>
                </Select.Item>
              ))}
              {actions && actions.length > 0 ? <Select.Separator className={styles.separator} /> : null}
              {actions?.map((action, index) => (
                <Select.Item key={`action-${action.label}`} className={cx(styles.item, styles.action, 'select-item')} value={`${ACTION_PREFIX}${index}`}>
                  <span className={styles.actionIcon} aria-hidden="true"><Settings2 size={14} /></span>
                  <Select.ItemText>{action.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
