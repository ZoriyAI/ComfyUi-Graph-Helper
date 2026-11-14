import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Provenance } from '../../../shared/contracts';
import { provenanceLabelKey } from '../../../shared/knowledge/labels';
import styles from './ProvenanceBadge.module.css';

/** Where a piece of knowledge came from. Always shown next to an explanation; an inference never reads as a fact. */
export default function ProvenanceBadge({ provenance, by }: { provenance: Provenance; by?: string }) {
  const { t } = useTranslation();
  // What the assistant wrote reads as the assistant's words, whatever it called them (P0 of the assistant review).
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

export function isProvenance(value: unknown): value is Provenance {
  return value === 'fact' || value === 'inference' || value === 'web' || value === 'user';
}
