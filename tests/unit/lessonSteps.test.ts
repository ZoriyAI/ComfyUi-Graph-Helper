/**
 * The steps a person answers (shared/lessons/steps.ts) as the engine (engine.ts lessonProgress, lessonOutcomes) and
 * the schema (schema.ts) treat them: a checklist done by ticks or by the app's own checks, a rubric with and without a
 * passing level, a quiz that is done once answered right or wrong, a read-check from what the app already reads, a
 * transfer task, the three outcomes with who stands behind each, and the lesson state that keeps the answers. A person
 * must never be held on a step they cannot finish, and the app must never claim to have checked what it did not.
 */
import { describe, expect, it } from 'vitest';
import { lessonOutcomes, lessonProgress, type Lesson, type LessonGraph } from '../../src/shared/lessons/engine';
import { SELF_CHECK, TICK, answerAll, itemState, personStepDone, readVerdict, stepKind, type ReadFacts } from '../../src/shared/lessons/steps';
import { lessonProblems, lessonRuleProblems, lessonStandardProblems, lessonWordsProblems } from '../../src/shared/lessons/schema';
import { useLessonStore } from '../../src/renderer/state/lessonState';

const EMPTY: LessonGraph = { nodes: [], links: [] };
const node = (id: string, classType: string) => ({ id, classType, inputs: [], outputs: [], values: {} });
const GRAPH: LessonGraph = { nodes: [node('1', 'KSampler'), node('2', 'SaveImage'), node('3', 'GeminiImageNode')], links: [] };
const INSTALLED = new Set(['KSampler', 'SaveImage', 'GeminiImageNode']);
const READ: ReadFacts = {
  catalogRead: true,
  installed: (classType) => INSTALLED.has(classType),
  partner: (classType) => classType === 'GeminiImageNode',
  models: { checkpoints: ['sd_xl_base_1.0.safetensors'], loras: [] },
  openedFrom: 'picture',
};

/** A small lesson with one step of every kind: read, checklist, canvas, read-check, rubric, quiz, transfer. */
const LESSON: Lesson = {
  id: 'probe',
  outcomes: ['structure', 'run', 'result'],
  steps: [
    { id: 'intro', read: true },
    { id: 'ready', checklist: [{ id: 'comfy', check: { kind: 'comfy-read' } }, { id: 'note' }, { id: 'extra', optional: true }] },
    { id: 'graph', roles: [{ role: 'sampler', classes: ['KSampler'] }] },
    { id: 'check', readCheck: [{ kind: 'workflow-size', min: 1 }, { kind: 'workflow-from', from: 'picture' }] },
    { id: 'run', checklist: [{ id: 'ran', run: true }] },
    { id: 'assess', rubric: [{ id: 'fit', levels: ['no', 'partly', 'yes'] }, { id: 'blind', levels: ['no', 'yes'], pass: 'yes' }] },
    { id: 'recall', quiz: [{ id: 'q', choices: ['a', 'b'], answer: 'b' }] },
    { id: 'own', transfer: true, checklist: [{ id: 'did' }] },
  ],
};
const SAMPLER: LessonGraph = { nodes: [node('1', 'KSampler')], links: [] };

describe('the kinds of a step', () => {
  it('tells each kind by the key it carries', () => {
    expect(LESSON.steps.map(stepKind)).toEqual(['read', 'checklist', 'canvas', 'read-check', 'checklist', 'rubric', 'quiz', 'checklist']);
  });
});

