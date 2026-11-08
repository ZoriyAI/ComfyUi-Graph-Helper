import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Hint from '../../ui/Hint';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import ChatPanel from '../chat/ChatPanel';
import Inspector from '../graph/Inspector';
import { canUseSplit, dockRange, useDockStore, type DockTab } from '../../state/dockState';

export function ToolSplitter() {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const split = useDockStore((state) => state.split);
  const width = useDockStore((state) => state.width);
  const setWidth = useDockStore((state) => state.setWidth);
  const setSplit = useDockStore((state) => state.setSplit);
  const [viewport, setViewport] = useState(() => window.innerWidth);
  const drag = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const onResize = () => {
      const next = window.innerWidth;
      setViewport(next);
      if (useDockStore.getState().split && !canUseSplit(next)) setSplit(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setSplit]);

  const range = dockRange(split, viewport);
  useEffect(() => {
    if (width < range.min || width > range.max) {
      setWidth(Math.min(range.max, Math.max(range.min, width)));
    }
  }, [range.max, range.min, setWidth, width]);

  if (collapsed) return null;

  const clamp = (next: number) => Math.min(range.max, Math.max(range.min, next));

  return (
    <div
      className="tool-separator"
      role="separator"
      aria-orientation="vertical"
      aria-label={String(t('dock.resize'))}
      aria-controls="tool-dock"
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        setWidth(clamp(start.width + (start.x - event.clientX)));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') event.preventDefault();
        if (event.key === 'ArrowLeft') setWidth(clamp(width + 16));
        if (event.key === 'ArrowRight') setWidth(clamp(width - 16));
        if (event.key === 'Home') setWidth(range.min);
        if (event.key === 'End') setWidth(range.max);
      }}
    />
  );
}

export function ToolToggles() {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const tab = useDockStore((state) => state.tab);
  const split = useDockStore((state) => state.split);
  const setCollapsed = useDockStore((state) => state.setCollapsed);
  const setSplit = useDockStore((state) => state.setSplit);
  const show = useDockStore((state) => state.show);
  const [viewport, setViewport] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const splitAllowed = canUseSplit(viewport);
  const splitReason = String(t('dock.showBothReason'));

  return (
    <>
      <button
        type="button"
        className="ghost-button"
        aria-pressed={!collapsed && (split || tab === 'inspector')}
        onClick={() => show('inspector')}
      >
        {t('dock.inspector')}
      </button>
      <button
        type="button"
        className="ghost-button"
        aria-pressed={!collapsed && (split || tab === 'assistant')}
        onClick={() => show('assistant')}
      >
        {t('dock.assistant')}
      </button>
      {splitAllowed ? (
        <button
          type="button"
          className="ghost-button"
          aria-pressed={split}
          title={String(t('dock.showBothTitle'))}
          onClick={() => setSplit(!split)}
        >
          {t('dock.showBoth')}
        </button>
      ) : (
        <Hint label={splitReason}>
          <button
            type="button"
            className="ghost-button"
            aria-pressed={false}
            aria-describedby="show-both-reason"
            disabled
          >
            {t('dock.showBoth')}
          </button>
        </Hint>
      )}
      <span id="show-both-reason" className="sr-only">{splitReason}</span>
      <button
        type="button"
        className="ghost-button"
        aria-pressed={collapsed}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? t('dock.showTools') : t('dock.hideTools')}
      </button>
    </>
  );
}

export default function Dock({
  onSendMessage,
  onPause,
}: {
  onSendMessage: (content: string) => void;
  onPause: () => void;
}) {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const tab = useDockStore((state) => state.tab);
  const split = useDockStore((state) => state.split);
  const width = useDockStore((state) => state.width);
  const show = useDockStore((state) => state.show);

  return (
    <aside
      className={split ? 'dock is-split' : 'dock'}
      style={{ width }}
      hidden={collapsed}
      id="tool-dock"
      aria-label={String(t('dock.region'))}
    >
      <ToolSplitter />
      <TabsRoot
        value={tab}
        onValueChange={(next) => show(next as DockTab)}
        className="dock-tabs"
      >
        <TabsList className="dock-tablist" aria-label={String(t('dock.tools'))}>
          <TabsTrigger className="dock-tab" value="inspector">{t('dock.inspector')}</TabsTrigger>
          <TabsTrigger className="dock-tab" value="assistant">{t('dock.assistant')}</TabsTrigger>
        </TabsList>
        <div className="dock-panels">
          <TabsContent className="dock-panel" value="inspector" forceMount>
            <Inspector />
          </TabsContent>
          <TabsContent className="dock-panel" value="assistant" forceMount>
            <ChatPanel onSendMessage={onSendMessage} onPause={onPause} />
          </TabsContent>
        </div>
      </TabsRoot>
    </aside>
  );
}
