import { i18n } from '../../i18n';
import type { ObjectRef } from '../../../shared/contracts/objects';
import { requestAsk } from '../../services/ask';
import { useUiStore } from '../../state/uiState';
import { useDockStore } from '../../state/dockState';
import { useKnowledgeStore } from '../../state/knowledgeState';
import { resolveEdgeKnowledge } from './lib/linkTypeKnowledge';

export function interfaceLanguage(): 'en' | 'ru' {
  return (i18n.language || 'ru').toLowerCase().startsWith('en') ? 'en' : 'ru';
}

/**
 * Ask the helper about one object: the chat shows `message` as the person's own, the turn carries the
 * object and the selection, and the canvas highlights the object (focusRef) while the answer comes.
 */
export function askAbout(objectRef: ObjectRef, message: string): void {
  const ui = useUiStore.getState();
  ui.setFocus(objectRef);
  requestAsk({
    context: { intent: 'ask', objectRef, selection: ui.selection, language: interfaceLanguage() },
    message,
  });
}

/**
 * "What flows here?" on a connection. When something is already known (an explanation of the edge, or the built-in
 * knowledge about the data type it carries), the Explain panel shows it at once, with no model call; otherwise the
 * question goes to the helper as before.
 */
export async function askWhatFlows(edgeId: string, dataType: string, message: string): Promise<void> {
  const ref: ObjectRef = { kind: 'edge', id: edgeId };
  const load = useKnowledgeStore.getState().loadExplanations;
  const known = await resolveEdgeKnowledge((owner) => load(owner), edgeId, dataType);
  if (known.length === 0) {
    askAbout(ref, message);
    return;
  }
  useUiStore.getState().setFocus(ref);
  useDockStore.getState().show('explain');
}
