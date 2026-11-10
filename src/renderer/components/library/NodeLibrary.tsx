import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NodeClassSummary } from '../../../shared/contracts';
import { requestAsk } from '../../services/ask';
import { useDockStore } from '../../state/dockState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { submitManual } from '../../services/commands/projection';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import SearchField from '../../ui/SearchField';
import Skeleton from '../../ui/Skeleton';
import { showToast } from '../../ui/toastStore';
import { runSyncNow } from '../sync/SyncIndicator';
import { flattenGroups, groupByCategory, NODE_DRAG_TYPE, type LibraryRow } from './libraryModel';
import { placeNewNode } from '../graph/placeNode';
import NodeCard from './NodeCard';
import VirtualList from './VirtualList';
import { categoryAccent } from '../graph/lib/typeColors';
import { cx } from '../../ui/cx';
import styles from './Library.module.css';

const ROW_HEIGHT = 40;
const SEARCH_LIMIT = 10000;

/** Adds a node class at the centre of the visible canvas (the nearest free spot there) through the manual command path. */
export async function addNodeFromLibrary(node: Pick<NodeClassSummary, 'classType' | 'displayName'>, messages: { added: string; failed: string }) {
  const position = await placeNewNode(null, { classType: node.classType });
  try {
    const result = await submitManual(`library-add-${crypto.randomUUID()}`, {
      type: 'add-node',
      nodeType: node.classType,
      title: node.displayName || undefined,
      x: position.x,
      y: position.y,
    });
    if (result.status === 'applied') showToast({ id: 'library-add', tone: 'success', title: messages.added, duration: 4000 });
    else showToast({ id: 'library-add', tone: 'error', title: messages.failed });
  } catch {
    showToast({ id: 'library-add', tone: 'error', title: messages.failed });
  }
}

