/** Public content export must follow application data and have verifiable content hashes. */
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LESSONS } from '../../src/shared/lessons/lessons';
import { builtinLessonDoc } from '../../src/shared/lessons/share/builtin';
import { GUIDE_PROBLEMS } from '../../src/shared/guidance/catalog';
import { BLUEPRINTS } from '../../src/shared/templates/catalog';
import distribution from '../../src/shared/product/distribution.json';
import pkg from '../../package.json';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- The build helper is also a standalone CommonJS script.
const { createProductManifest } = require('../../scripts/lib/product-manifest');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

it('exports the built application catalogue with full bilingual lessons, guide steps and exact hashes', () => {
  const manifest = createProductManifest({ pkg, source: { revision: 'test', modified: true }, distribution,
    lessons: LESSONS.map(x => builtinLessonDoc(x.id)), guides: GUIDE_PROBLEMS, blueprints: BLUEPRINTS });
  expect(manifest.sha256).toBe(digest(manifest.payload));
  expect(manifest.payload.lessons.map((x: { id: string }) => x.id)).toEqual(LESSONS.map(x => x.id));
  expect(manifest.payload.guides.map((x: { id: string }) => x.id)).toEqual(GUIDE_PROBLEMS.map(x => x.id));
  expect(manifest.payload.blueprints.map((x: { id: string }) => x.id)).toEqual(BLUEPRINTS.map(x => x.id));
  for (const item of [...manifest.payload.lessons, ...manifest.payload.guides]) expect(item.sha256).toBe(digest(item.document));
  for (const item of manifest.payload.lessons) {
    expect(item.document.standard).toBe(2);
    expect(item.document.texts.ru.title).toBeTruthy(); expect(item.document.texts.en.title).toBeTruthy();
  }
  expect(Object.keys(manifest.payload).sort()).toEqual(['schema', 'product', 'version', 'repository', 'source', 'distribution', 'lessons', 'guides', 'blueprints'].sort());
  expect(manifest.payload.distribution['windows-x64'].delivery).toBe('source-install-script');
  expect(manifest.payload.distribution['macos-arm64-x64'].signing).toBe('unsigned-not-notarized');
  const changed = JSON.parse(JSON.stringify(manifest.payload)); changed.lessons[0].document.texts.ru.title += '!';
  expect(digest(changed)).not.toBe(manifest.sha256);
});
