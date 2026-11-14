import { explainError, type Translator } from '../../../shared/i18n';
import type { ToastInput } from '../../ui/toastStore';

/** What a file action reports. Shown as one replaceable toast (id `workflow-note`). */
export type WorkflowNote =
  | {
    kind: 'imported';
    version: string;
    missingNodes: string[];
    missingModels: string[];
    shown?: Partial<Record<ShownKey, number>>;
    /** No node list has been read from ComfyUI yet: every class would look missing, so none is called missing. */
    catalogNotRead?: boolean;
  }
  | { kind: 'catalog'; nodes: number; models: number; skipped: number }
  | { kind: 'exported'; unset?: string[] }
  | { kind: 'saved-project' }
  | { kind: 'opened-project' }
  | { kind: 'error'; code: string };

export const WORKFLOW_NOTE_ID = 'workflow-note';

/** What export keeps but the canvas shows differently; counted by the import (codec shownDifferently). */
export const SHOWN_KEYS = ['groupNodes'] as const;
export type ShownKey = typeof SHOWN_KEYS[number];

function shownText(shown: Partial<Record<ShownKey, number>> | undefined, translate: Translator): string | undefined {
  const items = SHOWN_KEYS
    .filter((key) => (shown?.[key] ?? 0) > 0)
    .map((key) => translate(`workflow.shown.${key}`, { n: shown?.[key] ?? 0 }));
  return items.length > 0 ? translate('workflow.shownDifferently', { items: items.join('; ') }) : undefined;
}

/** Names shown in a toast before "and N more": a long list of class names would cover the canvas. */
export const NOTE_NAMES = 2;

/** "Missing nodes: A, B." for two or fewer, else "Missing nodes: 18 (A, B and 16 more)." */
function missingText(names: string[], key: 'Nodes' | 'Models', translate: Translator): string {
  if (names.length <= NOTE_NAMES) return translate(`workflow.missing${key}`, { names });
  return translate(`workflow.missing${key}Many`, { count: names.length, names: names.slice(0, NOTE_NAMES).join(', '), rest: names.length - NOTE_NAMES });
}

export interface NoteActions {
  /** Opens the Check panel; the import toast offers it when something is missing. */
  openCheck?: () => void;
  /** Reads ComfyUI now; the import toast offers it when no node list has been read yet. */
  syncNow?: () => void;
}

export function describeNote(note: WorkflowNote, translate: Translator, actions: NoteActions = {}): ToastInput {
  if (note.kind === 'imported') {
    const shown = shownText(note.shown, translate);
    if (note.catalogNotRead) {
      return {
        id: WORKFLOW_NOTE_ID,
        tone: 'warn',
        title: translate('workflow.openedShort'),
        description: [translate('workflow.catalogNotRead'), shown].filter(Boolean).join(' '),
        duration: 15000,
        ...(actions.syncNow ? { action: { label: translate('workflow.syncNow'), onSelect: actions.syncNow } } : {}),
      };
    }
    const missing = note.missingNodes.length > 0 || note.missingModels.length > 0;
    if (!missing) {
      return {
        id: WORKFLOW_NOTE_ID,
        tone: 'success',
        title: translate('workflow.imported', { version: note.version, nodeText: translate('workflow.noMissingNodes'), modelText: translate('workflow.noMissingModels') }),
        ...(shown ? { description: shown } : {}),
        duration: shown ? 15000 : 8000,
      };
    }
    // A count, the first names and "and N more", then what is shown differently; the button opens Check.
    const lines = [
      note.missingNodes.length > 0 ? missingText(note.missingNodes, 'Nodes', translate) : translate('workflow.noMissingNodes'),
      note.missingModels.length > 0 ? missingText(note.missingModels, 'Models', translate) : translate('workflow.noMissingModels'),
      shown,
    ].filter(Boolean);
    return {
      id: WORKFLOW_NOTE_ID,
      tone: 'warn',
      title: translate('workflow.openedShort'),
      description: lines.join(' '),
      duration: 15000,
      ...(actions.openCheck ? { action: { label: translate('workflow.openCheck'), onSelect: actions.openCheck } } : {}),
    };
  }
  if (note.kind === 'catalog') return { id: WORKFLOW_NOTE_ID, tone: 'success', title: translate('workflow.catalogImported', note) };
  if (note.kind === 'exported') {
    if (note.unset && note.unset.length > 0) {
      return {
        id: WORKFLOW_NOTE_ID,
        tone: 'warn',
        title: translate('workflow.exported'),
        description: translate('workflow.exportedUnset', { names: note.unset }),
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