describe('a read-check', () => {
  it('holds, fails or cannot tell, from what the app already knows', () => {
    expect(readVerdict({ kind: 'comfy-read' }, EMPTY, READ)).toBe('holds');
    expect(readVerdict({ kind: 'comfy-read' }, EMPTY, { catalogRead: false })).toBe('unknown');
    expect(readVerdict({ kind: 'node-class', classes: ['Missing', 'KSampler'] }, EMPTY, READ)).toBe('holds');
    expect(readVerdict({ kind: 'node-class', classes: ['Missing'] }, EMPTY, READ)).toBe('fails');
    expect(readVerdict({ kind: 'node-class', classes: ['Missing'] }, EMPTY, { ...READ, installed: () => null })).toBe('unknown');
    expect(readVerdict({ kind: 'model-file', folder: 'checkpoints' }, EMPTY, READ)).toBe('holds');
    expect(readVerdict({ kind: 'model-file', folder: 'checkpoints', words: ['XL'] }, EMPTY, READ)).toBe('holds');
    expect(readVerdict({ kind: 'model-file', folder: 'checkpoints', words: ['flux'] }, EMPTY, READ)).toBe('fails');
    expect(readVerdict({ kind: 'model-file', folder: 'loras' }, EMPTY, READ)).toBe('fails');
    // A folder the last sync did not list is not known, never "empty".
    expect(readVerdict({ kind: 'model-file', folder: 'vae' }, EMPTY, READ)).toBe('unknown');
    expect(readVerdict({ kind: 'workflow-complete' }, GRAPH, READ)).toBe('holds');
    expect(readVerdict({ kind: 'workflow-complete' }, { nodes: [node('1', 'Gone')], links: [] }, READ)).toBe('fails');
    expect(readVerdict({ kind: 'workflow-complete' }, EMPTY, READ)).toBe('fails');
    expect(readVerdict({ kind: 'workflow-size', max: 2 }, GRAPH, READ)).toBe('fails');
    expect(readVerdict({ kind: 'workflow-size', min: 1, max: 3 }, GRAPH, undefined)).toBe('holds');
    expect(readVerdict({ kind: 'workflow-from', from: 'picture' }, EMPTY, READ)).toBe('holds');
    expect(readVerdict({ kind: 'workflow-from', from: 'api' }, EMPTY, READ)).toBe('fails');
    expect(readVerdict({ kind: 'workflow-from', from: 'api' }, EMPTY, { catalogRead: true })).toBe('unknown');
    expect(readVerdict({ kind: 'workflow-partner', present: true }, GRAPH, READ)).toBe('holds');
    expect(readVerdict({ kind: 'workflow-partner', present: false }, GRAPH, READ)).toBe('fails');
    expect(readVerdict({ kind: 'workflow-partner', present: false }, SAMPLER, READ)).toBe('holds');
  });

  it('is done when every condition holds, or on the person\'s word while the app cannot tell, never against a failure', () => {
    const step = LESSON.steps[3];
    expect(personStepDone(step, {}, GRAPH, READ)).toBe(true);
    expect(personStepDone(step, {}, GRAPH, { catalogRead: false })).toBe(false);
    expect(personStepDone(step, { [SELF_CHECK]: TICK }, GRAPH, { catalogRead: false })).toBe(true);
    expect(personStepDone(step, { [SELF_CHECK]: TICK }, EMPTY, READ)).toBe(false);
  });
});

describe('a checklist', () => {
  const step = LESSON.steps[1];
  it('counts a tick as the person\'s word and a check as the app\'s; a failing check is not overruled by a tick', () => {
    const [comfy, note] = step.checklist!;
    expect(itemState(comfy, undefined, EMPTY, READ)).toEqual({ done: true, by: 'app', verdict: 'holds' });
    expect(itemState(comfy, TICK, EMPTY, { catalogRead: false })).toEqual({ done: true, by: 'self', verdict: 'unknown' });
    expect(itemState({ id: 'x', check: { kind: 'model-file', folder: 'loras' } }, TICK, EMPTY, READ)).toEqual({ done: false, by: null, verdict: 'fails' });
    expect(itemState(note, TICK, EMPTY, READ)).toEqual({ done: true, by: 'self', verdict: null });
  });

  it('is done when every required item is done; an optional one is never in the way', () => {
    expect(personStepDone(step, {}, EMPTY, READ)).toBe(false);
    expect(personStepDone(step, { note: TICK }, EMPTY, READ)).toBe(true);
    expect(personStepDone(step, { note: TICK }, EMPTY, { catalogRead: false })).toBe(false);
  });
});

