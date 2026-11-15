/**
 * The words of the built-in lessons in both languages, looked up by lesson id, and the helpers that put node names
 * into a step's text. Used by the lesson panel (renderer/components/lessons/LessonPanel.tsx, lackText.ts), the menu
 * bar, and share/builtin.ts and share/mine.ts. The words live apart from the lesson rules (lessons.ts, sets/*.ts) so
 * one rule set serves both languages, and tests/unit/lessonTexts.test.ts checks the numbers in the words against the
 * rules.
 */
import { LESSONS_EN } from './texts.en';
import { LESSONS_RU } from './texts.ru';
import { VIDEO_LESSONS_EN } from './sets/video.texts.en';
import { VIDEO_LESSONS_RU } from './sets/video.texts.ru';
import { FOUNDATIONS_LESSONS_EN } from './sets/foundations.texts.en';
import { FOUNDATIONS_LESSONS_RU } from './sets/foundations.texts.ru';
import { REASONS_EN } from './reasons.en';
import { REASONS_RU } from './reasons.ru';

/** The words of one lesson in one language. */
export interface LessonWords {
  title: string;
  /** One line for the list: what the person ends up with. */
  result: string;
  /** By step id: a short title, and what to do and why (a small markdown: paragraphs, a list, `code`). */
  steps: Record<string, { title: string; body: string }>;
  /**
   * By role: what that node is in THIS lesson, said in "Still to do" after a node's name when two nodes of one class
   * stand on the canvas. A role without an entry falls back to the shared label (catalog lessons.role), which is
   * written for the common meaning of the role's name; a lesson whose node means something else there (the face
   * picture of a face swap is not a "video") names it here.
   */
  roles?: Record<string, string>;
}

/** The languages the lessons are written in; any other interface language reads the English words. */
export type LessonLanguage = 'en' | 'ru';

// texts.en.ts and texts.ru.ts already spread the image-models, image-techniques and sound-3d-faces sets.
const WORDS: Record<LessonLanguage, Record<string, LessonWords>> = {
  en: { ...LESSONS_EN, ...VIDEO_LESSONS_EN, ...FOUNDATIONS_LESSONS_EN },
  ru: { ...LESSONS_RU, ...VIDEO_LESSONS_RU, ...FOUNDATIONS_LESSONS_RU },
};

/** The words of a lesson in the person's language (English for any language but Russian); null for an unknown id. */
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

/** Why a step asks for a value (FieldSpec.why), in the person's language; null for an id nobody wrote. */
export function lessonReason(language: string, id: string): string | null {
  return (language === 'ru' ? REASONS_RU : REASONS_EN)[id] ?? null;
}
