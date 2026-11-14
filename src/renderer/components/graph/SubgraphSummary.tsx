import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Translator } from '../../../shared/i18n';
import { useGraphStore } from '../../state/graphState';
import { cx } from '../../ui/cx';
import styles from './SubgraphSummary.module.css';

/** The parts of a subgraph definition its summary counts. */
export interface SubgraphShape {
  nodes: ReadonlyArray<unknown>;
  inputs: ReadonlyArray<unknown>;
  outputs: ReadonlyArray<unknown>;
}

/**
 * What a subgraph holds, in words: "3 nodes · 2 inputs · 1 output". Inputs and outputs it does not have are left
 * out; the node count always stays, so an empty subgraph still says so. Used wherever a subgraph is listed, so a
 * person reads its size instead of its id.
 */
export function subgraphSummary(t: Translator, shape: SubgraphShape): string {
  const parts = [t('subgraphInfo.nodes', { count: shape.nodes.length })];
  if (shape.inputs.length > 0) parts.push(t('subgraphInfo.inputs', { count: shape.inputs.length }));
  if (shape.outputs.length > 0) parts.push(t('subgraphInfo.outputs', { count: shape.outputs.length }));
  return parts.join(' · ');
}

/** The summary of the definition with this id, read from the graph store; nothing when the store does not model it. */
export default function SubgraphSummary({ id, className }: { id: string; className?: string }) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const definition = useGraphStore((state) => state.subgraphs.find((item) => item.id === id));
  if (!definition) return null;
  return <span className={cx(styles.summary, className)}>{subgraphSummary(translate, definition)}</span>;
}
