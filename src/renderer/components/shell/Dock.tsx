import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Columns2, Lightbulb, ListChecks, PanelRightClose, PanelRightOpen, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import IconButton from '../../ui/IconButton';
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
import { motionIsFull } from '../../motion/policy';
import { runCommand, useCommandState } from '../../commands/registry';
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

/** Measures text the way the dock tabs draw it, so the header knows whether full labels fit. */
let measureContext: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * 7.5;
  measureContext.font = `600 13px ${getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'}`;
  return measureContext.measureText(text).width;
}

/** Icon 16 + gap 5 + padding 2x8 + border 2 around each label (Dock.module.css .tab), 2px between tabs, a little slack. */
function fullTabsWidth(labels: string[]): number {
  return labels.reduce((sum, label) => sum + Math.ceil(textWidth(label)) + 39, 0) + (labels.length - 1) * 2 + 8;
}

/**
 * Whether all four tab labels fit beside the header actions. Below that every tab is an icon with its name in a
 * tooltip (and for screen readers), so no tab changes width when another is chosen.
 */
function useLabelsFit(labels: string[]): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  const key = labels.join('|');
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const needed = fullTabsWidth(key.split('|'));
    const measure = () => setFits(element.clientWidth >= needed);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [key]);
  return [ref, fits];
}

/**
 * Dock header actions: show Inspector and Assistant side by side, and hide the dock. Both run the
 * View-menu commands (view.showBoth, view.dock), so the menu bar and these buttons agree.
 */
