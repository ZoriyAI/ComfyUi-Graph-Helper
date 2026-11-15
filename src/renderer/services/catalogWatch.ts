/**
 * Keeps the canvas in step with the catalog (the node list read from ComfyUI).
 *
 * Who uses it: commands/appCommands.ts installs it with the commands.
 */
import { useKnowledgeStore } from '../state/knowledgeState';
import { useUiStore } from '../state/uiState';
import { loadClassTitles } from '../components/graph/lib/classTitles';
import { useProjectionStore } from './commands/projection';
import { useGraphStore } from '../state/graphState';

/** What the catalog changed: a sync finished, or a node list was loaded from a file. */
function catalogStamp(): string {
  const sync = useKnowledgeStore.getState().sync;
  return `${sync?.lastSyncAt ?? 0}:${sync?.counts.nodeClasses ?? 0}:${useUiStore.getState().catalogVersion}`;
}

/**
 * Reads what the canvas needs from the catalog again whenever the catalog changes or another graph comes onto
 * the canvas (open, open workflow, new project, undo across one): the readable class names (classTitles.ts), and
 * the check, so a node whose class this ComfyUI does not have is marked at once, not only after "Check".
 * Returns the unsubscribe.
 */
export function installCatalogWatch(): () => void {
  let stamp = catalogStamp();
  let graphKey = useProjectionStore.getState().graphKey;
  const recheck = () => {
    if (!useProjectionStore.getState().graphKey) return;
    // Before a node list is read every class would look missing: nothing is marked until ComfyUI has been read.
    if ((useKnowledgeStore.getState().sync?.counts.nodeClasses ?? 0) === 0) return;
    // An empty canvas has nothing to mark; the check badge stays away until there is a graph.
    if (useGraphStore.getState().nodes.length === 0 && useKnowledgeStore.getState().check === null) return;
    void useKnowledgeStore.getState().runCheck(useProjectionStore.getState().projectId).catch(() => undefined);
  };
  void loadClassTitles();
  recheck();
  const onCatalog = () => {
    const next = catalogStamp();
    if (next === stamp) return;
    stamp = next;
    void loadClassTitles();
    recheck();
  };
  const offKnowledge = useKnowledgeStore.subscribe(onCatalog);
  const offUi = useUiStore.subscribe(onCatalog);
  const offProjection = useProjectionStore.subscribe((state) => {
    if (state.graphKey === graphKey) return;
    graphKey = state.graphKey;
    recheck();
  });
  return () => {
    offKnowledge();
    offUi();
    offProjection();
  };
}
