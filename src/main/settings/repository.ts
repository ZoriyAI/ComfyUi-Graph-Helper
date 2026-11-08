import type Database from 'better-sqlite3';
import { carriesSecret } from '../../shared/config/draft';
import { isUnprotectedCipher } from '../../shared/config/secretPolicy';
import {
  nonSecretDefaults,
  nonSecretSettingsSchema,
  type NonSecretSettings,
  type SecretSaveResult,
  type SettingsRead,
} from '../../shared/config/schema';

type SettingsRow = {
  theme: string;
  motion: string;
  provider: string;
  model: string;
  base_url: string;
  comfy_origin: string;
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
    language: row.language,
  };
}

export function readSettings(db: Database.Database): SettingsRead {
  const row = db.prepare('SELECT theme, motion, provider, model, base_url, comfy_origin, language FROM settings WHERE id = 1').get() as
    | SettingsRow
    | undefined;
  if (!row) {
    return { source: 'default', values: nonSecretDefaults };
  }
  const parsed = nonSecretSettingsSchema.safeParse(rowToInput(row));
  if (!parsed.success) {
    return { source: 'corrupt' };
  }
  return { source: 'stored', values: parsed.data };
}

export function saveSettings(db: Database.Database, input: unknown): { ok: true; values: NonSecretSettings } | { ok: false; error: string } {
  if (carriesSecret(input)) {
    return { ok: false, error: 'Settings cannot store a secret' };
  }
  const parsed = nonSecretSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Settings do not match the schema' };
  }
  const values = parsed.data;
  const write = db.transaction(() => {
    db.prepare(
      `INSERT INTO settings (id, theme, motion, provider, model, comfy_origin, base_url, language, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         theme = excluded.theme,
         motion = excluded.motion,
         provider = excluded.provider,
         model = excluded.model,
         comfy_origin = excluded.comfy_origin,
         base_url = excluded.base_url,
         language = excluded.language,
         updated_at = excluded.updated_at`
    ).run(
      values.theme,
      values.motion,
      values.provider,
      values.model,
      values.comfyOrigin,
      values.baseURL,
      values.language,
      Date.now(),
    );
  });
  write.immediate();
  return { ok: true, values };
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
  if (!decision.persist || ciphertext.includes(Buffer.from(plain)) || isUnprotectedCipher(ciphertext)) {
    return attemptSaveSecret(db);
  }
  db.prepare(
    `INSERT INTO secret_records (name, ciphertext) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext`
  ).run('provider-key', ciphertext);
  return { status: 'stored' };
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
