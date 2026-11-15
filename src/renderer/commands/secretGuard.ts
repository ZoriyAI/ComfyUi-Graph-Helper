/**
 * The question about key-like fields before a workflow or project file is written.
 *
 * Who uses it: commands/actions.ts opens it when main refuses a save because of such fields;
 * components/shell/CommandDialogs.tsx draws the dialog and repeats the save with the person's answer.
 * Why: a workflow file is often shared, and an API key typed into a node must not leave the computer unasked.
 */
import { create } from 'zustand';

/** A field that looks like a key or token, as main reports it before writing a file (never the value). */
export interface SecretFieldItem {
  nodeId: string;
  classType: string;
  title: string;
  name: string;
}

/** Which save is waiting: File ▸ Export (the ComfyUI workflow) or File ▸ Save project. */
export type SecretGuardTarget = 'workflow' | 'project';

interface SecretGuardState {
  /** The file waiting for the person's answer, and the fields that made it wait; null when nothing waits. */
  pending: { target: SecretGuardTarget; fields: SecretFieldItem[] } | null;
  ask: (target: SecretGuardTarget, fields: SecretFieldItem[]) => void;
  clear: () => void;
}

/** "Save workflow for ComfyUI" and "Save project": the question about key-like fields before the file is written. */
export const useSecretGuardStore = create<SecretGuardState>((set) => ({
  pending: null,
  ask: (target, fields) => set({ pending: { target, fields } }),
  clear: () => set({ pending: null }),
}));

/** How a field is named in the question: the node's title (or class) and the field. */
export function secretFieldLabel(field: SecretFieldItem): string {
  const node = field.title || field.classType || `#${field.nodeId}`;
  return `${node} · ${field.name}`;
}
