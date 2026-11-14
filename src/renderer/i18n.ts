import i18next, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, ru, type AppLanguage } from '../shared/i18n';

export const i18n = i18next.createInstance();
i18n.use(initReactI18next);

let started = false;

/** What stands in for a value a text did not get: never the placeholder itself. */
export const MISSING_VALUE = '…';
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

function publish(language: AppLanguage) {
  document.documentElement.lang = language;
  document.title = String(i18n.t('shell.title'));
}

export function startI18n(language: AppLanguage) {
  if (!started) {
    started = true;
    const options: InitOptions = {
      resources: resources(),
      lng: language,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru'],
      load: 'currentOnly',
      interpolation: {
        escapeValue: false,
      },
      missingInterpolationHandler: (text: string, value: RegExpExecArray) => missingValue(text, value),
      returnNull: false,
      react: { useSuspense: false },
    };
    (options as InitOptions & { initImmediate: boolean }).initImmediate = false;
    i18n.init(options);
  } else {
    void i18n.changeLanguage(language);
  }
  publish(language);
}

export function applyLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
  const changed = i18n.changeLanguage(language);
  if (changed && typeof (changed as Promise<unknown>).then === 'function') {
    void (changed as Promise<unknown>).then(() => publish(language));
    return;
  }
  publish(language);
}
