/**
 * The words of the "Could not be read" report: for each row, what it is (a model file with its folder, a model
 * folder, a catalog section), why it could not be read, and what to do, in the person's language; and the plain
 * text "Copy report" puts on the clipboard. Used by sync/UnreadableList.tsx (Sync ▸ Problems and repairs) and
 * library/ModelCard.tsx (why a model has no description). Pure functions, so the wording is tested without a window.
 * Why here and not in main: main stores codes and the server's short redacted text; the sentences live in the catalog.
 */
import type { UnreadableItem } from '../../../shared/contracts';
import type { Translator } from '../../../shared/i18n';
import { formatSyncTime } from './syncView';

/** Catalog keys of the sections main names in English. */
const SECTION_KEYS: Record<string, string> = {
  'node classes': 'sync.section.nodeClasses',
  'node packs': 'sync.section.nodePacks',
  'model files': 'sync.section.modelFiles',
};

/** What the row is: “file” in the folder “loras”, Model folder “…”, Catalog: the list of packs. */
export function rowLabel(row: UnreadableItem, t: Translator): string {
  if (row.kind === 'model') return t('sync.unread.model', { name: row.name, folder: row.directory ?? '' });
  if (row.kind === 'folder') return t('sync.unread.folder', { name: row.name });
  const key = SECTION_KEYS[row.name];
  return t('sync.unread.section', { section: key ? t(key) : row.name });
}

/** Why it could not be read, in one sentence. */
export function rowWhy(row: UnreadableItem, t: Translator): string {
  if (row.reason === 'serverError') return row.detail ? t('sync.unread.why.serverError', { detail: row.detail }) : t('sync.unread.why.serverErrorPlain');
  return t(`sync.unread.why.${row.reason}`);
}

/** What the person can do, with the time of the next try where the file is tried again by itself. */
export function rowTodo(row: UnreadableItem, t: Translator, language: 'en' | 'ru'): string {
  if (row.kind !== 'model') return t(row.reason === 'comfyDown' ? 'sync.unread.todo.comfyDown' : 'sync.unread.todo.listing');
  if (row.skipped) return t('sync.unread.todo.damaged');
  const time = row.retryAt ? formatSyncTime(row.retryAt, language) : '';
  if (row.reason === 'dropped' || row.reason === 'unreadable') return t('sync.unread.todo.damaged', { time });
  if (row.reason === 'notConnected') return t('sync.unread.todo.restart', { time });
  return t('sync.unread.todo.later', { time });
}

/**
 * The report as plain text for the clipboard: a title, the summary, then one line per row with its reason and
 * advice. It holds file and folder names (the person's own) and never the server's address.
 */
export function reportText(rows: readonly UnreadableItem[], summary: string, t: Translator, language: 'en' | 'ru'): string {
  const lines = rows.map((row) => `- ${rowLabel(row, t)}: ${rowWhy(row, t)} ${rowTodo(row, t, language)}${row.skipped ? ` ${t('sync.unread.todo.skipped')}` : ''}`);
  return [t('sync.unread.title'), summary, '', ...lines].join('\n');
}
