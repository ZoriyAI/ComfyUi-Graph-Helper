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

export const nonSecretSettingsSchema = z.object({
  theme: z.literal('graphite'),
  motion: z.enum(['system', 'on', 'reduced', 'off']),
  provider: z.union([z.literal(''), z.literal('test'), z.literal('openai')]),
  model: z.string().trim().max(200),
  baseURL: z.string().trim().max(500).refine(httpOriginOrEmpty).default(''),
  comfyOrigin: z.string().max(500),
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
};

export type SettingsRead =
  | { source: 'default'; values: NonSecretSettings }
  | { source: 'stored'; values: NonSecretSettings }
  | { source: 'corrupt' };

export type SecretSaveResult = { status: 'secret-storage-blocked' };
