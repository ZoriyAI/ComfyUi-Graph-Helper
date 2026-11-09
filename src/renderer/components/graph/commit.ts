import type { GraphMutation } from '../../../shared/commands/types';
import { translateKnownError } from '../../../shared/i18n';
import { i18n } from '../../i18n';
import { submitManual } from '../../services/commands/projection';
import { showToast } from '../../ui/toastStore';
import { useCanvasStore } from './canvasStore';

const translate = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options ?? {}));

/** Tell the person an edit did not land; the projection that came back is already on the canvas. */
export function reportRefusal(result: { status?: unknown; result?: unknown } | null | undefined): void {
  if (!result || (result.status !== 'conflict' && result.status !== 'rejected')) return;
  const detail = result.result as { error?: unknown } | null | undefined;
  const reason = typeof detail?.error === 'string' ? translateKnownError(translate, detail.error) : null;
  showToast({
    id: 'canvas-edit-refused',
    tone: 'warn',
    title: translate('canvas.editRefused'),
    description: reason ?? (result.status === 'conflict' ? translate('canvas.editConflict') : null),
    duration: 5000,
  });
}

/**
 * Every canvas edit goes through here: submitManual with a fresh action id, refused while a replay is
 * showing (the replay is read-only), and marked so its projection does not start a build reveal.
 * A refusal or conflict is shown as a toast; submitManual has already put the engine's projection back.
 */
export function commitManual(payload: GraphMutation, prefix = 'manual'): Promise<unknown> {
  const canvas = useCanvasStore.getState();
  if (canvas.replay) return Promise.resolve(null);
  canvas.beginManual();
  return submitManual(`${prefix}-${crypto.randomUUID()}`, payload)
    .then((result) => {
      reportRefusal(result);
      return result;
    })
    .catch(() => null)
    .finally(() => useCanvasStore.getState().endManual());
}
