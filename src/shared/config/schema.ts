import { z } from 'zod';

export const nonSecretSettingsSchema = z.object({
  theme: z.literal('graphite'),
  motion: z.enum(['system', 'on', 'off']),
  provider: z.union([z.literal(''), z.literal('test'), z.literal('openai')]),
  model: z.string().max(200),
  comfyOrigin: z.string().max(500),
});

export type NonSecretSettings = z.infer<typeof nonSecretSettingsSchema>;

export const nonSecretDefaults: NonSecretSettings = {
  theme: 'graphite',
  motion: 'system',
  provider: '',
  model: '',
  comfyOrigin: '',
};

export type SettingsRead =
  | { source: 'default'; values: NonSecretSettings }
  | { source: 'stored'; values: NonSecretSettings }
  | { source: 'corrupt' };

export type SecretSaveResult = { status: 'secret-storage-blocked' };
