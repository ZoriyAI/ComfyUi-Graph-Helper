/**
 * A small lesson document that holds together (a loader feeding a sampler, a file chosen, a number in a range), for
 * the tests of lesson files: the format, the store in the profile, the editor and the assistant's draft tool.
 */

import type { LessonDoc } from '../../../src/shared/lessons/files/format';

/** A small lesson that holds together: a loader feeding a sampler, its file chosen. */
export function sampleDoc(overrides: Partial<LessonDoc> = {}): LessonDoc {
  return {
    id: 'my-first',
    texts: {
      en: {
        title: 'A first lesson',
        result: 'A loader that feeds a sampler.',
        steps: {
          intro: { title: 'What this is', body: 'We connect two nodes.' },
          loader: { title: 'Add a loader', body: 'Add {checkpoint} and choose a file.' },
          sampler: { title: 'Add a sampler', body: 'Add {sampler} and connect `MODEL` to `model`.' },
        },
      },
    },
    steps: [
      { id: 'intro', read: true },
      { id: 'loader', roles: [{ role: 'checkpoint', classes: ['CheckpointLoaderSimple'] }], fields: [{ role: 'checkpoint', field: 'ckpt_name', test: { kind: 'chosen' } }] },
      { id: 'sampler', roles: [{ role: 'sampler', classes: ['KSampler'] }], links: [{ from: 'checkpoint', output: 'MODEL', to: 'sampler', input: 'model' }], fields: [{ role: 'sampler', field: 'steps', test: { kind: 'between', min: 10, max: 30, prefer: 20 } }] },
    ],
    ...overrides,
  };
}

