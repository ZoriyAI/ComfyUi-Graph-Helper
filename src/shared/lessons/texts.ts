import { LESSONS_EN } from './texts.en';
import { LESSONS_RU } from './texts.ru';

/** The words of one lesson in one language. */
export interface LessonWords {
  title: string;
  /** One line for the list: what the person ends up with. */
  result: string;
  /** By step id: a short title, and what to do and why (a small markdown: paragraphs, a list, `code`). */
  steps: Record<string, { title: string; body: string }>;
}

export type LessonLanguage = 'en' | 'ru';

const WORDS: Record<LessonLanguage, Record<string, LessonWords>> = { en: LESSONS_EN, ru: LESSONS_RU };

export function lessonWords(language: string, lessonId: string): LessonWords | null {
  const table = language === 'ru' ? WORDS.ru : WORDS.en;
  return table[lessonId] ?? null;
}

const ROLE = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The roles a text names in braces. */
export function rolesIn(text: string): string[] {
  return [...text.matchAll(ROLE)].map((match) => match[1]);
}

/**
 * A step's text with each `{role}` replaced by the name of its node in bold, the way the library of this ComfyUI
 * shows it. A role nobody can name keeps the word itself, so a sentence never shows a brace.
 */
export function withNodeNames(text: string, nameOf: (role: string) => string | null): string {
  return text.replace(ROLE, (_match, role: string) => `**${(nameOf(role) ?? role).replace(/\*/g, '')}**`);
}
