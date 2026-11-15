/**
 * The "ports unknown" toast: a node was just added whose class this app has no port list for.
 *
 * Who uses it: commands/appCommands.ts installs it with the commands.
 * Why: such a node shows no inputs or outputs to link, and a person would not know that a sync of ComfyUI (with
 * its server running) fixes it.
 */
import { i18n } from '../i18n';
import { showToast } from '../ui/toastStore';
import { useProjectionStore } from './commands/projection';
import { useGraphStore } from '../state/graphState';

/** At most this many new nodes in one change count as "added"; more is an import or an opened project. */
const ADDED_AT_ONCE = 3;

/** Whether the toast was shown in this session; and the class guard's answer per class. */
let shown = false;
const verdicts = new Map<string, Promise<boolean>>();

/** True when the class guard says the app does not know this class's ports. Cached per class. */
function portsUnknown(classType: string): Promise<boolean> {
  let pending = verdicts.get(classType);
  if (!pending) {
    const bridge = window.electronAPI;
    pending = bridge?.validateNodeClass
      ? bridge.validateNodeClass(classType).then((verdict) => verdict.ok && !verdict.portsKnown).catch(() => false)
      : Promise.resolve(false);
    verdicts.set(classType, pending);
  }
  return pending;
}

/** Forgets that the toast was shown and the cached answers, so tests start fresh. */
export function resetPortsNotice(): void {
  shown = false;
  verdicts.clear();
}

/**
 * Watches the canvas for nodes that were just added (by the person or the assistant). The first one whose
 * class has no known ports shows a toast once per session: sync ComfyUI with the server running.
 */
export function installPortsNotice(): () => void {
  let known: Set<string> | null = null;
  let revSeq = useProjectionStore.getState().revSeq;
  return useGraphStore.subscribe((state) => {
    const projection = useProjectionStore.getState();
    const ids = new Set(state.nodes.map((node) => node.id));
    const previous = known;
    // Only a new revision counts: a graph store change without one (selection, size) adds nothing.
    const advanced = projection.revSeq > revSeq;
    known = ids;
    revSeq = projection.revSeq;
    if (shown || !previous || !advanced) return;
    const added = state.nodes.filter((node) => !previous.has(node.id) && node.data?.kind !== 'subgraph-instance');
    if (added.length === 0 || added.length > ADDED_AT_ONCE) return;
    for (const node of added) {
      const classType = typeof node.data?.comfyType === 'string' ? node.data.comfyType : '';
      if (!classType) continue;
      void portsUnknown(classType).then((unknown) => {
        if (!unknown || shown) return;
        shown = true;
        showToast({
          id: 'ports-unknown',
          tone: 'warn',
          title: String(i18n.t('nodeGuard.portsUnknown')),
          description: String(i18n.t('nodeGuard.portsUnknownBody', { type: classType })),
          duration: 8000,
        });
      });
    }
  });
}