/** Searchable, grouped, windowed list of every node class the sync knows. */
export default function NodeLibrary() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<NodeClassSummary[] | null>(null);
  /** The class whose card is open beside the rail. */
  const [open, setOpen] = useState<NodeClassSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const syncPart = useKnowledgeStore((state) => `${state.sync?.lastSyncAt ?? 0}:${state.sync?.counts.nodeClasses ?? 0}`);
  const catalogVersion = useUiStore((state) => state.catalogVersion);
  const syncStamp = `${syncPart}:${catalogVersion}`;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      window.electronAPI.searchNodeTypes({ query: query.trim(), limit: SEARCH_LIMIT })
        .then((found) => {
          if (cancelled) return;
          setNodes(found);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setNodes([]);
          setFailed(true);
        });
    }, query ? 120 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, syncStamp]);

  const ranked = query.trim() !== '';
  const rows = useMemo(() => {
    const groups = groupByCategory(nodes ?? [], { ranked, uncategorized: String(t('library.uncategorized')) });
    return flattenGroups(groups, ranked ? new Set() : collapsed);
  }, [nodes, ranked, collapsed, t]);

  const toggle = useCallback((category: string, open?: boolean) => {
    setCollapsed((current) => {
      const next = new Set(current);
      const isCollapsed = next.has(category);
      if (open === true || (open === undefined && isCollapsed)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const add = (node: NodeClassSummary) => {
    const name = node.displayName || node.classType;
    void addNodeFromLibrary(node, { added: String(t('library.added', { name })), failed: String(t('library.addFailed')) });
  };

  const count = nodes?.length ?? 0;

  // A card whose class left the catalog after a sync closes.
  useEffect(() => {
    if (open && nodes && !nodes.some((node) => node.classType === open.classType)) setOpen(null);
  }, [nodes, open]);

  // A click opens the card of a row, a double click adds the node. The card waits a moment for the second click,
  // so a double click does not flash it open and shut.
  const clickTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
  }, []);
  const rowClick = (node: NodeClassSummary) => {
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      setOpen((current) => (current?.classType === node.classType ? null : node));
    }, 230);
  };

  const ask = (node: NodeClassSummary, message: string) => {
    useDockStore.getState().show('chat');
    requestAsk({
      context: {
        intent: 'ask',
        objectRef: { kind: 'nodeClass', id: node.classType, classType: node.classType },
        selection: [],
        language: i18n.language === 'en' ? 'en' : 'ru',
      },
      message,
    });
  };

  return (
    <div className={styles.pane}>
      <div className={styles.controls}>
        <SearchField
          value={query}
          onValueChange={setQuery}
          label={String(t('library.searchNodes'))}
          placeholder={String(t('library.searchNodes'))}
          clearLabel={String(t('library.clear'))}
        />
      </div>
      {nodes === null ? (
        <div className={styles.controls} aria-busy="true">
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </div>
      ) : count === 0 && !ranked ? (
        <EmptyState
          icon={<Plug size={20} />}
          title={String(t('library.emptyNodesTitle'))}
          actions={<Button variant="subtle" size="sm" onClick={() => void runSyncNow()}>{t('sync.now')}</Button>}
        >
          {failed ? t('library.loadFailed') : t('library.emptyNodesBody')}
        </EmptyState>
      ) : (
        <>
          <div className={styles.meta}>
            <span role="status">{ranked ? t('library.results', { count }) : t('status.nodes', { count })}</span>
          </div>
          {count > 0 && !open ? <p className={styles.metaHint}>{t('library.nodeCardHint')}</p> : null}
          {count === 0 ? <p className={styles.meta}>{t('knowledge.noResults')}</p> : (
            <VirtualList<LibraryRow>
              id="node-library-list"
              className={styles.list}
              rows={rows}
              rowHeight={ROW_HEIGHT}
              label={String(t('library.nodeList'))}
              getKey={(row) => row.key}
              onActivate={(row) => {
                if (row.kind === 'header') toggle(row.category);
                else add(row.node);
              }}
              onRowKey={(row, event) => {
                if (row.kind !== 'header') {
                  // Escape closes the card; the space bar opens the one of the row the keyboard is on.
                  if (event.key === 'Escape' && open) {
                    setOpen(null);
                    return true;
                  }
                  if (event.key === ' ') {
                    setOpen(open?.classType === row.node.classType ? null : row.node);
                    return true;
                  }
                  return false;
                }
                if (event.key === 'ArrowLeft') toggle(row.category, false);
                else if (event.key === 'ArrowRight') toggle(row.category, true);
                else if (event.key === ' ') toggle(row.category);
                else return false;
                return true;
              }}
              renderRow={(row, { active }) => (row.kind === 'header' ? (
                <div
                  className={styles.header}
                  data-collapsed={row.collapsed ? 'true' : 'false'}
                  aria-expanded={!row.collapsed}
                  onClick={() => toggle(row.category)}
                >
                  <span className={styles.chevron} aria-hidden="true"><ChevronDown size={12} /></span>
                  <span className={styles.headerDot} style={{ '--row-hue': categoryAccent(row.category, undefined) } as React.CSSProperties} aria-hidden="true" />
                  <span className={styles.headerName}>{row.category}</span>
                  <span className={styles.count} aria-label={String(t('status.nodes', { count: row.count }))}>{row.count}</span>
                </div>
              ) : (
                <div
                  className={cx(styles.row, styles.nodeRow)}
                  data-active={active ? 'true' : 'false'}
                  data-open={open?.classType === row.node.classType ? 'true' : 'false'}
                  data-node-class={row.node.classType}
                  draggable
                  title={String(t('library.dragHint'))}
                  onClick={() => rowClick(row.node)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_TYPE, JSON.stringify({ classType: row.node.classType, title: row.node.displayName || undefined }));
                    event.dataTransfer.setData('text/plain', row.node.classType);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <span
                    className={cx(styles.detailDot, styles.categoryDot)}
                    data-on={row.node.detailed ? 'true' : 'false'}
                    style={{ '--row-hue': categoryAccent(row.node.category, undefined) } as React.CSSProperties}
                    title={String(t(row.node.detailed ? 'library.detailed' : 'library.notDetailed'))}
                    aria-label={String(t(row.node.detailed ? 'library.detailed' : 'library.notDetailed'))}
                    role="img"
                  />
                  <span className={styles.text}>
                    <span className={styles.name}>{row.node.displayName || row.node.classType}</span>
                    <span className={styles.sub}>{row.node.classType}</span>
                  </span>
                  <span className={styles.side}>
                    <Badge>{row.node.pack || t('library.core')}</Badge>
                  </span>
                </div>
              ))}
            />
          )}
        </>
      )}
      {open ? (
        <NodeCard
          key={open.classType}
          node={open}
          onClose={() => setOpen(null)}
          onAdd={add}
          onAsk={(message) => ask(open, message)}
        />
      ) : null}
    </div>
  );
}
