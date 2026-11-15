import { useEffect, useRef } from 'react';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { useGraphStore } from '../../../state/graphState';
import { checkedNodeIds, flashWave } from '../../../motion/attention';
import { motionIsFull } from '../../../motion/policy';

/**
 * After «Проверить граф» / "Check the graph" (motion package): a wave runs over the nodes the check marked, left to
 * right. CanvasFlow mounts it. Only a new report starts a wave; a report read again on start-up does not.
 */
export function useCheckWave(): void {
  const check = useKnowledgeStore((state) => state.check);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!check) return;
    const ids = new Set(checkedNodeIds(check));
    const nodes = useGraphStore.getState().nodes.filter((node) => ids.has(node.id)).map((node) => ({ id: node.id, x: node.position.x }));
    flashWave(nodes, motionIsFull());
  }, [check]);
}
