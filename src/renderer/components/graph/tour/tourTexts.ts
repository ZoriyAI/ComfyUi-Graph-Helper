import { inSubgraph } from '../../../../shared/contracts/objects';
import { DESKTOP_PROJECT_ID } from '../../../../shared/project';
import { useNodeInfoStore } from '../nodeInfo';
import { firstExplanation, type TourNode, type TourTexts } from './buildTour';

/**
 * Gathers explanation and catalog text for every node of a tour. Failures fall back to nothing. `subgraphId`: the
 * definition whose inner nodes the tour walks (its node numbers repeat those of the main canvas).
 */
export async function collectTourTexts(nodes: TourNode[], projectId = DESKTOP_PROJECT_ID, subgraphId: string | null = null): Promise<TourTexts> {
  const bridge = window.electronAPI;
  const texts: TourTexts = { byNode: {}, byClass: {}, catalog: {} };
  const classes = [...new Set(nodes.map((node) => node.data.comfyType))];
  const list = (owner: Parameters<typeof bridge.listExplanations>[0]['owner']) => (
    bridge?.listExplanations ? bridge.listExplanations({ projectId, owner }).catch(() => []) : Promise.resolve([])
  );
  await Promise.all([
    ...nodes.map(async (node) => {
      texts.byNode[node.id] = firstExplanation(await list(inSubgraph({ kind: 'node', id: node.id, classType: node.data.comfyType }, subgraphId)));
    }),
    ...classes.map(async (classType) => {
      const [explanations, detail] = await Promise.all([
        list({ kind: 'nodeClass', id: classType, classType }),
        useNodeInfoStore.getState().request(classType),
      ]);
      texts.byClass[classType] = firstExplanation(explanations);
      texts.catalog[classType] = detail ? { description: detail.description, displayName: detail.displayName } : undefined;
    }),
  ]);
  return texts;
}
