import { z } from 'zod';

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
  const origin = typeof record.comfyOrigin === 'string' ? record.comfyOrigin.trim() : record.comfyOrigin;
  if (typeof origin === 'string' && !httpOriginOrEmpty(origin)) record.comfyOrigin = '';
  return record;
}

export const nonSecretSettingsSchema = z.object({
  theme: z.literal('graphite'),
  motion: z.enum(['system', 'on', 'reduced', 'off']),
  provider: z.union([z.literal(''), z.literal('test'), z.literal('openai'), z.literal('local')]),
  model: z.string().trim().max(200),
  baseURL: z.string().trim().max(500).refine(httpOriginOrEmpty).default(''),
  comfyOrigin: z.string().trim().max(500).refine(httpOriginOrEmpty).default(''),
  language: z.enum(['en', 'ru']).default('ru'),
}).superRefine((value, ctx) => {
  if (value.provider !== 'local') return;
  if (value.baseURL === '') ctx.addIssue({ code: 'custom', path: ['baseURL'], message: 'local endpoint' });
  if (value.model.trim() === '') ctx.addIssue({ code: 'custom', path: ['model'], message: 'local model' });
});

export type NonSecretSettings = z.infer<typeof nonSecretSettingsSchema>;

export type ChatRuntimeConfig = Pick<NonSecretSettings, 'provider' | 'model' | 'baseURL'>;

export const nonSecretDefaults: NonSecretSettings = {
  theme: 'graphite',
  motion: 'system',
  provider: '',
  model: '',
  baseURL: '',
  comfyOrigin: '',
  language: 'ru',
};

export type SettingsRead =
  | { source: 'default'; values: NonSecretSettings }
  | { source: 'stored'; values: NonSecretSettings }
  | { source: 'corrupt' };

export type SecretSaveResult = { status: 'secret-storage-blocked' };
