export function acceptsProjection(
  displayed: { projectId: string; revSeq: number } | null,
  incoming: { projectId: string; revSeq: number },
): boolean {
  if (!displayed) return true;
  if (incoming.projectId !== displayed.projectId) return false;
  return incoming.revSeq >= displayed.revSeq;
}
