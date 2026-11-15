import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CONTENT_RULE_POINTS, contentRules, contentRulesMarkdown } from '../../src/shared/content/rules';
import { adultContentOn, parsePreferences, preferencesDefaults } from '../../src/shared/config/preferences';
import { helpFile } from '../../src/main/ipc/aboutIpc';
import { HELP_TOPICS } from '../../src/shared/contracts/about';

const root = path.join(__dirname, '..', '..');

/**
 * What is forbidden is said the same way everywhere. The words live in one place (the catalog's `contentRules`);
 * these tests pin them and hold every other place that states them to that one.
 */
describe('the content rules', () => {
  it('are the five points, in their order, with the sentences before and after, in both languages', () => {
    expect(CONTENT_RULE_POINTS).toEqual(['minors', 'realPeople', 'violence', 'animals', 'law']);
    expect(contentRules('ru')).toEqual({
      lead: 'Взрослые могут делать любое законное содержимое для взрослых, и приложение учит технике. С этим приложение не помогает никогда и этому не учит:',
      points: [
        'несовершеннолетние и все, кто выглядит несовершеннолетним, включая рисованных персонажей;',
        'реальные люди в откровенном содержимом; лицо и голос человека только с его согласия;',
        'сексуальное насилие и принуждение;',
        'животные в откровенном содержимом;',
        'всё, что запрещено законом там, где вы живёте.',
      ],
      after: 'За то, что вы делаете и куда выкладываете, отвечаете вы: законы вашей страны и правила площадок.',
    });
    expect(contentRules('en')).toEqual({
      lead: 'Adults may make any legal adult content, and the app teaches the technique. The app never helps with these and never teaches them:',
      points: [
        'minors and anyone who looks like a minor, drawn characters included;',
        "real people in explicit content; a person's face and voice only with their consent;",
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
    for (const [file, language] of [['CONTENT.md', 'en'], ['CONTENT.ru.md', 'ru']] as const) {
      const page = fs.readFileSync(path.join(root, 'docs', file), 'utf8');
      expect(page, file).toContain(contentRulesMarkdown(language));
      // The place for the contact is marked, so it cannot ship unnoticed as if it were filled in.
      expect(page, file).toMatch(/TODO/);
    }
  });

  it('are bundled with the app as a page of Help', () => {
    expect(HELP_TOPICS).toContain('content');
    expect(helpFile('/d', 'content', 'en')).toEqual([path.join('/d', 'help', 'content.en.md'), path.join('/d', 'help', 'content.ru.md')]);
    const script = fs.readFileSync(path.join(root, 'scripts', 'build-assets.js'), 'utf8');
    expect(script).toContain("['CONTENT.md', 'content.en.md']");
    expect(script).toContain("['CONTENT.ru.md', 'content.ru.md']");
    // The README points to the page.
    expect(fs.readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('docs/CONTENT.ru.md');
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
