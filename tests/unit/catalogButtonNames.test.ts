import { describe, expect, it } from 'vitest';
import { en, ru } from '../../src/shared/i18n/catalog';

/**
 * A sentence that tells a person to press a button or turn a switch names it exactly as the screen shows it, and
 * says what that control really does. Each test here pins one sentence to the label it quotes.
 */
describe('sentences that quote a control', () => {
  it('quote the connection test button by its own label after Ollama made a copy of a model', () => {
    expect(en.providers.variantMade).toContain(`“${en.preferences.check}”`);
    expect(ru.providers.variantMade).toContain(`«${ru.preferences.check}»`);
  });

  it('say that the app checks for new versions only when the switch for it is on', () => {
    expect(en.preferences.sentElsewhere).not.toMatch(/no update checks/);
    expect(ru.preferences.sentElsewhere).not.toMatch(/ни проверки обновлений/);
    expect(en.preferences.sentElsewhere).toContain(`unless you turn on “${en.updates.check}”`);
    expect(ru.preferences.sentElsewhere).toContain(`только если вы включите «${ru.updates.check}»`);
  });
});
