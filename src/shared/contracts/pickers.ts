/**
 * Lists the settings offer to pick from instead of making the person remember and type a value
 * (Settings ▸ Assistant model and base URL, Settings ▸ Connection addresses). Every field stays free text too.
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
}

/**
 * The model list for a draft provider and base URL. `source` is the origin the list came from (a plain address,
 * never a key). `error` is a fixed English sentence the renderer translates.
 */
export type ModelListResult =
  | { ok: true; models: ModelChoice[]; source: string }
  | { ok: false; error: string };

/** A local OpenAI-compatible server the app found: named by the MCP server, or answering on this computer. */
export interface LocalServer {
  /** The base URL to use, ending in /v1. */
  value: string;
  origin: 'mcp' | 'probe';
  /** MCP: the target name (e.g. ollama_5090). Probe: the server kind (Ollama, LM Studio, vLLM). */
  name: string;
  gpu?: string;
  defaultModel?: string;
  /** What the server listed, with capabilities when the MCP server gave them. */
  models: ModelChoice[];
}

export interface LocalDiscovery {
  servers: LocalServer[];
  /** Fixed English sentences about sources that could not be read (e.g. the MCP server); translated in the renderer. */
  notes: string[];
}

/** Where a suggested address came from; the renderer names it. */
export type AddressSource = 'reported' | 'saved' | 'recent' | 'probe';

export interface AddressSuggestion {
  value: string;
  source: AddressSource;
}

export interface ConnectionSuggestions {
  comfyOrigins: AddressSuggestion[];
  mcpUrls: AddressSuggestion[];
}
