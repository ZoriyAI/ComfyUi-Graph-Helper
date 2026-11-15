/**
 * The rules about content, in the words of the catalog (`contentRules`), the one place they are written. Everything
 * that states them (the confirmation of the switch for adult content, the lessons for adults, the page
 * Help ▸ Content rules, held to these words by a test) takes them from here, so they cannot drift apart.
 * Read by Settings ▸ Privacy (PrivacySection.tsx) and the lesson texts (lessons/texts.en.ts, texts.ru.ts).
 */
import { en, ru } from '../i18n/catalog';
/** The five points, in their order. */
export const CONTENT_RULE_POINTS = ['minors', 'realPeople', 'violence', 'animals', 'law'] as const;

/** The rules in one language, ready to show as a sentence, a list and a closing sentence. */
export interface ContentRules {
  /** The sentence before the list. */
  lead: string;
  /** The five points, each with its own closing mark. */
  points: string[];
  /** The sentence after the list. */
  after: string;
}

/** The rules in `language`; any language other than Russian gets English. */
export function contentRules(language: string): ContentRules {
  const words = language === 'ru' ? ru.contentRules : en.contentRules;
  return { lead: words.lead, points: CONTENT_RULE_POINTS.map((point) => words[point]), after: words.after };
}

/** The same as a small markdown: the sentence, the list, the closing sentence. */
export function contentRulesMarkdown(language: string): string {
  const rules = contentRules(language);
  return `${rules.lead}\n${rules.points.map((point) => `- ${point}`).join('\n')}\n\n${rules.after}`;
}
