import type { Preferences } from './preferences';
import { z } from 'zod';
import { withLoopbackScheme } from '../mcp/loopback';

function httpOriginOrEmpty(value: string): boolean {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Read path only. An older row may contain a label that is not an http(s) origin. */
export function coerceLegacyComfyOrigin(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const record = { ...(input as Record<string, unknown>) };
  // `localhost:8188` (an older row) is this computer's ComfyUI without http://: it is completed, not dropped.
  const origin = typeof record.comfyOrigin === 'string' ? withLoopbackScheme(record.comfyOrigin) : record.comfyOrigin;
  if (typeof origin === 'string' && !httpOriginOrEmpty(origin)) record.comfyOrigin = '';
  return record;
}

export const nonSecretSettingsSchema = z.object({
  theme: z.literal('graphite'),
  motion: z.enum(['system', 'on', 'reduced', 'off']),
  provider: z.union([z.literal(''), z.literal('test'), z.literal('openai'), z.literal('anthropic'), z.literal('google'), z.literal('compatible'), z.literal('local')]),
  model: z.string().trim().max(200),
  // An address on this computer typed without http:// is completed (shared/mcp/loopback.ts withLoopbackScheme).
  baseURL: z.string().trim().max(500).transform(withLoopbackScheme).refine(httpOriginOrEmpty).default(''),
  comfyOrigin: z.string().trim().max(500).transform(withLoopbackScheme).refine(httpOriginOrEmpty).default(''),
  /** Streamable HTTP MCP endpoint of the ComfyUI MCP server, or empty. The token is never part of this row. */
  mcpUrl: z.string().trim().max(500).transform(withLoopbackScheme).refine(httpOriginOrEmpty).default(''),
  /**
   * How the app presents itself to the MCP server, chosen by the person in Settings ▸ Connection: 'none' sends no
   * credentials (a server that needs none), 'token' sends the pasted token, 'oauth' uses the browser sign-in.
   * '' means not chosen yet: the app offers what it holds (token, else sign-in, else nothing) until detection or
   * the person settles it. The token itself is never part of this row.
   */
  mcpAuth: z.enum(['', 'none', 'token', 'oauth']).default(''),
  language: z.enum(['en', 'ru']).default('ru'),
}).superRefine((value, ctx) => {
  // An OpenAI-compatible cloud service has no official address: its https address is the provider.
  if (value.provider === 'compatible') {
    if (!/^https:\/\//i.test(value.baseURL)) ctx.addIssue({ code: 'custom', path: ['baseURL'], message: 'compatible endpoint' });
    if (value.model.trim() === '') ctx.addIssue({ code: 'custom', path: ['model'], message: 'compatible model' });
    return;
  }
  if (value.provider !== 'local') return;
  if (value.baseURL === '') ctx.addIssue({ code: 'custom', path: ['baseURL'], message: 'local endpoint' });
  if (value.model.trim() === '') ctx.addIssue({ code: 'custom', path: ['model'], message: 'local model' });
});

export type NonSecretSettings = z.infer<typeof nonSecretSettingsSchema>;
export type McpAuthMode = NonSecretSettings['mcpAuth'];

export type ChatRuntimeConfig = Pick<NonSecretSettings, 'provider' | 'model' | 'baseURL'>;

export const nonSecretDefaults: NonSecretSettings = {
  theme: 'graphite',
  motion: 'system',
  provider: '',
  model: '',
  baseURL: '',
  comfyOrigin: '',
  mcpUrl: '',
  mcpAuth: '',
  language: 'ru',
};

/**
 * `preferences` is additive: the validated preferences model (src/shared/config/preferences.ts) read with the row.
 * Older callers ignore it.
 */
export type SettingsRead =
  | { source: 'default'; values: NonSecretSettings; preferences?: Preferences }
  | { source: 'stored'; values: NonSecretSettings; preferences?: Preferences }
  | { source: 'corrupt'; preferences?: Preferences };

export type SecretSaveResult = { status: 'secret-storage-blocked' };
