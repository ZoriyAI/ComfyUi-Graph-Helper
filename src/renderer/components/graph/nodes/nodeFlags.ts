import { useCanvasStore } from '../canvasStore';
import { useCanvasView } from '../CanvasContext';

/** Canvas state flags of one node, read from the canvas store and the level on screen. */
export function useNodeFlags(id: string) {
  const view = useCanvasView();
  const aiTouched = useCanvasStore((state) => Boolean(state.aiTouched[id]));
  const revealing = useCanvasStore((state) => Boolean(state.justAdded[id]));
  const pending = useCanvasStore((state) => state.pending.includes(id));
  return {
    aiTouched,
    revealing,
    pending,
    error: view.errorNodes.has(id),
    dimmed: view.plan?.dimmed.has(id) ?? false,
    // Out of the tour's or the lesson's focus (motion package).
    unfocused: view.focusNodes ? !view.focusNodes.has(id) : false,
  };
}
