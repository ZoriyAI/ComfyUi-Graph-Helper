import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, MessageCircleQuestion, Pencil, X } from 'lucide-react';
import { NodeToolbar, Position, useNodes, useStore, useStoreApi, type Node, type ReactFlowState } from '@xyflow/react';
import { objectKey, type ObjectRef } from '../../../../shared/contracts/objects';
import type { Explanation } from '../../../../shared/contracts/knowledge';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import { useGraphStore } from '../../../state/graphState';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { useRevisionStore } from '../../../state/revisionState';
import { useUiStore } from '../../../state/uiState';
import { ProvenanceBadge } from '../../../ui';
import { provenanceLabelKey } from '../../../../shared/knowledge/labels';
import type { ComfyNodeData } from '../../../types/graph';
import { askAbout } from '../askAbout';
import { useCanvasView } from '../CanvasContext';
import { useCanvasStore } from '../canvasStore';
import {
  HANDLE_REACH,
  descriptionVisibility,
  firstLine,
  neighbourBoxes,
  placeCard,
  selectDescription,
  type Box,
  type CardPlacement,
  type CardSide,
  type DescriptionContent,
  type DescriptionDemand,
  type DescriptionPart,
  type DescriptionsMode,
} from '../lib/description';
import { nodeRef } from '../lib/selection';
import { nodeDisplayName } from '../lib/nodeName';
import { useNodeDetail } from '../nodeInfo';
import styles from './DescriptionLayer.module.css';

/** Smallest card width in screen pixels; wider nodes give their own (zoomed) width, up to MAX_WIDTH. */
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
/** Below this zoom nodes are small: collapsed cards get compact (narrower, a provenance dot instead of the badge). */
const COMPACT_ZOOM = 0.75;
const COMPACT_MIN_WIDTH = 132;
/** The one-line card a crowded node falls back to: about its own width, one line high. */
const SQUEEZED_MIN_WIDTH = 96;
const LINE_HEIGHT = 30;
/** First guesses of a card's height before it is measured. */
const COLLAPSED_HEIGHT = 34;
const EXPANDED_HEIGHT = 140;
/** Hover: the card opens after the pointer rests this long, and closes this long after it leaves. */
export const HOVER_OPEN_MS = 400;
export const HOVER_CLOSE_MS = 300;
/** Cards of nodes the person is looking at (selected, hovered, focused, the tour step) draw above other cards. */
const RAISED_Z = 2000;
const EMPTY: Explanation[] = [];
const NO_BOXES: Box[] = [];
const POSITIONS: Record<CardSide, Position> = { bottom: Position.Bottom, top: Position.Top, right: Position.Right, left: Position.Left };
const OFFSETS: Record<CardSide, number> = { bottom: 8, top: 8, right: 14, left: 14 };

/** Owners already asked for; the knowledge store keeps the lists current after that (explain results, saves). */
const requested = new Set<string>();

function ensureLoaded(ref: ObjectRef | null): void {
  if (!ref) return;
  const key = objectKey(ref);
  if (requested.has(key)) return;
  requested.add(key);
  if (typeof window === 'undefined' || !window.electronAPI?.listExplanations) return;
  void useKnowledgeStore.getState().loadExplanations(ref).catch(() => {
    requested.delete(key);
  });
}

/** The node the tour is showing, and what it would say without a card. */
export interface DescriptionSpotlight {
  nodeId: string;
  text: string;
}

export function useDescriptionSpotlight(): DescriptionSpotlight | null {
  const step = useUiStore((state) => (state.tour ? state.tour.steps[state.tour.index] : undefined));
  if (step?.ref.kind === 'node') return { nodeId: step.ref.id, text: step.text };
  return null;
}

/**
 * True when the node's description card is on screen, so the tour and the build leave the text to it. The tour
 * step's card shows in every mode but off (own mode opens it on demand), so only off and a closed card count.
 */
export function useDescriptionCardShown(nodeId: string | undefined): boolean {
  return useCanvasStore((state) => Boolean(nodeId) && state.descriptionsMode !== 'off' && !state.hiddenDescriptions[nodeId ?? '']);
}

