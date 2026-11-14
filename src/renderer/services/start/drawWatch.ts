import { useProjectionStore } from '../commands/projection';

/** Two frames: the store change has been rendered and painted. A canvas that hangs never gets there. */
function afterPaint(run: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(run));
}

/**
 * Safe start (main/startGuard.ts): tells main each time the graph of a new revision is on screen. A graph that
 * never gets drawn leaves main's mark at "drawing", and the next start asks before drawing it again.
 */
export function installDrawWatch(api: Pick<Window['electronAPI'], 'graphDrawn'> = window.electronAPI): () => void {
  let told = '';
  const tell = (revisionId: string) => {
    if (!revisionId || revisionId === told) return;
    afterPaint(() => {
      if (useProjectionStore.getState().currentRevisionId !== revisionId) return;
      told = revisionId;
      void api.graphDrawn(revisionId).catch(() => undefined);
    });
  };
  tell(useProjectionStore.getState().currentRevisionId);
  return useProjectionStore.subscribe((state, previous) => {
    if (state.currentRevisionId !== previous.currentRevisionId) tell(state.currentRevisionId);
  });
}
