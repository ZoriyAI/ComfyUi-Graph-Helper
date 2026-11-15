/** Prepare an independent copy of a bundled native graph. The normal paste engine owns placement and ids. */
import { randomUUID } from 'node:crypto';
import { blueprintById, blueprintFacts } from '../../shared/templates/catalog';
import type { GraphMutation } from '../../shared/commands/types';
import { emptyWorkflowState, nextLinkId, nextNodeId, projectWorkflow, type GraphSnapshot } from '../../shared/workflow/codec';
import { GraphOpError, SUBGRAPH_ERRORS } from './graphOps';

type InsertBlueprint = Extract<GraphMutation, { type: 'insert-blueprint' }>;
export function prepareBlueprint(snapshot: GraphSnapshot, payload: InsertBlueprint): { snapshot: GraphSnapshot; nodes: Record<string, any>[]; edges: Record<string, any>[]; definitionId: string; definitionIds: string[] } {
  const entry = blueprintById(payload.templateId); if (!entry) throw new GraphOpError('Blueprint was not found.');
  if (payload.destinationDefinitionId && !(snapshot.subgraphs ?? []).some((d) => !d.opaque && d.id === payload.destinationDefinitionId)) throw new GraphOpError(SUBGRAPH_ERRORS.definitionMissing);
  if (snapshot.document?.formatVersion === 0.4 && !payload.upgradeToV1) throw new GraphOpError(SUBGRAPH_ERRORS.format);
  const read = projectWorkflow(structuredClone(entry.workflow)); if ('error' in read) throw new GraphOpError(read.error);
  const imported = read.snapshot; const definitions = imported.subgraphs ?? [];
  const remap = new Map(definitions.map((d) => [d.id, randomUUID()]));
  const definitionId = remap.get(blueprintFacts(entry).definition.id)!;
  const nodeRefs = (node: Record<string, any>) => {
    const type = remap.get(node.data.comfyType); if (!type) return;
    node.data.comfyType = type; node.data.subgraphId = type; node.data.comfy.type = type;
  };
  imported.nodes.forEach(nodeRefs);
  for (const definition of definitions) {
    definition.id = remap.get(definition.id)!;
    definition.nestedIn = definition.nestedIn ? remap.get(definition.nestedIn) ?? null : null;
    definition.nodes.forEach(nodeRefs);
    if (definition.id === definitionId) { definition.name = payload.name ?? definition.name; definition.raw.description = payload.description ?? definition.raw.description ?? ''; }
  }
  if (payload.name) { imported.nodes[0].data.title = payload.name; imported.nodes[0].data.comfy.title = payload.name; }
  let document = snapshot.document;
  if (document?.formatVersion === 0.4) {
    const raw: Record<string, unknown> = { ...document.raw, state: { ...emptyWorkflowState(), lastNodeId: nextNodeId(snapshot) - 1, lastLinkId: nextLinkId(snapshot) - 1 } };
    delete raw.last_node_id; delete raw.last_link_id; document = { formatVersion: 1, raw };
  }
  return { snapshot: { ...snapshot, document, subgraphs: [...(snapshot.subgraphs ?? []), ...definitions] }, nodes: imported.nodes, edges: imported.edges, definitionId, definitionIds: definitions.map((d) => d.id) };
}
