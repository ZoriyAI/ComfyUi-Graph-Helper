/**
 * What is forbidden is said the same way everywhere. The words live in one place (the catalog's `contentRules`);
 * these tests pin them and hold every other place that states them to that one: the Help page, the menu and button
 * names and the README. The adult content switch starts off in a new profile. A person must read one set of rules,
 * not two that disagree.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CONTENT_RULE_POINTS, contentRules, contentRulesMarkdown } from '../../src/shared/content/rules';
import { adultContentOn, parsePreferences, preferencesDefaults } from '../../src/shared/config/preferences';
import { HELP_IDS } from '../../src/shared/help/contextHelp';
import { en, ru } from '../../src/shared/i18n/catalog';

/** The repository root, where docs/wiki and the README files live. */
const root = path.join(__dirname, '..', '..');

describe('the content rules', () => {
  it('are the five points, in their order, with the sentences before and after, in both languages', () => {
    expect(CONTENT_RULE_POINTS).toEqual(['minors', 'realPeople', 'violence', 'animals', 'law']);
    expect(contentRules('ru')).toEqual({
      lead: 'Взрослые (18+) могут делать любое законное содержимое для взрослых с согласия всех участников, и приложение объясняет технику. В вашей работе этого быть не должно:',
      points: [
        'несовершеннолетние и все, кто выглядит несовершеннолетним, включая рисованных персонажей;',
        'реальные люди в откровенном содержимом; лицо и голос человека используйте только с его согласия;',
        'сексуальное насилие и принуждение;',
        'животные в откровенном содержимом;',
        'всё, что запрещено законом там, где вы живёте.',
      ],
      after: 'За то, что вы делаете и куда выкладываете, отвечаете вы: законы вашей страны и правила площадок.',
    });
    expect(contentRules('en')).toEqual({
      lead: 'Adults (18+) may make any lawful adult content with the consent of everyone involved, and the app explains the technique. Keep these out of your work:',
      points: [
        'minors and anyone who looks like a minor, drawn characters included;',
        "real people in explicit content; use a person's face or voice only with their consent;",
        'sexual violence and coercion;',
        'animals in explicit content;',
        'anything the law forbids where you live.',
      ],
      after: 'What you make and where you post it is your responsibility: the laws of your country and the rules of the sites.',
    });
    // Another interface language reads the English words.
    expect(contentRules('de')).toEqual(contentRules('en'));
  });

  it('are word for word the same on the page Help ▸ Content rules, in each language', () => {
    for (const [file, language] of [['Content-Rules.md', 'en'], ['Content-Rules.ru.md', 'ru']] as const) {
      const page = fs.readFileSync(path.join(root, 'docs', 'wiki', 'trust', file), 'utf8');
      expect(page, file).toContain(contentRulesMarkdown(language));
      // Reports go through GitHub only: no mailbox, no placeholder left.
      expect(page, file).toContain('content-rules');
      expect(page, file).not.toMatch(/TODO|@[a-z0-9-]+\.[a-z]{2,}/i);
    }
  });

  it('are called by one name wherever a button or a title opens them', () => {
    // The Help menu, the page's title and the button in My lessons use one name (helpReader.content), never a second
    // spelling.
    expect(ru.helpReader.content).toBe('Правила содержимого');
    expect(ru.lessonFiles.rulesOpen).toBe(ru.helpReader.content);
    expect(en.lessonFiles.rulesOpen).toBe(en.helpReader.content);
    expect(JSON.stringify(ru)).not.toMatch(/[Пп]равил[а-я]* о содержимом/);
  });

  it('are a page of the Help reader, and the README points to it', () => {
    expect(HELP_IDS['content-rules']).toBe('trust/Content-Rules');
    expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('docs/wiki/trust/Content-Rules.md');
    expect(fs.readFileSync(path.join(root, 'README.ru.md'), 'utf8')).toContain('docs/wiki/trust/Content-Rules.ru.md');
  });
});

describe('the switch for adult content', () => {
  it('is off in a new profile, and a profile that showed marked previews keeps it on', () => {
    expect(adultContentOn(preferencesDefaults)).toBe(false);
    expect(adultContentOn(parsePreferences({}))).toBe(false);
    expect(adultContentOn(parsePreferences({ privacy: { showMarkedPreviews: true } }))).toBe(true);
    expect(adultContentOn(null)).toBe(false);
  });
});
