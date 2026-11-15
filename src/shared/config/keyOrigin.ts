/**
 * A cloud key belongs to the address it was pasted for. The official address of its provider unless the person
 * pasted it while their own https address was set; it is then sent there and nowhere else, and any other address
 * (a typo, a pasted "proxy") gets no key at all: the person pastes a key for that address.
 * Main applies it when it stores and sends a key (main/settings/repository.ts, keyFile.ts, main/llmService.ts,
 * main/ipc.ts); Settings ▸ Assistant shows which address a key belongs to (KeyPanel.tsx).
 */

/**
 * Every provider a key can be held for. The three big companies have an official address; "compatible" is any cloud
 * service that speaks the OpenAI chat completions interface (a gateway, a regional provider) and has no official
 * address: its key always belongs to the https address the person typed. "local" is the person's own server, which
 * asks for a key only sometimes (vLLM with --api-key, LiteLLM, LM Studio with authentication on).
 */
export const KEY_PROVIDERS = ['openai', 'anthropic', 'google', 'compatible', 'local'] as const;
export type KeyProvider = typeof KEY_PROVIDERS[number];
/** The providers that answer from the internet and need a key on every request. */
export const CLOUD_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'compatible'] as const;
export type CloudProviderId = typeof CLOUD_PROVIDER_IDS[number];
/** The three with an official address. */
export type OfficialProvider = 'openai' | 'anthropic' | 'google';

/** Type guard for a provider name that came over IPC or from storage. */
export function isKeyProvider(value: unknown): value is KeyProvider {
  return typeof value === 'string' && (KEY_PROVIDERS as readonly string[]).includes(value);
}

/** Official endpoints. Passed explicitly so an environment variable never redirects a held key. */
export const OFFICIAL_BASE: Record<OfficialProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

/** True for the providers with an official address (OFFICIAL_BASE). */
export function hasOfficialBase(provider: KeyProvider): provider is OfficialProvider {
  return provider === 'openai' || provider === 'anthropic' || provider === 'google';
}

/** Returned (never thrown at the person as is: the renderer translates it) when a key belongs to another address. */
export const KEY_OTHER_ADDRESS = 'The key was given for another address.';

/** The official origin, or null for a provider that has none (compatible, local). */
export function officialOrigin(provider: KeyProvider): string | null {
  return hasOfficialBase(provider) ? new URL(OFFICIAL_BASE[provider]).origin : null;
}

/**
 * The origin a base URL sends to: the official one for an empty base, the base's own for an https address without
 * user info, null for anything else (http, user info, not an address): no key is ever bound to or sent there.
 */
export function keyOriginFor(provider: KeyProvider, base: string | null | undefined): string | null {
  const trimmed = base?.trim() ?? '';
  if (trimmed === '') return officialOrigin(provider);
  try {
    const url = new URL(trimmed);
    if (url.username !== '' || url.password !== '') return null;
    // The person's own server may answer on http (this computer, the home network); a cloud key needs https.
    const allowed = provider === 'local' ? url.protocol === 'https:' || url.protocol === 'http:' : url.protocol === 'https:';
    if (!allowed) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * What a remembered key record holds. A key for the official address is stored as the bare key (as every key was
 * before addresses were remembered, so an old record means the official address); a key for another address is
 * stored with it.
 */
export function encodeKeyRecord(provider: KeyProvider, key: string, origin: string): string {
  return origin === officialOrigin(provider) ? key : JSON.stringify({ v: 2, key, origin });
}

/** The key and its address from a stored record, or null when the record is empty or its address is not allowed. */
export function decodeKeyRecord(provider: KeyProvider, plain: string): { key: string; origin: string } | null {
  if (plain.startsWith('{')) {
    try {
      const parsed = JSON.parse(plain) as { v?: unknown; key?: unknown; origin?: unknown };
      if (parsed.v === 2 && typeof parsed.key === 'string' && parsed.key !== '' && typeof parsed.origin === 'string') {
        const origin = keyOriginFor(provider, parsed.origin);
        return origin ? { key: parsed.key, origin } : null;
      }
    } catch {
      // Not a record of ours: read as a bare key below.
    }
  }
  const official = officialOrigin(provider);
  // A bare key means the official address; a provider without one never had a bare record.
  return plain === '' || !official ? null : { key: plain, origin: official };
}
