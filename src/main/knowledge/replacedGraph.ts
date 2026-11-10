import type Database from 'better-sqlite3';

/**
 * Explanations of nodes, ports, links and groups are kept by the object's id, and ids start again from 1 in every
 * graph. When a workflow is opened or a new project started, the explanations of the graph that was there would
 * show on the new graph's objects with the same numbers: "everything starts with a checkpoint" on a sampler.
 *
 * So when a graph is replaced, an explanation stays only if its object is still the same one: a node with the
 * same id and class, a link with the same id between the same two such nodes, a port of such a node, a group
 * with the same id and title. Opening the same graph again keeps everything. Knowledge about classes, link types
 * and model families is not tied to a graph and is not touched.
 */

interface GraphNode { id?: unknown; data?: { comfyType?: unknown } | null }
interface GraphEdge { id?: unknown; source?: unknown; target?: unknown }
interface GraphGroup { id?: unknown; title?: unknown }
export interface ReplacedGraph { nodes: GraphNode[]; edges: GraphEdge[]; groups?: GraphGroup[] }

function nodeClasses(graph: ReplacedGraph): Map<string, string> {
  return new Map(graph.nodes.map((node) => [String(node.id), String(node.data?.comfyType ?? '')]));
}

/** Which objects of the graph that was there are still the same objects in the graph that replaced it. */
export function survivors(before: ReplacedGraph, after: ReplacedGraph): { nodes: Set<string>; edges: Set<string>; groups: Set<string> } {
  const next = nodeClasses(after);
  const nodes = new Set<string>();
  for (const [id, classType] of nodeClasses(before)) if (next.get(id) === classType) nodes.add(id);
  const nextEdges = new Map(after.edges.map((edge) => [String(edge.id), `${String(edge.source)}>${String(edge.target)}`]));
  const edges = new Set<string>();
  for (const edge of before.edges) {
    const id = String(edge.id);
    const same = nextEdges.get(id) === `${String(edge.source)}>${String(edge.target)}`;
    if (same && nodes.has(String(edge.source)) && nodes.has(String(edge.target))) edges.add(id);
  }
  const nextGroups = new Map((after.groups ?? []).map((group) => [String(group.id), String(group.title ?? '')]));
  const groups = new Set<string>();
  for (const group of before.groups ?? []) if (nextGroups.get(String(group.id)) === String(group.title ?? '')) groups.add(String(group.id));
  return { nodes, edges, groups };
}

/**
 * Inside the commit transaction of an import or an opened project. Returns how many explanations went.
 * A port's owner id is "<node id>:<direction>:<name>" (repository.ownerColumns).
 */
export function forgetExplanationsOfReplacedGraph(db: Database.Database, projectId: string, before: ReplacedGraph, after: ReplacedGraph): number {
  const kept = survivors(before, after);
  const rows = db
    .prepare(`SELECT id, owner_kind, owner_id FROM explanations WHERE project_id = ? AND owner_kind IN ('node', 'port', 'edge', 'group')`)
    .all(projectId) as Array<{ id: string; owner_kind: string; owner_id: string }>;
  const gone = rows.filter((row) => {
    if (row.owner_kind === 'node') return !kept.nodes.has(row.owner_id);
    if (row.owner_kind === 'port') return !kept.nodes.has(row.owner_id.split(':')[0]);
    if (row.owner_kind === 'edge') return !kept.edges.has(row.owner_id);
    return !kept.groups.has(row.owner_id);
  });
  const remove = db.prepare('DELETE FROM explanations WHERE id = ?');
  for (const row of gone) remove.run(row.id);
  return gone.length;
}
