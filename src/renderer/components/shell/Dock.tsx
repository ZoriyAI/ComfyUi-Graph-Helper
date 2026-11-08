import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Hint from '../../ui/Hint';
import Splitter from '../../ui/Splitter';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import ChatDock from '../chat/ChatDock';
import ExplainPanel from '../explain/ExplainPanel';
import CheckPanel from '../check/CheckPanel';
import Inspector from '../graph/Inspector';
import { canUseSplit, dockRange, normalizeDockTab, useDockStore, type DockTab } from '../../state/dockState';
import { RAIL_STRIP, RAIL_WIDTH, useUiStore } from '../../state/uiState';
import { DESKTOP_PROJECT_ID } from '../../../shared/project';
import styles from './Dock.module.css';

function useViewportWidth(): number {
  const [viewport, setViewport] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return viewport;
}

/** Width the rail takes right now; the dock range leaves the canvas its minimum beside both. */
function useRailReserve(): number {
  const railOpen = useUiStore((state) => state.railOpen);
  return railOpen ? RAIL_WIDTH : RAIL_STRIP;
}

/** The dock's resize handle (keeps the `tool-separator` class and the "Resize tools" name). */
export function ToolSplitter() {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const split = useDockStore((state) => state.split);
  const width = useDockStore((state) => state.width);
  const setWidth = useDockStore((state) => state.setWidth);
  const setSplit = useDockStore((state) => state.setSplit);
  const viewport = useViewportWidth();
  const reserve = useRailReserve();

  useEffect(() => {
    if (useDockStore.getState().split && !canUseSplit(viewport)) setSplit(false);
  }, [setSplit, viewport]);

  const range = dockRange(split, viewport, reserve);
  useEffect(() => {
    if (width < range.min || width > range.max) setWidth(Math.min(range.max, Math.max(range.min, width)));
  }, [range.max, range.min, setWidth, width]);

  if (collapsed) return null;
  return (
    <Splitter
      className="tool-separator"
      value={width}
      min={range.min}
      max={range.max}
      onChange={setWidth}
      label={String(t('dock.resize'))}
      controls="tool-dock"
      grow="left"
    />
  );
}

/** Toolbar buttons that open dock tabs, split the dock, or hide it. */
export function ToolToggles() {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const tab = useDockStore((state) => state.tab);
  const split = useDockStore((state) => state.split);
  const setCollapsed = useDockStore((state) => state.setCollapsed);
  const setSplit = useDockStore((state) => state.setSplit);
  const show = useDockStore((state) => state.show);
  const viewport = useViewportWidth();
  const splitAllowed = canUseSplit(viewport);
  const splitReason = String(t('dock.showBothReason'));

  return (
    <>
      <Button aria-pressed={!collapsed && (split || tab === 'inspector')} onClick={() => show('inspector')}>
        {t('dock.inspector')}
      </Button>
      <Button aria-pressed={!collapsed && (split || tab === 'assistant')} onClick={() => show('assistant')}>
        {t('dock.assistant')}
      </Button>
      {splitAllowed ? (
        <Button
          aria-pressed={split}
          title={String(t('dock.showBothTitle'))}
          onClick={() => {
            const next = !split;
            if (next && window.innerWidth - RAIL_WIDTH - 560 < 560) useUiStore.getState().setRail(false);
            setSplit(next);
          }}
        >
          {t('dock.showBoth')}
        </Button>
      ) : (
        <Hint label={splitReason}>
          <Button aria-pressed={false} aria-describedby="show-both-reason" disabled>
            {t('dock.showBoth')}
          </Button>
        </Hint>
      )}
      <span id="show-both-reason" className="sr-only">{splitReason}</span>
      <Button aria-pressed={collapsed} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? t('dock.showTools') : t('dock.hideTools')}
      </Button>
    </>
  );
}

const TABS: Array<{ value: DockTab; label: string; splitMember: boolean }> = [
  { value: 'assistant', label: 'dock.assistant', splitMember: true },
  { value: 'explain', label: 'dock.explain', splitMember: false },
  { value: 'inspector', label: 'dock.inspector', splitMember: true },
  { value: 'check', label: 'dock.check', splitMember: false },
];

/**
 * Right dock: Chat · Explain · Inspector · Check. Every panel stays mounted so a chat draft, its scroll
 * position and inspector edits survive tab switches and hiding the dock.
 */
export default function Dock({ onSendMessage, onPause }: { onSendMessage: (content: string) => void; onPause: () => void }) {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const tab = useDockStore((state) => state.tab);
  const split = useDockStore((state) => state.split);
  const width = useDockStore((state) => state.width);
  const show = useDockStore((state) => state.show);

  const panels: Record<DockTab, React.ReactNode> = {
    assistant: <ChatDock onSendMessage={onSendMessage} onPause={onPause} />,
    explain: <ExplainPanel />,
    inspector: <Inspector />,
    check: <CheckPanel projectId={DESKTOP_PROJECT_ID} />,
  };

  return (
    <aside
      className={cx(styles.dock, split && styles.split, 'dock', split && 'is-split')}
      style={{ width }}
      hidden={collapsed}
      id="tool-dock"
      aria-label={String(t('dock.region'))}
    >
      <ToolSplitter />
      <TabsRoot value={tab} onValueChange={(next) => show(normalizeDockTab(next))} className={cx(styles.tabs, 'dock-tabs')}>
        <TabsList className={cx(styles.tablist, 'dock-tablist')} aria-label={String(t('dock.tools'))}>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} className={cx(styles.tab, 'dock-tab')} value={item.value}>
              <span>{t(item.label)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className={cx(styles.panels, 'dock-panels')}>
          {TABS.map((item) => (
            <TabsContent
              key={item.value}
              className={cx(styles.panel, 'dock-panel')}
              value={item.value}
              data-split-member={item.splitMember ? 'true' : 'false'}
              forceMount
            >
              {panels[item.value]}
            </TabsContent>
          ))}
        </div>
      </TabsRoot>
    </aside>
  );
}
