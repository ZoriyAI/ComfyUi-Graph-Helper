/**
 * The node search on the canvas (Ctrl+K, the toolbar's Node button canvas.addNodeLabel, a double click on empty
 * canvas, the context menus, a link dropped on empty canvas). A person types a name or what the node does, picks
 * with arrows and Enter, and the node lands where they asked. The same box serves two editing commands
 * (commands/editingCommands.ts): placing a node on a link (only nodes that fit the link are listed) and putting
 * another node in a node's place. Each result carries one line on what it does, so a person can tell "Upscale Image"
 * from "Upscale Image (using Model)" before choosing; nodes added lately come first while nothing is typed.
 * CanvasToolbar renders the box; it opens from canvasStore.openAddSearch.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeClassSummary } from '../../../shared/contracts/knowledge';
import { useCanvasStore, type AddSearchPurpose } from './canvasStore';
import { captureEditOrigin, commitAtOrigin, originIsCurrent, requireEditOrigin, type EditOrigin } from './lib/editOrigin';
import { recentNodes, rememberRecentNode } from './lib/recentNodes';
import NodeMarks from './NodeMarks';
import { placeNewNode } from './placeNode';
import { useNodeInfoStore } from './nodeInfo';
import type { ConnectFrom } from './lib/connectAssist';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { portsCompatible } from '../../../shared/graph/linkTypes';
import { addedNodeId, revealNewNode } from './lib/reveal';
import { trackCommit } from '../../services/commands/pending';
import { replayIsOpen } from '../../commands/replayGate';
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
export function addCheckedNode(classType: string, at: { x: number; y: number } | null, title?: string, link?: ConnectFrom, origin = captureEditOrigin()): Promise<void> {
  // Counted as landing from the pick on (the class check and the size come first), so Ctrl+Z waits for it.
  return trackCommit(() => addNow(classType, at, title, link, origin));
}

/**
 * The port of a class that can take a link from (or give one to) `from`: its handle id by the catalog order
 * ("in-3", "out-0"), as the engine numbers a new node's ports. Null when none fits.
 */
export function linkHandleFor(detail: NodeClassDetail | null | undefined, from: ConnectFrom): string | null {
  if (!detail) return null;
  if (from.direction === 'output') {
    // The engine numbers a new node's inputs links first, then fields (shared/graph/ports.ts portsFromCatalog).
    const ordered = [...detail.inputs.filter((input) => !input.widget), ...detail.inputs.filter((input) => input.widget)];
    const index = ordered.findIndex((input) => portsCompatible(from.dataType, input.type));
    return index >= 0 ? `in-${index}` : null;
  }
  const index = detail.outputs.findIndex((output) => portsCompatible(output.type, from.dataType));
  return index >= 0 ? `out-${index}` : null;
}

async function addNow(classType: string, at: { x: number; y: number } | null, title: string | undefined, link: ConnectFrom | undefined, origin: EditOrigin): Promise<void> {
  if (!requireEditOrigin(origin) || replayIsOpen(true)) return;
  const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));
  const verdict = await window.electronAPI?.validateNodeClass?.(classType).catch(() => null);
  if (!requireEditOrigin(origin)) return;
  if (verdict && !verdict.ok) {
    showToast({
      id: 'add-node-unknown-class',
      tone: 'warn',
      title: String(t('nodeGuard.unknownClass', { classType })),
      description: verdict.suggestions.length > 0
        ? String(t('nodeGuard.didYouMean', { list: verdict.suggestions }))
        : String(t('nodeGuard.notInCatalog')),
      duration: 6000,
    });
    return;
  }
  const spot = await placeNewNode(at, { classType });
  // Under the name the library shows, as a node added from the library is: one node, one name, whichever way.
  const add = { type: 'add-node' as const, nodeType: classType, ...(title && title !== classType ? { title } : {}), x: spot.x, y: spot.y };
  if (!requireEditOrigin(origin)) return;
  const handle = link ? linkHandleFor(await useNodeInfoStore.getState().request(classType).catch(() => null), link) : null;
  if (link && handle) {
    // A link dropped on empty canvas: the new node and its link are one step.
    const connect = link.direction === 'output'
      ? { type: 'connect' as const, source: link.nodeId, sourceHandle: link.handle, target: '@0', targetHandle: handle }
      : { type: 'connect' as const, source: '@0', sourceHandle: handle, target: link.nodeId, targetHandle: link.handle };
    const result = await commitAtOrigin(origin, { type: 'batch', label: 'add-linked', edits: [add, connect] }) as { status?: string; result?: { nodeIds?: unknown } } | null;
    const ids = result?.status === 'applied' && Array.isArray(result.result?.nodeIds) ? result.result.nodeIds.map(String) : [];
    if (originIsCurrent(origin)) revealNewNode(ids[0] ?? null, undefined, origin);
    return;
  }
  const result = await commitAtOrigin(origin, add);
  // The new node is selected and in view, wherever the free spot was.
  if (originIsCurrent(origin)) revealNewNode(addedNodeId(result), undefined, origin);
}

