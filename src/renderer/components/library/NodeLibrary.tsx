/**
 * The Nodes tab of the library rail: every node class the sync knows, searchable, grouped by category, with the
 * node card beside the rail. shell/Rail.tsx mounts it; rows can be dragged onto the canvas or added with a double
 * click. tests/unit/asyncEditorOrigin.test.ts covers addNodeFromLibrary.
 */
import { closeCard, focusCardTitle } from '../../a11y/cardFocus';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plug, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NodeClassSummary } from '../../../shared/contracts';
import { requestAsk } from '../../services/ask';
import { useDockStore } from '../../state/dockState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { useUiStore } from '../../state/uiState';
import { captureEditOrigin, commitAtOrigin, originIsCurrent, type EditOrigin } from '../graph/lib/editOrigin';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import SearchField from '../../ui/SearchField';
import Skeleton from '../../ui/Skeleton';
import { showToast } from '../../ui/toastStore';
import { runSyncNow } from '../sync/SyncIndicator';
import { flattenGroups, groupByCategory, NODE_DRAG_TYPE, type LibraryRow } from './libraryModel';
import { placeNewNode } from '../graph/placeNode';
import { hasRefusalReason, reportRefusal } from '../graph/commit';
import NodeCard from './NodeCard';
import VirtualList from './VirtualList';
import { categoryAccent } from '../graph/lib/typeColors';
import { cx } from '../../ui/cx';
import { replayIsOpen } from '../../commands/replayGate';
import { trackCommit } from '../../services/commands/pending';
import styles from './Library.module.css';
import { addedNodeId, revealNewNode } from '../graph/lib/reveal';

/** Height of one row in pixels (VirtualList needs it fixed), and how many classes one search returns at most. */
const ROW_HEIGHT = 40;
const SEARCH_LIMIT = 10000;

/** Adds a node class at the centre of the visible canvas (the nearest free spot there) through the manual command path. */
export async function addNodeFromLibrary(node: Pick<NodeClassSummary, 'classType' | 'displayName'>, messages: { added: string; failed: string }) {
  // History replay shows an old version read-only; an undo pressed meanwhile waits for this add (trackCommit).
  if (replayIsOpen(true)) return;
  const origin = captureEditOrigin();
  return trackCommit(() => addNow(node, messages, origin));
}

/** The add itself, once trackCommit has taken it; it lands on the level the add began on, or nowhere. */
async function addNow(node: Pick<NodeClassSummary, 'classType' | 'displayName'>, messages: { added: string; failed: string }, origin: EditOrigin) {
  const position = await placeNewNode(null, { classType: node.classType });
  try {
    // Into the level on screen: the root graph, or the open subgraph.
    const result = await commitAtOrigin(origin, {
      type: 'add-node',
      nodeType: node.classType,
      title: node.displayName || undefined,
      x: position.x,
      y: position.y,
    }, 'library-add') as { status?: string; result?: unknown } | null;
    if (result?.status === 'applied') {
      showToast({ id: 'library-add', tone: 'success', title: messages.added, duration: 4000 });
      // Selected and in view, so the person sees what the toast says was added.
      if (originIsCurrent(origin)) revealNewNode(addedNodeId(result), undefined, origin);
    }
    else if (hasRefusalReason(result)) reportRefusal(result);
    else showToast({ id: 'library-add', tone: 'error', title: messages.failed });
  } catch {
    showToast({ id: 'library-add', tone: 'error', title: messages.failed });
  }
}

/** A pack name as a row shows it: without the usual "ComfyUI-" / "comfyui_" prefix; empty for ComfyUI's own nodes. */
export function packLabel(pack: string | undefined): string {
  const name = (pack ?? '').trim();
  if (name === '' || name.toLowerCase() === 'core') return '';
  return name.replace(/^comfyui[-_ ]?/i, '') || name;
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
  const sync = useKnowledgeStore((state) => state.sync);
  const openSettings = useUiStore((state) => state.openSettings);
  // Nothing was ever read from the person's ComfyUI: the few built-in nodes are not their nodes, so the library says
  // what to do instead of listing them under raw names.
  const neverRead = sync != null && sync.lastSyncAt == null;
  // One "read" state for any source: an address of ComfyUI or of an MCP server is enough to read.
  const hasAddress = sync != null && (sync.mcpUrl.trim() !== '' || (sync.comfyOrigin ?? '').trim() !== '');
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
      <div
        className={styles.controls}
        onKeyDown={(event) => {
          // From the search field, the down arrow goes into the list.
          if (event.key !== 'ArrowDown' || !(event.target instanceof HTMLInputElement)) return;
          const list = document.getElementById('node-library-list');
          if (!list) return;
          event.preventDefault();
          list.focus();
        }}
      >
        <SearchField
          value={query}
          onValueChange={setQuery}
          label={String(t('library.searchNodes'))}
          placeholder={String(t('library.searchNodes'))}
          clearLabel={String(t('library.clear'))}
        />
      </div>
      {neverRead ? (
        <EmptyState
          icon={<Plug size={20} />}
          title={String(t('library.notReadTitle'))}
          actions={hasAddress && sync
            ? <Button variant="subtle" size="sm" loading={sync.state === 'running'} onClick={() => void runSyncNow()}>{t('canvas.onboardRead')}</Button>
            : <Button variant="subtle" size="sm" onClick={() => openSettings('connection')}>{t('canvas.onboardOpenConnection')}</Button>}
        >
          {sync?.state === 'running' ? t('canvas.onboardReading') : hasAddress ? t('library.notReadBody') : t('library.notConnectedBody')}
        </EmptyState>
      ) : nodes === null ? (
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
          {count === 0 ? (
            <EmptyState
              size="compact"
              icon={<SearchX size={18} />}
              title={String(t('library.nodesNoMatchTitle'))}
              actions={<Button variant="subtle" size="sm" onClick={() => setQuery('')}>{t('library.clear')}</Button>}
            >
              {t('library.nodesNoMatchBody', { query: query.trim() })}
            </EmptyState>
          ) : (
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
                    const opening = open?.classType !== row.node.classType;
                    setOpen(opening ? row.node : null);
                    // Opened from the keyboard: the card takes focus, so its buttons are reachable (a11y/cardFocus.ts).
                    if (opening) focusCardTitle('.node-card #node-card-title');
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
                    {/* The pack, when the node comes from one, follows the class name on the second line, shortened;
                        a node of ComfyUI itself says nothing there (the card names where it comes from). */}
                    <span className={styles.sub}>
                      {row.node.classType}
                      {packLabel(row.node.pack) ? <span className={styles.subPack} title={row.node.pack}>{' · '}{packLabel(row.node.pack)}</span> : null}
                    </span>
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
          onClose={() => closeCard('.node-card', '#node-library-list', () => setOpen(null))}
          onAdd={add}
          onAsk={(message) => ask(open, message)}
        />
      ) : null}
    </div>
  );
}
