import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeClassSummary } from '../../../shared/contracts/knowledge';
import { useCanvasStore } from './canvasStore';
import { commitManual } from './commit';
import { placeNewNode } from './placeNode';
import { showToast } from '../../ui/toastStore';
import { i18n } from '../../i18n';
import styles from './Toolbar.module.css';

/**
 * Commits add-node after the class guard: an unknown class (with a synced catalog) is refused with the
 * nearest installed names; the guard being unreachable does not block the edit.
 */
async function addCheckedNode(classType: string, at: { x: number; y: number } | null): Promise<void> {
  const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));
  const verdict = await window.electronAPI?.validateNodeClass?.(classType).catch(() => null);
  if (verdict && !verdict.ok) {
    showToast({
      id: 'add-node-unknown-class',
      tone: 'warn',
      title: String(t('nodeGuard.unknownClass', { classType })),
      description: verdict.suggestions.length > 0
        ? String(t('nodeGuard.didYouMean', { list: verdict.suggestions.join(', ') }))
        : String(t('nodeGuard.notInCatalog')),
      duration: 6000,
    });
    return;
  }
  const spot = await placeNewNode(at, { classType });
  await commitManual({ type: 'add-node', nodeType: classType, x: spot.x, y: spot.y });
}

/**
 * Add-node search: type, pick with arrows and Enter, and the node lands where the person asked
 * (right-click position) or in the middle of the view, in the nearest free spot. Commits `add-node` through commitManual.
 */
export default function AddNodeSearch() {
  const { t } = useTranslation();
  const search = useCanvasStore((state) => state.addSearch);
  const close = useCanvasStore((state) => state.closeAddSearch);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NodeClassSummary[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.open) {
      setQuery('');
      setResults([]);
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 0);
    }
  }, [search.open]);

  useEffect(() => {
    if (!search.open) return undefined;
    let live = true;
    const bridge = window.electronAPI;
    const timer = window.setTimeout(() => {
      if (!bridge?.searchNodeTypes) return;
      void bridge.searchNodeTypes({ query: query.trim(), limit: 12 }).catch(() => []).then((found) => {
        if (live) {
          setResults(found);
          setActive(0);
        }
      });
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, search.open]);

  if (!search.open) return null;

  const pick = (item: NodeClassSummary | undefined) => {
    const classType = item?.classType ?? query.trim();
    if (!classType) return;
    // The right-click spot, else the middle of the view; placeNewNode moves it off any node.
    const at = search.at;
    close();
    void addCheckedNode(classType, at);
  };

  const listId = 'canvas-add-node-results';
  return (
    <div className={styles.search} role="dialog" aria-label={String(t('canvas.addNode'))}>
      <input
        ref={input}
        className={styles.searchInput}
        value={query}
        placeholder={String(t('canvas.addSearchPlaceholder'))}
        aria-label={String(t('canvas.addSearchLabel'))}
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') setActive((index) => Math.min(results.length - 1, index + 1));
          else if (event.key === 'ArrowUp') setActive((index) => Math.max(0, index - 1));
          else if (event.key === 'Enter') pick(results[active]);
          else if (event.key === 'Escape') close();
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) close();
        }}
      />
      <ul id={listId} className={styles.results} role="listbox" aria-label={String(t('canvas.addSearchLabel'))}>
        {results.length === 0 ? <li className={styles.empty}>{t('canvas.noResults')}</li> : results.map((item, index) => (
          <li
            key={item.classType}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className={styles.result}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(item)}
          >
            <span>{item.displayName || item.classType}</span>
            <span className={styles.resultMeta}>{item.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