/** Enter before results arrive: the search is part of the same originating gesture. */
export function addTypedNode(typed: string, at: { x: number; y: number } | null, link?: ConnectFrom): Promise<void> {
  const origin = captureEditOrigin();
  return trackCommit(async () => {
    const found = await window.electronAPI?.searchNodeTypes?.({ query: typed, limit: 1 }).catch(() => []) ?? [];
    if (!requireEditOrigin(origin)) return;
    const first = found[0];
    await addNow(first?.classType ?? typed, at, first?.displayName || undefined, link, origin);
  });
}

/** How many results a plain search shows; the list scrolls. */
const RESULT_LIMIT = 30;

/** Places the chosen node on the link the search was opened for (editing package). */
function insertOnLink(purpose: Extract<AddSearchPurpose, { kind: 'insert' }>, item: NodeClassSummary, at: { x: number; y: number } | null, origin = captureEditOrigin()): Promise<void> {
  return trackCommit(async () => {
    const spot = await placeNewNode(at, { classType: item.classType });
    if (!requireEditOrigin(origin)) return;
    const result = await commitAtOrigin(origin, {
      type: 'insert-node-on-edge', edgeId: purpose.edgeId, nodeType: item.classType,
      ...(item.displayName && item.displayName !== item.classType ? { title: item.displayName } : {}),
      x: Math.round(spot.x), y: Math.round(spot.y),
    }) as { status?: string; result?: { nodeId?: unknown } } | null;
    if (result?.status === 'applied') revealNewNode(typeof result.result?.nodeId === 'string' ? result.result.nodeId : null);
  });
}

/** Puts the chosen node in the place of the node the search was opened for, and says what did not fit. */
function replaceWith(purpose: Extract<AddSearchPurpose, { kind: 'replace' }>, item: NodeClassSummary, origin = captureEditOrigin()): Promise<void> {
  return trackCommit(async () => {
    const result = await commitAtOrigin(origin, { type: 'replace-node', nodeId: purpose.nodeId, nodeType: item.classType }) as { status?: string; result?: { droppedLinks?: number } } | null;
    if (result?.status !== 'applied') return;
    const dropped = result.result?.droppedLinks ?? 0;
    showToast({
      id: 'editing-replaced',
      tone: dropped > 0 ? 'warn' : 'success',
      title: String(i18n.t('editing.replaced', { name: item.displayName || item.classType })),
      description: dropped > 0 ? String(i18n.t('editing.droppedLinks', { count: dropped })) : null,
      duration: dropped > 0 ? 6000 : 3000,
    });
  });
}

