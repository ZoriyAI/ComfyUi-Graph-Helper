import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeClassSummary } from '../../../shared/contracts/knowledge';
import { useCanvasStore } from './canvasStore';
import { commitManual } from './commit';
import { placeNewNode } from './placeNode';
import { showToast } from '../../ui/toastStore';
import { i18n } from '../../i18n';
import { SearchX } from 'lucide-react';
import { categoryAccent } from './lib/typeColors';
import { categoryLabel } from './lib/categoryLabel';
import styles from './Toolbar.module.css';

/**
 * Commits add-node after the class guard: an unknown class (with a synced catalog) is refused with the
 * nearest installed names; the guard being unreachable does not block the edit.
 */
async function addCheckedNode(classType: string, at: { x: number; y: number } | null, title?: string): Promise<void> {
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
  // Under the name the library shows, as a node added from the library is: one node, one name, whichever way.
  await commitManual({ type: 'add-node', nodeType: classType, ...(title && title !== classType ? { title } : {}), x: spot.x, y: spot.y });
}

/** The name with the typed words marked, so a person sees why a row came up. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const marks: Array<[number, number]> = [];
  for (const word of words) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(word, from);
      if (at < 0) break;
      marks.push([at, at + word.length]);
      from = at + word.length;
    }
  }
  if (marks.length === 0) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of marks) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    if (from > cursor) parts.push(text.slice(cursor, from));
    parts.push(<mark key={from} className={styles.match}>{text.slice(from, end)}</mark>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
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
      // A lesson opens the search with the name of the node it asks for already typed.
      setQuery(search.query ?? '');
      setResults([]);
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 0);
    }
  }, [search.open, search.query]);

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
    void addCheckedNode(classType, at, item?.displayName || undefined);
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
        {results.length === 0 ? <li className={styles.empty}><SearchX size={16} aria-hidden="true" />{t('canvas.noResults')}</li> : results.map((item, index) => (
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
            <span className={styles.resultDot} style={{ background: categoryAccent(item.category, undefined) }} aria-hidden="true" />
            <span className={styles.resultText}>
              <span className={styles.resultName}><Highlighted text={item.displayName || item.classType} query={query} /></span>
              {item.displayName && item.displayName !== item.classType ? <span className={styles.resultClass}><Highlighted text={item.classType} query={query} /></span> : null}
            </span>
            <span className={styles.resultMeta}>{categoryLabel(item.category, (key) => String(t(key)))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
