import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { en, ru } from '../../src/shared/i18n/catalog';
import { rolesOf, type LessonGraph, type LessonNode } from '../../src/shared/lessons/engine';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { lessonWords } from '../../src/shared/lessons/texts';
import { nodeLabel } from '../../src/renderer/components/lessons/lackText';
import { useGraphStore } from '../../src/renderer/state/graphState';

/**
 * The part a node plays, said after its name in "Still to do" when two nodes of one class stand on the canvas
 * (lackText.ts nodeLabel). The label comes from the lesson (texts LessonWords.roles) and falls back to the shared
 * catalog label of the role's name. A shared label is written for the common meaning of a name and read wrong in
 * lessons that used the name for something else (the face picture of a face swap was called "video"), so every
 * role that can have a twin in a lesson has a label of that lesson, or is on the list below, checked by hand.
 */

/**
 * Roles whose shared label is true where they have twins: '*' for a name that means one thing in every lesson,
 * else the lessons where the shared label was read against the lesson's own text and holds.
 */
const SHARED_LABEL_HOLDS: Readonly<Record<string, '*' | readonly string[]>> = {
  // A prompt and a negative prompt are that in every lesson.
  positive: '*',
  negative: '*',
  // The Wan 2.2 pair of high and low noise: the first and the second pass, by the very name of the role.
  high: '*',
  low: '*',
  shiftHigh: '*',
  shiftLow: '*',
  loraHigh: '*',
  loraLow: '*',
  vaceHigh: '*',
  vaceLow: '*',
  // The two samplers of a Wan 2.2 pair are its first and second pass.
  first: ['video-text', 'video-image', 'video-fast', 'wrapper', 'wrapper-image', 'wrapper-vace'],
  second: ['video-text', 'video-image', 'video-fast', 'wrapper', 'wrapper-image', 'wrapper-vace'],
  // Refining really has two models: the shared "first model" / "of the second model" labels were written for it.
  checkpoint: ['refine'],
  checkpointB: ['refine'],
  positiveB: ['refine'],
  negativeB: ['refine'],
  sampler: ['refine'],
  samplerB: ['refine'],
  decode: ['refine', 'two-models'],
  decodeB: ['refine'],
  save: ['refine'],
  saveB: ['refine'],
  // Two models, a video and its first frame: "decoder" against "decoder of the frame".
  imagePositive: ['two-models'],
  imageNegative: ['two-models'],
  imageDecode: ['two-models'],
  // Two voices; the prompt against what the sound must not be; the VAE against the sound VAE.
  voice: ['wrapper-duo'],
  voice2: ['wrapper-duo'],
  text: ['wrapper-ovi'],
  soundNo: ['wrapper-ovi'],
  vae: ['video-ltx'],
  soundVae: ['video-ltx'],
};

/** The roles of a lesson that share a node class with another of its roles: those can stand twice on the canvas. */
function twinRoles(lesson: (typeof LESSONS)[number]): string[] {
  const specs = rolesOf(lesson);
  return [...new Set(specs.filter((spec) => specs.some((other) => other.role !== spec.role && other.classes.some((item) => spec.classes.includes(item)))).map((spec) => spec.role))];
}

describe('role labels in "Still to do"', () => {
  it('gives every role that can have a twin a label of its lesson, or a shared one checked for that lesson', () => {
    const unlabelled: string[] = [];
    for (const lesson of LESSONS) {
      for (const role of twinRoles(lesson)) {
        for (const language of ['en', 'ru'] as const) {
          if (lessonWords(language, lesson.id)?.roles?.[role]) continue;
          const holds = SHARED_LABEL_HOLDS[role];
          const shared = ((language === 'ru' ? ru : en).lessons.role as Record<string, string>)[role];
          if (shared && (holds === '*' || holds?.includes(lesson.id))) continue;
          unlabelled.push(`${language} ${lesson.id}: ${role}`);
        }
      }
    }
    expect(unlabelled).toEqual([]);
  });

  it('labels only roles the lesson brings, the same ones in both languages', () => {
    for (const lesson of LESSONS) {
      const brought = new Set(rolesOf(lesson).map((spec) => spec.role));
      const enRoles = Object.keys(lessonWords('en', lesson.id)?.roles ?? {}).sort();
      const ruRoles = Object.keys(lessonWords('ru', lesson.id)?.roles ?? {}).sort();
      expect(ruRoles, lesson.id).toEqual(enRoles);
      expect(enRoles.filter((role) => !brought.has(role)), lesson.id).toEqual([]);
    }
  });

  it('says the lesson\'s own label after a twin\'s name, and the shared one without it', () => {
    const t = i18next.createInstance();
    void t.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
    const make = (id: string): LessonNode => ({ id, classType: 'LoadImage', inputs: [], outputs: [], values: {} });
    const graph: LessonGraph = { nodes: [make('a'), make('b')], links: [] };
    useGraphStore.setState({ nodes: graph.nodes.map((node) => ({ id: node.id, type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'LoadImage', title: 'Load Image', inputs: [], outputs: [], parameters: {} } })) } as never);
    const base = { details: {}, graph, facts: {}, roles: { target: 'a', source: 'b' }, language: 'en' };
    const words = lessonWords('en', 'face-swap')!;
    expect(nodeLabel(t.t.bind(t) as never, 'b', { ...base, roleLabels: words.roles })).toBe('Load Image (picture with the face)');
    expect(nodeLabel(t.t.bind(t) as never, 'a', { ...base, roleLabels: words.roles })).toBe('Load Image (picture to change)');
    // Without the lesson's words the shared label of the role's name is said, as before.
    expect(nodeLabel(t.t.bind(t) as never, 'b', base)).toBe('Load Image (video)');
  });
});