describe('a rubric and a quiz', () => {
  it('records the levels; a criterion with a passing level holds the step until it is reached', () => {
    const step = LESSON.steps[5];
    expect(personStepDone(step, { fit: 'no' }, EMPTY, undefined)).toBe(false);
    expect(personStepDone(step, { fit: 'no', blind: 'no' }, EMPTY, undefined)).toBe(false);
    expect(personStepDone(step, { fit: 'no', blind: 'yes' }, EMPTY, undefined)).toBe(true);
    expect(personStepDone(step, { fit: 'nonsense', blind: 'yes' }, EMPTY, undefined)).toBe(false);
  });

  it('takes a wrong answer as an answer: the explanation shows and the lesson goes on', () => {
    const step = LESSON.steps[6];
    expect(personStepDone(step, {}, EMPTY, undefined)).toBe(false);
    expect(personStepDone(step, { q: 'a' }, EMPTY, undefined)).toBe(true);
    expect(personStepDone(step, { q: 'c' }, EMPTY, undefined)).toBe(false);
    expect(answerAll(step)).toEqual({ q: 'b' });
  });
});

describe('the engine with the steps a person answers', () => {
  it('stops at each until it is answered, and never asks the canvas for them', () => {
    const read = new Set(['intro']);
    const at = (answers: Record<string, Record<string, string>>, graph = SAMPLER, facts: ReadFacts = READ) => LESSON.steps[lessonProgress(LESSON, graph, { read: facts }, read, answers).current]?.id ?? 'end';
    expect(at({})).toBe('ready');
    expect(lessonProgress(LESSON, SAMPLER, { read: READ }, read, {}).missing).toEqual([]);
    expect(at({ ready: { note: TICK } })).toBe('run');
    // The read-check holds (one node on the canvas, opened from a picture) without any answer.
    expect(at({ ready: { note: TICK }, run: { ran: TICK } })).toBe('assess');
    const all = Object.fromEntries(LESSON.steps.map((step) => [step.id, answerAll(step)]));
    expect(at(all)).toBe('end');
    // The canvas step still holds the lesson back when its node is gone.
    expect(at(all, EMPTY)).toBe('graph');
  });

  it('says truthfully which outcome the app checked and which is the person\'s own word', () => {
    const read = new Set(['intro']);
    const states = (answers: Record<string, Record<string, string>>, graph: LessonGraph, facts: ReadFacts) => {
      const progress = lessonProgress(LESSON, graph, { read: facts }, read, answers);
      return Object.fromEntries(lessonOutcomes(LESSON, progress, answers, graph, { read: facts }).map((item) => [item.outcome, item.state]));
    };
    expect(states({}, EMPTY, READ)).toEqual({ structure: 'open', run: 'open', result: 'open' });
    const all = Object.fromEntries(LESSON.steps.map((step) => [step.id, answerAll(step)]));
    expect(states(all, SAMPLER, READ)).toEqual({ structure: 'app', run: 'self', result: 'self' });
    // A run item the app can check counts as checked by the app.
    const checked: Lesson = { ...LESSON, steps: LESSON.steps.map((step) => (step.id === 'run' ? { ...step, checklist: [{ id: 'ran', run: true, check: { kind: 'comfy-read' } }] } : step)) };
    const progress = lessonProgress(checked, SAMPLER, { read: READ }, read, all);
    expect(lessonOutcomes(checked, progress, all, SAMPLER, { read: READ }).find((item) => item.outcome === 'run')?.state).toBe('app');
    // A lesson that declares nothing has only "structure checked", as every lesson of version 1.0.
    expect(lessonOutcomes({ id: 'old', steps: [{ id: 'a', roles: [{ role: 'x', classes: ['KSampler'] }] }] }, { current: 1, roles: {}, missing: [] }, {}, SAMPLER, {})).toEqual([{ outcome: 'structure', state: 'app' }]);
  });
});

