import { probeSecretBackend } from './secretProbe';
import { secretPersistenceDecision } from '../../shared/config/secretPolicy';

export interface SecretDecision {
  persist: boolean;
  backend: string;
  reason: string;
}

let decided: SecretDecision | null = null;

/** Probes the OS secret backend once per process; every secret write in main asks this first. */
export async function secretStatus(): Promise<SecretDecision> {
  if (decided) return decided;
  const probe = await probeSecretBackend();
  const decision = secretPersistenceDecision(probe);
  decided = { persist: decision.persist, backend: probe.backend, reason: decision.reason };
  return decided;
}
