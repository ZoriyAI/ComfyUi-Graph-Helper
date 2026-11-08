import React, { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';

export const CLOSE_OPEN_SELECT = 'close-open-select';

export interface SelectOption {
  value: string;
  label: string;
}

const EMPTY = '__empty__';

export default function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  container,
}: {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  container?: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_OPEN_SELECT, close);
    return () => window.removeEventListener(CLOSE_OPEN_SELECT, close);
  }, []);
  return (
    <div className="field">
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
        <Select.Trigger id={id} className="select-trigger" aria-label={label} data-value={value}>
          <Select.Value />
          <Select.Icon className="select-icon" aria-hidden="true">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal container={container ?? undefined}>
          <Select.Content className="select-content" position="popper" sideOffset={4}>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option.label} className="select-item" value={option.value === '' ? EMPTY : option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="select-check" aria-hidden="true">✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
