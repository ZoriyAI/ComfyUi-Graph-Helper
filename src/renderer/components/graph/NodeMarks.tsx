/**
 * Small marks beside a node's name: Paid (editing.marks.api, a node on an outside service), Outdated, Experimental
 * and Result (a node that saves or shows a result). The node search (AddNodeSearch.tsx) renders this component, so
 * a newcomer sees cost and age before adding a node. The node card (nodes/NodeCard.tsx) shows the same Paid mark
 * with its own badge, not through this component.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NodeMark } from '../../../shared/contracts/knowledge';
import styles from './Toolbar.module.css';

interface NodeMarksProps {
  marks?: NodeMark[];
  /** Also mark a node that saves or shows a result. */
  output?: boolean;
}

/** The marks of one search result, in catalog order; nothing when it has none. */
export default function NodeMarks({ marks, output }: NodeMarksProps) {
  const { t } = useTranslation();
  const shown: Array<'api' | 'deprecated' | 'experimental' | 'output'> = [...(marks ?? [])];
  if (output) shown.push('output');
  if (shown.length === 0) return null;
  return (
    <span className={styles.marks}>
      {shown.map((mark) => (
        <span key={mark} className={styles.mark} data-mark={mark} title={String(t(`editing.marks.${mark}Title`))}>
          {t(`editing.marks.${mark}`)}
        </span>
      ))}
    </span>
  );
}
