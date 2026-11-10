import { useMemo } from 'react';
import { useGraphStore } from '../../state/graphState';
import { useNodeInfoStore } from '../graph/nodeInfo';
import type { StepNames } from './buildSteps';

/**
 * Names for step sentences from what the app already holds: the canvas nodes (title, then the catalog's display
 * name, then the class), their ports, and the subgraph definitions. Catalog details are only read, never fetched
 * here: the canvas already asks for every class it shows.
 */
export function useStepNames(): StepNames {
  const nodes = useGraphStore((state) => state.nodes);
  const subgraphs = useGraphStore((state) => state.subgraphs);
  const details = useNodeInfoStore((state) => state.details);
  return useMemo<StepNames>(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const classTitle = (classType: string) => details[classType]?.displayName || undefined;
    return {
      node: (id) => {
        const node = byId.get(id);
        if (!node) return undefined;
        const definition = node.data.subgraphId ? subgraphs.find((item) => item.id === node.data.subgraphId) : undefined;
        return node.data.title || definition?.name || classTitle(node.data.comfyType) || node.data.comfyType || undefined;
      },
      nodeClass: classTitle,
      port: (nodeId, handle, direction) => {
        const ports = direction === 'output' ? byId.get(nodeId)?.data.outputs : byId.get(nodeId)?.data.inputs;
        return ports?.find((port) => port.id === handle)?.name || undefined;
      },
      subgraph: (id) => subgraphs.find((item) => item.id === id)?.name || undefined,
    };
  }, [nodes, subgraphs, details]);
}