/** Recent nodes first (while nothing is typed in a plain search), then the results, each class once. */
function withRecent(found: NodeClassSummary[], query: string): NodeClassSummary[] {
  if (query.trim() !== '') return found;
  const recent = recentNodes();
  const seen = new Set(recent.map((item) => item.classType));
  return [...recent, ...found.filter((item) => !seen.has(item.classType))];
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
 * How many classes a search from a dropped link reads before keeping the ones that fit. Fitting is checked per class
 * against its catalog detail, so the search reads wide and the list keeps the first LINK_RESULTS that fit.
 */
const LINK_SEARCH_LIMIT = 400;
/** How many fitting nodes a search from a dropped link lists. */
const LINK_RESULTS = 12;

/** The found classes that have a port for the dropped link, in search order. */
async function nodesThatFit(found: NodeClassSummary[], link: ConnectFrom): Promise<NodeClassSummary[]> {
  const info = useNodeInfoStore.getState();
  const fitting: NodeClassSummary[] = [];
  for (const item of found) {
    if (!item.detailed) continue;
    const detail = await info.request(item.classType).catch(() => null);
    if (linkHandleFor(detail, link)) fitting.push(item);
    if (fitting.length >= LINK_RESULTS) break;
  }
  return fitting;
}

/**
 * Add-node search: type, pick with arrows and Enter, and the node lands where the person asked
 * (right-click position) or in the middle of the view, in the nearest free spot. Commits `add-node` (or the editing
 * command of its purpose) through commitAtOrigin, so an edit started in one graph never lands in another.
 */
export default function AddNodeSearch() {
  const { t, i18n: instance } = useTranslation();
  const search = useCanvasStore((state) => state.addSearch);
  const purpose = search.purpose;
  const language = instance.language === 'ru' ? 'ru' : 'en';
  const close = useCanvasStore((state) => state.closeAddSearch);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NodeClassSummary[]>([]);
  /** The query the results on screen answer: Enter right after typing must not pick from the previous list. */
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.open) {
      // A lesson opens the search with the name of the node it asks for already typed.
      setQuery(search.query ?? '');
      setResults([]);
      setResultsFor(null);
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
      const link = search.linkFrom;
      // The search filters by link type itself (main/knowledge/nodeSearch.ts): from a dropped link, on a link to
      // fill (editing), else no filter.
      const types = link
        ? (link.direction === 'output' ? { inputType: link.dataType } : { outputType: link.dataType })
        : purpose?.kind === 'insert' ? { inputType: purpose.dataType, outputType: purpose.targetType } : {};
      void bridge.searchNodeTypes({ query: query.trim(), limit: link ? LINK_SEARCH_LIMIT : RESULT_LIMIT, language, ...types }).catch(() => [] as NodeClassSummary[]).then(async (found) => {
        // From a dropped link: only the nodes that can take it (or give it), as the catalog describes them.
        const fitting = link ? await nodesThatFit(found, link)
          : purpose?.kind === 'replace' ? found.filter((item) => !item.editor)
            : purpose ? found : withRecent(found, query);
        // A newer query or a closed box has dropped this answer: an old list must not replace a newer one.
        if (live) {
          setResults(fitting);
          setResultsFor(query.trim());
          setActive(0);
        }
      });
    }, 120); // A short debounce: one search per pause in typing, not one per key.
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, search.open, search.linkFrom, purpose, language]);

  if (!search.open) return null;

  const pick = (item: NodeClassSummary | undefined) => {
    const classType = item?.classType ?? query.trim();
    if (!classType) return;
    // The right-click spot, else the middle of the view; placeNewNode moves it off any node.
    const at = search.at;
    // Focus leaves the field at once, so a Ctrl+Z pressed right after reaches the app, not the closing field.
    input.current?.blur();
    close();
    const chosen: NodeClassSummary = item ?? { classType, displayName: classType, category: '', pack: '', detailed: false };
    if (purpose?.kind === 'insert') void insertOnLink(purpose, chosen, at);
    else if (purpose?.kind === 'replace') void replaceWith(purpose, chosen);
    else void addCheckedNode(classType, at, item?.displayName || undefined, search.linkFrom);
    if (item) rememberRecentNode(item);
  };

  /** Enter before the list caught up with the typing: the first match for what is typed now. */
  const pickTyped = () => {
    const typed = query.trim();
    if (!typed) return;
    const at = search.at;
    const link = search.linkFrom;
    input.current?.blur();
    close();
    if (!purpose) {
      void addTypedNode(typed, at, link);
      return;
    }
    const origin = captureEditOrigin();
    void trackCommit(async () => {
      const types = purpose.kind === 'insert' ? { inputType: purpose.dataType, outputType: purpose.targetType } : {};
      const found = await window.electronAPI?.searchNodeTypes?.({ query: typed, limit: 1, ...types }).catch(() => []) ?? [];
      const first = found[0];
      if (!first) return;
      if (purpose.kind === 'insert') await insertOnLink(purpose, first, at, origin);
      else await replaceWith(purpose, first, origin);
    });
  };

  const listId = 'canvas-add-node-results';
  const heading = purpose?.kind === 'insert'
    ? t('editing.insertTitle', { type: purpose.dataType })
    : purpose?.kind === 'replace'
      ? t('editing.replaceTitle', { name: purpose.name })
      : null;
  return (
    <div className={styles.search} role="dialog" aria-label={String(heading ?? t('canvas.addNode'))} data-purpose={purpose?.kind ?? 'add'}>
      {heading ? <div className={styles.searchTitle}>{heading}</div> : null}
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
          else if (event.key === 'Enter') {
            if (resultsFor === query.trim()) pick(results[active]);
            else pickTyped();
          }
          else if (event.key === 'Escape') close();
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onBlur={(event) => {
          // A click on a result keeps the box open (the row is inside it); focus going anywhere else closes it.
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
            // No focus move on press, so the input's blur does not close the box before the click picks the row.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(item)}
          >
            <span className={styles.resultDot} style={{ background: categoryAccent(item.category, undefined) }} aria-hidden="true" />
            <span className={styles.resultText}>
              <span className={styles.resultName}><Highlighted text={item.displayName || item.classType} query={query} /><NodeMarks marks={item.marks} output={item.outputNode} /></span>
              {item.displayName && item.displayName !== item.classType ? <span className={styles.resultClass}><Highlighted text={item.classType} query={query} /></span> : null}
              {item.description ? <span className={styles.resultDesc}>{item.description}</span> : null}
            </span>
            <span className={styles.resultMeta}>{categoryLabel(item.category, (key) => String(t(key)))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
