import type { McpAuthMode } from '../../../shared/config/schema';
import type { McpAuthProbe } from '../../../shared/contracts';
import { explainError, type Translator } from '../../../shared/i18n';

/** A made choice of how to reach the MCP server ('' in the settings means "not chosen yet"). */
export type AccessChoice = Exclude<McpAuthMode, ''>;

export const ACCESS_CHOICES: AccessChoice[] = ['none', 'token', 'oauth'];

/** What "Check" found: the choice to select (null when the server could not be asked) and one sentence for the person. */
export interface DetectionNote {
  mode: AccessChoice | null;
  text: string;
  tone: 'good' | 'bad';
}

/** Turns the server's answer into the choice to select and the sentence that says why. */
export function detectionNote(probe: McpAuthProbe, translate: Translator): DetectionNote {
  if (!probe.ok) return { mode: null, text: explainError(translate, probe.error).summary, tone: 'bad' };
  if (probe.mode === 'none') return { mode: 'none', text: translate('settings.detectedNone', { tools: probe.tools }), tone: 'good' };
  if (probe.mode === 'oauth') return { mode: 'oauth', text: translate('settings.detectedOauth'), tone: 'good' };
  return { mode: 'token', text: translate('settings.detectedToken'), tone: 'good' };
}

export interface TokenStatus {
  held: boolean;
  source: 'none' | 'session' | 'os';
  stored: boolean;
}

/** The status line under the token field: kept until restart, saved in the system storage, or none. */
export function tokenPlaceKey(status: TokenStatus): string {
  if (status.source === 'os' || status.stored) return 'settings.tokenPlaceOs';
  if (status.held) return 'settings.tokenPlaceSession';
  return 'settings.tokenPlaceNone';
}

/**
 * Whether a save should ask the server what it wants: the address changed to a non-empty one and the person has not
 * chosen an access yet, so someone who only pastes the address still ends up with the right choice.
 */
export function shouldDetectAfterSave(before: { mcpUrl: string }, after: { mcpUrl: string; mcpAuth: McpAuthMode }): boolean {
  return after.mcpAuth === '' && after.mcpUrl.trim() !== '' && after.mcpUrl.trim() !== before.mcpUrl.trim();
}
