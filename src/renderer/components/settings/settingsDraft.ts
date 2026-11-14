/**
 * Pure helpers of the Settings draft: everything in Settings waits for Save, auto sync included; only a
 * pasted key or token applies at once (and says so next to its field).
 */

/** Settings ▸ Sync ▸ auto sync and its interval while the dialog is open. */
export interface AutoDraft {
  enabled: boolean;
  intervalMinutes: number;
}

export function sameAuto(left: AutoDraft, right: AutoDraft): boolean {
  return left.enabled === right.enabled && left.intervalMinutes === right.intervalMinutes;
}

/**
 * Whether auto sync can be switched on in the draft: only with an MCP address (main keeps it off without one).
 * Switching it off is always possible.
 */
export function autoSyncAllowed(addressSet: boolean, enabled: boolean): boolean {
  return addressSet || !enabled;
}
