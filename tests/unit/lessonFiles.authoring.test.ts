/**
 * "Make a lesson from this graph": a graph a person built becomes a lesson whose steps build it again from an empty
 * canvas, in an order a person can follow (a node after what feeds it). The proposed lesson reads as a lesson file,
 * can be done from an empty canvas, keeps only the values the person said matter, and an edit that breaks it says
 * which step.
 */

import { describe, expect, it } from 'vitest';
import { LESSONS, lessonById } from '../../src/shared/lessons/lessons';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { buildOrder, changeDraftLanguage, docFromDraft, draftFromDoc, draftFromGraph, lessonIdFrom, roleNameOf, withoutDraftLanguage, type ClassInfo } from '../../src/shared/lessons/share/authoring';
import { LESSON_FILE_FORMAT, LESSON_FILE_VERSION, lessonFileVersion, readLessonFile } from '../../src/shared/lessons/share/format';
import { checkLessonDoc } from '../../src/shared/lessons/share/mine';
import { lessonShapes, tryLesson, type ClassShapes } from '../../src/shared/lessons/share/tryLesson';
import type { LessonGraph } from '../../src/shared/lessons/engine';

/** The first built-in lesson, done on a canvas: the graph a person would make a lesson from. */
function builtGraph(): { graph: LessonGraph; shapes: ClassShapes } {
  const lesson = lessonById('image')!;
  const base = lessonShapes([lesson]);
  // The canvas the try leaves behind, with a seed and a model file as a real graph has them.
  const shapes: ClassShapes = (classType) => {
    const shape = base(classType);
    if (!shape) return null;
    if (classType === 'KSampler') return { ...shape, inputs: [...shape.inputs, { name: 'seed', type: 'INT', value: 42 }, { name: 'steps', type: 'INT', value: 20 }] };
    return shape;
  };
  // The try sees the canvas before every action and once more at the end: the last one is the finished graph.
  let graph: LessonGraph = { nodes: [], links: [] };
  expect(tryLesson(lesson, shapes, { observe: (seen) => { graph = seen; } }).ok).toBe(true);
  return { graph, shapes };
}

const info = (classType: string): ClassInfo => ({
  displayName: classType,
  fields: classType === 'CheckpointLoaderSimple' ? { ckpt_name: { kind: 'combo', modelDirectory: 'checkpoints' } }
    : classType === 'CLIPTextEncode' ? { text: { kind: 'string', multiline: true } }
      : classType === 'KSampler' ? { seed: { kind: 'int' }, steps: { kind: 'int' } } : {},
});

