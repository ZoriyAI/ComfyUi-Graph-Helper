/**
 * Decides whether the renderer takes a projection that arrives from main (renderer/services/commands/projection.ts).
 * Answers can arrive out of order; an older revision must not replace a newer one on screen.
 */
/**
 * True when `incoming` may replace what is shown: nothing is shown yet, or it is the same project at the same or a
 * later revision. Another project's projection is refused.
 */
export function acceptsProjection(
  displayed: { projectId: string; revSeq: number } | null,
  incoming: { projectId: string; revSeq: number },
): boolean {
  if (!displayed) return true;
  if (incoming.projectId !== displayed.projectId) return false;
  return incoming.revSeq >= displayed.revSeq;
}
