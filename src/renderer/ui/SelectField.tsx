import React, { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import styles from './SelectField.module.css';
import { cx } from './cx';

export const CLOSE_OPEN_SELECT = 'close-open-select';

export interface SelectOption {
  value: string;
  label: string;
}

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
}: {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  container?: HTMLElement | null;
  className?: string;
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
          const stored = next === EMPTY ? '' : next;
          if (stored !== value) onChange(stored);
        }}
      >
        <Select.Trigger id={id} className={cx(styles.trigger, 'select-trigger')} aria-label={label} data-value={value}>
          <Select.Value />
          <Select.Icon className={cx(styles.icon, 'select-icon')} aria-hidden="true"><ChevronDown size={14} /></Select.Icon>
        </Select.Trigger>
        <Select.Portal container={container ?? undefined}>
          <Select.Content className={cx(styles.content, 'select-content')} position="popper" sideOffset={4} collisionPadding={8}>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option.label} className={cx(styles.item, 'select-item')} value={option.value === '' ? EMPTY : option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className={cx(styles.check, 'select-check')} aria-hidden="true"><Check size={14} /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
