import React from 'react';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@radix-ui/react-tooltip';

export function Hint({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="hint-trigger" tabIndex={0}>{children}</span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent className="hint-bubble" side="bottom" sideOffset={8}>
          {label}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
