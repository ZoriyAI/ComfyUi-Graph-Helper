/**
 * The small badge that says where a piece of knowledge came from: a fact, an inference, the web, the person, or the
 * assistant. ExplainPanel.tsx and chat/ToolCard.tsx show it beside every explanation, so an inference never reads
 * as a fact.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Provenance } from '../../../shared/contracts';
import { provenanceLabelKey } from '../../../shared/knowledge/labels';
import styles from './ProvenanceBadge.module.css';

/** Where a piece of knowledge came from. Always shown next to an explanation; an inference never reads as a fact. */
export default function ProvenanceBadge({ provenance, by }: { provenance: Provenance; by?: string }) {
  const { t } = useTranslation();
  // What the assistant wrote reads as the assistant's words, whatever provenance it claimed for them.
  if (by === 'ai') {
    return (
      <span
        className={`provenance-badge ${styles.badge}`}
        data-provenance="inference"
        data-by="assistant"
        title={String(t(provenance === 'web' ? 'knowledge.byAssistantWebHint' : 'knowledge.byAssistantHint'))}
      >
        {t('knowledge.byAssistant')}
      </span>
    );
  }
  return (
    <span
      className={`provenance-badge ${styles.badge}`}
      data-provenance={provenance}
      title={String(t(`knowledge.provenanceHint.${provenance}`))}
    >
      {t(provenanceLabelKey(provenance))}
    </span>
  );
}

/** True for one of the four provenance values; guards data read from a tool call. */
export function isProvenance(value: unknown): value is Provenance {
  return value === 'fact' || value === 'inference' || value === 'web' || value === 'user';
}
