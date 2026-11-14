/**
 * A cloud key belongs to the address it was pasted for. The official address of its provider unless the person
 * pasted it while their own https address was set; it is then sent there and nowhere else, and any other address
 * (a typo, a pasted "proxy") gets no key at all: the person pastes a key for that address.
 */

export type KeyProvider = 'openai' | 'anthropic' | 'google';

/** Official endpoints. Passed explicitly so an environment variable never redirects a held key. */
export const OFFICIAL_BASE: Record<KeyProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

/** Returned (never thrown at the person as is: the renderer translates it) when a key belongs to another address. */
export const KEY_OTHER_ADDRESS = 'The key was given for another address.';

export function officialOrigin(provider: KeyProvider): string {
  return new URL(OFFICIAL_BASE[provider]).origin;
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
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return null;
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
  return plain === '' ? null : { key: plain, origin: officialOrigin(provider) };
}
