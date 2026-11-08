import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Provenance } from '../../../shared/contracts';
import { provenanceLabelKey } from '../../../shared/knowledge/labels';
import styles from './ProvenanceBadge.module.css';

/** Where a piece of knowledge came from. Always shown next to an explanation; an inference never reads as a fact. */
export default function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { t } = useTranslation();
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
