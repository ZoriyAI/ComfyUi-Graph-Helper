/**
 * The window's side of the ways a file arrives without a dialog: dropped on the window, or named on the command line
 * (at start, or by a second start while this window is open).
 *
 * Who uses it: App.tsx installs it once. Why here and not on the canvas: a person drops a workflow anywhere on the
 * window, not only on the canvas; the canvas keeps its own drops of nodes and models (application/x-helper-*), and a
 * text field keeps a dropped text. Every arrival goes to commands/actions.ts, which asks before replacing a graph and
 * ends in the one open path.
 */
import { openDroppedFile, openPendingFile, refreshRecentFiles } from './actions';
import { useKnowledgeStore } from '../state/knowledgeState';

/** True when the drop lands in a field that takes text: the field keeps it. */
function inTextField(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
}

/** Installs the drop listener and the command-line request listener; returns the uninstall. */
export function installFileOpening(): () => void {
  const onDrop = (event: DragEvent) => {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0 || inTextField(event.target)) return;
    // A node or model dragged from the library is the canvas's own drop, not a file to open.
    if (Array.from(event.dataTransfer?.types ?? []).some((type) => type.startsWith('application/x-helper-'))) return;
    event.preventDefault();
    // One graph at a time: the first file of a drop opens.
    void openDroppedFile(files[0]);
  };
  document.addEventListener('drop', onDrop);
  const offRequest = window.electronAPI.onOpenRequest?.(() => void openPendingFile()) ?? (() => undefined);
  void refreshRecentFiles();
  // Examples are built from the node list: a new read of ComfyUI may add or remove some.
  let lastRead = useKnowledgeStore.getState().sync?.lastSyncAt ?? null;
  const offSync = useKnowledgeStore.subscribe((state) => {
    const read = state.sync?.lastSyncAt ?? null;
    if (read === lastRead) return;
    lastRead = read;
    void refreshRecentFiles();
  });
  return () => {
    offSync();
    document.removeEventListener('drop', onDrop);
    offRequest();
  };
}
