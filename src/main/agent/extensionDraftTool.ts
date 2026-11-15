import { jsonSchema } from 'ai';
import { extensionDrafts, type ExtensionDrafts } from '../extensions/drafts';
import { MAIN_TOOL_SPECS } from './toolSpecs';

export function createExtensionDraftTool(signal?: AbortSignal, drafts: ExtensionDrafts = extensionDrafts) {
  return {
    description: MAIN_TOOL_SPECS.draftExtension.description,
    inputSchema: jsonSchema(MAIN_TOOL_SPECS.draftExtension.parameters as Parameters<typeof jsonSchema>[0]),
    execute: async (input: unknown) => {
      if (signal?.aborted) return { success: false, error: 'Cancelled; no draft created.' };
      try {
        const draft = drafts.add(input);
        return { success: true, extensionDraftId: draft.id, name: draft.name, files: draft.files.map((f) => f.path), verification: draft.verification, message: 'Source-only draft shown for review and ZIP download. Python has not been compiled or executed. No installation or dependencies changed. It becomes an available node only after the person reviews, installs in ComfyUI, restarts and synchronizes the catalog.' };
      } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Invalid extension source package.' }; }
    },
  };
}
