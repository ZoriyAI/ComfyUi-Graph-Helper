import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, MessageCircleQuestion, Pencil, X } from 'lucide-react';
import { NodeToolbar, Position, useNodes, useStore, type Node, type ReactFlowState } from '@xyflow/react';
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
import { firstLine, selectDescription, type DescriptionContent, type DescriptionPart } from '../lib/description';
import { nodeRef } from '../lib/selection';
import { useNodeDetail } from '../nodeInfo';
import styles from './DescriptionLayer.module.css';

/** Smallest card width in screen pixels; wider nodes give their own (zoomed) width, up to MAX_WIDTH. */
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
/** Below this zoom nodes are small: collapsed cards get compact (narrower, a provenance dot instead of the badge). */
const COMPACT_ZOOM = 0.75;
const COMPACT_MIN_WIDTH = 132;
const EMPTY: Explanation[] = [];

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

/** The node the tour or the step-by-step build is showing, and what it would say without a card. */
export interface DescriptionSpotlight {
  nodeId: string;
  text: string;
}

export function useDescriptionSpotlight(): DescriptionSpotlight | null {
  const step = useUiStore((state) => (state.tour ? state.tour.steps[state.tour.index] : undefined));
  const callout = useCanvasStore((state) => state.callout);
  if (step?.ref.kind === 'node') return { nodeId: step.ref.id, text: step.text };
  if (callout) return { nodeId: callout.nodeId, text: callout.text };
  return null;
}

/** True when the node's description card is on screen, so the tour and the build leave the text to it. */
export function useDescriptionCardShown(nodeId: string | undefined): boolean {
  return useCanvasStore((state) => Boolean(nodeId) && state.descriptionsOn && !state.hiddenDescriptions[nodeId ?? '']);
}

const zoomOf = (state: ReactFlowState) => state.transform[2];

type ComfyFlowNode = Node<ComfyNodeData>;

function nodeName(data: ComfyNodeData, displayName: string | undefined): string {
  return data.title?.trim() || displayName || data.comfyType;
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
function DescriptionCard({ node, spotlight, readOnly }: { node: ComfyFlowNode; spotlight: DescriptionSpotlight | null; readOnly: boolean }) {
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
  const own = useKnowledgeStore((state) => state.explanations[objectKey(ref)] ?? EMPTY);
  const shared = useKnowledgeStore((state) => (classRef ? state.explanations[objectKey(classRef)] ?? EMPTY : EMPTY));
  const detail = useNodeDetail(instance ? undefined : data.comfyType);
  const purpose = useGraphStore((state) => state.components.find((item) => item.ownerKind === 'node' && item.ownerId === node.id)?.purpose);
  const content = useMemo(
    () => selectDescription({ own, shared, catalog: detail?.description, purpose }),
    [own, shared, detail?.description, purpose],
  );
  const hidden = useCanvasStore((state) => Boolean(state.hiddenDescriptions[node.id]));
  const expandedByPerson = useCanvasStore((state) => Boolean(state.expandedDescriptions[node.id]));
  const setExpanded = useCanvasStore((state) => state.setDescriptionExpanded);
  const hide = useCanvasStore((state) => state.hideDescription);
  const show = useCanvasStore((state) => state.showDescription);
  const zoom = useStore(zoomOf);
  const [editing, setEditing] = useState(false);
  const spot = spotlight?.nodeId === node.id;
  const expanded = expandedByPerson || spot || editing;
  const name = nodeName(data, detail?.displayName);

  if (hidden) {
    return (
      <NodeToolbar nodeId={node.id} isVisible position={Position.Bottom} offset={-5} className="nopan nodrag">
        <button
          type="button"
          className={styles.dot}
          data-description-dot={node.id}
          aria-label={`${String(t('canvas.descriptionShow'))}: ${name}`}
          title={String(t('canvas.descriptionShow'))}
          onClick={() => show(node.id)}
        />
      </NodeToolbar>
    );
  }

  const fallback = spot && spotlight ? spotlight.text.trim() : '';
  if (!content && !fallback && !editing) return null;

  const compact = zoom < COMPACT_ZOOM && !expanded;
  const width = Math.round(Math.min(MAX_WIDTH, Math.max(compact ? COMPACT_MIN_WIDTH : MIN_WIDTH, (node.measured?.width ?? node.width ?? 240) * zoom)));
  const primary = content?.primary;
  const summary = primary ? firstLine(primary.text) : fallback || String(t('canvas.descriptionEmpty'));
  const toggle = () => setExpanded(node.id, !expandedByPerson);
  const canAsk = !readOnly && !content?.explained;
  return (
    <NodeToolbar nodeId={node.id} isVisible position={Position.Bottom} offset={8} className="nopan nodrag">
      <section
        className={`description-card ${styles.card}`}
        style={{ width }}
        data-description-node={node.id}
        data-description-scope={content?.scope ?? 'none'}
        data-expanded={expanded ? 'true' : 'false'}
        data-compact={compact ? 'true' : undefined}
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
}

/**
 * Description blocks on the canvas: one card under every node that has something to say, anchored with
 * React Flow's NodeToolbar so it follows drags, pans and zooms while its text stays a readable size.
 * The toolbar's "Descriptions" button turns all cards off; each card can be hidden on its own (a dot brings it
 * back). The tour step and the node the build just revealed get their card expanded. Cards live in the project
 * (explanations, catalog, component records) and never in the exported workflow.
 */
export default function DescriptionLayer() {
  const on = useCanvasStore((state) => state.descriptionsOn);
  const pending = useCanvasStore((state) => state.pending);
  const nodes = useNodes();
  const spotlight = useDescriptionSpotlight();
  const { readOnly } = useCanvasView();
  if (!on) return null;
  return (
    <>
      {nodes.map((node) => (node.type === 'comfy' && !pending.includes(node.id)
        ? <DescriptionCard key={node.id} node={node as ComfyFlowNode} spotlight={spotlight} readOnly={readOnly} />
        : null))}
    </>
  );
}
