import type { GraphMutation } from '../../../shared/commands/types';
import { submitManual } from '../../services/commands/projection';
import { useCanvasStore } from './canvasStore';

/**
 * Every canvas edit goes through here: submitManual with a fresh action id, refused while a replay is
 * showing (the replay is read-only), and marked so its projection does not start a build reveal.
 */
export function commitManual(payload: GraphMutation, prefix = 'manual'): Promise<unknown> {
  const canvas = useCanvasStore.getState();
  if (canvas.replay) return Promise.resolve(null);
  canvas.beginManual();
  return submitManual(`${prefix}-${crypto.randomUUID()}`, payload)
    .catch(() => null)
    .finally(() => useCanvasStore.getState().endManual());
}
