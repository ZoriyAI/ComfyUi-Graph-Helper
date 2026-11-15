/**
 * The left library rail of the main window (App.tsx renders it): the node, model and subgraph libraries as tabs, or a
 * strip of icons when collapsed. Its open state and tab live in uiState so the View menu (view.rail) and the
 * dock's width range (Dock.tsx reserves the rail's width) agree with it.
 */
import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Boxes, Layers, PanelLeftClose, PanelLeftOpen, Shapes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import IconButton from '../../ui/IconButton';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import { EASE_OUT, useMotionTimings } from '../../motion/policy';
import { RAIL_AUTO_COLLAPSE, RAIL_STRIP, RAIL_WIDTH, useUiStore, type RailTab } from '../../state/uiState';
import NodeLibrary from '../library/NodeLibrary';
import ModelLibrary from '../library/ModelLibrary';
import SubgraphLibrary from '../library/SubgraphLibrary';
import { runCommand } from '../../commands/registry';
import styles from './Rail.module.css';

/** The rail's sections in order: the catalog key of each name and its icon in the strip. */
const TABS: Array<{ value: RailTab; label: string; icon: React.ReactNode }> = [
  { value: 'nodes', label: 'library.nodes', icon: <Shapes size={18} aria-hidden="true" /> },
  { value: 'models', label: 'library.models', icon: <Boxes size={18} aria-hidden="true" /> },
  { value: 'subgraphs', label: 'library.subgraphs', icon: <Layers size={18} aria-hidden="true" /> },
];


/**
 * Left library rail: Nodes · Models · Subgraphs. Collapses to an icon strip; below RAIL_AUTO_COLLAPSE (1180 px) it
 * starts collapsed and collapses itself when the window shrinks past that width.
 */
export default function Rail() {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.railOpen);
  const tab = useUiStore((state) => state.railTab);
  const setRail = useUiStore((state) => state.setRail);
  // Collapse only on the crossing from wide to narrow, so a person who opens the rail in a narrow window keeps it open.
  const wasWide = useRef(window.innerWidth >= RAIL_AUTO_COLLAPSE);

  useEffect(() => {
    const onResize = () => {
      const wide = window.innerWidth >= RAIL_AUTO_COLLAPSE;
      if (wasWide.current && !wide && useUiStore.getState().railOpen) setRail(false);
      wasWide.current = wide;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setRail]);

  // --motion-panel with full motion, the short fade of Reduced, 0 with Off (motion/policy.ts).
  const duration = useMotionTimings().panel;

  return (
    <motion.aside
      id="library-rail"
      className={cx(styles.rail, 'rail')}
      aria-label={String(t('shell.library'))}
      data-open={open ? 'true' : 'false'}
      initial={false}
      animate={{ width: open ? RAIL_WIDTH : RAIL_STRIP }}
      transition={{ duration, ease: EASE_OUT }}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            className={cx(styles.inner, styles.panel)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // Half the width animation each: mode="wait" fades the old content out, then the new one in.
            transition={{ duration: duration / 2 }}
          >
            <TabsRoot value={tab} onValueChange={(next) => setRail(true, next as RailTab)} className={styles.tabs}>
              <div className={styles.head}>
                <TabsList className={styles.tablist} aria-label={String(t('library.sections'))}>
                  {TABS.map((item) => (
                    <TabsTrigger key={item.value} value={item.value} className={styles.tab}>{t(item.label)}</TabsTrigger>
                  ))}
                </TabsList>
                <IconButton size="sm" label={String(t('shell.railCollapse'))} aria-controls="library-rail" aria-expanded onClick={() => void runCommand('view.rail')}>
                  <PanelLeftClose size={16} aria-hidden="true" />
                </IconButton>
              </div>
              {TABS.map((item) => (
                <TabsContent key={item.value} value={item.value} className={styles.content} tabIndex={-1}>
                  {item.value === 'nodes' ? <NodeLibrary /> : item.value === 'models' ? <ModelLibrary /> : <SubgraphLibrary />}
                </TabsContent>
              ))}
            </TabsRoot>
          </motion.div>
        ) : (
          <motion.div
            key="strip"
            className={cx(styles.inner, styles.strip)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration / 2 }}
          >
            <IconButton label={String(t('shell.railExpand'))} aria-controls="library-rail" aria-expanded={false} onClick={() => void runCommand('view.rail')}>
              <PanelLeftOpen size={18} aria-hidden="true" />
            </IconButton>
            <span className={styles.stripRule} aria-hidden="true" />
            {TABS.map((item) => (
              <IconButton key={item.value} label={String(t(item.label))} active={item.value === tab} onClick={() => setRail(true, item.value)}>
                {item.icon}
              </IconButton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
