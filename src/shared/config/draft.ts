import { nonSecretSettingsSchema } from './schema';

const SECRET_FIELD = /^(api[_-]?key|token|secret|password|authorization|credential)$/i;

const KEYISH = '(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token|secret|password|passwd|credential|private[_-]?key|client[_-]?secret)';

/**
 * Secret shapes. Where a pattern captures a prefix (group 1: "Bearer ", "api_key=", "token: "), the prefix stays
 * readable and only the value is replaced. Provider keys are anchored on a
 * word start, so "mask-like", "risk-", "task-" and "loras/mask-xl_v1" are not keys.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  // OpenAI / Anthropic style keys. Six characters after the prefix keeps short test markers ("sk-abc123") covered.
  /\bsk-(?:ant-|proj-|svcacct-|live-|test-)?[A-Za-z0-9_-]{6,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bhf_[A-Za-z0-9]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  /\b(bearer\s+)[^\s"',;]+/gi,
  /\b(authorization\s*[:=]\s*["']?basic\s+)[A-Za-z0-9+/=._-]+/gi,
  /\b(api[_-]?key\s*[:=]\s*["']?)[^\s"',;}]*/gi,
  // JSON-quoted fields keep their key and quotes, so redacted JSON still parses.
  new RegExp(`("${KEYISH}"\\s*:\\s*")[^"]+(?=")`, 'gi'),
  new RegExp(`('${KEYISH}'\\s*:\\s*')[^']+(?=')`, 'gi'),
  /[?&](?:access_token|token|key|api_key|apikey|auth|sig|signature)=[A-Za-z0-9._~%+/-]{16,}/gi,
  // A long base64 or hex run right after a key-ish word ("token: 3f9a…", "secret=QmFz…").
  new RegExp(`(\\b${KEYISH}\\w*["']?\\s*(?:[:=]|is)\\s*["']?)(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{32,}={0,2})`, 'gi'),
];

function valueCarriesSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    const found = pattern.test(value);
    pattern.lastIndex = 0;
    return found;
  });
}

/** Replaces every secret-shaped run in free text with "[redacted]". Plain prose and file names pass unchanged. */
export function redactSecrets(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (_match: string, prefix?: unknown) => (typeof prefix === 'string' ? `${prefix}[redacted]` : '[redacted]'));
  }
  return result;
}

/** True when free text holds a secret shape. */
export function textCarriesSecret(text: string): boolean {
  return typeof text === 'string' && valueCarriesSecret(text);
}

/**
 * A redactor for values this process holds (a provider key, an MCP token): every exact occurrence is replaced,
 * whatever it looks like. Values shorter than four characters are ignored so that they cannot blank ordinary text.
 */
export function exactMatchRedactor(values: ReadonlyArray<string | null | undefined>): (text: string) => string {
  const held = [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length >= 4))]
    .sort((left, right) => right.length - left.length);
  return (text: string) => {
    if (typeof text !== 'string' || held.length === 0) return text;
    let result = text;
    for (const value of held) result = result.split(value).join('[redacted]');
    return result;
  };
}

/** Same reject-before-parse check the settings repository uses. No secret is stored. */
export function carriesSecret(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_FIELD.test(key)) return true;
    if (typeof value !== 'string') continue;
    if (valueCarriesSecret(value)) return true;
  }
  return false;
}

/** Names of fields whose values match the existing secret check. */
export function secretBearingFields(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.entries(input).flatMap(([key, value]) => (
    typeof value === 'string' && valueCarriesSecret(value) ? [key] : []
  ));
}

/** A settings field a save can fail on, in the order Settings shows them. */
export type SettingsField = 'mcpUrl' | 'comfyOrigin' | 'baseURL' | 'model' | 'other';

/**
 * The fields that keep a draft from being saved: a value that carries a secret, or one the schema refuses (an
 * address that is not one, a local server without its address or model). The form marks each one, names it in
 * one sentence and opens its section, so a save that cannot happen never leaves the person guessing.
 */
export function settingsProblemFields(input: unknown): SettingsField[] {
  const known: SettingsField[] = ['mcpUrl', 'comfyOrigin', 'baseURL', 'model'];
  const found = new Set<SettingsField>();
  for (const name of secretBearingFields(input)) found.add((known as string[]).includes(name) ? name as SettingsField : 'other');
  const parsed = nonSecretSettingsSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? '');
      found.add((known as string[]).includes(name) ? name as SettingsField : 'other');
    }
  }
  return known.concat('other').filter((name) => found.has(name as SettingsField)) as SettingsField[];
}

export function settingsWriteError(input: unknown): string | null {
  if (carriesSecret(input)) return 'Settings cannot store a secret';
  if (!nonSecretSettingsSchema.safeParse(input).success) return 'Settings do not match the schema';
  return null;
}
