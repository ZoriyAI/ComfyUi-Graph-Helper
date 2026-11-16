/** Reported by the configured Ollama server, never inferred from the desktop's own hardware. */
export interface LoadedLocalModel { name: string; bytes: number | null; vramBytes: number | null; contextTokens: number | null }
export type LocalModelStatus = { ok: true; models: LoadedLocalModel[]; at: number } | { ok: false; error: string };
export type LocalModelAction = 'load' | 'unload';
export type LocalGenerationStyle = 'model' | 'focused' | 'creative';
/** Explicit optional overrides. Inherit everything else, including the model's own template and stop tokens. */
export const LOCAL_GENERATION_STYLES: Record<LocalGenerationStyle, Record<string, number>> = {
  model: {}, focused: { temperature: 0.2, top_p: 0.9 }, creative: { temperature: 0.9, top_p: 0.95 },
};
