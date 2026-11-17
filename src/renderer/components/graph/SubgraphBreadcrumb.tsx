/**
 * The breadcrumb bar over the canvas while a subgraph is open: the root graph, each subgraph on the way in, an Up
 * button and a line saying the canvas shows a definition. GraphWorkspace renders it; it hides itself on the root.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, CornerLeftUp } from 'lucide-react';
import { useGraphStore } from '../../state/graphState';
import { breadcrumb } from './lib/subgraphView';
import styles from './Toolbar.module.css';

/** Where the canvas is: Graph › Subgraph › Nested. Each crumb goes back to that level. */
export default function SubgraphBreadcrumb() {
  const { t } = useTranslation();
  const path = useGraphStore((state) => state.subgraphPath);
  const instances = useGraphStore(state => state.subgraphInstancePath);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const exit = useGraphStore((state) => state.exitSubgraph);
  if (path.length === 0) return null;
  const crumbs = breadcrumb(path, subgraphs).map((crumb, index) => ({ ...crumb, name: instances[index] ? String(t('lessons.instanceContext', { name: crumb.name, id: instances[index] })) : crumb.name }));
  return (
    <div className={styles.crumbBar} data-canvas-breadcrumb="">
      <nav className={styles.crumbs} aria-label={String(t('canvas.breadcrumb'))}>
        <button type="button" className={styles.crumb} onClick={() => exit(0)}>{t('canvas.root')}</button>
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight size={14} aria-hidden="true" className={styles.crumbSep} />
            {index === crumbs.length - 1
              ? <span className={styles.crumbCurrent} aria-current="page">{crumb.name}</span>
              : <button type="button" className={styles.crumb} onClick={() => exit(crumb.depth)}>{crumb.name}</button>}
          </React.Fragment>
        ))}
        <button type="button" className={styles.button} onClick={() => exit(path.length - 1)} aria-label={String(t('canvas.up'))} title={String(t('canvas.up'))}>
          <CornerLeftUp size={14} aria-hidden="true" />
        </button>
      </nav>
      <p className={styles.crumbHint}>{t('canvas.insideDefinition')}</p>
    </div>
  );
}
