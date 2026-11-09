import type Database from 'better-sqlite3';
import { carriesSecret } from '../../shared/config/draft';
import { isUnprotectedCipher } from '../../shared/config/secretPolicy';
import {
  coerceLegacyComfyOrigin,
  nonSecretDefaults,
  nonSecretSettingsSchema,
  type NonSecretSettings,
  type SecretSaveResult,
  type SettingsRead,
} from '../../shared/config/schema';
import {
  mergePreferences,
  parsePreferences,
  preferencesCarrySecret,
  preferencesDefaults,
  preferencesSchema,
  type Preferences,
} from '../../shared/config/preferences';

type SettingsRow = {
  theme: string;
  motion: string;
  provider: string;
  model: string;
  base_url: string;
  comfy_origin: string;
  mcp_url: string;
  mcp_auth: string;
  language: string;
};

function rowToInput(row: SettingsRow): unknown {
  return {
    theme: row.theme,
    motion: row.motion,
    provider: row.provider,
    model: row.model,
    baseURL: row.base_url,
    comfyOrigin: row.comfy_origin,
    mcpUrl: row.mcp_url,
    mcpAuth: row.mcp_auth,
    language: row.language,
  };
}

export function readSettings(db: Database.Database): SettingsRead {
  const row = db.prepare('SELECT theme, motion, provider, model, base_url, comfy_origin, mcp_url, mcp_auth, language FROM settings WHERE id = 1').get() as
    | SettingsRow
    | undefined;
  const preferences = readPreferences(db);
  if (!row) {
    return { source: 'default', values: nonSecretDefaults, preferences };
  }
  const parsed = nonSecretSettingsSchema.safeParse(coerceLegacyComfyOrigin(rowToInput(row)));
  if (!parsed.success) {
    return { source: 'corrupt', preferences };
  }
  return { source: 'stored', values: parsed.data, preferences };
}

/**
 * The preferences on the settings row, whole and valid: missing or broken fields read as defaults.
 * Main-process consumers (prompt, step limit, sync) call this on each use, so a save applies to the next turn.
 */
export function readPreferences(db: Database.Database): Preferences {
  try {
    const row = db.prepare('SELECT preferences_json FROM settings WHERE id = 1').get() as { preferences_json: string } | undefined;
    return row ? parsePreferences(row.preferences_json) : parsePreferences({});
  } catch {
    // A database before v10 has no column yet.
    return JSON.parse(JSON.stringify(preferencesDefaults)) as Preferences;
  }
}

export type SettingsSaveResult =
  | { ok: true; values: NonSecretSettings; preferences: Preferences }
  | { ok: false; error: string };

/**
 * Saves the non-secret row. An optional `preferences` field is a patch merged onto the stored preferences
 * (sections merge field by field; shortcuts replace the map). Fail-closed: a secret-shaped value anywhere,
 * in the row or in the preferences, blocks the whole save before validation.
 */
export function saveSettings(db: Database.Database, input: unknown): SettingsSaveResult {
  const { preferences: patch, ...row } = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : { preferences: undefined };
  if (carriesSecret(input) || carriesSecret(row) || (patch !== undefined && preferencesCarrySecret(patch))) {
    return { ok: false, error: 'Settings cannot store a secret' };
  }
  const parsed = nonSecretSettingsSchema.safeParse(row);
  if (!parsed.success) {
    return { ok: false, error: 'Settings do not match the schema' };
  }
  let preferences = readPreferences(db);
  if (patch !== undefined) {
    const merged = preferencesSchema.safeParse(mergePreferences(preferences, patch));
    if (!merged.success || preferencesCarrySecret(merged.data)) {
      return { ok: false, error: merged.success ? 'Settings cannot store a secret' : 'Settings do not match the schema' };
    }
    preferences = merged.data;
  }
  const values = parsed.data;
  const write = db.transaction(() => {
    db.prepare(
      `INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, mcp_url, mcp_auth, language, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         theme = excluded.theme,
         motion = excluded.motion,
         provider = excluded.provider,
         model = excluded.model,
         comfy_origin = excluded.comfy_origin,
         base_url = excluded.base_url,
         mcp_url = excluded.mcp_url,
         mcp_auth = excluded.mcp_auth,
         language = excluded.language,
         updated_at = excluded.updated_at`
    ).run(
      values.theme,
      values.motion,
      values.provider,
      values.model,
      values.comfyOrigin,
      values.baseURL,
      values.mcpUrl,
      values.mcpAuth,
      values.language,
      Date.now(),
    );
    if (patch !== undefined) {
      db.prepare('UPDATE settings SET preferences_json = ? WHERE id = 1').run(JSON.stringify(preferences));
    }
  });
  write.immediate();
  return { ok: true, values, preferences };
}

export function secretRecordCount(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM secret_records').get() as { count: number };
  return row.count;
}

export function attemptSaveSecret(db: Database.Database): SecretSaveResult {
  const before = secretRecordCount(db);
  const after = secretRecordCount(db);
  if (after !== before) {
    throw new Error('secret_records changed during a blocked save');
  }
  return { status: 'secret-storage-blocked' };
}

/** Writes ciphertext only when the caller already proved an OS password manager. */
export function saveSecretIfProven(
  db: Database.Database,
  decision: { persist: boolean },
  plain: string,
  ciphertext: Buffer,
): { status: 'stored' } | SecretSaveResult {
  return saveNamedSecretIfProven(db, decision, 'provider-key', plain, ciphertext);
}

/**
 * The same fail-closed rule for any named secret record (e.g. `mcp-oauth-tokens:<origin>`): ciphertext is written
 * only after the OS password manager proved encryption, and never when it contains the plaintext or uses the
 * unprotected fallback cipher.
 */
export function saveNamedSecretIfProven(
  db: Database.Database,
  decision: { persist: boolean },
  name: string,
  plain: string,
  ciphertext: Buffer,
): { status: 'stored' } | SecretSaveResult {
  if (!decision.persist || ciphertext.includes(Buffer.from(plain)) || isUnprotectedCipher(ciphertext)) {
    return attemptSaveSecret(db);
  }
  db.prepare(
    `INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext`
  ).run(name, ciphertext);
  return { status: 'stored' };
}

export function readSecretCipher(db: Database.Database, name: string): Buffer | null {
  const row = db.prepare('SELECT ciphertext FROM secret_records WHERE name = ?').get(name) as { ciphertext: Buffer } | undefined;
  return row ? Buffer.from(row.ciphertext) : null;
}

export function forgetSecret(db: Database.Database, name: string): void {
  db.prepare('DELETE FROM secret_records WHERE name = ?').run(name);
}

export function readProviderKeyCipher(db: Database.Database): Buffer | null {
  const row = db.prepare('SELECT ciphertext FROM secret_records WHERE name = ?').get('provider-key') as
    | { ciphertext: Buffer }
    | undefined;
  return row ? Buffer.from(row.ciphertext) : null;
}

export function forgetProviderKey(db: Database.Database): void {
  db.prepare('DELETE FROM secret_records WHERE name = ?').run('provider-key');
}