const zoomOf = (state: ReactFlowState) => state.transform[2];

type ComfyFlowNode = Node<ComfyNodeData>;

function nodeName(data: ComfyNodeData, displayName: string | undefined): string {
  return nodeDisplayName(data, displayName).trim() || data.comfyType;
}

function EditForm({ nodeId, owner, content, onDone }: { nodeId: string; owner: ObjectRef; content: DescriptionContent | null; onDone: () => void }) {
  const { t } = useTranslation();
  const saveExplanation = useKnowledgeStore((state) => state.saveExplanation);
  const textFor = (aspect: 'what' | 'why'): string => {
    if (!content) return '';
    if (content.primary.aspect === aspect) return content.primary.text;
    return content.why?.aspect === aspect ? content.why.text : '';
  };
  const [aspect, setAspect] = useState<'what' | 'why'>('what');
  const [text, setText] = useState(() => textFor('what'));
  const [saving, setSaving] = useState(false);
  const fieldId = `description-text-${nodeId}`;
  const pick = (next: 'what' | 'why') => {
    if (next === aspect) return;
    // Switching the aspect starts from what the card says for it, unless the person already typed something new.
    if (text.trim() === '' || text === textFor(aspect)) setText(textFor(next));
    setAspect(next);
  };
  const save = () => {
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    void saveExplanation({
      projectId: DESKTOP_PROJECT_ID,
      owner,
      aspect,
      text: body,
      provenance: 'user',
      sourceUrl: null,
      revisionId: useRevisionStore.getState().currentRevisionId || null,
      createdBy: 'user',
    })
      .then(() => onDone())
      .catch(() => setSaving(false));
  };
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className={styles.aspects} role="group" aria-label={String(t('canvas.descriptionAspect'))}>
        {(['what', 'why'] as const).map((item) => (
          <button key={item} type="button" className={styles.aspect} aria-pressed={aspect === item} onClick={() => pick(item)}>
            {t(item === 'what' ? 'canvas.descriptionWhat' : 'canvas.descriptionWhy')}
          </button>
        ))}
      </div>
      <textarea
        id={fieldId}
        className={`${styles.field} nowheel`}
        aria-label={String(t('canvas.descriptionText'))}
        value={text}
        rows={4}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDone();
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
          }
        }}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onDone}>{t('canvas.descriptionCancel')}</button>
        <button type="submit" className={`${styles.action} ${styles.primary}`} disabled={saving || text.trim() === ''}>{t('canvas.descriptionSave')}</button>
      </div>
    </form>
  );
}

function Part({ part, label, showBadge }: { part: DescriptionPart; label?: string; showBadge: boolean }) {
  return (
    <div className={styles.part}>
      {label || showBadge ? (
        <div className={styles.partHead}>
          {label ? <span className={styles.partLabel}>{label}</span> : null}
          {showBadge ? <span data-provenance={part.provenance}><ProvenanceBadge provenance={part.provenance} /></span> : null}
        </div>
      ) : null}
      <p className={styles.text}>{part.text}</p>
    </div>
  );
}

/**
 * One description card under one node: the explanation of the node (else its class, else the catalog, else the
 * component purpose) with the badge of its source. Collapsed it shows the first line; expanded, the full
 * what / why text, an edit form that saves a "user" explanation, and "Ask" when nothing is explained yet.
 */
interface CardProps {
  node: ComfyFlowNode;
  spotlight: DescriptionSpotlight | null;
  readOnly: boolean;
  purpose: string | undefined;
  mode: DescriptionsMode;
  /** Selected, and the only selected node: selection expands its card. */
  selected: boolean;
  /** Selected among several: the card shows, collapsed. */
  inSelection: boolean;
  hovered: boolean;
  focused: boolean;
  revealed: boolean;
  /** The node's box and the boxes of nodes near it, in flow coordinates, for overlap avoidance. */
  box: Box | null;
  neighbours: Box[];
  /** The visible canvas in flow coordinates; given to cards someone asked for, so they open where they can be read. */
  bounds: Box | null;
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  return Boolean(a && b) && a!.x === b!.x && a!.y === b!.y && a!.width === b!.width && a!.height === b!.height;
}