describe('the rules of these steps', () => {
  it('passes a well-made lesson', () => {
    expect(lessonProblems(LESSON, [LESSON], {}, new Set())).toEqual([]);
  });

  it('names what an author gets wrong', () => {
    const broken: Lesson = {
      id: 'broken',
      outcomes: ['structure', 'run', 'result'],
      meta: { prerequisites: ['nowhere'], checkedOn: '15.11.2026' },
      steps: [
        { id: 'a', read: true, checklist: [{ id: 'x' }] },
        { id: 'b', checklist: [] },
        { id: 'c', rubric: [{ id: 'one', levels: ['only'] }, { id: 'two', levels: ['no', 'yes'], pass: 'maybe' }] },
        { id: 'd', quiz: [{ id: 'q', choices: ['a', 'a'], answer: 'a' }, { id: 'q2', choices: ['a', 'b'], answer: 'z' }] },
        { id: 'e', transfer: true, quiz: [{ id: 'q', choices: ['a', 'b'], answer: 'a' }] },
        { id: 'f', checklist: [{ id: 'same' }, { id: 'same' }] },
      ],
    };
    expect(lessonRuleProblems(broken, [broken], {}, new Set()).map((problem) => `${problem.code}${problem.step ? `:${problem.step}` : ''}${problem.name ? `:${problem.name}` : ''}`)).toEqual([
      'step-kinds:a',
      'list-size:b',
      'levels:c:one',
      'pass-level:c:two',
      'choices:d:q',
      'choices:d:q2',
      'transfer-kind:e',
      'item-twice:f:same',
      'prerequisite:nowhere',
      'checked-on',
      'outcome-structure',
      'outcome-run',
    ]);
  });

  it('asks for the words of every item, criterion and question in each language a lesson has', () => {
    const words = {
      en: { title: 'Probe', result: 'A probe.', steps: { ready: { title: 'Ready', body: '', items: { comfy: { label: 'Read' } } }, recall: { title: 'Q', body: '', questions: { q: { text: 'Which?', choices: { a: 'A' }, explain: 'Because.' } } } } },
    };
    expect(lessonWordsProblems(LESSON, words).map((problem) => `${problem.code}:${problem.name}:${problem.language}`)).toEqual([
      'words-item:note:en', 'words-item:extra:en', 'words-item:ran:en', 'words-criterion:fit:en', 'words-criterion:blind:en', 'words-question:q:en', 'words-item:did:en',
    ]);
  });

  it('holds a lesson of standard 2 to the template, and leaves a lesson of standard 1 alone', () => {
    expect(lessonStandardProblems(LESSON, { en: { title: 't', result: 'r', steps: {} } })).toEqual([]);
    const strict: Lesson = { ...LESSON, standard: 2, steps: LESSON.steps.filter((step) => !step.quiz && !step.transfer) };
    expect(lessonStandardProblems(strict, { en: { title: 't', result: 'r', steps: {}, meta: { skill: 'One thing.', mistakes: [{ sign: 'a', fix: 'b' }] } } }).map((problem) => problem.code)).toEqual([
      'standard-versions', 'standard-quiz', 'standard-transfer', 'standard-requires', 'standard-mistakes', 'standard-provenance', 'standard-not-checked',
    ]);
  });
});

describe('the answers in the lesson state', () => {
  it('keeps, takes back and clears answers, and starting over clears them with the outcomes', () => {
    useLessonStore.setState({ active: '', read: {}, done: [], answers: {}, outcomes: {} });
    const state = () => useLessonStore.getState();
    state().answer('one-factor', 'ready', 'question', TICK);
    state().answer('one-factor', 'assess', 'difference', 'partly');
    expect(state().answers['one-factor']).toEqual({ ready: { question: TICK }, assess: { difference: 'partly' } });
    state().answer('one-factor', 'ready', 'question', null);
    expect(state().answers['one-factor'].ready).toEqual({});
    state().clearAnswers('one-factor', 'assess');
    expect(state().answers['one-factor']).toEqual({ ready: {} });
    state().setOutcomes('one-factor', ['result', 'structure']);
    expect(state().outcomes['one-factor']).toEqual(['result', 'structure']);
    state().again('one-factor');
    expect(state().answers['one-factor']).toBeUndefined();
    expect(state().outcomes['one-factor']).toBeUndefined();
  });
});
