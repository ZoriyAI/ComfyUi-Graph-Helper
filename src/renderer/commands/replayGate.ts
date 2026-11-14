import { i18n } from '../i18n';
import { setManualGate } from '../services/commands/projection';
import { useCanvasStore } from '../components/graph/canvasStore';
import { showToast } from '../ui/toastStore';

/** The toast that says why nothing changed: the real graph is read-only while History replay is open. */
export function sayReplayLocked(): void {
  showToast({
    id: 'replay-locked',
    tone: 'info',
    title: String(i18n.t('canvas.replayLockedTitle')),
    description: String(i18n.t('canvas.replayLockedBody')),
    duration: 6000,
  });
}

/** True while History replay is open; says so when `say` is set. */
export function replayIsOpen(say = false): boolean {
  const open = Boolean(useCanvasStore.getState().replay);
  if (open && say) sayReplayLocked();
  return open;
}

/** A build turn of the helper is about to change the real graph: the replay closes first, and says so. */
export function closeReplayForBuild(): void {
  if (!replayIsOpen()) return;
  useCanvasStore.getState().setReplay(null);
  showToast({ id: 'replay-locked', tone: 'info', title: String(i18n.t('canvas.replayClosedForBuild')), duration: 5000 });
}

/**
 * While History replay is open, no manual change reaches the real graph, whichever panel it comes from (the
 * library, a model card, a lesson's "Do this for me"): submitManual asks this gate first. Returns the uninstall.
 */
export function installReplayGate(): () => void {
  setManualGate(() => !replayIsOpen(true));
  return () => setManualGate(null);
}
