import { SETTINGS_KINDS, type TurnError } from '../../../shared/agent/turnError';
import { TOOL_CAPABLE_EXAMPLES } from '../../../shared/agent/providerErrors';

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** The one plain sentence the chat says about a failed turn, with its next step. Never the server's words. */
export function turnErrorText(error: Pick<TurnError, 'kind' | 'retryAfterSeconds'>, translate: Translate): string {
  if (error.kind === 'no-tools') return translate('diagnostics.localModelNoTools', { examples: TOOL_CAPABLE_EXAMPLES.join(', ') });
  if (error.kind === 'rate' && error.retryAfterSeconds) return translate('chat.turnError.rateSeconds', { seconds: error.retryAfterSeconds });
  return translate(`chat.turnError.${error.kind}`);
}

/** The actions a failed turn offers: ask again always; the assistant settings when the fix is there. */
export function turnErrorActions(error: Pick<TurnError, 'kind'>): Array<'retry' | 'settings'> {
  return SETTINGS_KINDS.has(error.kind) ? ['retry', 'settings'] : ['retry'];
}
