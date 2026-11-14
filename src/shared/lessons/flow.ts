import type { Lesson, Roles } from './engine';

/**
 * Where the nodes of a lesson stand when the app is the one that adds them. A lesson tells a person that a graph
 * reads from left to right; a node added by "Do this for me" must not contradict it by landing wherever the view
 * happens to be. Each role has a column, counted along the lesson's own links, and a new node goes into its
 * column next to the node it will be fed by.
 */

export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function linksOf(lesson: Lesson): Array<{ from: string; to: string }> {
  return lesson.steps.flatMap((step) => step.links ?? []).map((link) => ({ from: link.from, to: link.to }));
}

/**
 * The column of each role: the number of links on the longest way to it from a node that nothing leads into.
 * Loaders and blanks stand in column 0, what they feed in column 1, and so on to the node that saves.
 */
export function columnsOf(lesson: Lesson): Record<string, number> {
  const into = new Map<string, string[]>();
  const names = new Set<string>();
  for (const step of lesson.steps) for (const spec of step.roles ?? []) names.add(spec.role);
  for (const link of linksOf(lesson)) {
    names.add(link.from);
    names.add(link.to);
    into.set(link.to, [...(into.get(link.to) ?? []), link.from]);
  }
  const columns = new Map<string, number>();
  const walk = (role: string, trail: Set<string>): number => {
    const known = columns.get(role);
    if (known !== undefined) return known;
    // Links that came round to where they started say nothing about left and right.
    if (trail.has(role)) return 0;
    trail.add(role);
    const column = Math.max(-1, ...(into.get(role) ?? []).map((from) => walk(from, trail))) + 1;
    trail.delete(role);
    columns.set(role, column);
    return column;
  };
  for (const role of names) walk(role, new Set());
  return Object.fromEntries(columns);
}

/**
 * The top-left corner for a node the app adds for `role`. It stands in the role's column, counted from a node of
 * the lesson that is on the canvas already (the one that will feed it, when there is one), at that node's height,
 * moved down past whatever it would cover. Null when nothing of the lesson is on the canvas: the first node goes
 * where any new node goes.
 */
export function lessonSpot(
  lesson: Lesson,
  role: string,
  roles: Roles,
  rects: ReadonlyMap<string, FlowRect>,
  size: { width: number; height: number },
  gaps: { x: number; y: number },
): { x: number; y: number } | null {
  const columns = columnsOf(lesson);
  if (!(role in columns)) return null;
  const placed = Object.entries(roles).flatMap(([name, id]) => {
    const rect = rects.get(id);
    return name !== role && rect && name in columns ? [{ name, rect }] : [];
  });
  if (placed.length === 0) return null;
  const links = linksOf(lesson);
  const feeds = new Set(links.filter((link) => link.to === role).map((link) => link.from));
  const fed = new Set(links.filter((link) => link.from === role).map((link) => link.to));
  // Everything the role leads to or comes from along the lesson's links, however many nodes lie in between.
  const reach = (forward: boolean): Set<string> => {
    const seen = new Set<string>();
    const queue = [role];
    while (queue.length > 0) {
      const at = queue.pop()!;
      for (const link of links) {
        const next = forward ? (link.from === at ? link.to : null) : link.to === at ? link.from : null;
        if (next !== null && next !== role && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };
  const related = new Set([...reach(true), ...reach(false)]);
  // Next to the node that will feed it, the nearest of those; else next to the one it will feed; else by a node
  // it reaches through others (a part built in front of a graph that is already there counts its columns back
  // from where it joins that graph); else to whatever of the lesson stands nearest by column.
  const kin = (name: string) => (feeds.has(name) ? 0 : fed.has(name) ? 1 : related.has(name) ? 2 : 3);
  const away = (name: string) => Math.abs(columns[name] - columns[role]);
  const anchor = placed.reduce((best, item) => (kin(item.name) < kin(best.name) || (kin(item.name) === kin(best.name) && away(item.name) < away(best.name)) ? item : best));
  const stride = Math.max(size.width, ...placed.map((item) => item.rect.width)) + gaps.x;
  const x = anchor.rect.x + (columns[role] - columns[anchor.name]) * stride;
  let y = anchor.rect.y;
  const all = [...rects.values()];
  for (let guard = 0; guard < 500; guard += 1) {
    const covered = all.find((rect) => x < rect.x + rect.width + gaps.x && x + size.width + gaps.x > rect.x && y < rect.y + rect.height + gaps.y && y + size.height + gaps.y > rect.y);
    if (!covered) break;
    y = covered.y + covered.height + gaps.y;
  }
  return { x: Math.round(x), y: Math.round(y) };
}
