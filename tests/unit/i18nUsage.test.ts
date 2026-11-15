/**
 * No text reaches the screen with a placeholder in it. A person once saw "MCP state: Reading model metadata:
 * {{done}} / {{total}}": the label was translated without its numbers. This runs the translation audit
 * (support/i18nAudit.ts) over every t() call in src, checks that each text gets the values it needs and that each key
 * exists, and first proves the audit on its own fixture (fixtures/i18nAudit/cases.tsx).
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { createTranslator, en, ru } from '../../src/shared/i18n';
import { auditTranslations, placeholdersOf, type AuditStats } from './support/i18nAudit';

const SRC = path.resolve(__dirname, '../../src');
const FIXTURE = path.resolve(__dirname, 'fixtures/i18nAudit');

/** The catalog the fixture's calls are judged against: plain texts, texts with values and plural forms. */
const FIXTURE_CATALOG = {
  status: { idle: 'Idle', running: 'Running', reading: 'Reading: {{done}} / {{total}}', hint: 'Set the address first' },
  menu: { file: 'File', edit: 'Edit' },
  day: { today: 'Today, {{time}}', yesterday: 'Yesterday, {{time}}' },
  section: { nodes: 'Nodes', models: 'Models' },
  kind: { lora: 'LoRA', other: 'Other' },
  greeting: { named: 'Hello, {{name}}', plain: 'Hello' },
  items_one: '{{count, number}} item',
  items_other: '{{count, number}} items',
};

describe('the translation audit itself', () => {
  it('reads the values a text needs', () => {
    expect(placeholdersOf('Reading: {{done}} / {{total}}')).toEqual(['done', 'total']);
    expect(placeholdersOf('{{count, number}} items in {{ folder }}')).toEqual(['count', 'folder']);
    expect(placeholdersOf('No values here')).toEqual([]);
  });

  it('judges every case of its fixture as marked', () => {
    const file = path.join(FIXTURE, 'cases.tsx');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    // What each line is marked with: "// kind" after the call, or nothing.
    const expected = new Map<number, string>();
    lines.forEach((text, index) => {
      const mark = /\/\/ (unknown-key|missing-values|dynamic-needs-values|empty-value|unresolved)\s*$/.exec(text);
      if (mark) expected.set(index + 1, mark[1]);
    });
    expect(expected.size).toBeGreaterThanOrEqual(12);

    const stats: AuditStats = { calls: 0, followed: 0 };
    const findings = auditTranslations(FIXTURE, [FIXTURE_CATALOG], () => false, stats);
    const found = new Map(findings.map((finding) => [finding.line, finding.kind]));
    expect([...found.entries()].sort((a, b) => a[0] - b[0])).toEqual([...expected.entries()].sort((a, b) => a[0] - b[0]));
    // The reported bug, in the audit's own words.
    const bug = findings.find((finding) => finding.code === 't(view.labelKey)');
    expect(bug?.detail).toContain('"status.reading"');
    expect(bug?.detail).toContain('{{done}}');
    expect(stats.calls).toBeGreaterThan(25);
    expect(stats.followed).toBeGreaterThan(8);
  }, 60_000);
});

describe('every translated text in the app', () => {
  it('gets the values it needs, and every key exists', () => {
    const stats: AuditStats = { calls: 0, followed: 0 };
    // The catalog itself is skipped: it defines the texts, it does not call t().
    const findings = auditTranslations(SRC, [en, ru], (file) => file.endsWith(path.join('i18n', 'catalog.ts')), stats);
    const report = findings.map((finding) => `${finding.kind} ${finding.file}:${finding.line}\n    ${finding.code}\n    ${finding.detail}`).join('\n');
    expect(report).toBe('');
    // The audit really read the app: a change that makes it see nothing must not pass as "no findings".
    expect(stats.calls).toBeGreaterThan(900);
    expect(stats.followed).toBeGreaterThan(60);
  }, 120_000);

  it('never prints a placeholder, even if a call forgot its values', () => {
    // The static check above keeps this from happening; this is what a person would see if it happened anyway.
    const russian = createTranslator('ru');
    const forgotten = russian('sync.enriching');
    expect(forgotten).not.toContain('{{');
    expect(forgotten).toBe('Чтение метаданных моделей: … / …');
    expect(russian('sync.enriching', { done: 12 })).toBe('Чтение метаданных моделей: 12 / …');
    expect(russian('sync.enriching', { done: 12, total: 300 })).toBe('Чтение метаданных моделей: 12 / 300');
    expect(createTranslator('en')('preferences.connectionState', {})).not.toContain('{{');
  });

  it('uses the same value names in both languages', () => {
    const flat = (value: unknown, prefix = ''): Array<[string, string]> => (typeof value === 'string'
      ? [[prefix, value]]
      : Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flat(child, prefix ? `${prefix}.${key}` : key)));
    const russian = new Map(flat(ru));
    const differing: string[] = [];
    for (const [key, english] of flat(en)) {
      // Plural forms differ by language and may leave the number out where the word says it ("one item").
      if (/_(zero|one|two|few|many|other)$/.test(key)) continue;
      const left = placeholdersOf(english).sort().join(',');
      const right = placeholdersOf(russian.get(key) ?? '').sort().join(',');
      if (left !== right) differing.push(`${key}: en {${left}} ru {${right}}`);
    }
    expect(differing).toEqual([]);
  });
});
