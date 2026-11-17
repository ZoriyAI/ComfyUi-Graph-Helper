/** A source-only custom-node package. Format validation never means Python or runtime acceptance. */
export interface ExtensionSource { path: string; content: string }
export interface ExtensionProposal {
  slug: string;
  name: string;
  purpose: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  dependencies: string[];
  files: ExtensionSource[];
}
export interface ExtensionDraft extends ExtensionProposal {
  id: string;
  /** Saved for review across restarts; false when chat storage is disabled. */
  persistent?: boolean;
  createdAt: number;
  origin: 'assistant' | 'starter';
  verification: 'source-only';
  archiveBase64: string;
}
