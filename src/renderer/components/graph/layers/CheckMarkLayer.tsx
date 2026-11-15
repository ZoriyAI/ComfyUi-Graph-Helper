/**
 * The Check tab's findings, marked on the nodes they are about: a ring around the node in the colour of the worst
 * finding (raspberry when the graph will not run, amber when it may run badly) and a small count at its corner.
 * Who sees it: a person who ran "Check the graph" and looks at the canvas instead of the list.
 * Why it hides after any edit: the report describes the graph as it was checked; after a change it may no longer be
 * true, and a mark that lies is worse than none. Running the check again brings the marks back.
 * Drawn in the viewport (it moves and zooms with the canvas); the ring and the count keep their screen size.
 */
import React from 'react';
import { ViewportPortal, useNodes, useStore, type ReactFlowState } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { useRevisionStore } from '../../../state/revisionState';
import { useGraphStore } from '../../../state/graphState';
import { checkMarks } from '../lib/checkMarks';
import styles from './CheckMarkLayer.module.css';

/** The revision of the graph the last check report describes; null before any check. */
const useCheckedRevision = create<{ revision: string | null }>(() => ({ revision: null }));
// Stamped when the report arrives, wherever the check was started from, so the layer can mount later and still know.
useKnowledgeStore.subscribe((state, previous) => {
  if (state.check !== previous.check) useCheckedRevision.setState({ revision: state.check ? useRevisionStore.getState().currentRevisionId : null });
});

const zoomOf = (state: ReactFlowState) => state.transform[2];

export default function CheckMarkLayer() {
  const { t } = useTranslation();
  const report = useKnowledgeStore((state) => state.check);
  const checked = useCheckedRevision((state) => state.revision);
  const current = useRevisionStore((state) => state.currentRevisionId);
  // The report names nodes of the main graph; inside a subgraph other nodes are on screen.
  const inSubgraph = useGraphStore((state) => state.activeSubgraphId !== null);
  const nodes = useNodes();
  const zoom = useStore(zoomOf);
  if (!report || inSubgraph || checked === null || checked !== current) return null;
  const marks = checkMarks(report);
  if (marks.size === 0) return null;
  return (
    <ViewportPortal>
      {nodes.map((node) => {
        const mark = marks.get(node.id);
        if (!mark || !node.measured?.width) return null;
        const style = {
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          width: node.measured.width,
          height: node.measured.height,
          '--check-zoom': zoom,
        } as React.CSSProperties;
        const label = String(t('canvas.checkMark', { count: mark.count }));
        return (
          <div key={node.id} className={styles.mark} style={style} data-check-mark={node.id} data-check-level={mark.level} role="img" aria-label={label}>
            <span className={styles.count} aria-hidden="true">{mark.count}</span>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
