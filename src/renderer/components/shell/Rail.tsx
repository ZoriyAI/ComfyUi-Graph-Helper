import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Boxes, Layers, PanelLeftClose, PanelLeftOpen, Shapes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import IconButton from '../../ui/IconButton';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import { motionIsFull } from '../../motion/policy';
import { RAIL_AUTO_COLLAPSE, RAIL_STRIP, RAIL_WIDTH, useUiStore, type RailTab } from '../../state/uiState';
import NodeLibrary from '../library/NodeLibrary';
import ModelLibrary from '../library/ModelLibrary';
import SubgraphLibrary from '../library/SubgraphLibrary';
import styles from './Rail.module.css';

const TABS: Array<{ value: RailTab; label: string; icon: React.ReactNode }> = [
  { value: 'nodes', label: 'library.nodes', icon: <Shapes size={18} aria-hidden="true" /> },
  { value: 'models', label: 'library.models', icon: <Boxes size={18} aria-hidden="true" /> },
  { value: 'subgraphs', label: 'library.subgraphs', icon: <Layers size={18} aria-hidden="true" /> },
];

/** Panel transitions follow the motion policy: 200 ms when motion is fully on, instant otherwise. */
function panelSeconds(): number {
  return motionIsFull() ? 0.2 : 0;
}

/**
 * Left library rail: Nodes · Models · Subgraphs. Collapses to an icon strip; below 1440 px it starts
 * collapsed and collapses itself when the window shrinks past that width.
 */
export default function Rail() {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.railOpen);
  const tab = useUiStore((state) => state.railTab);
  const setRail = useUiStore((state) => state.setRail);
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

  const duration = panelSeconds();

  return (
    <motion.aside
      id="library-rail"
      className={cx(styles.rail, 'rail')}
      aria-label={String(t('shell.library'))}
      data-open={open ? 'true' : 'false'}
      initial={false}
      animate={{ width: open ? RAIL_WIDTH : RAIL_STRIP }}
      transition={{ duration, ease: [0.2, 0, 0, 1] }}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            className={cx(styles.inner, styles.panel)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration / 2 }}
          >
            <TabsRoot value={tab} onValueChange={(next) => setRail(true, next as RailTab)} className={styles.tabs}>
              <div className={styles.head}>
                <TabsList className={styles.tablist} aria-label={String(t('library.sections'))}>
                  {TABS.map((item) => (
                    <TabsTrigger key={item.value} value={item.value} className={styles.tab}>{t(item.label)}</TabsTrigger>
                  ))}
                </TabsList>
                <IconButton size="sm" label={String(t('shell.railCollapse'))} aria-controls="library-rail" aria-expanded onClick={() => setRail(false)}>
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
            <IconButton label={String(t('shell.railExpand'))} aria-controls="library-rail" aria-expanded={false} onClick={() => setRail(true)}>
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
