/**
 * What the app explains about a link (edge): the explanations written for that edge, else the knowledge about the
 * data type it carries. Used by the Properties panel (Inspector), askAbout.ts and the Explain panel
 * (explain/ExplainPanel.tsx), so a link with no notes of its own still teaches what a MODEL or a LATENT is.
 */
import type { Explanation } from '../../../../shared/contracts/knowledge';
import type { ObjectRef } from '../../../../shared/contracts/objects';
import { linkTypeRef } from '../../../../shared/knowledge/coreKnowledge';

/** The knowledge owner of a link data type ('MODEL', 'LATENT', ...), re-exported for the renderer. */
export { linkTypeRef };

/** The data type an edge carries: its own dataType, else the type of the output it leaves. */
export function edgeDataType(edge: { data?: { dataType?: unknown } | null }, outputType?: string | null): string {
  return String(edge.data?.dataType ?? outputType ?? '');
}

/**
 * What to show about an edge: explanations written for the edge itself; when there are none, the knowledge about
 * the data type it carries (owner `{ kind: 'linkType', id: 'MODEL' }`, seeded with the core knowledge).
 */
export function edgeKnowledge(own: readonly Explanation[] | undefined, byType: readonly Explanation[] | undefined): Explanation[] {
  if (own && own.length > 0) return [...own];
  return [...(byType ?? [])];
}

/** The owners to load for an edge: the edge, then its data type when it has a concrete one. */
export function edgeKnowledgeRefs(edgeId: string, dataType: string | null | undefined): { edge: ObjectRef; type: ObjectRef | null } {
  return { edge: { kind: 'edge', id: edgeId }, type: linkTypeRef(dataType) };
}

/**
 * Lists the explanations for an edge through the bridge, falling back to the data type's knowledge.
 * Failures read as nothing known.
 */
export async function resolveEdgeKnowledge(
  list: (owner: ObjectRef) => Promise<Explanation[]>,
  edgeId: string,
  dataType: string | null | undefined,
): Promise<Explanation[]> {
  const refs = edgeKnowledgeRefs(edgeId, dataType);
  const own = await list(refs.edge).catch(() => []);
  if (own.length > 0 || !refs.type) return own;
  return list(refs.type).catch(() => []);
}
