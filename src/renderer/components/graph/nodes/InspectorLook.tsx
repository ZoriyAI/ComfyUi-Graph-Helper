import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair } from 'lucide-react';
import { constantName, editorKind, partnersOf, promotedFields } from '../../../../shared/workflow/comfyLook';
import type { ComfyNodeData, GraphNode } from '../../../types/graph';
import { goToNode } from '../importLook';
import { PromotedFields, SavedValues } from './EditorNodes';
import { useClassPresence } from './nodeLook';
import styles from './Node.module.css';

/**
 * What Properties says of a node the file describes in a way of its own (IMPORT+NODES): a class that is not
 * installed, a node only the ComfyUI editor knows, a Set / Get pair. Null when there is nothing to say, so the
 * usual sentence stays.
 */
export function useLookSentence(data: ComfyNodeData, instance: boolean): string | null {
  const { t } = useTranslation();
  const presence = useClassPresence(data.comfyType, instance);
  if (instance) return null;
  if (presence === 'missing') return String(t('importLook.notInstalled', { type: data.comfyType }));
  const kind = editorKind(data.comfyType);
  if (kind) return String(t(`importLook.editorOnly.${kind}`, { name: constantName(data) || '—' }));
  return null;
}

/** A Get's "Go to its Set", a Set's "Go to its Get" (the first one), when the partner is on this level. */
export function SetGetJump({ node, nodes }: { node: GraphNode; nodes: GraphNode[] }) {
  const { t } = useTranslation();
  const kind = editorKind(node.data.comfyType);
  if (kind !== 'set' && kind !== 'get') return null;
  const partners = partnersOf(node.id, nodes);
  if (partners.length === 0) return <p className={styles.editorHint}>{t(kind === 'get' ? 'importLook.noSet' : 'importLook.noGet')}</p>;
  return (
    <button type="button" className={`ghost-button ${styles.jump}`} onClick={() => goToNode(partners[0])} data-go-to={partners[0]}>
      <Crosshair size={14} aria-hidden="true" />
      {t(kind === 'get' ? 'importLook.goToSet' : 'importLook.goToGet', { count: partners.length })}
    </button>
  );
}

/** The promoted fields of a subgraph copy, in Properties: the same rows as on the copy, full width. */
export function PromotedPanel({ node, disabled }: { node: GraphNode; disabled: boolean }) {
  const { t } = useTranslation();
  if (promotedFields(node.data).length === 0) return null;
  return (
    <section className={styles.promotedSection} aria-label={String(t('importLook.promoted'))}>
      <p className={styles.editorHint}>{t('importLook.promotedHint')}</p>
      <PromotedFields id={node.id} data={node.data} disabled={disabled} connected={new Set()} focusable={false} panel />
    </section>
  );
}

/** The values a node of a class that is not installed saved, read-only, in Properties too. */
export function MissingValues({ data, instance }: { data: ComfyNodeData; instance: boolean }) {
  const presence = useClassPresence(data.comfyType, instance);
  return presence === 'missing' ? <SavedValues data={data} /> : null;
}
