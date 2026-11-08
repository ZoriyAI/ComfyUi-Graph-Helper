import React, { useRef, useState } from 'react';
import ChatPanel from '../chat/ChatPanel';
import Inspector from '../graph/Inspector';

const MIN_INSPECTOR = 120;
const MAX_INSPECTOR = 420;

export default function Dock({
  onSendMessage,
  onPause,
}: {
  onSendMessage: (content: string) => void;
  onPause: () => void;
}) {
  const [height, setHeight] = useState(220);
  const drag = useRef<{ y: number; height: number } | null>(null);

  const clamp = (next: number) => Math.min(MAX_INSPECTOR, Math.max(MIN_INSPECTOR, next));

  return (
    <aside className="dock" aria-label="Inspector and assistant">
      <div className="dock-inspector" style={{ height }}>
        <Inspector />
      </div>
      <div
        className="dock-splitter"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize inspector"
        aria-valuemin={MIN_INSPECTOR}
        aria-valuemax={MAX_INSPECTOR}
        aria-valuenow={height}
        tabIndex={0}
        onPointerDown={(event) => {
          drag.current = { y: event.clientY, height };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          setHeight(clamp(start.height + (event.clientY - start.y)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') setHeight((current) => clamp(current + 16));
          if (event.key === 'ArrowUp') setHeight((current) => clamp(current - 16));
        }}
      />
      <ChatPanel onSendMessage={onSendMessage} onPause={onPause} />
    </aside>
  );
}
