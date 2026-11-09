import { explainError, type Translator } from '../../../shared/i18n';
import type { ToastInput } from '../../ui/toastStore';

/** What a file action reports. Shown as one replaceable toast (id `workflow-note`). */
export type WorkflowNote =
  | { kind: 'imported'; version: string; missingNodes: string[]; missingModels: string[] }
  | { kind: 'catalog'; nodes: number; models: number; skipped: number }
  | { kind: 'exported'; unset?: string[] }
  | { kind: 'saved-project' }
  | { kind: 'opened-project' }
  | { kind: 'error'; code: string };

export const WORKFLOW_NOTE_ID = 'workflow-note';

export function describeNote(note: WorkflowNote, translate: Translator): ToastInput {
  if (note.kind === 'imported') {
    const nodeText = note.missingNodes.length > 0
      ? translate('workflow.missingNodes', { names: note.missingNodes.join(', ') })
      : translate('workflow.noMissingNodes');
    const modelText = note.missingModels.length > 0
      ? translate('workflow.missingModels', { names: note.missingModels.join(', ') })
      : translate('workflow.noMissingModels');
    const missing = note.missingNodes.length > 0 || note.missingModels.length > 0;
    return {
      id: WORKFLOW_NOTE_ID,
      tone: missing ? 'warn' : 'success',
      title: translate('workflow.imported', { version: note.version, nodeText, modelText }),
      duration: missing ? 15000 : 8000,
    };
  }
  if (note.kind === 'catalog') return { id: WORKFLOW_NOTE_ID, tone: 'success', title: translate('workflow.catalogImported', note) };
  if (note.kind === 'exported') {
    if (note.unset && note.unset.length > 0) {
      return {
        id: WORKFLOW_NOTE_ID,
        tone: 'warn',
        title: translate('workflow.exported'),
        description: translate('workflow.exportedUnset', { names: note.unset.join(', ') }),
        duration: 15000,
      };
    }
    return { id: WORKFLOW_NOTE_ID, tone: 'success', title: translate('workflow.exported') };
  }
  if (note.kind === 'saved-project') return { id: WORKFLOW_NOTE_ID, tone: 'success', title: translate('workflow.savedProject') };
  if (note.kind === 'opened-project') return { id: WORKFLOW_NOTE_ID, tone: 'success', title: translate('workflow.openedProject') };
  const explained = explainError(translate, note.code);
  return { id: WORKFLOW_NOTE_ID, tone: 'error', title: explained.summary, description: explained.diagnostic, duration: 12000 };
}
