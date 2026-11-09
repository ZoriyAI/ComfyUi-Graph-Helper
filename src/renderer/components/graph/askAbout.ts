import { i18n } from '../../i18n';
import type { ObjectRef } from '../../../shared/contracts/objects';
import { requestAsk } from '../../services/ask';
import { useUiStore } from '../../state/uiState';

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
