import type { McpAuthMode } from '../../../shared/config/schema';
import type { McpAuthProbe, McpTokenStatus, SyncStatus } from '../../../shared/contracts';
import { explainError, type Translator } from '../../../shared/i18n';

/** The stored sentence for a 401 to a connection without credentials (main/mcp/client.ts MCP_NEEDS_SIGN_IN). */
export const NEEDS_SIGN_IN = 'MCP server requires sign-in.';

/** A made choice of how to reach the MCP server ('' in the settings means "not chosen yet"). */
export type AccessChoice = Exclude<McpAuthMode, ''>;

export const ACCESS_CHOICES: AccessChoice[] = ['none', 'token', 'oauth'];

/** What "Check" found: the choice to select (null when the server could not be asked) and one sentence for the person. */
export interface DetectionNote {
  mode: AccessChoice | null;
  text: string;
  tone: 'good' | 'bad';
  /** The address with http:// added, when the person typed an address on this computer without it. */
  completedUrl?: string;
}

/** Turns the server's answer into the choice to select and the sentence that says why. */
export function detectionNote(probe: McpAuthProbe, translate: Translator): DetectionNote {
  const note = noteOf(probe, translate);
  if (!probe.completedUrl) return note;
  return { ...note, completedUrl: probe.completedUrl, text: `${translate('settings.addressCompleted')} ${note.text}` };
}

function noteOf(probe: McpAuthProbe, translate: Translator): DetectionNote {
  if (!probe.ok) return { mode: null, text: explainError(translate, probe.error).summary, tone: 'bad' };
  // The server let the app in, but lists none of the tools of a kind the app reads: never a green "connected".
  if ((probe.mode === 'none' || probe.mode === 'token') && probe.profile === null) {
    return { mode: probe.mode, text: translate('settings.mcpProfile.unknown'), tone: 'bad' };
  }
  const kind = (probe.mode === 'none' || probe.mode === 'token') && probe.profile ? ` ${translate(`settings.mcpProfile.${probe.profile}`)}` : '';
  const known = noteOfAccess(probe, translate);
  return kind && known.tone === 'good' ? { ...known, text: `${known.text}${kind}` } : known;
}

function noteOfAccess(probe: Extract<McpAuthProbe, { ok: true }>, translate: Translator): DetectionNote {
  if (probe.mode === 'none') return { mode: 'none', text: translate('settings.detectedNone', { tools: probe.tools }), tone: 'good' };
  if (probe.mode === 'oauth') return { mode: 'oauth', text: translate('settings.detectedOauth'), tone: 'good' };
  // A held token was tried against the 401: say whether the server took it, not only that it wants one.
  if (probe.tokenAccepted === true) return { mode: 'token', text: translate('settings.detectedTokenAccepted', { tools: probe.tools ?? 0 }), tone: 'good' };
  if (probe.tokenAccepted === false) return { mode: 'token', text: translate('settings.detectedTokenRejected'), tone: 'bad' };
  return { mode: 'token', text: translate('settings.detectedToken'), tone: 'good' };
}

export type TokenStatus = McpTokenStatus;

/** The status line under the token field: where the token lives, or that there is none. */
export function tokenPlaceKey(status: TokenStatus): string {
  if (status.source === 'os' || status.stored) return 'settings.tokenPlaceOs';
  if (status.source === 'file' || status.inFile) return 'settings.tokenPlaceFile';
  if (status.held) return 'settings.tokenPlaceSession';
  return 'settings.tokenPlaceNone';
}

/**
 * A sync or read error as a sentence about the person's own situation: when the server asked for a sign-in and
 * "Token" is chosen, the fix is to paste the token; with "Sign in through the browser", to sign in; otherwise the
 * general sentence. Every other error keeps its own translation.
 */
export function accessErrorText(
  error: string,
  status: Pick<SyncStatus, 'authChoice' | 'tokenHeld' | 'signedIn'> | null,
  translate: Translator,
  /** Settings ▸ Connection has the token field right above; anywhere else the sentence names where it is. */
  place: 'settings' | 'elsewhere' = 'settings',
): string {
  if (error === NEEDS_SIGN_IN && status) {
    if (status.authChoice === 'token') return translate(status.tokenHeld ? 'errors.mcpToken' : place === 'settings' ? 'settings.needsTokenPasted' : 'sync.needsToken');
    if (status.authChoice === 'oauth' && !status.signedIn) return translate('sync.needsBrowser');
  }
  return explainError(translate, error).summary;
}

/**
 * Whether a save should ask the server what it wants: the address changed to a non-empty one and the person has not
 * chosen an access yet, so someone who only pastes the address still ends up with the right choice.
 */
export function shouldDetectAfterSave(before: { mcpUrl: string }, after: { mcpUrl: string; mcpAuth: McpAuthMode }): boolean {
  return after.mcpAuth === '' && after.mcpUrl.trim() !== '' && after.mcpUrl.trim() !== before.mcpUrl.trim();
}
