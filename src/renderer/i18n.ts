import i18next, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, ru, type AppLanguage } from '../shared/i18n';

export const i18n = i18next.createInstance();
i18n.use(initReactI18next);

let started = false;

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
