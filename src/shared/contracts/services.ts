import { z } from 'zod';

export type ServiceScope = 'user' | 'system';
export type ServiceKind = 'comfyui' | 'mcp' | 'ollama' | 'llamacpp' | 'lmstudio';
export type ServiceAction = 'start' | 'stop' | 'restart';
export type ServiceState = 'running' | 'stopped' | 'failed' | 'starting' | 'stopping' | 'unknown';
export interface LocalService {
  id: string; revision: string; unit: string; scope: ServiceScope; kind: ServiceKind;
  state: ServiceState; memoryBytes: number | null; restarts: number | null;
  canStart: boolean; canStop: boolean;
}
export interface ServicesStatus {
  supported: boolean; host: string; at: number; services: LocalService[];
  unavailableScopes: ServiceScope[];
}
export const serviceActionSchema = z.object({
  id: z.string().min(1).max(240), revision: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(['start', 'stop', 'restart']),
}).strict();
export type ServiceActionRequest = z.infer<typeof serviceActionSchema>;
export type ServiceActionResult = { ok: true; status: ServicesStatus } | {
  ok: false; error: 'invalid' | 'unavailable' | 'changed' | 'busy' | 'authorization' | 'timeout' | 'failed' | 'unconfirmed';
  status?: ServicesStatus;
};
