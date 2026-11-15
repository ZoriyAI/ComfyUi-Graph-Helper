/**
 * A breadcrumb path. Exported from ui/index.ts; no component in the app imports it at present (the canvas draws
 * its subgraph path itself).
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './Breadcrumb.module.css';
import { cx } from './cx';

/** One place of the path; `onSelect` makes it a button that goes back there. */
export interface BreadcrumbItem {
  id: string;
  label: string;
  onSelect?: () => void;
}

/** Path of nested places (e.g. graph > subgraph). The last item is the current one. */
export default function Breadcrumb({ items, label, className }: { items: BreadcrumbItem[]; label: string; className?: string }) {
  return (
    <nav className={cx(styles.nav, className)} aria-label={label}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.id} className={styles.item}>
              {index > 0 ? <span className={styles.sep} aria-hidden="true"><ChevronRight size={12} /></span> : null}
              {last || !item.onSelect ? (
                <span className={styles.current} aria-current={last ? 'page' : undefined}>{item.label}</span>
              ) : (
                <button type="button" className={styles.link} onClick={item.onSelect}>{item.label}</button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