describe('a lesson from the graph on the canvas', () => {
  it('names roles after their class and orders nodes so each comes after what feeds it', () => {
    expect(roleNameOf('CLIPTextEncode')).toBe('clipTextEncode');
    expect(roleNameOf('KSampler')).toBe('kSampler');
    expect(roleNameOf('VAEDecode')).toBe('vaeDecode');
    expect(roleNameOf('3DLoader!')).toBe('dLoader');
    const graph: LessonGraph = {
      nodes: [
        { id: 'save', classType: 'SaveImage', inputs: [{ id: 'i', name: 'images', type: 'IMAGE' }], outputs: [], values: {} },
        { id: 'load', classType: 'LoadImage', inputs: [], outputs: [{ id: 'o', name: 'IMAGE', type: 'IMAGE' }], values: {} },
      ],
      links: [{ from: 'load', fromPort: 'o', to: 'save', toPort: 'i' }],
    };
    expect(buildOrder(graph).map((node) => node.id)).toEqual(['load', 'save']);
  });

  it('proposes a lesson that reads as a lesson file and can be done from an empty canvas', () => {
    const { graph, shapes } = builtGraph();
    const model = draftFromGraph(graph, info, 'en')!;
    expect(model.steps[0]).toMatchObject({ id: 'intro', read: true });
    expect(model.steps).toHaveLength(graph.nodes.length + 1);
    // The model file and the description matter by default; the seed is offered, off.
    const fields = model.steps.flatMap((step) => step.fields);
    expect(fields.find((item) => item.spec.field === 'ckpt_name')).toMatchObject({ on: true, spec: { test: { kind: 'chosen' } } });
    expect(fields.find((item) => item.spec.field === 'seed')).toMatchObject({ on: false, spec: { test: { kind: 'equals', value: 42 } } });
    // Every link of the graph is asked for once, by the step of the node it goes into.
    expect(model.steps.flatMap((step) => step.links)).toHaveLength(graph.links.length);
    model.title = 'My first picture';
    model.result = 'A picture from a text.';
    const doc = docFromDraft({ ...model, id: lessonIdFrom(model.title) });
    expect(doc.id).toBe('my-first-picture');
    expect(doc.texts.en!.steps['step-1'].title).toMatch(/^Add \{/);
    expect(readLessonFile({ format: LESSON_FILE_FORMAT, version: LESSON_FILE_VERSION, lessons: [doc] }).ok).toBe(true);
    expect(checkLessonDoc(doc)).toEqual({ ok: true });
    // Tried with the classes of "this ComfyUI" too: the shapes the graph was built with.
    expect(checkLessonDoc(doc, () => null, shapes)).toEqual({ ok: true });
    // A value the person says matters becomes a rule "Do this for me" sets.
    const seed = model.steps.find((step) => step.fields.some((item) => item.spec.field === 'seed'))!;
    seed.fields = seed.fields.map((item) => (item.spec.field === 'seed' ? { ...item, on: true } : item));
    const strict = docFromDraft({ ...model, id: 'strict' });
    expect(strict.steps.flatMap((step) => step.fields ?? []).some((spec) => spec.field === 'seed')).toBe(true);
    expect(checkLessonDoc(strict)).toEqual({ ok: true });
  });

  it('writes the words in Russian when asked', () => {
    const { graph } = builtGraph();
    const model = draftFromGraph(graph, info, 'ru')!;
    expect(model.steps[1].title).toMatch(/^Добавьте \{/);
    const doc = docFromDraft({ ...model, title: 'Урок', id: lessonIdFrom('Урок', 0) });
    expect(doc.id).toBe('lesson-0');
    expect(Object.keys(doc.texts)).toEqual(['ru']);
  });

  it('says which step cannot be done after an edit breaks the lesson', () => {
    const { graph } = builtGraph();
    const model = draftFromGraph(graph, info, 'en')!;
    model.title = 'Broken';
    // Taking away the step that adds the loader leaves the links into it with nothing to start from.
    const broken = { ...model, steps: model.steps.filter((_step, index) => index !== 1) };
    const check = checkLessonDoc(docFromDraft(broken));
    expect(check).toMatchObject({ ok: false, problem: { code: 'unknown-role' } });
  });

  it('opens one of My lessons for editing and saves it back unchanged', () => {
    const { graph } = builtGraph();
    const model = draftFromGraph(graph, info, 'en')!;
    const doc = docFromDraft({ ...model, title: 'Round trip', id: 'round-trip' });
    expect(docFromDraft(draftFromDoc(doc, 'en'))).toEqual(doc);
  });

  it('proposes nothing for an empty canvas', () => {
    expect(draftFromGraph({ nodes: [], links: [] }, info, 'en')).toBeNull();
  });

  it.each(LESSONS.map((lesson) => [lesson.id]))('keeps both languages, every rule and the file version when editing %s without changes', (id) => {
    const doc = builtinLessonDoc(id)!;
    expect(doc.texts.en).toBeDefined();
    expect(doc.texts.ru).toBeDefined();
    for (const language of ['en', 'ru'] as const) {
      const saved = docFromDraft(draftFromDoc(doc, language));
      expect(saved).toEqual(doc);
      expect(lessonFileVersion([saved])).toBe(lessonFileVersion([doc]));
    }
  });

  it('changes only the chosen title and keeps role labels and all other words', () => {
    const doc = builtinLessonDoc('one-factor')!;
    const model = draftFromDoc(doc, 'en');
    const saved = docFromDraft({ ...model, title: 'A changed title' });
    expect(saved).toEqual({ ...doc, texts: { ...doc.texts, en: { ...doc.texts.en!, title: 'A changed title' } } });
  });

  it('removes deleted steps from every language and refuses missing translations of new steps', () => {
    const doc = builtinLessonDoc('image')!;
    const model = draftFromDoc(doc, 'en');
    const removed = model.steps[0].id;
    const saved = docFromDraft({ ...model, steps: model.steps.slice(1) });
    expect(saved.texts.en!.steps[removed]).toBeUndefined();
    expect(saved.texts.ru!.steps[removed]).toBeUndefined();
    const added = docFromDraft({ ...model, steps: [...model.steps, { id: 'extra', read: true, title: 'More', body: 'Read.', roles: [], links: [], fields: [] }] });
    expect(added.texts.ru).toEqual(doc.texts.ru);
    expect(checkLessonDoc(added)).toMatchObject({ ok: false, problem: { code: 'missing-words', language: 'ru', step: 'extra' } });
  });

  it('loads the chosen language and retains edits when switching back, without relabelling words', () => {
    const doc = builtinLessonDoc('image')!;
    const english = { ...draftFromDoc(doc, 'en'), title: 'Changed English' };
    const russian = changeDraftLanguage(english, 'ru');
    expect(russian.title).toBe(doc.texts.ru!.title);
    expect(russian.steps[0].body).toBe(doc.texts.ru!.steps[russian.steps[0].id].body);
    const back = changeDraftLanguage({ ...russian, title: 'Changed Russian' }, 'en');
    expect(back.title).toBe('Changed English');
    expect(docFromDraft(back).texts.ru!.title).toBe('Changed Russian');
    const without = withoutDraftLanguage(back, 'ru');
    expect(docFromDraft(without).texts.ru).toBeUndefined();
    expect(doc.texts.ru).toBeDefined();
  });
});
