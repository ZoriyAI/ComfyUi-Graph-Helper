import { describe, expect, it } from 'vitest';
import type { GraphCheckReport, PromptNote } from '../../src/shared/contracts';
import { createTranslator } from '../../src/shared/i18n';
import { placeholdersOf } from './support/i18nAudit';
import { en, ru } from '../../src/shared/i18n';
import { adviceOf, checkFindingCount, groupCheckReport, nodeNamer } from '../../src/renderer/components/check/checkModel';

/** One note of every kind, shaped as the check makes them. */
const NOTES: PromptNote[] = [
  { kind: 'lora-tag', nodeId: '2', classType: 'CLIPTextEncode', found: '<lora:neon:0.8>' },
  { kind: 'foreign-syntax', nodeId: '2', classType: 'CLIPTextEncode', found: 'BREAK' },
  { kind: 'unbalanced', nodeId: '2', classType: 'CLIPTextEncode', found: '', numbers: { open: 2, close: 1 } },
  { kind: 'weight-high', nodeId: '2', classType: 'CLIPTextEncode', found: '(rain:1.9)' },
  { kind: 'weight-ignored', nodeId: '2', classType: 'CLIPTextEncode', found: '(camera:1.3)' },
  { kind: 'negative-ignored', nodeId: '3', classType: 'CLIPTextEncode', found: '', numbers: { cfg: 1 }, samplerId: '4' },
  { kind: 'empty-positive', nodeId: '2', classType: 'CLIPTextEncode', found: '', samplerId: '4' },
  { kind: 'contradiction', nodeId: '2', classType: 'CLIPTextEncode', found: 'film grain, soft light' },
  { kind: 'negation', nodeId: '2', classType: 'CLIPTextEncode', found: 'without' },
  { kind: 'not-english', nodeId: '2', classType: 'CLIPTextEncode', found: '' },
  { kind: 'too-long', nodeId: '2', classType: 'CLIPTextEncode', found: 'clip', numbers: { tokens: 212 } },
  { kind: 'too-long', nodeId: '2', classType: 'CLIPTextEncode', found: 't5', numbers: { tokens: 505 } },
  { kind: 'missing-trigger', nodeId: '5', classType: 'LoraLoader', found: '', model: 'neon.safetensors', words: ['neon rain', 'wet glass'] },
];

const REPORT: GraphCheckReport = {
  ok: true,
  missingNodes: [],
  missingModels: [],
  typeMismatches: [],
  baseModelMismatches: [],
  unconnectedRequiredInputs: [],
  unknownNodeTypes: [],
  unsetWidgets: [],
  promptNotes: NOTES,
};

const NAMES = nodeNamer([
  { id: '2', data: { title: 'What I want', comfyType: 'CLIPTextEncode' } },
  { id: '3', data: { title: 'What I do not want', comfyType: 'CLIPTextEncode' } },
  { id: '4', data: { title: '', comfyType: 'KSampler' } },
  { id: '5', data: { title: 'Neon LoRA', comfyType: 'LoraLoader' } },
]);

function leaf(catalog: unknown, key: string): string {
  let value: unknown = catalog;
  for (const part of key.split('.')) value = (value as Record<string, unknown> | undefined)?.[part];
  return typeof value === 'string' ? value : '';
}

describe('advice about the descriptions of a graph', () => {
  it('is one row for each note, never a problem, and never counted as one', () => {
    const rows = adviceOf(REPORT, NAMES);
    expect(rows).toHaveLength(NOTES.length);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.every((row) => row.type === 'promptNotes')).toBe(true);
    // A graph with advice only is a graph without problems.
    expect(checkFindingCount(REPORT)).toBe(0);
    expect(groupCheckReport(REPORT)).toEqual([]);
    // Each row points at the node it is about.
    expect(rows[0].ref).toEqual({ kind: 'node', id: '2', classType: 'CLIPTextEncode' });
    expect(rows[rows.length - 1].ref).toEqual({ kind: 'node', id: '5', classType: 'LoraLoader' });
    // A report from before the advice existed has none.
    expect(adviceOf({ ...REPORT, promptNotes: undefined })).toEqual([]);
  });

  it('gives every sentence every value it needs, in both languages', () => {
    const rows = adviceOf(REPORT, NAMES);
    for (const [language, catalog] of [['en', en], ['ru', ru]] as const) {
      const t = createTranslator(language);
      for (const row of rows) {
        const template = leaf(catalog, row.textKey);
        expect(template, `${language} ${row.textKey}`).not.toBe('');
        for (const name of placeholdersOf(template)) expect(row.values[name], `${language} ${row.textKey} needs {{${name}}}`).toBeTruthy();
        const text = t(row.textKey, row.values);
        expect(text, row.textKey).not.toContain('{{');
        expect(text.length, row.textKey).toBeGreaterThan(40);
      }
    }
  });

  it('names nodes as the person sees them and says the numbers plainly', () => {
    const rows = adviceOf(REPORT, NAMES);
    const english = createTranslator('en');
    const text = (kind: string, index = 0) => english(rows.filter((row) => row.key.includes(`:${kind}:`))[index].textKey, rows.filter((row) => row.key.includes(`:${kind}:`))[index].values);
    expect(text('lora-tag')).toContain('The prompt in “What I want” contains <lora:neon:0.8>.');
    expect(text('unbalanced')).toContain('2 opening, 1 closing');
    // A node without a title is called by its class.
    expect(text('negative-ignored')).toContain('The sampler “KSampler” has cfg 1');
    expect(text('negative-ignored')).toContain('The text in “What I do not want” changes nothing now.');
    expect(text('too-long', 0)).toContain('about 212 tokens. This model reads text in chunks of 75 tokens');
    expect(text('too-long', 1)).toContain('about 505 tokens. Its end may not fit');
    expect(text('missing-trigger')).toContain('The LoRA neon.safetensors is switched on by its own words, and the prompt has none of them: neon rain, wet glass.');
    const russian = createTranslator('ru');
    expect(russian(rows[0].textKey, rows[0].values)).toContain('В промпте ноды «What I want» стоит запись <lora:neon:0.8>.');
  });
});