function sameBoxes(a: Box[], b: Box[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (!sameBox(a[index], b[index])) return false;
  return true;
}

/** Re-render a card only when what it shows changes; a drag of a far-away node leaves it alone. */
function sameCard(previous: CardProps, next: CardProps): boolean {
  return previous.spotlight === next.spotlight && previous.readOnly === next.readOnly && previous.purpose === next.purpose
    && previous.mode === next.mode && previous.selected === next.selected && previous.inSelection === next.inSelection
    && previous.hovered === next.hovered && previous.focused === next.focused && previous.revealed === next.revealed
    && previous.node.data === next.node.data && previous.node.id === next.node.id
    && (previous.node.measured?.width ?? previous.node.width) === (next.node.measured?.width ?? next.node.width)
    && sameBox(previous.box, next.box) && sameBoxes(previous.neighbours, next.neighbours) && sameBox(previous.bounds, next.bounds);
}

/**
 * The card's rendered height in screen pixels, by form (expanded or not) and width, kept current while it grows
 * (an edit) or shrinks. Keeping the forms apart lets a card try the expanded form without flip-flopping.
 */
function useMeasuredHeights(): [React.RefCallback<HTMLElement>, Record<string, number>] {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const observer = useRef<ResizeObserver | null>(null);
  const ref = React.useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    const read = () => {
      const key = `${element.dataset.expanded ?? 'false'}:${Math.round(element.offsetWidth)}`;
      const height = Math.round(element.offsetHeight);
      setHeights((current) => (current[key] === height ? current : { ...current, [key]: height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(read);
    observer.current.observe(element);
  }, []);
  useLayoutEffect(() => () => observer.current?.disconnect(), []);
  return [ref, heights];
}

const DescriptionCard = React.memo(function DescriptionCard(props: CardProps) {
  const { node, spotlight, readOnly, purpose, mode, selected, inSelection, hovered, focused, revealed, box, neighbours, bounds } = props;
  const { t } = useTranslation();
  const data = node.data;
  const instance = data.kind === 'subgraph-instance';
  const nodeId = node.id;
  const classType = data.comfyType;
  const ref = useMemo(() => nodeRef({ id: nodeId, data: { comfyType: classType } }), [nodeId, classType]);
  const classRef = useMemo<ObjectRef | null>(
    () => (instance ? null : { kind: 'nodeClass', id: data.comfyType, classType: data.comfyType }),
    [instance, data.comfyType],
  );
  useEffect(() => {
    ensureLoaded(ref);
    ensureLoaded(classRef);
  }, [ref, classRef]);
  // Inside a subgraph the nodes are numbered from 1 again, and explanations are kept by number: what was written
  // for node 1 of the graph is not about node 1 of the subgraph, so there only what is known of the class shows.
  const inDefinition = useGraphStore((state) => state.activeSubgraphId !== null);
  const stored = useKnowledgeStore((state) => state.explanations[objectKey(ref)] ?? EMPTY);
  const own = inDefinition ? EMPTY : stored;
  const shared = useKnowledgeStore((state) => (classRef ? state.explanations[objectKey(classRef)] ?? EMPTY : EMPTY));
  const detail = useNodeDetail(instance ? undefined : data.comfyType);
  const content = useMemo(
    () => selectDescription({ own, shared, catalog: detail?.description, purpose }, { preferOwn: mode === 'own' }),
    [own, shared, detail?.description, purpose, mode],
  );
  const hidden = useCanvasStore((state) => Boolean(state.hiddenDescriptions[node.id]));
  const expandedByPerson = useCanvasStore((state) => Boolean(state.expandedDescriptions[node.id]));
  const collapsedByPerson = useCanvasStore((state) => Boolean(state.collapsedDescriptions[node.id]));
  const setExpanded = useCanvasStore((state) => state.setDescriptionExpanded);
  const hide = useCanvasStore((state) => state.hideDescription);
  const show = useCanvasStore((state) => state.showDescription);
  const zoom = useStore(zoomOf);
  const [editing, setEditing] = useState(false);
  const [measureRef, heights] = useMeasuredHeights();
  const spot = spotlight?.nodeId === node.id;
  const fallback = spot && spotlight ? spotlight.text.trim() : '';
  const demand: DescriptionDemand = {
    selected: selected || inSelection, hovered, focused, tour: spot, revealed, pinned: expandedByPerson, editing,
  };
  const visibility = descriptionVisibility({ mode, content, demand, fallback: Boolean(fallback) });
  // Expanded on purpose: the tour step, an edit, the person's click. The only selected node expands too (unless the
  // person collapsed it), but only where the expanded card has room; otherwise it stays one line (the Inspector has it all).
  const expandedOnPurpose = spot || editing || expandedByPerson;
  const wantsExpanded = expandedOnPurpose || (selected && !collapsedByPerson);
  const name = nodeName(data, detail?.displayName);
  const asked = spot || editing || selected || inSelection || hovered || focused || expandedByPerson;
  const raised = spot || editing || selected || hovered || focused;

  const nodeWidth = node.measured?.width ?? node.width ?? 240;
  // Inside the node's own width minus the handle reach on both sides, so it clears ports of nodes that touch this one.
  const squeezedWidth = Math.floor(Math.max(SQUEEZED_MIN_WIDTH, Math.min(MAX_WIDTH, (nodeWidth - HANDLE_REACH * 2) * zoom - 2)));
  const plan = useMemo(() => {
    const widthFor = (open: boolean) => Math.round(Math.min(MAX_WIDTH, Math.max(zoom < COMPACT_ZOOM && !open ? COMPACT_MIN_WIDTH : MIN_WIDTH, nodeWidth * zoom)));
    const place = (open: boolean): CardPlacement | null => {
      if (visibility !== 'card' || !box) return { side: 'bottom', compact: false };
      const width = widthFor(open);
      const height = heights[`${open}:${width}`] ?? (open ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
      return placeCard({
        node: box,
        others: neighbours,
        zoom,
        size: { width, height },
        compactSize: open ? null : { width: Math.min(squeezedWidth, width), height: LINE_HEIGHT },
        required: asked,
        sides: spot ? ['bottom', 'right', 'left'] : undefined,
        bounds,
      });
    };
    if (wantsExpanded) {
      const open = place(true);
      if (expandedOnPurpose || (open && !open.covers)) return { expanded: true, width: widthFor(true), placement: open };
    }
    return { expanded: false, width: widthFor(false), placement: place(false) };
  }, [visibility, box, neighbours, zoom, nodeWidth, heights, squeezedWidth, asked, spot, bounds, wantsExpanded, expandedOnPurpose]);
  const { expanded, width, placement } = plan;
  const zoomCompact = zoom < COMPACT_ZOOM && !expanded;

  if (hidden || (visibility === 'dot') || (visibility === 'card' && !placement)) {
    // A closed card, class knowledge waiting for a look, or a card with no free room: a dot on the node's edge.
    const closed = hidden;
    return (
      <NodeToolbar nodeId={node.id} isVisible position={Position.Bottom} offset={-5} className="nopan nodrag">
        <button
          type="button"
          className={styles.dot}
          data-description-dot={closed ? node.id : undefined}
          data-knowledge-dot={closed ? undefined : node.id}
          aria-label={`${String(t(closed ? 'canvas.descriptionShow' : 'canvas.descriptionRead'))}: ${name}`}
          title={String(t(closed ? 'canvas.descriptionShow' : 'canvas.descriptionRead'))}
          onClick={() => (closed ? show(node.id) : setExpanded(node.id, true))}
        />
      </NodeToolbar>
    );
  }
  if (visibility === 'none' || !placement) return null;

  const squeezed = placement.compact;
  const compact = zoomCompact || squeezed;
  const primary = content?.primary;
  const summary = primary ? firstLine(primary.text) : fallback || String(t('canvas.descriptionEmpty'));
  const toggle = () => setExpanded(node.id, !expanded);
  const canAsk = !readOnly && !content?.explained;
  const reason = spot ? 'tour' : editing ? 'edit' : selected || inSelection ? 'selected' : expandedByPerson ? 'pinned'
    : hovered ? 'hover' : focused ? 'focus' : revealed ? 'build' : undefined;
  return (
    <NodeToolbar
      nodeId={node.id}
      isVisible
      position={POSITIONS[placement.side]}
      align={placement.side === 'left' || placement.side === 'right' ? 'start' : 'center'}
      offset={OFFSETS[placement.side]}
      className="nopan nodrag"
      style={raised ? { zIndex: RAISED_Z } : undefined}
    >
      <section
        ref={measureRef}
        className={`description-card ${styles.card}`}
        style={{ width: squeezed ? Math.min(squeezedWidth, width) : width }}
        data-description-node={node.id}
        data-description-scope={content?.scope ?? 'none'}
        data-expanded={expanded ? 'true' : 'false'}
        data-compact={compact ? 'true' : undefined}
        data-squeezed={squeezed ? 'true' : undefined}
        data-side={placement.side}
        data-raised={raised ? 'true' : undefined}
        data-on-demand={mode === 'all' ? undefined : reason}
        data-spotlight={spot ? 'true' : undefined}
        aria-label={String(t('canvas.descriptionLabel', { name }))}
        aria-live={spot ? 'polite' : undefined}
      >
        <div className={styles.head}>
          <button
            type="button"
            className={styles.summary}
            aria-expanded={expanded}
            title={String(expanded ? t('canvas.descriptionCollapse') : t('canvas.descriptionExpand'))}
            onClick={toggle}
          >
            {primary && compact ? (
              <span className={styles.provDot} data-provenance={primary.provenance} title={String(t(provenanceLabelKey(primary.provenance)))}>
                <span className="sr-only">{t(provenanceLabelKey(primary.provenance))}</span>
              </span>
            ) : null}
            {primary && !compact ? <span className={styles.badge} data-provenance={primary.provenance}><ProvenanceBadge provenance={primary.provenance} /></span> : null}
            <span className={styles.line}>{expanded ? null : summary}</span>
            {expanded ? <ChevronUp size={14} aria-hidden="true" className={styles.chevron} /> : <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />}
          </button>
          <button type="button" className={styles.icon} aria-label={`${String(t('canvas.descriptionHide'))}: ${name}`} title={String(t('canvas.descriptionHide'))} onClick={() => hide(node.id)}>
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        {expanded ? (
          <div className={styles.body}>
            {editing ? (
              <EditForm nodeId={node.id} owner={ref} content={content} onDone={() => setEditing(false)} />
            ) : (
              <>
                {primary ? (
                  <Part part={primary} label={content?.why || primary.aspect === 'why' ? String(t(primary.aspect === 'why' ? 'canvas.descriptionWhy' : 'canvas.descriptionWhat')) : undefined} showBadge={false} />
                ) : <p className={styles.text}>{fallback || t('canvas.descriptionEmpty')}</p>}
                {content?.why ? <Part part={content.why} label={String(t('canvas.descriptionWhy'))} showBadge={content.why.provenance !== primary?.provenance} /> : null}
                {readOnly ? null : (
                  <div className={styles.actions}>
                    {canAsk ? (
                      <button type="button" className={styles.action} onClick={() => askAbout(ref, String(t(instance ? 'contextMenu.askSubgraph' : 'contextMenu.askWhat', { name })))}>
                        <MessageCircleQuestion size={13} aria-hidden="true" />
                        {t('canvas.descriptionAsk')}
                      </button>
                    ) : null}
                    <button type="button" className={`${styles.action} ${styles.square}`} aria-label={String(t('canvas.descriptionEdit'))} title={String(t('canvas.descriptionEdit'))} onClick={() => setEditing(true)}>
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </section>
    </NodeToolbar>
  );
}, sameCard);

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [role="dialog"], [role="menu"], [role="listbox"]'));
}

function focusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** The node a DOM element belongs to: the node itself, its card, or its dot. */
function nodeIdOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest<HTMLElement>('[data-description-node], [data-knowledge-dot], [data-description-dot]');
  if (card) return card.dataset.descriptionNode ?? card.dataset.knowledgeDot ?? card.dataset.descriptionDot ?? null;
  const node = target.closest<HTMLElement>('.react-flow__node');
  return node?.dataset.id ?? null;
}

/**
 * Hover and keyboard focus for on-demand cards: the pointer resting HOVER_OPEN_MS on a node (or its card) opens
 * its card, leaving for HOVER_CLOSE_MS closes it; keyboard focus on a node opens it at once. Escape collapses
 * every card (expanded, hovered, revealed by the build) without taking the selection away.
 */
function useCardDemand(selectedIds: string[]): void {
  const store = useCanvasStore;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let openTimer: number | undefined;
    let closeTimer: number | undefined;
    let target: string | null = null;
    const clearTimers = () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
    const onOver = (event: PointerEvent) => {
      const id = nodeIdOf(event.target);
      if (id === target) return;
      target = id;
      clearTimers();
      const current = store.getState().hoveredDescription;
      if (id && id === current) return;
      if (current) closeTimer = window.setTimeout(() => store.getState().setHoveredDescription(null), HOVER_CLOSE_MS);
      if (id) openTimer = window.setTimeout(() => store.getState().setHoveredDescription(id), HOVER_OPEN_MS);
    };
    const onLeaveWindow = () => {
      target = null;
      clearTimers();
      if (store.getState().hoveredDescription) closeTimer = window.setTimeout(() => store.getState().setHoveredDescription(null), HOVER_CLOSE_MS);
    };
    const onFocusIn = (event: FocusEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      // Only a node with keyboard focus counts (a click focuses it too, but the selection covers that);
      // a button inside a card keeps what it had.
      if (element?.classList.contains('react-flow__node') && element.dataset.id && focusVisible(element)) {
        store.getState().setFocusedDescription(element.dataset.id);
      } else if (!element?.closest('[data-description-node]')) {
        store.getState().setFocusedDescription(null);
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      // Focus went nowhere (a click on the pane): the node is no longer focused.
      if (event.relatedTarget === null) store.getState().setFocusedDescription(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || typingTarget(event.target)) return;
      clearTimers();
      target = null;
      store.getState().setFocusedDescription(null);
      store.getState().collapseDescriptions(selectedRef.current);
    };
    document.addEventListener('pointerover', onOver);
    // A move also counts, so the pointer picks its node up again after a leave it did not make (a window on top).
    document.addEventListener('pointermove', onOver, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimers();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointermove', onOver);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKey);
    };
  }, [store]);
}

/** Room kept free at the canvas edges, and under the floating toolbar at the top, in screen pixels. */
const EDGE_PX = 8;
const TOOLBAR_PX = 64;
type View = [number, number, number, number, number];
/** Pan, zoom and canvas size, rounded so sub-pixel pans do not re-place cards. */
const viewOf = (state: ReactFlowState): View => [Math.round(state.transform[0]), Math.round(state.transform[1]), state.transform[2], state.width, state.height];
const sameView = (a: View, b: View) => a.every((value, index) => value === b[index]);

/** Widest a card can reach from its node, in screen pixels: neighbours farther than this cannot be covered. */
const REACH_PX = MAX_WIDTH + 40;

/**
 * Description blocks on the canvas, anchored with React Flow's NodeToolbar so they follow drags, pans and zooms
 * while their text stays a readable size. Three modes (toolbar button, View menu, Settings ▸ Canvas):
 * - own (default): a card where the node has its own text (node explanation, component purpose); class
 *   knowledge (built-in seeds, class explanations, the catalog) waits behind a dot until the node is hovered,
 *   selected, focused, the tour step, or just revealed by the live build;
 * - all: a card under every node that has something to say;
 * - off: dots only.
 * A card that would cover another node or its ports moves to the right, the left or above, or shrinks to one
 * line, or (when nobody asked for it) stays a dot. Each card can be closed on its own (a dot brings it back).
 * Cards live in the project (explanations, catalog, component records) and never in the exported workflow.
 */
export default function DescriptionLayer() {
  const mode = useCanvasStore((state) => state.descriptionsMode);
  const pending = useCanvasStore((state) => state.pending);
  // While the live build's bubble speaks for a node that just appeared, its card waits; then the bubble collapses into it.
  const speaking = useCanvasStore((state) => (state.callout && (state.callout.kind ?? 'node') === 'node' ? state.callout.nodeId : null));
  const hoveredId = useCanvasStore((state) => state.hoveredDescription);
  const focusedId = useCanvasStore((state) => state.focusedDescription);
  const revealedId = useCanvasStore((state) => state.revealedDescription);
  const collapsed = useCanvasStore((state) => state.collapsedDescriptions);
  const keepCollapsed = useCanvasStore((state) => state.keepCollapsed);
  const nodes = useNodes();
  const flowStore = useStoreApi();
  const zoom = useStore(zoomOf);
  const spotlight = useDescriptionSpotlight();
  const { readOnly } = useCanvasView();
  const components = useGraphStore((state) => state.components);
  // One lookup table for every card instead of a scan of all records per card.
  const purposes = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of components) if (item.ownerKind === 'node' && !map.has(item.ownerId)) map.set(item.ownerId, item.purpose);
    return map;
  }, [components]);
  const selectedIds = useMemo(() => nodes.filter((node) => node.selected).map((node) => node.id), [nodes]);
  const selectedKey = selectedIds.join(' ');
  useCardDemand(selectedIds);
  useEffect(() => {
    keepCollapsed(selectedKey ? selectedKey.split(' ') : []);
  }, [selectedKey, collapsed, keepCollapsed]);

  // Node boxes in flow coordinates (absolute positions, measured sizes), and for each node the ones near it.
  const boxes = useMemo(() => {
    const lookup = flowStore.getState().nodeLookup;
    const map = new Map<string, Box>();
    for (const node of nodes) {
      const internal = lookup.get(node.id);
      const at = internal?.internals.positionAbsolute ?? node.position;
      const width = node.measured?.width ?? node.width;
      const height = node.measured?.height ?? node.height;
      if (!width || !height || node.hidden || pending.includes(node.id)) continue;
      map.set(node.id, { x: at.x, y: at.y, width, height });
    }
    return map;
  }, [nodes, flowStore, pending]);
  const neighbours = useMemo(() => {
    const all = [...boxes.values()];
    const reach = REACH_PX / (zoom > 0 ? zoom : 1);
    const map = new Map<string, Box[]>();
    for (const [id, box] of boxes) map.set(id, neighbourBoxes(box, all, reach));
    return map;
  }, [boxes, zoom]);

  const single = selectedIds.length === 1 ? selectedIds[0] : null;
  const view = useStore(viewOf, sameView);
  const bounds = useMemo<Box | null>(() => {
    const [tx, ty, scale] = view;
    if (!(view[3] > 0 && view[4] > 0 && scale > 0)) return null;
    const left = EDGE_PX;
    const top = TOOLBAR_PX;
    return { x: (left - tx) / scale, y: (top - ty) / scale, width: (view[3] - left - EDGE_PX) / scale, height: (view[4] - top - EDGE_PX) / scale };
  }, [view]);
  return (
    <>
      {nodes.map((node) => (node.type === 'comfy' && !pending.includes(node.id) && node.id !== speaking
        ? (
          <DescriptionCard
            key={node.id}
            node={node as ComfyFlowNode}
            spotlight={spotlight}
            readOnly={readOnly}
            purpose={purposes.get(node.id)}
            mode={mode}
            selected={node.id === single}
            inSelection={Boolean(node.selected) && node.id !== single}
            hovered={node.id === hoveredId}
            focused={node.id === focusedId}
            revealed={node.id === revealedId}
            box={boxes.get(node.id) ?? null}
            neighbours={neighbours.get(node.id) ?? NO_BOXES}
            bounds={node.selected || node.id === hoveredId || node.id === focusedId || node.id === spotlight?.nodeId ? bounds : null}
          />
        )
        : null))}
    </>
  );
}
