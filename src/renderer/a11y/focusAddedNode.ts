/** A keyboard add ends on its new card. Later input cancels the handoff instead of stealing focus. */
import { captureEditOrigin, originIsCurrent } from '../components/graph/lib/editOrigin';
import { levelNodes } from '../components/graph/lib/level';

export function focusAddedNode(action: Promise<void>): void {
  const origin = captureEditOrigin();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  document.addEventListener('pointerdown', cancel, { capture: true, signal: controller.signal });
  document.addEventListener('keydown', cancel, { capture: true, signal: controller.signal });
  void action.then(() => {
    const selected = levelNodes().filter(node => node.selected);
    if (selected.length !== 1) { cancel(); return; }
    const id = selected[0].id;
    const deadline = performance.now() + 1200;
    const focus = () => {
      if (controller.signal.aborted || !originIsCurrent(origin)) { cancel(); return; }
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
      if (node && !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) {
        // React Flow first mounts a hidden card to measure it; focus only succeeds once it is visible.
        node.focus({ preventScroll: true });
        if (document.activeElement === node) { cancel(); return; }
      }
      if (performance.now() < deadline) window.requestAnimationFrame(focus);
      else cancel();
    };
    // Let the projection and reveal camera render; viewport culling may mount the node on a later frame.
    window.requestAnimationFrame(focus);
  }, cancel);
}
