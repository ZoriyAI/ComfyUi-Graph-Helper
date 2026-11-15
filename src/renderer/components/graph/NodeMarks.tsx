/**
 * Small marks beside a node's name: «Платная» (a paid node on an outside service), «Устарела», «Опытная» and, in the
 * node search, «Результат» (a node that saves or shows a result). The node search (AddNodeSearch.tsx) and the node
 * card (nodes/NodeCard.tsx, paid only) use them, so a newcomer sees cost and age before adding a node.
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
