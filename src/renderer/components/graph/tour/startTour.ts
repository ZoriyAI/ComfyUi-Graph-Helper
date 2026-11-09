import { currentPreferences } from '../../../state/preferencesState';
import { i18n } from '../../../i18n';
import { useGraphStore } from '../../../state/graphState';
import { useUiStore } from '../../../state/uiState';
import { definitionView } from '../lib/subgraphView';
import { buildTour, stepIndexOf, type TourNode } from './buildTour';
import { collectTourTexts } from './tourTexts';

/** Nodes and edges of the level on screen, without boundary pseudo-nodes. */
function levelGraph(): { nodes: TourNode[]; edges: Array<{ id: string; source: string; target: string }> } {
  const graph = useGraphStore.getState();
  const definition = graph.activeSubgraphId ? graph.subgraphs.find((item) => item.id === graph.activeSubgraphId) : undefined;
  if (definition) {
    const view = definitionView(definition);
    return {
      nodes: view.nodes.filter((node) => node.type === 'comfy') as unknown as TourNode[],
      edges: view.edges,
    };
  }
  return { nodes: graph.nodes as unknown as TourNode[], edges: graph.edges };
}

/**
 * Builds the tour of the level on screen and starts it (playing unless motion is off for the person),
 * optionally from one node. A new tour replaces the old one: one explanation at a time.
 */
export async function startGraphTour(options: { fromNodeId?: string; playing?: boolean } = {}): Promise<boolean> {
  const { nodes, edges } = levelGraph();
  if (nodes.length === 0) return false;
  const texts = await collectTourTexts(nodes);
  const steps = buildTour(nodes, edges, texts, (node) => {
    const list = (ports?: Array<{ name: string }>) => (ports && ports.length > 0 ? ports.map((port) => port.name).join(', ') : String(i18n.t('canvas.nothing')));
    return String(i18n.t('canvas.neutralStep', { inputs: list(node.data.inputs), outputs: list(node.data.outputs) }));
  });
  const ui = useUiStore.getState();
  ui.startTour(steps, options.playing ?? currentPreferences().canvas.tourAutoplay);
  if (options.fromNodeId) {
    const index = stepIndexOf(steps, options.fromNodeId);
    if (index > 0) ui.setTourIndex(index);
  }
  return true;
}
