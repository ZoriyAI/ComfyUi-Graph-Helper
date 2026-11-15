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

/** The words of one checklist item: what to do and, when it helps, how to see that it is done. */
export interface ItemWords {
  label: string;
  how?: string;
}

/** The words of one rubric criterion: the question, each level by id, and what to try when the answer is low. */
export interface CriterionWords {
  title: string;
  levels: Record<string, string>;
  /** Shown when a level below the top one is chosen. */
  tryNext?: string;
}

/** The words of one quiz question: the question, each choice by id, and the explanation shown after an answer. */
export interface QuestionWords {
  text: string;
  choices: Record<string, string>;
  explain: string;
}

/** The words of one step: its title and body, and the words of its items, criteria or questions. */
export interface StepWords {
  title: string;
  body: string;
  items?: Record<string, ItemWords>;
  criteria?: Record<string, CriterionWords>;
  questions?: Record<string, QuestionWords>;
}

/** One expected mistake: how a person recognises it and what to do. */
export interface MistakeWords {
  sign: string;
  fix: string;
}

/**
 * The words of the template of the new standard (schema.ts lessonStandardProblems): the one target skill, what a
 * person needs before, the expected mistakes, where the material comes from and under what terms, and what the app
 * does not check.
 */
export interface MetaWords {
  skill: string;
  requires?: string[];
  mistakes?: MistakeWords[];
  provenance?: string;
  notChecked?: string;
}

/** The words of one lesson in one language. */
export interface LessonWords {
  title: string;
  /** One line for the list: what the person ends up with. */
  result: string;
  /** By step id: a short title, and what to do and why (a small markdown: paragraphs, a list, `code`). */
  steps: Record<string, StepWords>;
  /** The words of the lesson template (standard 2). */
  meta?: MetaWords;
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
