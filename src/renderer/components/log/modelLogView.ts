/**
 * How the model conversation log reads to a person: what a recorded turn is called, how it ended, how long it
 * took. Pure, so the wording rules are tested without a window (tests/unit/modelLogView.test.ts). Used by
 * ModelLogDialog.tsx and services/diagnostics/modelLog.ts.
 */
import type { ModelLogTurn } from '../../../shared/contracts/modelLog';
import { formatByteSize } from '../../../shared/i18n/format';
import { displayLocale } from '../../../shared/i18n/languages';
import { isOllamaCloudModel } from '../../../shared/config/ollamaCloud';


/** The colour of a turn's outcome badge. */
export type OutcomeTone = 'ok' | 'danger' | 'warn' | 'neutral';

/** The words and the colour for how a turn ended. Unknown values read as "not finished", never as success. */
export function outcomeView(outcome: string): { labelKey: string; tone: OutcomeTone } {
  switch (outcome) {
    case 'ok': return { labelKey: 'modelLog.outcome.ok', tone: 'ok' };
    case 'error': return { labelKey: 'modelLog.outcome.error', tone: 'danger' };
    case 'paused': return { labelKey: 'modelLog.outcome.paused', tone: 'warn' };
    case 'cancelled': return { labelKey: 'modelLog.outcome.cancelled', tone: 'neutral' };
    default: return { labelKey: 'modelLog.outcome.unfinished', tone: 'warn' };
  }
}

/**
 * Who answered, in the words the Helper settings use for the same choice. Your own server with an Ollama cloud
 * model (`model`) is named as Ollama's cloud, never as a local model.
 */
export function providerLabelKey(provider: string, model = ''): string {
  switch (provider) {
    case 'local': return isOllamaCloudModel(model) ? 'modelLog.provider.localCloud' : 'modelLog.provider.local';
    case 'openai': return 'modelLog.provider.openai';
    case 'anthropic': return 'modelLog.provider.anthropic';
    case 'google': return 'modelLog.provider.google';
    case 'compatible': return 'modelLog.provider.compatible';
    case 'test': return 'modelLog.provider.test';
    default: return 'modelLog.provider.none';
  }
}

/** What the person was doing when they asked: a question, a build, a plain chat message. */
export function intentLabelKey(intent: string): string {
  switch (intent) {
    case 'ask': return 'modelLog.intent.ask';
    case 'build': return 'modelLog.intent.build';
    case 'chat': return 'modelLog.intent.chat';
    default: return 'modelLog.intent.other';
  }
}

/** "0.4 s", "12 s", "3 min 05 s": a turn with a local model can run for minutes. */
export function durationParts(ms: number | null): { minutes: number; seconds: number; tenths: boolean } | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 10_000) return { minutes: 0, seconds: Math.round(ms / 100) / 10, tenths: true };
  const whole = Math.round(ms / 1000);
  return { minutes: Math.floor(whole / 60), seconds: whole % 60, tenths: false };
}

/** A size in the log window, never larger units than gigabytes. */
export function formatLogBytes(bytes: number, language: 'en' | 'ru'): string {
  return formatByteSize(bytes, language, undefined, 'gigabytes');
}

/** "Today, 14:32" reads faster than a date for what just happened; older turns show the day. */
export function formatTurnTime(startedAt: number, language: 'en' | 'ru', now = Date.now()): { day: 'today' | 'yesterday' | 'date'; text: string } {
  const locale = displayLocale(language);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(startedAt);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  if (startedAt >= dayStart.getTime()) return { day: 'today', text: time };
  if (startedAt >= dayStart.getTime() - 86_400_000) return { day: 'yesterday', text: time };
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(startedAt);
  return { day: 'date', text: `${date}, ${time}` };
}

/** The ids to tick for a quick choice. Turns arrive newest first. */
export function pickTurns(turns: ModelLogTurn[], choice: 'last' | 'today' | 'errors' | 'all' | 'none', now = Date.now()): string[] {
  if (choice === 'none') return [];
  if (choice === 'last') return turns.slice(0, 1).map((turn) => turn.id);
  if (choice === 'errors') return turns.filter((turn) => turn.outcome === 'error' || turn.outcome === 'unfinished').map((turn) => turn.id);
  if (choice === 'today') {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    return turns.filter((turn) => turn.startedAt >= dayStart.getTime()).map((turn) => turn.id);
  }
  return turns.map((turn) => turn.id);
}

/**
 * Fixed sentences main answers with (main/ipc/diagnosticsIpc.ts), mapped to translated ones. The strings must match
 * main's word for word. Anything else is shown as it came: it is a
 * system message about a file or a folder and says more than a generic line would.
 */
export function logErrorKey(error: string | undefined): string | null {
  switch (error) {
    case 'That turn is not in the log.': return 'modelLog.error.turnGone';
    case 'The log has no turns to save.': return 'modelLog.error.nothingToSave';
    case 'The log file could not be written.': return 'modelLog.error.writeFailed';
    case 'The log folder is not available.': return 'modelLog.error.noFolder';
    default: return null;
  }
}