function DockActions() {
  const { t } = useTranslation();
  const showBoth = useCommandState('view.showBoth');
  const splitReason = String(t('dock.showBothReason'));

  return (
    <div className={styles.actions}>
      {showBoth.enabled ? (
        <IconButton
          size="sm"
          label={String(t('dock.showBoth'))}
          title={String(t('dock.showBothTitle'))}
          aria-pressed={Boolean(showBoth.checked)}
          onClick={() => void runCommand('view.showBoth')}
        >
          <Columns2 size={16} aria-hidden="true" />
        </IconButton>
      ) : (
        <Hint label={splitReason}>
          <IconButton size="sm" label={String(t('dock.showBoth'))} title="" aria-pressed={false} aria-describedby="show-both-reason" disabled>
            <Columns2 size={16} aria-hidden="true" />
          </IconButton>
        </Hint>
      )}
      <span id="show-both-reason" className="sr-only">{splitReason}</span>
      <IconButton size="sm" label={String(t('dock.hideTools'))} aria-controls="tool-dock" aria-expanded onClick={() => void runCommand('view.dock')}>
        <PanelRightClose size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

/** While split, the header names both panes; each name leaves the split on that pane. */
function SplitTitles() {
  const { t } = useTranslation();
  const show = useDockStore((state) => state.show);
  return (
    <div className={styles.splitTitles} role="group" aria-label={String(t('dock.tools'))}>
      {TABS.filter((item) => item.splitMember).map((item) => (
        <button key={item.value} type="button" className={styles.splitTitle} onClick={() => show(item.value)}>
          <span className={styles.tabIcon} aria-hidden="true">{item.icon}</span>
          <span>{t(item.label)}</span>
        </button>
      ))}
    </div>
  );
}

/** The collapsed dock: a strip of icons on the right edge, mirroring the library rail. */
function DockStrip() {
  const { t } = useTranslation();
  const tab = useDockStore((state) => state.tab);
  const show = useDockStore((state) => state.show);
  return (
    <div className={cx(styles.strip, 'dock-strip')}>
      <IconButton label={String(t('dock.showTools'))} aria-controls="tool-dock" aria-expanded={false} onClick={() => void runCommand('view.dock')}>
        <PanelRightOpen size={18} aria-hidden="true" />
      </IconButton>
      <span className={styles.stripRule} aria-hidden="true" />
      {TABS.map((item) => (
        <IconButton key={item.value} label={String(t(item.label))} active={item.value === tab} onClick={() => show(item.value)}>
          {item.icon}
        </IconButton>
      ))}
    </div>
  );
}

const TABS: Array<{ value: DockTab; label: string; splitMember: boolean; icon: React.ReactNode }> = [
  { value: 'assistant', label: 'dock.assistant', splitMember: true, icon: <Sparkles size={16} aria-hidden="true" /> },
  { value: 'explain', label: 'dock.explain', splitMember: false, icon: <Lightbulb size={16} aria-hidden="true" /> },
  { value: 'inspector', label: 'dock.inspector', splitMember: true, icon: <SlidersHorizontal size={16} aria-hidden="true" /> },
  { value: 'check', label: 'dock.check', splitMember: false, icon: <ListChecks size={16} aria-hidden="true" /> },
];

/**
 * Right dock: Assistant · Explain · Inspector · Check. Every panel stays mounted so a chat draft, its scroll
 * position and inspector edits survive tab switches and hiding the dock. The tab names the panel; panels keep
 * an accessible name but draw no heading that repeats it (see Dock.module.css for the chat header).
 */
export default function Dock({ onSendMessage, onPause }: { onSendMessage: (content: string) => void; onPause: () => void }) {
  const { t } = useTranslation();
  const collapsed = useDockStore((state) => state.collapsed);
  const tab = useDockStore((state) => state.tab);
  const split = useDockStore((state) => state.split);
  const width = useDockStore((state) => state.width);
  const show = useDockStore((state) => state.show);
  const labels = TABS.map((item) => String(t(item.label)));
  const [tabsRef, labelsFit] = useLabelsFit(labels);
  const slide = motionIsFull() ? 0.2 : 0;

  const panels: Record<DockTab, React.ReactNode> = {
    assistant: <ChatDock onSendMessage={onSendMessage} onPause={onPause} />,
    explain: <ExplainPanel />,
    inspector: <Inspector />,
    check: <CheckPanel projectId={DESKTOP_PROJECT_ID} />,
  };

  return (
    <>
      <aside
        className={cx(styles.dock, split && styles.split, 'dock', split && 'is-split')}
        style={{ width }}
        hidden={collapsed}
        id="tool-dock"
        aria-label={String(t('dock.region'))}
      >
        <ToolSplitter />
        <TabsRoot value={tab} onValueChange={(next) => show(normalizeDockTab(next))} className={cx(styles.tabs, 'dock-tabs')}>
          <div className={cx(styles.header, 'dock-header')}>
            {split ? <SplitTitles /> : null}
            <div ref={tabsRef} className={styles.tabsWrap}>
              <TabsList className={cx(styles.tablist, 'dock-tablist')} aria-label={String(t('dock.tools'))}>
                {TABS.map((item, index) => {
                  const active = item.value === tab;
                  // All labels or none: when the four names do not fit, every tab (the chosen one too) is an icon with
                  // its name in a hint, so the tabs keep their widths when another one is chosen.
                  const iconOnly = !labelsFit;
                  const trigger = (
                    <TabsTrigger key={item.value} className={cx(styles.tab, iconOnly && styles.iconTab, 'dock-tab')} value={item.value}>
                      <span className={styles.tabIcon} aria-hidden="true">{item.icon}</span>
                      <span className={iconOnly ? 'sr-only' : styles.tabLabel}>{labels[index]}</span>
                      {active && !collapsed ? (
                        <motion.span layoutId="dock-tab-underline" className={styles.underline} transition={{ duration: slide, ease: [0.2, 0, 0, 1] }} aria-hidden="true" />
                      ) : null}
                    </TabsTrigger>
                  );
                  return iconOnly ? <Hint key={item.value} label={labels[index]} side="bottom">{trigger}</Hint> : trigger;
                })}
              </TabsList>
            </div>
            <DockActions />
          </div>
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
      {collapsed ? <DockStrip /> : null}
    </>
  );
}
