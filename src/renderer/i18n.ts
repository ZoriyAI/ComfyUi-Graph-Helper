/**
 * The renderer's single i18next instance and the two ways to set its language. index.tsx calls startI18n once at
 * boot; SettingsPanel, AppearanceSection and the preferences commands (commands/actions.ts) call applyLanguage when
 * a person switches language. Services and components that build text outside React import `i18n` directly.
 * The catalogs themselves live in src/shared/i18n so main and the renderer share them.
 */
import i18next, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, ru, NAME_VALUES, type AppLanguage } from '../shared/i18n';
import { pseudoText } from '../shared/i18n/pseudo';

/** A private instance, not the i18next global, so tests and other bundles cannot change the app's language. */
export const i18n = i18next.createInstance();
i18n.use(initReactI18next);

// Only the first startI18n call initialises; a later call just switches the language.
let started = false;

/** What stands in for a value a text did not get: never the placeholder itself. */
export const MISSING_VALUE = '…';
// Each missing value is logged once per text, so a text rendered in a loop does not flood the log.
const reported = new Set<string>();

/**
 * A text was shown without one of its values. The static check (tests/unit/i18nUsage.test.ts) keeps this from
 * happening; if it happens anyway, a person sees "…" instead of "{{done}}", and the place is written to the log
 * once so it can be found.
 */
function missingValue(text: string, value: RegExpExecArray | string[]): string {
  const name = String(value?.[0] ?? '');
  const key = `${name}|${text}`;
  if (!reported.has(key)) {
    reported.add(key);
    const message = `[i18n] A text was shown without its value ${name}: "${text.slice(0, 160)}"`;
    console.error(message);
    try {
      void window.electronAPI?.reportRendererError?.({ kind: 'error', message })?.catch(() => undefined);
    } catch {
      // Outside the app window (a test page) there is no main process to tell.
    }
  }
  return MISSING_VALUE;
}

function resources() {
  return {
    en: { translation: en },
    ru: { translation: ru },
  };
}

/** Puts the language on <html lang> (screen readers, hyphenation) and the translated product name in the title. */
function publish(language: AppLanguage) {
  document.documentElement.lang = language;
  document.title = String(i18n.t('shell.title'));
}

/** Layout tests only (main passes --pseudo-locale=1 to an unpackaged run): every text 40 % longer. */
function pseudoWanted(): boolean {
  try {
    return (window as unknown as { electronAPI?: { flags?: { pseudoLocale?: boolean } } }).electronAPI?.flags?.pseudoLocale === true;
  } catch {
    return false;
  }
}

/** Starts i18n at boot with the saved language; called by index.tsx before the first render. */
export function startI18n(language: AppLanguage) {
  if (!started) {
    started = true;
    if (pseudoWanted()) i18n.use({ type: 'postProcessor', name: 'pseudo', process: (value: string) => pseudoText(value) });
    const options: InitOptions = {
      resources: resources(),
      lng: language,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru'],
      load: 'currentOnly',
      interpolation: {
        escapeValue: false,
        // The product's name in every text ({{app}}, {{appShort}}): see NAME_VALUES.
        defaultVariables: NAME_VALUES,
      },
      missingInterpolationHandler: (text: string, value: RegExpExecArray) => missingValue(text, value),
      returnNull: false,
      react: { useSuspense: false },
      ...(pseudoWanted() ? { postProcess: ['pseudo'] } : {}),
    };
    // The first render must already have its texts: init is synchronous because the resources are passed inline.
    i18n.init(options);
  } else {
    void i18n.changeLanguage(language);
  }
  publish(language);
}

/**
 * Switches the running app to another language. changeLanguage may return a promise or not, depending on whether
 * the catalog is already loaded, so the title is published after it settles in either case.
 */
export function applyLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
  const changed = i18n.changeLanguage(language);
  if (changed && typeof (changed as Promise<unknown>).then === 'function') {
    void (changed as Promise<unknown>).then(() => publish(language));
    return;
  }
  publish(language);
}
