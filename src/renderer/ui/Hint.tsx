import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export function HintProvider({ children }: { children: React.ReactNode }) {
  return <Tooltip.Provider delayDuration={400}>{children}</Tooltip.Provider>;
}

export default function Hint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="hint-target">{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="hint-content" sideOffset={6}>{label}</Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
