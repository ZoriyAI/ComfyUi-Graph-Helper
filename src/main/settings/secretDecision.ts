/**
 * Whether this computer can keep secrets (model keys, server tokens) in the OS password store, decided once.
 * Used by ipc.ts before every key save, the key status and the Privacy panel. The rule itself is
 * shared/config/secretPolicy.ts; the probe is secretProbe.ts. Cached because the probe round-trips the OS store.
 */
import { probeSecretBackend } from './secretProbe';
import { secretPersistenceDecision } from '../../shared/config/secretPolicy';

/** The decision: persist or not, which backend was seen, and the reason code the Privacy panel shows. */
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
