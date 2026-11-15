/**
 * Lists the settings offer to pick from instead of making the person remember and type a value
 * (Settings ▸ Assistant model and base URL, Settings ▸ Connection addresses). Every field stays free text too.
 * Main builds the lists (main/llm/modelList.ts, localDiscovery.ts, main/settings/connectionSuggestions.ts);
 * renderer/components/settings/sections/pickerItems.ts turns them into picker rows.
 */

/** One model a provider or local server listed. */
export interface ModelChoice {
  id: string;
  /** A display name when the provider gives one (Anthropic, Google). */
  label?: string;
  /** Parameter size and family, when the server says (Ollama). */
  detail?: string;
  /** Capabilities, when known (the MCP server's Ollama catalog). Undefined means unknown, not "no". */
  tools?: boolean;
  vision?: boolean;
  thinking?: boolean;
  /** The model's own maximum context window in tokens, when the server says (Ollama's /api/show). */
  contextLength?: number;
}

/**
 * The model list for a draft provider and base URL. `source` is the origin the list came from (a plain address,
 * never a key). `error` is a fixed English sentence the renderer translates.
 */
export type ModelListResult = (
  | { ok: true; models: ModelChoice[]; source: string }
  /** `dropped`: the provider refused a key pasted for this session, and main no longer holds it. */
  | { ok: false; error: string; dropped?: boolean }
) & {
  /** The address asked, with http:// added, when the draft had an address on this computer without it. */
  completedUrl?: string;
};

/** A local OpenAI-compatible server the app found: named by the MCP server, or answering on this computer. */
export interface LocalServer {
  /** The base URL to use, ending in /v1. */
  value: string;
  origin: 'mcp' | 'probe';
  /** MCP: the target name (e.g. ollama_gpu0). Probe: the server kind (Ollama, LM Studio, vLLM). */
  name: string;
  gpu?: string;
  defaultModel?: string;
  /** What the server listed, with capabilities when the MCP server gave them. */
  models: ModelChoice[];
}

/** The local model servers found, and what could not be checked. */
export interface LocalDiscovery {
  servers: LocalServer[];
  /** Fixed English sentences about sources that could not be read (e.g. the MCP server); translated in the renderer. */
  notes: string[];
}

/** Where a suggested address came from; the renderer names it. */
export type AddressSource = 'reported' | 'saved' | 'recent' | 'probe';

/** One address offered for a Connection field. */
export interface AddressSuggestion {
  value: string;
  source: AddressSource;
}

/** The addresses offered for the ComfyUI and the MCP fields. */
export interface ConnectionSuggestions {
  comfyOrigins: AddressSuggestion[];
  mcpUrls: AddressSuggestion[];
}
