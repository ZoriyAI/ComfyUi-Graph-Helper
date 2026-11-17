/** Authored, topic-specific practice. Reusable presentation does not replace the content of each exercise. */
export interface CycleWords {
  skill: string;
  prepare: string;
  mistakes: [readonly [string, string], readonly [string, string], readonly [string, string]];
  question: string;
  /** The first answer is correct; presentation rotates its position by lesson id. */
  choices: [string, string, string];
  explain: string;
  practice: string;
  assess: [string, string];
  evidence: string;
}

export interface LessonCycle {
  prerequisites: string[];
  /** False for inspection exercises that cannot honestly require a runnable output graph. */
  run: boolean;
  sources: string[];
  en: CycleWords;
  ru: CycleWords;
}

export const CORE_SOURCE = 'https://github.com/Comfy-Org/ComfyUI';
